// src/pages/clientes/ClienteDocumentos.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { Link, useParams } from '@tanstack/react-router'
import { Folder, File, Upload, FolderPlus, Trash2, Download, FileArchive, Loader2, Eye, EyeOff, FileImage, FileSpreadsheet, FileText, Eye as EyeIcon} from 'lucide-react'
import { clienteDocumentosRoute, documentosClienteRoute } from '@router/routes'
import { useState, useMemo } from 'react'
import { useSession } from '@hooks/useSession'
import ClienteDocumentoUploadModal from './ClienteDocumentoUploadModal'
import { joinPath } from '@lib/utils'
import { saveAs } from 'file-saver'
import { toast } from 'react-hot-toast'
import ConfirmationModal from '@components/ConfirmationModal'
import FilePreviewModal from '@components/FilePreviewModal';

// ... (getFileIcon, PLACEHOLDER, tipos, breadcrumbs se mantienen igual) ...
const getFileIcon = (fileName: string, size: number = 20) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(extension)) return <FileText size={size} style={{ color: '#E53E3E' }} />;
  if (['doc', 'docx'].includes(extension)) return <FileText size={size} style={{ color: 'var(--secondary)' }} />;
  if (['txt'].includes(extension)) return <FileText size={size} style={{ color: 'var(--muted)' }} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return <FileImage size={size} style={{ color: '#48BB78' }} />;
  if (['zip', 'rar', '7z', 'tar'].includes(extension)) return <FileArchive size={size} style={{ color: '#4299E1' }} />;
  if (['xls', 'xlsx', 'csv'].includes(extension)) return <FileSpreadsheet size={size} style={{ color: '#38A169' }} />;
  return <File size={size} />;
};
const PLACEHOLDER = '.emptyFolderPlaceholder';

type ExplorerItem = {
  name: string; is_folder: boolean; id: string | null; full_path: string; is_visible: boolean;
};

// ... (listFiles, isFolderEffectivelyEmpty, Breadcrumbs, createFolder, getAllPathsToDelete - IGUAL) ...
async function listFiles(clienteId: string, path: string, clientMode: boolean): Promise<ExplorerItem[]> {
  const fullPath = joinPath('clientes', clienteId, path);
  const { data: storageData, error: storageError } = await supabase.storage.from('documentos').list(fullPath, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  if (storageError) throw storageError;
  const itemsFromStorage = (storageData ?? []).filter((item) => item.name !== PLACEHOLDER);

  let query = supabase.from('documentos').select('id, ruta_storage, visible_para_cliente, nombre_archivo').eq('cliente_id', clienteId);
  const clientRootPathPrefix = `clientes/${clienteId}/`;
  query = query.like('ruta_storage', `${clientRootPathPrefix}%`);

  if (clientMode) {
    query = query.eq('visible_para_cliente', true);
  }

  const { data: dbFiles, error: dbError } = await query;
  if (dbError) throw dbError;

  const explorerItems: ExplorerItem[] = itemsFromStorage.map((item) => {
    const itemFullPath = joinPath(fullPath, item.name);
    const isFolder = !item.id;
    const dbMatch = dbFiles.find(f => {
      if (isFolder) return false;
      const dbFileName = f.ruta_storage.substring(f.ruta_storage.lastIndexOf('/') + 1);
      if (dbFileName !== item.name) return false;
      const expectedDirPath = joinPath('clientes', clienteId, path);
      const dirPartOfDbPath = f.ruta_storage.substring(0, f.ruta_storage.lastIndexOf('/'));
      const cleanedDirPartOfDbPath = dirPartOfDbPath.replace(/\/+/g, '/');
      return cleanedDirPartOfDbPath === expectedDirPath;
    });
    let isFolderVisible = false;
    if (isFolder) {
      const folderPrefix = itemFullPath + '/';
      if (clientMode) {
        isFolderVisible = dbFiles.some(f => f.ruta_storage.startsWith(folderPrefix));
      } else {
        isFolderVisible = dbFiles.some(f => f.ruta_storage.startsWith(folderPrefix) && f.visible_para_cliente === true);
      }
    }
    const isVisibleForClient = clientMode ? (isFolder ? isFolderVisible : !!dbMatch) : (isFolder ? isFolderVisible : (dbMatch?.visible_para_cliente ?? false));
    return { name: item.name, is_folder: isFolder, id: dbMatch?.id ?? null, full_path: itemFullPath, is_visible: isVisibleForClient };
  });

  if (clientMode) {
    return explorerItems.filter(item => item.is_visible);
  }
  return explorerItems;
}

async function isFolderEffectivelyEmpty(fullFolderPath: string) {
  const { data, error } = await supabase.storage.from('documentos').list(fullFolderPath, { limit: 1000 });
  if (error) { console.warn(`No se pudo listar ${fullFolderPath}: ${error.message}`); return true; }
  const items = (data ?? []).filter((i) => i.name !== PLACEHOLDER);
  return items.length === 0;
}

async function createFolder({ clienteId, path, folderName }: { clienteId: string; path: string; folderName: string }) {
  const safeFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = joinPath('clientes', clienteId, path, safeFolderName, PLACEHOLDER);
  const { error } = await supabase.storage.from('documentos').upload(fullPath, new Blob());
  if (error) throw error;
}

function Breadcrumbs({ clienteId, path, clientMode }: { clienteId: string; path: string; clientMode: boolean }) {
  const segments = path.split('/').filter(Boolean);
  const baseTo = clientMode ? documentosClienteRoute.id : clienteDocumentosRoute.id; 
  const baseParams = clientMode ? { _splat: '' } : { id: clienteId, _splat: '' };
  return (
    <nav className="breadcrumbs">
      <Link to={baseTo} params={baseParams}>Documentos</Link>
      {segments.map((segment, index) => {
        const currentPath = segments.slice(0, index + 1).join('/');
        const segmentParams = clientMode ? { _splat: currentPath } : { id: clienteId, _splat: currentPath };
        return (<span key={index}> / <Link to={baseTo} params={segmentParams}>{segment}</Link></span>);
      })}
    </nav>
  );
}

// ... (Componente Principal)
export default function ClienteDocumentos({ clienteId: explicitClienteId, pathSplat: explicitPathSplat, clientMode: propClientMode = false }: { clienteId?: string; pathSplat?: string; clientMode?: boolean; }) {
  const { rol } = useSession();
  
  // --- MODIFICACIÓN DE LOGICA: ¿Es modo restringido? ---
  // Si se pasa propClientMode=true (cliente real) O si el rol es 'comercial'
  const isRestrictedMode = propClientMode || rol === 'comercial';
  // ------------------------------------------------------

  // Si es cliente real, usamos su ruta especial. Si es comercial, usa la ruta normal de admin (/clientes/:id/documentos)
  const routeId = propClientMode ? documentosClienteRoute.id : clienteDocumentosRoute.id;
  const paramsFromRoute = useParams({ from: routeId });
  
  const clienteId: string | undefined = explicitClienteId ?? (paramsFromRoute as { id?: string }).id ?? undefined; 
  const path: string | undefined = explicitPathSplat ?? paramsFromRoute._splat;
  
  const queryClient = useQueryClient();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [modalState, setModalState] = useState<{ isOpen: boolean; itemToDelete: { name: string; fullPath: string; isFolder: boolean } | null; }>({ isOpen: false, itemToDelete: null });
  const [isZipping, setIsZipping] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // --- PERMISOS MODIFICADOS ---
  const canManage = rol === 'administrador'; // Solo admin puede gestionar (borrar/subir/ocultar)
  const canUpload = canManage;
  const canCreateFolder = canManage;
  const canDelete = canManage;
  const currentPath = path || '';

  const { data: files, isLoading, isError } = useQuery({
    queryKey: ['documentos', clienteId, currentPath, isRestrictedMode], // Usamos isRestrictedMode en la key
    queryFn: () => {
      if (typeof clienteId !== 'string') throw new Error("Cliente ID inválido.");
      // Pasamos isRestrictedMode a la función fetch
      return listFiles(clienteId, currentPath, isRestrictedMode); 
    },
    enabled: typeof clienteId === 'string', 
  });

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

  // ... (getAllPathsToDelete se mantiene igual) ...
  async function getAllPathsToDelete(currentFolderPath: string): Promise<string[]> {
    const { data: items, error: listError } = await supabase.storage.from('documentos').list(currentFolderPath, { limit: 1000 });
    if (listError) return [];
    let paths: string[] = [];
    for (const item of items ?? []) {
      if (item.name === PLACEHOLDER) { paths.push(joinPath(currentFolderPath, item.name)); continue; }
      const itemPath = joinPath(currentFolderPath, item.name);
      const isFile = Boolean((item as any).id);
      if (isFile) { paths.push(itemPath); } else {
        const sub = await getAllPathsToDelete(itemPath);
        paths = paths.concat(sub);
        paths.push(joinPath(itemPath, PLACEHOLDER));
      }
    }
    paths.push(joinPath(currentFolderPath, PLACEHOLDER));
    return Array.from(new Set(paths.filter(Boolean)));
  }

  const deleteMutation = useMutation({
    mutationFn: async ({ fullPath, isFolder }: { fullPath: string; isFolder: boolean }) => {
      if (!isFolder) {
        const { error: storageError } = await supabase.storage.from('documentos').remove([fullPath]);
        if (storageError) throw new Error(`Error de Storage: ${storageError.message}`);
        const { error: dbError } = await supabase.from('documentos').delete().eq('ruta_storage', fullPath);
        if (dbError) throw new Error(`Error al borrar de BBDD: ${dbError.message}`);
        return;
      }
      const allPathsToDelete = await getAllPathsToDelete(fullPath);
      if (allPathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('documentos').remove(allPathsToDelete);
        if (storageError) throw new Error(`Error de Storage: ${storageError.message}`);
      }
      const { error: dbError } = await supabase.from('documentos').delete().like('ruta_storage', `${fullPath}/%`);
      if (dbError) console.warn(`Archivos de carpeta borrados de Storage pero no de BBDD: ${dbError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
      queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
      toast.success('Elemento eliminado con éxito.');
    },
    onError: (error: Error) => { toast.error(`Error al eliminar: ${error.message}`); },
  });

  const handleDelete = async (itemName: string, isFolder: boolean) => {
    if (!clienteId) return; 
    const fullPath = joinPath('clientes', clienteId, currentPath, itemName);
    if (isFolder) {
      try {
        const isEmpty = await isFolderEffectivelyEmpty(fullPath);
        if (isEmpty) { deleteMutation.mutate({ fullPath, isFolder: true }); return; } 
        setModalState({ isOpen: true, itemToDelete: { name: itemName, fullPath, isFolder } });
      } catch (e: any) { toast.error(`Error al comprobar la carpeta: ${e.message}`); }
    } else {
      setModalState({ isOpen: true, itemToDelete: { name: itemName, fullPath, isFolder } });
    }
  };

  const handleDownload = async (itemName: string) => {
    if (!clienteId) return; 
    const fullPath = joinPath('clientes', clienteId, currentPath, itemName);
    try {
      const { data, error } = await supabase.storage.from('documentos').download(fullPath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = itemName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) { toast.error(`Error al descargar el archivo: ${error.message}`); }
  };

  const handleDownloadFolderZip = async (folderName: string) => {
    if (!clienteId) return; 
    const safeFolder = folderName.replace(/[^a-zA-Z0-9._-]/g, '_'); 
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zip-folder?clienteId=${encodeURIComponent(clienteId)}&path=${encodeURIComponent(currentPath)}&folder=${encodeURIComponent(folderName)}`;
    try {
      setIsZipping(folderName);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Fallo al generar ZIP (${res.status})`);
      const blob = await res.blob();
      saveAs(blob, `${safeFolder}.zip`);
    } catch (error: any) {
      console.error("Error ZIP:", error);
      toast.error(`Error al crear el ZIP: ${error.message}`);
    } finally { setIsZipping(null); }
  };

  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
      queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
      setIsFolderModalOpen(false); setNewFolderName('');
      toast.success('Carpeta creada con éxito.');
    },
    onError: (error: Error) => { toast.error(`Error al crear la carpeta: ${error.message}`); },
  });

  const toggleFileVisibilityMutation = useMutation({
    mutationFn: async ({ dbId, newVisibility }: { dbId: string; newVisibility: boolean }) => {
      const { error } = await supabase.from('documentos').update({ visible_para_cliente: newVisibility }).eq('id', dbId);
      if (error) throw error;
      return newVisibility;
    },
    onSuccess: (newVisibility) => {
      if (newVisibility) toast.success("Visibilidad activada", { icon: <Eye size={18} /> });
      else toast.success("Visibilidad desactivada", { icon: <EyeOff size={18} /> });
      queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath, isRestrictedMode], exact: true });
      queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
    },
    onError: (error: Error) => { toast.error(`Error al actualizar visibilidad: ${error.message}`); },
  });

  const toggleFolderVisibilityMutation = useMutation({
    mutationFn: async ({ folderName, newVisibility }: { folderName: string; newVisibility: boolean }) => {
      if (!clienteId) throw new Error("ID de cliente no encontrado");
      const folderPath = joinPath(currentPath, folderName);
      const { error } = await supabase.rpc('set_folder_visibility', { p_cliente_id: clienteId, p_folder_path: folderPath, p_is_visible: newVisibility });
      if (error) throw error;
      return newVisibility;
    },
    onSuccess: async (newVisibility) => {
      if (newVisibility) toast.success("Carpeta visible", { icon: <Eye size={18} /> });
      else toast.success("Carpeta oculta", { icon: <EyeOff size={18} /> });
      const queryKey = ['documentos', clienteId, currentPath, isRestrictedMode];
      await queryClient.invalidateQueries({ queryKey, exact: true });
      await queryClient.refetchQueries({ queryKey, exact: true });
      queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
    },
    onError: (error: Error) => { toast.error(`Error al actualizar carpeta: ${error.message}`); },
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !clienteId) return;
    createFolderMutation.mutate({ clienteId, path: currentPath, folderName: newFolderName });
  };

  const sortedFiles = useMemo(() => {
    if (!files) return [] as any[];
    return [...files].sort((a: any, b: any) => {
      const aIsFolder = a.is_folder;
      const bIsFolder = b.is_folder;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);
  
  return (
    <div className="card"> 
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        {typeof clienteId === 'string' && <Breadcrumbs clienteId={clienteId} path={currentPath || ''} clientMode={isRestrictedMode} />}
        <div className="page-actions">
          {canCreateFolder && <button className="secondary" onClick={() => setIsFolderModalOpen(true)}><FolderPlus size={20} /></button>}
          {canUpload && <button onClick={() => setIsUploadModalOpen(true)}><Upload size={20} /></button>}
        </div>
      </div>

      {isLoading && <div>Cargando...</div>}
      {isError && <div className="error-text">Error al cargar los documentos.</div>}
      {typeof clienteId !== 'string' && !isLoading && !isError && <div className="error-text" style={{padding: '2rem', textAlign: 'center'}}>ID de cliente no válido.</div>}
      {sortedFiles && sortedFiles.length === 0 && !isLoading && typeof clienteId === 'string' && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Esta carpeta está vacía.</div>}

      {sortedFiles && sortedFiles.length > 0 && typeof clienteId === 'string' && (
        <table className="table file-explorer">
          {canManage && (
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>Visible</th>
                <th>Nombre</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
          )}
          <tbody>
            {sortedFiles.map((file: ExplorerItem) => {
              const isFolder = file.is_folder;
              const isZippingThisFolder = isZipping === file.name;
              let folderLinkProps: { to: string; params: Record<string, string> };
              // Usamos isRestrictedMode para determinar la ruta de los links también
              if (isRestrictedMode && propClientMode) {
                 // Si es cliente REAL, usa la ruta /documentos-cliente
                 folderLinkProps = { to: documentosClienteRoute.id, params: { _splat: joinPath(currentPath, file.name) }, };
              } else {
                 // Si es admin o comercial (dentro de app), usa la ruta /clientes/:id/documentos
                 folderLinkProps = { to: clienteDocumentosRoute.id, params: { id: clienteId, _splat: joinPath(currentPath, file.name) }, };
              }
              
              return (
                <tr key={file.id ?? file.name}>
                  {canManage && (
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={file.is_visible}
                        onChange={(e) => {
                          const newVisibility = !file.is_visible;
                          if (isFolder) {
                            toggleFolderVisibilityMutation.mutate({ folderName: file.name, newVisibility: newVisibility });
                          } else {
                            if (!file.id) return;
                            toggleFileVisibilityMutation.mutate({ dbId: file.id, newVisibility: newVisibility });
                          }
                        }}
                        disabled={toggleFileVisibilityMutation.isPending || toggleFolderVisibilityMutation.isPending}
                      />
                    </td>
                  )}
                  <td className={`file-item ${isFolder ? 'is-folder' : 'is-file'}`}>
                    {isFolder ? (
                      <Link {...folderLinkProps}><Folder size={20} /><span>{file.name}</span></Link>
                    ) : (
                      <button
                        onClick={() => handlePreview(file.full_path, file.name)}
                        className="file-preview-button"
                        style={{ background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--fg)', fontWeight: 500, width: '100%'}}
                        title={`Vista previa de ${file.name}`}
                      >
                        {getFileIcon(file.name)}<span>{file.name}</span>
                      </button>
                    )}
                  </td>
                  <td className="file-actions">
                    {!isFolder && (
                        <button onClick={() => handlePreview(file.full_path, file.name)} className="icon-button secondary" title="Vista previa" style={{ marginLeft: '0.5rem' }} disabled={isLoadingPreview && previewFile?.name === file.name}>
                            {isLoadingPreview && previewFile?.name === file.name ? <Loader2 size={18} className="animate-spin" /> : <EyeIcon size={18} />}
                        </button>
                    )}
                    {!isFolder && (
                      <button onClick={() => handleDownload(file.name)} className="icon-button secondary" title="Descargar"><Download size={18} /></button>
                    )}
                    {isFolder && (
                      <button onClick={() => handleDownloadFolderZip(file.name)} className="icon-button secondary" title={`Descargar carpeta ${file.name} como .zip`} disabled={isZippingThisFolder}>
                        {isZipping === file.name ? <Loader2 size={18} className="animate-spin" /> : <FileArchive size={18} />}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(file.name, isFolder)} className="icon-button danger" title="Eliminar" disabled={deleteMutation.isPending}>
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

      {canManage && isFolderModalOpen && typeof clienteId === 'string' && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateFolder} className="modal-content card">
            <h3 style={{ marginTop: 0 }}>Crear Nueva Carpeta</h3>
            <div>
              <label htmlFor="folderName">Nombre de la carpeta</label>
              <input id="folderName" type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ej: Facturas 2025" autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" className="secondary" onClick={() => setIsFolderModalOpen(false)}>Cancelar</button>
              <button type="submit" disabled={createFolderMutation.isPending}>{createFolderMutation.isPending ? 'Creando...' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}

      {canManage && isUploadModalOpen && typeof clienteId === 'string' && (
        <ClienteDocumentoUploadModal
          clienteId={clienteId}
          currentPath={currentPath}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['documentos', clienteId, currentPath] });
            queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
          }}
        />
      )}
      
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, itemToDelete: null })} 
        onConfirm={() => {
          if (modalState.itemToDelete) {
            deleteMutation.mutate({ fullPath: modalState.itemToDelete.fullPath, isFolder: modalState.itemToDelete.isFolder });
          }
           setModalState({ isOpen: false, itemToDelete: null });
        }}
        title={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `Borrar Carpeta "${modalState.itemToDelete.name}"` : `Borrar Archivo "${modalState.itemToDelete.name}"`) : 'Confirmar Acción'}
        message={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `La carpeta "${modalState.itemToDelete.name}" contiene elementos. ¿Estás seguro de que quieres borrarla junto con todo su contenido? Esta acción es irreversible.` : `¿Estás seguro de que quieres eliminar el archivo "${modalState.itemToDelete.name}"? Esta acción es irreversible.`) : 'Por favor, confirma la acción.'}
        confirmText="Sí, Eliminar" cancelText="Cancelar" confirmButtonClass="danger" isConfirming={deleteMutation.isPending} 
      />

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
  );
}