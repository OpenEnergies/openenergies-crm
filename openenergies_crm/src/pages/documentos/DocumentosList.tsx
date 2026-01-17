import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { Link } from '@tanstack/react-router'
import { RootDocumentItem } from '@lib/types'
import { Download, Folder, FileText, FileArchive, Loader2, FileUp, FileImage, FileSpreadsheet, Eye as EyeIcon, Search, FolderOpen } from 'lucide-react'
import { useSession } from '@hooks/useSession'
import { useTheme } from '@hooks/ThemeContext'
import { EmptyState } from '@components/EmptyState'
import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';
import FilePreviewModal from '@components/FilePreviewModal';
import DocumentoUploadModal from './DocumentoUploadModal';

const getFileIcon = (fileName: string, size: number = 20) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (['pdf'].includes(extension)) {
    return <FileText size={size} className="text-red-400" />;
  }
  if (['doc', 'docx'].includes(extension)) {
    return <FileText size={size} className="text-blue-400" />;
  }
  if (['txt'].includes(extension)) {
    return <FileText size={size} className="text-gray-400" />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return <FileImage size={size} className="text-green-400" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return <FileSpreadsheet size={size} className="text-emerald-400" />;
  }
  if (['zip', 'rar', '7z', 'tar'].includes(extension)) {
    return <FileArchive size={size} className="text-blue-400" />;
  }

  return <FileText size={size} className="text-gray-400" />;
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
  const queryClient = useQueryClient()
  const { theme } = useTheme()

  // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  const [filter, setFilter] = useState('')
  const [isZipping, setIsZipping] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['all_root_documents'],
    queryFn: fetchAllRootDocuments,
  })

  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const canUpload = rol === 'administrador' || rol === 'comercial'
  const canSearch = rol === 'administrador' || rol === 'comercial'

  const filteredData = useMemo(() => {
    if (!data) return []

    const clientVisibleData = (rol === 'cliente')
      ? data.filter(item => item.visible_para_cliente)
      : data;

    if (!filter || !canSearch) return clientVisibleData;

    return clientVisibleData.filter(
      item =>
        (item.item_name && item.item_name.toLowerCase().includes(filter.toLowerCase())) ||
        (item.cliente_nombre && item.cliente_nombre.toLowerCase().includes(filter.toLowerCase()))
    )
  }, [data, filter, canSearch, rol]);

  const handlePreview = async (filePath: string, fileName: string) => {
    setIsLoadingPreview(true);
    setPreviewFile({ url: '', name: fileName });
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 3600);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
          </div>
          <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Documentos Globales</h1>
        </div>

        <div className="flex items-center gap-3">
          {canSearch && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-fenix-600 dark:text-fenix-400 whitespace-nowrap">
                <Search size={16} />
                Buscar
              </label>
              <input
                type="text"
                placeholder="Nombre o cliente..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="glass-input pr-4 py-2 min-w-[200px]"
              />
            </div>
          )}
          {canUpload && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer"
            >
              <FileUp size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
            <span className="text-slate-500 dark:text-slate-400">Cargando...</span>
          </div>
        )}
        {isError && (
          <div className="text-center py-12">
            <p className="text-red-400">Error al cargar documentos.</p>
          </div>
        )}

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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="border-b-2 bg-bg-intermediate"
                  style={{ borderBottomColor: tableBorderColor }}
                >
                  <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Nombre del Archivo / Carpeta
                  </th>
                  <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">
                    Cliente Propietario
                  </th>
                  <th className="p-4 text-right text-xs font-bold text-primary uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {filteredData.map(item => {
                  const zipKey = `${item.cliente_id}-${item.item_name}`;
                  const isZippingThisFolder = isZipping === zipKey;
                  return (
                    <tr key={`${item.cliente_id}-${item.full_path}`} className="hover:bg-fenix-500/8 transition-colors cursor-pointer">
                      <td className="p-4">
                        {item.is_folder ? (
                          canSearch ? (
                            <Link
                              to="/app/clientes/$id/documentos/$"
                              params={{ id: item.cliente_id, _splat: item.item_name }}
                              className="flex items-center gap-3 text-fenix-400 hover:text-fenix-300 transition-colors"
                            >
                              <Folder size={20} className="text-amber-500" />
                              <span className="font-medium">{item.item_name}</span>
                            </Link>
                          ) : (
                            <Link
                              to="/app/documentos-cliente/$"
                              params={{ _splat: item.item_name }}
                              className="flex items-center gap-3 text-fenix-400 hover:text-fenix-300 transition-colors"
                            >
                              <Folder size={20} className="text-amber-500" />
                              <span className="font-medium">{item.item_name}</span>
                            </Link>
                          )
                        ) : (
                          <button
                            onClick={() => handlePreview(item.full_path, item.item_name)}
                            className="flex items-center gap-3 hover:text-fenix-500 dark:hover:text-fenix-400 transition-colors w-full text-left cursor-pointer"
                            title={`Vista previa de ${item.item_name}`}
                          >
                            {getFileIcon(item.item_name)}
                            <span className="text-secondary font-bold">{item.item_name}</span>
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">{item.cliente_nombre}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!item.is_folder && (
                            <button
                              onClick={() => handlePreview(item.full_path, item.item_name)}
                              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors cursor-pointer"
                              title="Vista previa"
                            >
                              <EyeIcon size={16} />
                            </button>
                          )}
                          {item.is_folder && (
                            <button
                              onClick={() => handleDownloadFolderZip(item.cliente_id, item.item_name)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors disabled:opacity-50 cursor-pointer"
                              title={`Descargar carpeta ${item.item_name} como .zip`}
                              disabled={isZippingThisFolder}
                            >
                              {isZippingThisFolder ? <Loader2 size={16} className="animate-spin" /> : <FileArchive size={16} />}
                            </button>
                          )}
                          {!item.is_folder && (
                            <button
                              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors cursor-pointer"
                              title="Descargar documento"
                              onClick={async () => {
                                const fullPath = item.full_path

                                try {
                                  const { data, error } = await supabase.storage
                                    .from('documentos')
                                    .download(fullPath)

                                  if (error) throw error

                                  const url = URL.createObjectURL(data)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = item.item_name
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
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => { setPreviewFile(null); setIsLoadingPreview(false); }}
        fileUrl={previewFile?.url || null}
        fileName={previewFile?.name || null}
      />

      {/* Loading overlay */}
      {isLoadingPreview && !previewFile?.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Cargando vista previa...</span>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <DocumentoUploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['all_root_documents'] });
          }}
        />
      )}
    </div>
  )
}

