import { useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { Link } from '@tanstack/react-router'
import { RootDocumentItem } from '@lib/types' // <-- Importamos el tipo actualizado
import { Download, Folder, FileText, FileArchive, Loader2, FileUp, FileImage, FileSpreadsheet, Eye as EyeIcon } from 'lucide-react'
import { useSession } from '@hooks/useSession'
import { EmptyState } from '@components/EmptyState'
import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import FilePreviewModal from '@components/FilePreviewModal';

// (Función auxiliar para obtener el icono del archivo)
// (Función auxiliar para obtener el icono del archivo)
const getFileIcon = (fileName: string, size: number = 20) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // --- 1. PDF (Rojo) ---
  if (['pdf'].includes(extension)) {
    return <FileText size={size} style={{ color: '#E53E3E' }} />;
  }

  // --- 2. Word (Azul) ---
  if (['doc', 'docx'].includes(extension)) {
    return <FileText size={size} style={{ color: 'var(--secondary)' }} />;
  }

  // --- 3. TXT (Gris) ---
  if (['txt'].includes(extension)) {
    return <FileText size={size} style={{ color: 'var(--muted)' }} />;
  }

  // --- Iconos que SÍ funcionan ---
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return <FileImage size={size} style={{ color: '#48BB78' }} />;
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return <FileSpreadsheet size={size} style={{ color: '#38A169' }} />;
  }

  // --- Otros ---
  if (['zip', 'rar', '7z', 'tar'].includes(extension)) {
    return <FileArchive size={size} style={{ color: '#4299E1' }} />;
  }
  
  // Icono por defecto (genérico - FileText)
  return <FileText size={size} />;
};

async function fetchAllRootDocuments(): Promise<RootDocumentItem[]> {
  // Esta llamada ahora usa la función SQL con UNION
  const { data, error } = await supabase.rpc('get_all_root_documents')
  if (error) {
    console.error("Error al llamar a la función RPC 'get_all_root_documents':", error)
    throw error
  }
  // Añadimos un fallback para evitar errores si data es null
  return data || []
}

export default function DocumentosList() {
  const { rol } = useSession()
  const [filter, setFilter] = useState('')
  const [isZipping, setIsZipping] = useState<string | null>(null); // key es 'clienteId-folderName'
  const { data, isLoading, isError } = useQuery({
    queryKey: ['all_root_documents'],
    queryFn: fetchAllRootDocuments,
  })

  // --- 2. Estado para el modal de vista previa ---
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  // ---------------------------------------------

  const canUpload = rol === 'administrador' || rol === 'comercial'
  const canSearch = rol === 'administrador' || rol === 'comercial'
  // Modifica el useMemo 'filteredData'
  const filteredData = useMemo(() => {
    if (!data) return []

    // Filtro para el cliente: solo ve items visibles
    const clientVisibleData = (rol === 'cliente')
      ? data.filter(item => item.visible_para_cliente)
      : data;

    if (!filter || !canSearch) return clientVisibleData;

    // El filtro de texto se aplica sobre los datos ya filtrados por rol
    return clientVisibleData.filter(
      item =>
        (item.item_name && item.item_name.toLowerCase().includes(filter.toLowerCase())) ||
        (item.cliente_nombre && item.cliente_nombre.toLowerCase().includes(filter.toLowerCase()))
    )
  }, [data, filter, canSearch, rol]);

  // --- 3. Handler para abrir la vista previa ---
  const handlePreview = async (filePath: string, fileName: string) => {
      setIsLoadingPreview(true);
      setPreviewFile({ url: '', name: fileName }); // Abre modal con spinner
      try {
          // Obtener URL firmada (válida por 1 hora en este ejemplo)
          const { data, error } = await supabase.storage
              .from('documentos')
              .createSignedUrl(filePath, 3600); // 3600 segundos = 1 hora

          if (error) throw error;
          if (!data?.signedUrl) throw new Error("No se pudo obtener la URL firmada.");

          // Actualiza el estado con la URL real
          setPreviewFile({ url: data.signedUrl, name: fileName });

      } catch (e: any) {
          console.error('Error al obtener URL firmada:', e);
          toast.error(`Error al preparar vista previa: ${e.message}`);
          setPreviewFile(null); // Cierra el modal si hay error
      } finally {
        setIsLoadingPreview(false);
      }
  };
  // ----------------------------------------------

  const handleDownloadFolderZip = async (clienteId: string, folderName: string) => {
    // La ruta aquí es la raíz (path = '')
    const currentPath = ''; 
    const safeFolder = folderName.replace(/[^a-zA-Z0-9._-]/g, '_'); 
    const zipKey = `${clienteId}-${folderName}`; // Clave única para el estado de carga

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zip-folder?clienteId=${encodeURIComponent(
      clienteId
    )}&path=${encodeURIComponent(currentPath)}&folder=${encodeURIComponent(folderName)}`;

    try {
      setIsZipping(zipKey);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
          throw new Error("No se pudo obtener la sesión del usuario.");
      }
      const token = sessionData.session.access_token;

      const res = await fetch(url, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: res.statusText }));
        console.error("Error response body:", errorBody);
        throw new Error(errorBody.message || `Fallo al generar ZIP (${res.status})`);
      }

      const blob = await res.blob();
      saveAs(blob, `${safeFolder}.zip`);

    } catch (error: any) {
      console.error("Error al descargar/crear el ZIP:", error);
      toast.error(`Error al crear el ZIP: ${error.message}`);
    } finally {
      setIsZipping(null);
    }
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Documentos Globales</h2>
        <div className="page-actions">
          {canSearch && (
            <input
              type="text"
              placeholder="Buscar por nombre o cliente..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ minWidth: '250px' }}
            />
          )}
          {canUpload && (
            <Link to="/app/documentos/subir">
              <button><FileUp /></button>
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar documentos.</div>}

        {filteredData && filteredData.length === 0 && !isLoading && (
          <EmptyState
            title={filter && canSearch ? 'Sin resultados' : 'Sin documentos'}
            description={
              filter && canSearch
                ? 'No se encontraron documentos o carpetas que coincidan con tu búsqueda.'
                : 'No hay documentos ni carpetas en la raíz de ningún cliente.'
            }
          />
        )}
        {filteredData && filteredData.length > 0 && (
          <div className="table-wrapper">
            <table className="table file-explorer">
              <thead>
                <tr>
                  <th>Nombre del Archivo / Carpeta</th>
                  <th>Cliente Propietario</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => {
                  const zipKey = `${item.cliente_id}-${item.item_name}`;
                  const isZippingThisFolder = isZipping === zipKey;
                  return (
                  <tr key={`${item.cliente_id}-${item.full_path}`}>
                    <td className={`file-item ${item.is_folder ? 'is-folder' : 'is-file'}`}>
                      {item.is_folder ? (
                        canSearch ? (
                          <Link
                            to="/app/clientes/$id/documentos/$"
                            params={{ id: item.cliente_id, _splat: item.item_name }}
                          >
                            <Folder size={20} />
                            <span>{item.item_name}</span>
                          </Link>
                        ) : (
                          <Link
                            to="/app/documentos-cliente/$"
                            params={{ _splat: item.item_name }}
                          >
                            <Folder size={20} />
                            <span>{item.item_name}</span>
                          </Link>
                        )
                      ) : (
                        // --- 4. Renderizado del nombre del archivo como botón ---
                        <button
                          onClick={() => handlePreview(item.full_path, item.item_name)}
                          className="file-preview-button" // Puedes añadir estilos específicos si quieres
                          style={{ // Estilos básicos para que parezca texto normal
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex', // Re-aplica flex para alinear icono y texto
                              alignItems: 'center',
                              gap: '0.75rem',
                              color: 'var(--fg)', // Hereda color
                              fontWeight: 500, // Hereda fuente
                              width: '100%' // Ocupa el ancho
                          }}
                          title={`Vista previa de ${item.item_name}`}
                        >
                          {getFileIcon(item.item_name)}
                          <span>{item.item_name}</span>
                        </button>
                        // -------------------------------------------------
                      )}

                    </td>
                    <td>{item.cliente_nombre}</td>
                    <td style={{ textAlign: 'right' }}>
                      {/* --- 5. Botón de vista previa en acciones (Opcional) --- */}
                      {!item.is_folder && (
                            <button
                                onClick={() => handlePreview(item.full_path, item.item_name)}
                                className="icon-button secondary"
                                title="Vista previa"
                                style={{ marginLeft: '0.5rem' }} // Añade espacio si pones más botones
                            >
                                <EyeIcon size={18} />
                            </button>
                      )}
                       {/* --- Fin Modificación 5 --- */}
                      {item.is_folder && (
                        <button
                          onClick={() => handleDownloadFolderZip(item.cliente_id, item.item_name)}
                          className="icon-button secondary"
                          title={`Descargar carpeta ${item.item_name} como .zip`}
                          disabled={isZippingThisFolder}
                        >
                          {isZippingThisFolder ? <Loader2 size={18} className="animate-spin" /> : <FileArchive size={18} />}
                        </button>
                      )}
                      {!item.is_folder && (
                        <button
                          className="icon-button secondary"
                          title="Descargar documento"
                          onClick={async () => {
                            // --- CAMBIO #2: Usamos 'item.full_path' ---
                            // Esta es la ruta real del objeto en el Storage (ej: 'uuid-cliente/factura.pdf')
                            const fullPath = item.full_path

                            try {
                              const { data, error } = await supabase.storage
                                .from('documentos')
                                .download(fullPath) // <-- Usamos la ruta correcta

                              if (error) throw error

                              const url = URL.createObjectURL(data)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = item.item_name // El nombre del fichero sigue siendo correcto
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            } catch (e: any) {
                              console.error('Error al descargar:', e)
                              toast.error(`Error al descargar el fichero: ${e.message}`)
                            }
                          }}
                        >
                          <Download size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* --- 6. Renderizar el modal --- */}
       <FilePreviewModal
         isOpen={!!previewFile}
         onClose={() => { setPreviewFile(null); setIsLoadingPreview(false); }}
         fileUrl={previewFile?.url || null}
         fileName={previewFile?.name || null}
       />
       {/* Muestra un overlay de carga mientras se obtiene la URL */}
       {isLoadingPreview && !previewFile?.url && (
           <div style={{
               position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               zIndex: 1100, color: 'white'
           }}>
               <Loader2 className="animate-spin" size={32} />
               <span style={{ marginLeft: '1rem' }}>Cargando vista previa...</span>
           </div>
       )}
       {/* --- Fin Modificación 6 --- */}
    </div>
  )
}