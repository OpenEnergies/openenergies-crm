// src/pages/documentos/DocumentosList.tsx
// ... (imports previos se mantienen) ...
// Asegúrate de que las importaciones estén completas, aquí muestro la lógica modificada

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { Link } from '@tanstack/react-router'
import { RootDocumentItem } from '@lib/types'
import { Download, Folder, FileText, FileArchive, Loader2, FileUp, FileImage, FileSpreadsheet, Eye as EyeIcon } from 'lucide-react'
import { useSession } from '@hooks/useSession'
import { EmptyState } from '@components/EmptyState'
import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import FilePreviewModal from '@components/FilePreviewModal';

const getFileIcon = (fileName: string, size: number = 20) => {
  // ... (función getFileIcon sin cambios) ...
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(extension)) return <FileText size={size} style={{ color: '#E53E3E' }} />;
  if (['doc', 'docx'].includes(extension)) return <FileText size={size} style={{ color: 'var(--secondary)' }} />;
  if (['txt'].includes(extension)) return <FileText size={size} style={{ color: 'var(--muted)' }} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return <FileImage size={size} style={{ color: '#48BB78' }} />;
  if (['xls', 'xlsx', 'csv'].includes(extension)) return <FileSpreadsheet size={size} style={{ color: '#38A169' }} />;
  if (['zip', 'rar', '7z', 'tar'].includes(extension)) return <FileArchive size={size} style={{ color: '#4299E1' }} />;
  return <FileText size={size} />;
};

async function fetchAllRootDocuments(): Promise<RootDocumentItem[]> {
  const { data, error } = await supabase.rpc('get_all_root_documents')
  if (error) {
    console.error("Error al llamar a la función RPC 'get_all_root_documents':", error)
    throw error
  }
  return data || []
}

export default function DocumentosList() {
  const { rol } = useSession()
  const [filter, setFilter] = useState('')
  const [isZipping, setIsZipping] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['all_root_documents'],
    queryFn: fetchAllRootDocuments,
  })

  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // --- MODIFICACIÓN DE PERMISOS ---
  // Solo admin puede subir
  const canUpload = rol === 'administrador'; 
  const canSearch = true; // Todos pueden buscar

  const filteredData = useMemo(() => {
    if (!data) return []

    // --- MODIFICACIÓN: Comercial ve lo mismo que cliente ---
    // Filtro para el cliente o comercial: solo ven items visibles
    const restrictedView = rol === 'cliente' || rol === 'comercial';
    
    const clientVisibleData = restrictedView
      ? data.filter(item => item.visible_para_cliente)
      : data;
    // ------------------------------------------------------

    if (!filter) return clientVisibleData;

    return clientVisibleData.filter(
      item =>
        (item.item_name && item.item_name.toLowerCase().includes(filter.toLowerCase())) ||
        (item.cliente_nombre && item.cliente_nombre.toLowerCase().includes(filter.toLowerCase()))
    )
  }, [data, filter, rol]);

  // ... (Resto de funciones handlePreview, handleDownloadFolderZip se mantienen igual) ...
  const handlePreview = async (filePath: string, fileName: string) => {
      setIsLoadingPreview(true);
      setPreviewFile({ url: '', name: fileName });
      try {
          const { data, error } = await supabase.storage.from('documentos').createSignedUrl(filePath, 3600);
          if (error) throw error;
          if (!data?.signedUrl) throw new Error("No se pudo obtener la URL firmada.");
          setPreviewFile({ url: data.signedUrl, name: fileName });
      } catch (e: any) {
          console.error('Error al obtener URL firmada:', e);
          toast.error(`Error al preparar vista previa: ${e.message}`);
          setPreviewFile(null);
      } finally {
        setIsLoadingPreview(false);
      }
  };

  const handleDownloadFolderZip = async (clienteId: string, folderName: string) => {
    const currentPath = ''; 
    const safeFolder = folderName.replace(/[^a-zA-Z0-9._-]/g, '_'); 
    const zipKey = `${clienteId}-${folderName}`;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zip-folder?clienteId=${encodeURIComponent(clienteId)}&path=${encodeURIComponent(currentPath)}&folder=${encodeURIComponent(folderName)}`;
    try {
      setIsZipping(zipKey);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("No se pudo obtener la sesión.");
      const token = sessionData.session.access_token;
      const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorBody.message || `Fallo al generar ZIP (${res.status})`);
      }
      const blob = await res.blob();
      saveAs(blob, `${safeFolder}.zip`);
    } catch (error: any) {
      console.error("Error ZIP:", error);
      toast.error(`Error al crear el ZIP: ${error.message}`);
    } finally {
      setIsZipping(null);
    }
  };

  return (
    <div className="page-layout">
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
            title={filter ? 'Sin resultados' : 'Sin documentos'}
            description={
              filter
                ? 'No se encontraron documentos o carpetas que coincidan.'
                : 'No hay documentos disponibles.'
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
                          <Link to="/app/clientes/$id/documentos/$" params={{ id: item.cliente_id, _splat: item.item_name }}>
                            <Folder size={20} />
                            <span>{item.item_name}</span>
                          </Link>
                        ) : (
                          <Link to="/app/documentos-cliente/$" params={{ _splat: item.item_name }}>
                            <Folder size={20} />
                            <span>{item.item_name}</span>
                          </Link>
                        )
                      ) : (
                        <button
                          onClick={() => handlePreview(item.full_path, item.item_name)}
                          className="file-preview-button"
                          style={{ background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--fg)', fontWeight: 500, width: '100%' }}
                          title={`Vista previa de ${item.item_name}`}
                        >
                          {getFileIcon(item.item_name)}
                          <span>{item.item_name}</span>
                        </button>
                      )}
                    </td>
                    <td>{item.cliente_nombre}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!item.is_folder && (
                            <button onClick={() => handlePreview(item.full_path, item.item_name)} className="icon-button secondary" title="Vista previa" style={{ marginLeft: '0.5rem' }}>
                                <EyeIcon size={18} />
                            </button>
                      )}
                      {item.is_folder && (
                        <button onClick={() => handleDownloadFolderZip(item.cliente_id, item.item_name)} className="icon-button secondary" title="Descargar zip" disabled={isZippingThisFolder}>
                          {isZippingThisFolder ? <Loader2 size={18} className="animate-spin" /> : <FileArchive size={18} />}
                        </button>
                      )}
                      {!item.is_folder && (
                        <button className="icon-button secondary" title="Descargar" onClick={async () => {
                            const fullPath = item.full_path
                            try {
                              const { data, error } = await supabase.storage.from('documentos').download(fullPath)
                              if (error) throw error
                              const url = URL.createObjectURL(data)
                              const a = document.createElement('a'); a.href = url; a.download = item.item_name;
                              document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                            } catch (e: any) { toast.error(`Error al descargar: ${e.message}`) }
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
       <FilePreviewModal
         isOpen={!!previewFile}
         onClose={() => { setPreviewFile(null); setIsLoadingPreview(false); }}
         fileUrl={previewFile?.url || null}
         fileName={previewFile?.name || null}
       />
       {isLoadingPreview && !previewFile?.url && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, color: 'white' }}>
               <Loader2 className="animate-spin" size={32} />
               <span style={{ marginLeft: '1rem' }}>Cargando vista previa...</span>
           </div>
       )}
    </div>
  )
}
