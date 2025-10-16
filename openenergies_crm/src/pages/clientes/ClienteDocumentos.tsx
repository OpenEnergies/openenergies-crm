import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link, useParams } from '@tanstack/react-router';
import { Folder, File, Upload, FolderPlus, Trash2, Download } from 'lucide-react';
import { clienteDocumentosRoute } from '@router/routes'; // <-- Ahora la importación funciona
import { useState, useMemo } from 'react';
import { useSession } from '@hooks/useSession';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Añade useMutation y useQueryClient
import ClienteDocumentoUploadModal from './ClienteDocumentoUploadModal';


// Función para listar archivos y carpetas
async function listFiles(clienteId: string, path: string) {
  const fullPath = `clientes/${clienteId}/${path}`;
  const { data, error } = await supabase.storage.from('documentos').list(fullPath, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  return data.filter(item => item.name !== '.emptyFolderPlaceholder');
}

// Componente para los Breadcrumbs (corregido)
function Breadcrumbs({ clienteId, path }: { clienteId: string, path: string }) {
  const segments = path.split('/').filter(Boolean);

  return (
    <nav className="breadcrumbs">
      <Link 
        to={clienteDocumentosRoute.to} 
        params={{ id: clienteId, _splat: '' }}
      >
        Documentos
      </Link>
      {segments.map((segment, index) => {
        const currentPath = segments.slice(0, index + 1).join('/');
        return (
          <span key={index}>
            / <Link 
                to={clienteDocumentosRoute.to} 
                params={{ id: clienteId, _splat: currentPath }}
              >
                {segment}
              </Link>
          </span>
        );
      })}
    </nav>
  );
}

// --- NUEVA FUNCIÓN para crear la carpeta ---
async function createFolder({ clienteId, path, folderName }: { clienteId: string; path: string; folderName: string }) {
  // Limpiamos el nombre de la carpeta para evitar caracteres problemáticos
  const safeFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = `clientes/${clienteId}/${path ? `${path}/` : ''}${safeFolderName}/.emptyFolderPlaceholder`;
  // Subimos un archivo vacío para crear la ruta/carpeta
  const { error } = await supabase.storage.from('documentos').upload(fullPath, new Blob());
  if (error) throw error;
}

export default function ClienteDocumentos() {
  // useParams corregido para usar el nombre de parámetro '$'
  const { id: clienteId, _splat: path } = useParams({ from: clienteDocumentosRoute.id });
  const queryClient = useQueryClient();
  const { rol } = useSession();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // <-- NUEVO
  const [newFolderName, setNewFolderName] = useState('');

  // --- LÓGICA DE PERMISOS ---
  const isAdmin = rol === 'administrador';
  // El cliente puede ver y descargar, pero no crear ni eliminar
  const canUpload = isAdmin;
  const canCreateFolder = isAdmin;
  const canDelete = isAdmin;

  const { data: files, isLoading, isError } = useQuery({
    queryKey: ['documentos', clienteId, path],
    queryFn: () => listFiles(clienteId, path || ''), // Aseguramos que path no sea undefined
  });

  // --- NUEVA MUTACIÓN para crear la carpeta ---
  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      // Refresca la lista de archivos para mostrar la nueva carpeta
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, path] });
      setIsFolderModalOpen(false); // Cierra el modal
      setNewFolderName(''); // Limpia el input
      alert('Carpeta creada con éxito.');
    },
    onError: (error: Error) => {
      alert(`Error al crear la carpeta: ${error.message}`);
    }
  });

  // --- NUEVA MUTACIÓN PARA ELIMINAR ---
  const deleteMutation = useMutation({
    mutationFn: async (filePath: string) => {
        // La función de Supabase puede eliminar un array de ficheros/carpetas
        const { error } = await supabase.storage.from('documentos').remove([filePath]);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, path] });
        alert('Elemento eliminado con éxito.');
    },
    onError: (error: Error) => {
        alert(`Error al eliminar: ${error.message}`);
    }
  });

  const handleDelete = (itemName: string) => {
    const fullPath = `clientes/${clienteId}/${path ? `${path}/` : ''}${itemName}`;
    if (confirm(`¿Estás seguro de que quieres eliminar "${itemName}"? Esta acción no se puede deshacer.`)) {
        deleteMutation.mutate(fullPath);
    }
  };

  // --- NUEVA FUNCIÓN PARA DESCARGAR ---
  const handleDownload = async (itemName: string) => {
    const fullPath = `clientes/${clienteId}/${path ? `${path}/` : ''}${itemName}`;
    try {
        const { data, error } = await supabase.storage.from('documentos').download(fullPath);
        if (error) throw error;
        
        // Creamos un enlace en memoria para iniciar la descarga
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = itemName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error: any) {
        alert(`Error al descargar el archivo: ${error.message}`);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({ clienteId, path: path || '', folderName: newFolderName });
  };

  // Ordenamos para que las carpetas aparezcan primero
  const sortedFiles = useMemo(() => {
    if (!files) return [];
    return [...files].sort((a, b) => {
        const aIsFolder = !a.id;
        const bIsFolder = !b.id;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a.name.localeCompare(b.name);
    });
  }, [files]);

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <Breadcrumbs clienteId={clienteId} path={path || ''} />
        <div className="page-actions">
          {/* --- BOTONES CONDICIONALES POR ROL --- */}
          {canCreateFolder && <button className="secondary" onClick={() => setIsFolderModalOpen(true)}><FolderPlus size={16} /> Crear Carpeta</button>}
          {canUpload && <button onClick={() => setIsUploadModalOpen(true)}><Upload size={16} /> Subir Documento</button>}
        </div>
      </div>

      {isLoading && <div>Cargando...</div>}
      {isError && <div className="error-text">Error al cargar los documentos.</div>}
      
      {sortedFiles && sortedFiles.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Esta carpeta está vacía.</div>
      )}

      {sortedFiles && sortedFiles.length > 0 && (
        <table className="table file-explorer">
          <tbody>
            {sortedFiles.map(file => {
              const isFolder = !file.id;
              return (
                <tr key={file.id ?? file.name}>
                  <td className={`file-item ${isFolder ? 'is-folder' : 'is-file'}`}>
                    {isFolder ? (
                      <Link to={clienteDocumentosRoute.to} params={{ id: clienteId, _splat: `${path ? `${path}/` : ''}${file.name}` }}>
                        <Folder size={20} />
                        <span>{file.name}</span>
                      </Link>
                    ) : (
                      <div>
                        <File size={20} />
                        <span>{file.name}</span>
                      </div>
                    )}
                  </td>
                  {/* --- NUEVA CELDA DE ACCIONES --- */}
                  <td className="file-actions">
                    {!isFolder && (
                      <button onClick={() => handleDownload(file.name)} className="icon-button secondary" title="Descargar">
                        <Download size={18} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(file.name)} className="icon-button danger" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* --- NUEVO MODAL PARA CREAR CARPETA --- */}
      {isFolderModalOpen && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateFolder} className="modal-content card">
            <h3 style={{ marginTop: 0 }}>Crear Nueva Carpeta</h3>
            <div>
              <label htmlFor="folderName">Nombre de la carpeta</label>
              <input 
                id="folderName"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej: Facturas 2025"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" className="secondary" onClick={() => setIsFolderModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={createFolderMutation.isPending}>
                {createFolderMutation.isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- NUEVO MODAL PARA SUBIR ARCHIVO --- */}
      {isUploadModalOpen && (
        <ClienteDocumentoUploadModal
          clienteId={clienteId}
          currentPath={path || ''}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, path] });
          }}
        />
      )}

    </div>
  );
}