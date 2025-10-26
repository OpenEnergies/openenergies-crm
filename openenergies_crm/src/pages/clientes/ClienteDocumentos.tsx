import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
// --- (1) Importar 'Link' y 'useParams' ---
import { Link, useParams } from '@tanstack/react-router'; 
// Arriba, con las otras importaciones de lucide-react
import { Folder, File, Upload, FolderPlus, Trash2, Download, FileArchive, Loader2, Eye, EyeOff } from 'lucide-react';
import { clienteDocumentosRoute, documentosClienteRoute } from '@router/routes'; 
import { useState, useMemo } from 'react';
import { useSession } from '@hooks/useSession';
import ClienteDocumentoUploadModal from './ClienteDocumentoUploadModal';
import { joinPath } from '@lib/utils';
import { saveAs } from 'file-saver';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '@components/ConfirmationModal';
import { th } from 'date-fns/locale/th';

// --- (2) Eliminar tipos innecesarios ---
// Ya no necesitamos ClienteDocParams ni DocClienteParams

const PLACEHOLDER = '.emptyFolderPlaceholder';

// ... (listFiles, isFolderEffectivelyEmpty no cambian) ...
// Función para listar archivos y carpetas

type ExplorerItem = {
  name: string;
  is_folder: boolean;
  id: string | null; // null para carpetas
  full_path: string;
  is_visible: boolean; // true si visible_para_cliente es true (para archivos)
};

// Reemplaza tu función listFiles existente por esta:

// Reemplaza tu función listFiles completa por esta:

// Reemplaza tu función listFiles completa por esta versión:

async function listFiles(
  clienteId: string,
  path: string,
  clientMode: boolean
): Promise<ExplorerItem[]> {
  const fullPath = joinPath('clientes', clienteId, path);

  // 1. Obtener carpetas y archivos de Storage (Sin cambios)
  const { data: storageData, error: storageError } = await supabase.storage
    .from('documentos')
    .list(fullPath, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  if (storageError) throw storageError;

  const itemsFromStorage = (storageData ?? []).filter((item) => item.name !== PLACEHOLDER);

  // 2. Obtener metadatos de archivos de la BBDD (FILTRO CORREGIDO)
  let query = supabase
    .from('documentos')
    .select('id, ruta_storage, visible_para_cliente, nombre_archivo') // Mantenemos nombre_archivo por si acaso
    .eq('cliente_id', clienteId);

  // Siempre pedimos todos los archivos bajo la ruta del cliente
  const clientRootPathPrefix = `clientes/${clienteId}/`;
  query = query.like('ruta_storage', `${clientRootPathPrefix}%`);

  // --- ¡CORRECCIÓN IMPORTANTE AQUÍ! ---
  // Aplicamos el filtro para cliente DESPUÉS de construir la query base
  if (clientMode) {
    query = query.eq('visible_para_cliente', true); // <-- ESTE FILTRO AHORA SE APLICA CORRECTAMENTE
  }
  // --- FIN CORRECCIÓN ---

  // Ejecutamos la query final
  const { data: dbFiles, error: dbError } = await query;
  if (dbError) throw dbError;

  // 3. Mergear y formatear (Lógica sin cambios respecto a la última versión)
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
        // En modo cliente, dbFiles ya está filtrado por visible=true.
        // Si algún archivo visible empieza con esta ruta de carpeta, la carpeta es visible.
        isFolderVisible = dbFiles.some(f => f.ruta_storage.startsWith(folderPrefix));
      } else {
        // --- CORRECCIÓN AQUÍ ---
        // En modo admin, dbFiles NO está filtrado, así que debemos comprobar
        // la visibilidad de los archivos que encontramos dentro de la carpeta.
        isFolderVisible = dbFiles.some(f => 
          f.ruta_storage.startsWith(folderPrefix) && f.visible_para_cliente === true
        );
        // --- FIN CORRECCIÓN ---
      }
    }

    // Si estamos en modo cliente y no encontramos coincidencia en dbFiles (que ya está filtrado),
    // significa que este archivo no es visible, así que lo marcamos como no visible.
    const isVisibleForClient = clientMode
        ? isFolder ? isFolderVisible : !!dbMatch // En modo cliente, la visibilidad depende de si se encontró en dbFiles (ya filtrados)
        : isFolder ? isFolderVisible : (dbMatch?.visible_para_cliente ?? false); // En modo admin, usamos el valor de la BD

    return {
      name: item.name,
      is_folder: isFolder,
      id: dbMatch?.id ?? null,
      full_path: itemFullPath,
      is_visible: isVisibleForClient, // <-- Usamos la visibilidad calculada
    };
  });
  // --- FIN MERGE ---


  // --- FILTRADO FINAL PARA CLIENTE ---
  // Aunque la query ya filtra, necesitamos filtrar aquí también para:
  // 1. Ocultar carpetas que quedaron vacías DESPUÉS del filtrado de la query.
  // 2. Asegurar que solo se muestren los items que realmente deben verse.
  if (clientMode) {
    // Mantenemos solo los archivos (ya filtrados por la query) y las carpetas que calculamos como visibles
    const clientVisibleItems = explorerItems.filter(item => item.is_visible);

    // Lógica adicional para ocultar carpetas vacías (opcional pero recomendable)
    // Esto requiere una comprobación más compleja o asumir que si isFolderVisible es true, no está vacía.
    // Por simplicidad, devolveremos solo los items marcados como visibles:
    return clientVisibleItems;
  }
  // --- FIN FILTRADO FINAL ---


  // Para admin/comercial, devolvemos todo
  return explorerItems;
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


// --- (3) Breadcrumbs CORREGIDO ---
function Breadcrumbs({ clienteId, path, clientMode }: { clienteId: string; path: string; clientMode: boolean }) {
  const segments = path.split('/').filter(Boolean);

  // Usamos los IDs de ruta directamente (son strings)
  const baseTo = clientMode ? documentosClienteRoute.id : clienteDocumentosRoute.id; 
  // Creamos los objetos de parámetros
  const baseParams = clientMode 
    ? { _splat: '' } 
    : { id: clienteId, _splat: '' };

  return (
    <nav className="breadcrumbs">
      {/* Pasamos los params directamente. TS debería inferirlos */}
      <Link to={baseTo} params={baseParams}> 
        Documentos
      </Link>
      {segments.map((segment, index) => {
        const currentPath = segments.slice(0, index + 1).join('/');
        // Creamos los objetos de parámetros
        const segmentParams = clientMode 
          ? { _splat: currentPath } 
          : { id: clienteId, _splat: currentPath };
        
        return (
          <span key={index}>
            /{' '}
            {/* Pasamos los params directamente. TS debería inferirlos */}
            <Link to={baseTo} params={segmentParams}> 
              {segment}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
// --- Fin corrección Breadcrumbs ---

// ... (createFolder no cambia) ...
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


export default function ClienteDocumentos({
  clienteId: explicitClienteId, 
  pathSplat: explicitPathSplat, 
  clientMode = false 
}: {
  clienteId?: string;
  pathSplat?: string;
  clientMode?: boolean;
}) {
  // --- (4) Corregir obtención de params ---
  // Obtener params usando la ruta correcta según el modo
  const paramsFromRoute = useParams({ 
    from: clientMode ? documentosClienteRoute.id : clienteDocumentosRoute.id 
  });
  // Asegurar que clienteId es string o undefined
  // Usamos un type assertion para indicarle a TS qué tipo esperar aquí
  const clienteId: string | undefined = explicitClienteId ?? (paramsFromRoute as { id?: string }).id ?? undefined; 
  const path: string | undefined = explicitPathSplat ?? paramsFromRoute._splat;
  // --- Fin corrección params ---
  
  const queryClient = useQueryClient();
  const { rol } = useSession();

  // ... (Estados locales no cambian: isFolderModalOpen, etc.) ...
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const canManage = rol === 'administrador' || rol === 'comercial';
  const canUpload = canManage;
  const canCreateFolder = canManage;
  const canDelete = canManage;
  const currentPath = path || '';

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    itemToDelete: { name: string; fullPath: string; isFolder: boolean } | null;
  }>({ isOpen: false, itemToDelete: null });

  const [isZipping, setIsZipping] = useState<string | null>(null);

  // --- Query (sin cambios, ya valida clienteId en enabled) ---
  // Busca el useQuery de 'files' y modifícalo:
  const { data: files, isLoading, isError } = useQuery({
    queryKey: ['documentos', clienteId, currentPath, clientMode], // <-- Añadir clientMode
    queryFn: () => {
      if (typeof clienteId !== 'string') {
          throw new Error("Cliente ID inválido para cargar documentos.");
      }
      // Pasar clientMode a la función
      return listFiles(clienteId, currentPath, clientMode); 
    },
    enabled: typeof clienteId === 'string', 
  });

  // ... (Mutaciones y Handlers: getAllPathsToDelete, deleteMutation, handleDelete, handleDownload, handleDownloadFolderZip, createFolderMutation, handleCreateFolder NO CAMBIAN) ...
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
    // Asegurarse de que tenemos un clienteId válido
    if (!clienteId) return; 
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
    // Asegurarse de que tenemos un clienteId válido
    if (!clienteId) return; 
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
  // Asegurarse de que tenemos un clienteId válido
  if (!clienteId) return; 
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

  // Mutación para un solo archivo
// Mutación para un solo archivo (AHORA USA ID)
const toggleFileVisibilityMutation = useMutation({
  mutationFn: async ({ dbId, newVisibility }: { dbId: string; newVisibility: boolean }) => {
    // Actualiza usando el ID de la tabla 'documentos'
    const { error } = await supabase
      .from('documentos')
      .update({ visible_para_cliente: newVisibility })
      .eq('id', dbId); // <-- CAMBIO: Usar eq('id', dbId)
    if (error) throw error;
  },
  onSuccess: () => {
    // La invalidación sigue igual
    queryClient.invalidateQueries({
      queryKey: ['documentos', clienteId, currentPath, clientMode],
      exact: true
    });
  },
  onError: (error: Error) => {
    toast.error(`Error al actualizar visibilidad: ${error.message}`);
  },
});

// Mutación para carpetas (RPC)
  const toggleFolderVisibilityMutation = useMutation({
    mutationFn: async ({ folderName, newVisibility }: { folderName: string; newVisibility: boolean }) => {
      if (!clienteId) return;
      const folderPath = joinPath(currentPath, folderName);
      const { error } = await supabase.rpc('set_folder_visibility', {
        p_cliente_id: clienteId,
        p_folder_path: folderPath,
        p_is_visible: newVisibility
      });
      if (error) throw error;
    },
    onSuccess: async () => { // <-- Función async
    toast.success('Visibilidad de la carpeta actualizada.');
    const queryKey = ['documentos', clienteId, currentPath, clientMode];

    // 1. Invalidar primero para marcar como obsoleto
    await queryClient.invalidateQueries({ queryKey, exact: true });

    // 2. Forzar refetch inmediato y esperar
    await queryClient.refetchQueries({ queryKey, exact: true });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar carpeta: ${error.message}`);
    },
  });

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !clienteId) return; // Asegurar clienteId
    createFolderMutation.mutate({ clienteId, path: currentPath, folderName: newFolderName });
  };

  // Ordenamos para que las carpetas aparezcan primero
  const sortedFiles = useMemo(() => {
    if (!files) return [] as any[];
    return [...files].sort((a: any, b: any) => {
      // Corrección: 'is_folder' es un booleano en nuestro tipo ExplorerItem
      const aIsFolder = a.is_folder;
      const bIsFolder = b.is_folder;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);
  
  // --- Renderizado JSX (dentro del return) ---
  return (
    <div className="card"> 
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        {typeof clienteId === 'string' && 
          <Breadcrumbs clienteId={clienteId} path={currentPath || ''} clientMode={clientMode} />
        }
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

      {/* Asegurar que clienteId es un string válido antes de renderizar la tabla */}
      {typeof clienteId !== 'string' && !isLoading && !isError && (
          <div className="error-text" style={{padding: '2rem', textAlign: 'center'}}>ID de cliente no válido.</div>
      )}

      {sortedFiles && sortedFiles.length === 0 && !isLoading && typeof clienteId === 'string' && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          Esta carpeta está vacía.
        </div>
      )}

      {/* Renderizar tabla solo si hay archivos Y clienteId es válido */}
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
          {/* ====================================================================== */}
          {/* === SECCIÓN CORREGIDA === */}
          {/* ====================================================================== */}
          {/* Pega esto reemplazando tu <tbody> ... </tbody> completo */}
          <tbody>
            {sortedFiles.map((file: ExplorerItem) => {
              const isFolder = file.is_folder;
              const isZippingThisFolder = isZipping === file.name;

              // Lógica para el link (sin cambios)
              let folderLinkProps: { to: string; params: Record<string, string> };
              if (clientMode) {
                folderLinkProps = {
                  to: documentosClienteRoute.id,
                  params: { _splat: joinPath(currentPath, file.name) },
                };
              } else {
                folderLinkProps = {
                  to: clienteDocumentosRoute.id,
                  params: { id: clienteId, _splat: joinPath(currentPath, file.name) },
                };
              }
              
              return (
                <tr key={file.id ?? file.name}>
                  
                  {/* === 1. CELDA DE VISIBILIDAD (CORREGIDA) === */}
                  {/* === 1. CELDA DE VISIBILIDAD (CORREGIDA CON LLAMADA POR ID) === */}
                  {canManage && (
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                      <input
                        type="checkbox"
                        title={file.is_visible ? (isFolder ? "Al menos un archivo es visible. Haz clic para ocultar todos." : "Ocultar al cliente") : (isFolder ? "Hacer toda la carpeta visible" : "Hacer visible al cliente")}
                        checked={file.is_visible}
                        onChange={(e) => {
                        // Calcula el NUEVO estado deseado invirtiendo el estado ACTUAL de los datos
                          const newVisibility = !file.is_visible;

                          if (isFolder) {
                            // Carpeta: Llama a RPC con el estado calculado
                            toggleFolderVisibilityMutation.mutate({
                              folderName: file.name,
                              newVisibility: newVisibility // <--- Usa el estado calculado
                            });
                          } else {
                            // Archivo: Llama a mutación CON ID (puede usar el estado calculado o el del evento)
                            if (!file.id) {
                              toast.error("Error: No se pudo identificar el documento.");
                              console.error("Intento de toggle en archivo sin ID:", file);
                              return;
                            }
                            toggleFileVisibilityMutation.mutate({
                              dbId: file.id,
                              newVisibility: newVisibility // <--- Usa el estado calculado también para consistencia
                            });
                          }
                        }}
                        // Deshabilita el checkbox mientras se guarda (sin cambios)
                        disabled={toggleFileVisibilityMutation.isPending || toggleFolderVisibilityMutation.isPending}
                      />
                    </td>
                  )}

                  {/* === 2. CELDA DE NOMBRE (CORREGIDA) === */}
                  <td className={`file-item ${isFolder ? 'is-folder' : 'is-file'}`}>
                    {isFolder ? (
                      <Link {...folderLinkProps}>
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

                  {/* === 3. CELDA DE ACCIONES (CORREGIDA) === */}
                  <td className="file-actions">
                    {!isFolder && (
                      <button onClick={() => handleDownload(file.name)} className="icon-button secondary" title="Descargar">
                        <Download size={18} />
                      </button>
                    )}
                    {isFolder && (
                      <button
                        onClick={() => handleDownloadFolderZip(file.name)}
                        className="icon-button secondary"
                        title={`Descargar carpeta ${file.name} como .zip`}
                        disabled={isZippingThisFolder}
                      >
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
          {/* ====================================================================== */}
          {/* === FIN DE SECCIÓN CORREGIDA === */}
          {/* ====================================================================== */}
        </table>
      )}

      {/* Modales (Crear, Subir, Confirmar) - Asegurar clienteId para Crear/Subir */}
      {canManage && isFolderModalOpen && typeof clienteId === 'string' && (
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

      {canManage && isUploadModalOpen && typeof clienteId === 'string' && (
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
        onClose={() => setModalState({ isOpen: false, itemToDelete: null })} 
        onConfirm={() => {
          if (modalState.itemToDelete) {
            deleteMutation.mutate({
              fullPath: modalState.itemToDelete.fullPath,
              isFolder: modalState.itemToDelete.isFolder,
            });
          }
           setModalState({ isOpen: false, itemToDelete: null });
        }}
        title={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `Borrar Carpeta "${modalState.itemToDelete.name}"` : `Borrar Archivo "${modalState.itemToDelete.name}"`) : 'Confirmar Acción'}
        message={modalState.itemToDelete ? (modalState.itemToDelete.isFolder ? `La carpeta "${modalState.itemToDelete.name}" contiene elementos. ¿Estás seguro de que quieres borrarla junto con todo su contenido? Esta acción es irreversible.` : `¿Estás seguro de que quieres eliminar el archivo "${modalState.itemToDelete.name}"? Esta acción es irreversible.`) : 'Por favor, confirma la acción.'}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="danger" 
        isConfirming={deleteMutation.isPending} 
      />
    </div>
  );
}