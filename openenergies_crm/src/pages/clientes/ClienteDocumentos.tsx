import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link, useParams } from '@tanstack/react-router';
import { Folder, File, Upload, FolderPlus, Trash2, Download, FileArchive, Loader2 } from 'lucide-react';
import { clienteDocumentosRoute } from '@router/routes';
import { useState, useMemo } from 'react';
import { useSession } from '@hooks/useSession';
import ClienteDocumentoUploadModal from './ClienteDocumentoUploadModal';
import { joinPath } from '@lib/utils';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '@components/ConfirmationModal';


const PLACEHOLDER = '.emptyFolderPlaceholder';

// Función para listar archivos y carpetas
async function listFiles(clienteId: string, path: string) {
  const fullPath = joinPath('clientes', clienteId, path);
  const { data, error } = await supabase.storage.from('documentos').list(fullPath, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  // No mostramos el placeholder
  return (data ?? []).filter((item) => item.name !== PLACEHOLDER);
}

// Comprueba si una carpeta está "efectivamente vacía":
// a) No tiene elementos, o b) solo contiene el placeholder
async function isFolderEffectivelyEmpty(fullFolderPath: string) {
  const { data, error } = await supabase.storage.from('documentos').list(fullFolderPath, {
    limit: 1000,
    offset: 0,
  });
  if (error) {
    // Si no podemos listar, asumimos vacía (mejor experiencia que bloquear la acción)
    console.warn(`No se pudo listar ${fullFolderPath}: ${error.message}`);
    return true;
  }
  const items = (data ?? []).filter((i) => i.name !== PLACEHOLDER);
  return items.length === 0;
}

// Componente Breadcrumbs
function Breadcrumbs({ clienteId, path }: { clienteId: string; path: string }) {
  const segments = path.split('/').filter(Boolean);

  return (
    <nav className="breadcrumbs">
      <Link to={clienteDocumentosRoute.to} params={{ id: clienteId, _splat: '' }}>
        Documentos
      </Link>
      {segments.map((segment, index) => {
        const currentPath = segments.slice(0, index + 1).join('/');
        return (
          <span key={index}>
            /{' '}
            <Link to={clienteDocumentosRoute.to} params={{ id: clienteId, _splat: currentPath }}>
              {segment}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

// Crear carpeta (sube placeholder vacío)
async function createFolder({
  clienteId,
  path,
  folderName,
}: {
  clienteId: string;
  path: string;
  folderName: string;
}) {
  const safeFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = joinPath('clientes', clienteId, path, safeFolderName, PLACEHOLDER);
  const { error } = await supabase.storage.from('documentos').upload(fullPath, new Blob());
  if (error) throw error;
}

export default function ClienteDocumentos() {
  const { id: clienteId, _splat: path } = useParams({ from: clienteDocumentosRoute.id });
  const queryClient = useQueryClient();
  const { rol } = useSession();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const isAdmin = rol === 'administrador';
  const canUpload = isAdmin;
  const canCreateFolder = isAdmin;
  const canDelete = isAdmin;
  const currentPath = path || '';

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    itemToDelete: { name: string; fullPath: string; isFolder: boolean } | null;
  }>({ isOpen: false, itemToDelete: null });

  const [isZipping, setIsZipping] = useState<string | null>(null);

  const { data: files, isLoading, isError } = useQuery({
    queryKey: ['documentos', clienteId, currentPath],
    queryFn: () => listFiles(clienteId, currentPath),
  });

  // Aux: reunir todas las rutas a borrar dentro de una carpeta (recursivo)
  async function getAllPathsToDelete(currentFolderPath: string): Promise<string[]> {
    const { data: items, error: listError } = await supabase.storage
      .from('documentos')
      .list(currentFolderPath, { limit: 1000 });

    if (listError) {
      console.error(`Error listando ${currentFolderPath}:`, listError.message);
      return [];
    }

    let paths: string[] = [];

    for (const item of items ?? []) {
      if (item.name === PLACEHOLDER) {
        // Se elimina implícitamente si quitamos toda la carpeta, pero lo añadimos por si acaso
        paths.push(joinPath(currentFolderPath, item.name));
        continue;
      }
      const itemPath = joinPath(currentFolderPath, item.name);
      const isFile = Boolean((item as any).id); // En Supabase, los ficheros tienen id; las "carpetas" no
      if (isFile) {
        paths.push(itemPath);
      } else {
        // Subcarpeta: bajar recursivamente
        const sub = await getAllPathsToDelete(itemPath);
        paths = paths.concat(sub);
        // Añadir también su placeholder si existiera
        paths.push(joinPath(itemPath, PLACEHOLDER));
      }
    }

    // Asegurar también el placeholder de la carpeta actual por si existe
    paths.push(joinPath(currentFolderPath, PLACEHOLDER));

    // Deduplicar y limpiar
    return Array.from(new Set(paths.filter(Boolean)));
  }

  // Eliminar (archivo o carpeta)
  const deleteMutation = useMutation({
    mutationFn: async ({ fullPath, isFolder }: { fullPath: string; isFolder: boolean }) => {
      if (!isFolder) {
        // --- Fichero ---
        const { error: storageError } = await supabase.storage.from('documentos').remove([fullPath]);
        if (storageError) throw new Error(`Error de Storage: ${storageError.message}`);

        const { error: dbError } = await supabase
          .from('documentos')
          .delete()
          .eq('ruta_storage', fullPath);
        if (dbError) throw new Error(`Error al borrar de BBDD: ${dbError.message}`);
        return;
      }

      // --- Carpeta ---
      const allPathsToDelete = await getAllPathsToDelete(fullPath);

      if (allPathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('documentos').remove(allPathsToDelete);
        if (storageError) throw new Error(`Error de Storage: ${storageError.message}`);
      }

      // Borrar entradas de la tabla documentos bajo esa ruta
      const { error: dbError } = await supabase
        .from('documentos')
        .delete()
        .like('ruta_storage', `${fullPath}/%`);
      if (dbError) console.warn(`Archivos de carpeta borrados de Storage pero no de BBDD: ${dbError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
      toast.success('Elemento eliminado con éxito.');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const handleDelete = async (itemName: string, isFolder: boolean) => {
    // Construye la ruta igual que antes
    const fullPath = joinPath('clientes', clienteId, currentPath, itemName);

    let modalTitle = '';
    let modalMessage = '';
    let confirmClass = 'danger'; // Clase para el botón de confirmación

    if (isFolder) {
      try {
        const isEmpty = await isFolderEffectivelyEmpty(fullPath);
        if (isEmpty) {
          // Carpeta vacía: borrar directamente SIN modal de confirmación (más ágil)
          // Opcional: podrías mostrar un toast.loading aquí
          deleteMutation.mutate({ fullPath, isFolder: true });
          return; // Salimos de la función
        } else {
          // Carpeta NO vacía: Preparamos el modal
          modalTitle = `Borrar Carpeta "${itemName}"`;
          modalMessage = `Esta carpeta contiene elementos. ¿Estás seguro de que quieres borrarla junto con todo su contenido? Esta acción es irreversible.`;
        }
      } catch (e: any) {
        toast.error(`Error al comprobar la carpeta: ${e.message}`);
        return; // No continuar si no se puede comprobar
      }
    } else {
      // Fichero: Preparamos el modal
      modalTitle = `Borrar Archivo "${itemName}"`;
      modalMessage = `¿Estás seguro de que quieres eliminar este archivo? Esta acción es irreversible.`;
    }

    // Guardamos la info del item y abrimos el modal
    setModalState({
      isOpen: true,
      itemToDelete: { name: itemName, fullPath, isFolder },
    });
  };

  // Descargar fichero
  const handleDownload = async (itemName: string) => {
    const fullPath = joinPath('clientes', clienteId, currentPath, itemName);
    try {
      const { data, error } = await supabase.storage.from('documentos').download(fullPath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = itemName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(`Error al descargar el archivo: ${error.message}`);
    }
  };

  // Descargar carpeta como .zip (EDGE FUNCTION)
const handleDownloadFolderZip = async (folderName: string) => {
  // Usamos joinPath para asegurar consistencia, aunque la Edge Function también sanea
  const folderPath = joinPath(currentPath, folderName); 
  // Extraemos solo el nombre limpio para el .zip
  const safeFolder = folderName.replace(/[^a-zA-Z0-9._-]/g, '_'); 

  // Construimos la URL de la Edge Function
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zip-folder?clienteId=${encodeURIComponent(
    clienteId
  )}&path=${encodeURIComponent(currentPath)}&folder=${encodeURIComponent(folderName)}`; // Pasamos el nombre original, la función lo saneará si es necesario

  try {
    // --- CAMBIO DE NOMBRE DE ESTADO ---
    setIsZipping(folderName); // Actualizado para usar tu estado
    // ---------------------------------
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        throw new Error("No se pudo obtener la sesión del usuario.");
    }
    const token = sessionData.session.access_token;

    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText })); // Intenta leer JSON, si no, usa statusText
      console.error("Error response body:", errorBody);
      throw new Error(errorBody.message || `Fallo al generar ZIP (${res.status})`);
    }

    const blob = await res.blob();

    // Usamos file-saver (que ya tenías instalado) para la descarga
    saveAs(blob, `${safeFolder}.zip`);

  } catch (error: any) {
    console.error("Error al descargar/crear el ZIP:", error);
    toast.error(`Error al crear el ZIP: ${error.message}`);
  } finally {
    // --- CAMBIO DE NOMBRE DE ESTADO ---
    setIsZipping(null); // Actualizado para usar tu estado
    // ---------------------------------
  }
};

  // Crear carpeta
  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
      setIsFolderModalOpen(false);
      setNewFolderName('');
      toast.success('Carpeta creada con éxito.');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear la carpeta: ${error.message}`);
    },
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({ clienteId, path: currentPath, folderName: newFolderName });
  };

  // Ordenamos para que las carpetas aparezcan primero
  const sortedFiles = useMemo(() => {
    if (!files) return [] as any[];
    return [...files].sort((a: any, b: any) => {
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
        <Breadcrumbs clienteId={clienteId} path={currentPath || ''} />
        <div className="page-actions">
          {canCreateFolder && (
            <button className="secondary" onClick={() => setIsFolderModalOpen(true)}>
              <FolderPlus size={16} /> Crear Carpeta
            </button>
          )}
          {canUpload && (
            <button onClick={() => setIsUploadModalOpen(true)}>
              <Upload size={16} /> Subir Documento
            </button>
          )}
        </div>
      </div>

      {isLoading && <div>Cargando...</div>}
      {isError && <div className="error-text">Error al cargar los documentos.</div>}

      {sortedFiles && sortedFiles.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Esta carpeta está vacía.
        </div>
      )}

      {sortedFiles && sortedFiles.length > 0 && (
        <table className="table file-explorer">
          <tbody>
            {sortedFiles.map((file: any) => {
              const isFolder = !file.id;
              const isZippingThisFolder = isZipping === file.name;
              return (
                <tr key={file.id ?? file.name}>
                  <td className={`file-item ${isFolder ? 'is-folder' : 'is-file'}`}>
                    {isFolder ? (
                      <Link
                        to={clienteDocumentosRoute.to}
                        params={{ id: clienteId, _splat: joinPath(currentPath, file.name) }}
                      >
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
                  <td className="file-actions">
                    {!isFolder && (
                      <button onClick={() => handleDownload(file.name)} className="icon-button secondary" title="Descargar">
                        <Download size={18} />
                      </button>
                    )}
                    {isFolder && (
                      <button
                        // Llama a la nueva función
                        onClick={() => handleDownloadFolderZip(file.name)}
                        className="icon-button secondary"
                        title={`Descargar carpeta ${file.name} como .zip`}
                        // Comprueba si *esta* carpeta se está zipeando
                        disabled={isZippingThisFolder}
                      >
                        {/* Muestra texto/icono de carga si esta carpeta se está zipeando */}
                        {isZipping === file.name ? <Loader2 size={18} className="animate-spin" /> : <FileArchive size={18} />}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(file.name, isFolder)}
                        className="icon-button danger"
                        title="Eliminar"
                        disabled={deleteMutation.isPending}
                      >
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

      {isUploadModalOpen && (
        <ClienteDocumentoUploadModal
          clienteId={clienteId}
          currentPath={currentPath}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
          }}
        />
      )}

      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, itemToDelete: null })} // Cierra el modal al cancelar
        onConfirm={() => {
          // Si hay un item guardado, ejecuta la mutación de borrado
          if (modalState.itemToDelete) {
            deleteMutation.mutate({
              fullPath: modalState.itemToDelete.fullPath,
              isFolder: modalState.itemToDelete.isFolder,
            });
          }
          // Cierra el modal después de confirmar (la mutación mostrará toast de éxito/error)
           setModalState({ isOpen: false, itemToDelete: null });
        }}
        title={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `Borrar Carpeta "${modalState.itemToDelete.name}"` : `Borrar Archivo "${modalState.itemToDelete.name}"`) : 'Confirmar Acción'}
        message={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `La carpeta "${modalState.itemToDelete.name}" contiene elementos. ¿Estás seguro de que quieres borrarla junto con todo su contenido? Esta acción es irreversible.` : `¿Estás seguro de que quieres eliminar el archivo "${modalState.itemToDelete.name}"? Esta acción es irreversible.`) : 'Por favor, confirma la acción.'}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="danger" // Botón rojo para eliminar
        isConfirming={deleteMutation.isPending} // Muestra 'Procesando...' si la mutación está activa
      />
    </div>
  );
}
