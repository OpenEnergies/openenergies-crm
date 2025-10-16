// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { RootDocumentItem } from '@lib/types'; // <-- Importamos el nuevo tipo
import { Download, Folder, FileText } from 'lucide-react'; // <-- Íconos añadidos
import { useSession } from '@hooks/useSession';
import { EmptyState } from '@components/EmptyState';
import { useState, useMemo } from 'react';

// --- CAMBIO #2: La función ahora llama a nuestra RPC 'get_all_root_documents' ---
async function fetchAllRootDocuments(): Promise<RootDocumentItem[]> {
  const { data, error } = await supabase.rpc('get_all_root_documents');
  if (error) {
    console.error("Error al llamar a la función RPC 'get_all_root_documents':", error);
    throw error;
  }
  return data;
}

export default function DocumentosList() {
  const { rol } = useSession();
  // La query ahora llama a la nueva función
  const [filter, setFilter] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['all_root_documents'],
    queryFn: fetchAllRootDocuments,
  });

  // Los permisos para subir documentos se mantienen igual
  const canUpload = rol === 'administrador' || rol === 'comercial';

  // --- CAMBIO #2: Filtramos los datos antes de renderizarlos ---
  // useMemo optimiza el rendimiento para que el filtrado no se ejecute en cada render.
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!filter) return data; // Si no hay filtro, devolvemos todos los datos

    return data.filter(item =>
      item.item_name.toLowerCase().includes(filter.toLowerCase()) ||
      item.cliente_nombre.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data, filter]);

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Documentos Globales</h2>
        <div className="page-actions">
          {/* --- CAMBIO #3: Añadimos la barra de búsqueda --- */}
          <input
            type="text"
            placeholder="Buscar por nombre o cliente..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ minWidth: '250px' }}
          />
          {canUpload && (
            <Link to="/app/documentos/subir">
              <button>Subir Documento</button>
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar documentos.</div>}
        
        {/* Usamos filteredData en lugar de 'data' para el renderizado */}
        {filteredData && filteredData.length === 0 && !isLoading && (
            <EmptyState 
                title={filter ? "Sin resultados" : "Sin documentos"}
                description={filter ? "No se encontraron documentos o carpetas que coincidan con tu búsqueda." : "No hay documentos ni carpetas en la raíz de ningún cliente."}
            />
        )}

        {filteredData && filteredData.length > 0 && (
          <div className="table-wrapper">
            <table className="table file-explorer"> {/* Usamos la misma clase para consistencia visual */}
              <thead>
                <tr>
                  <th>Nombre del Archivo / Carpeta</th>
                  <th>Cliente Propietario</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(item => (
                  <tr key={`${item.cliente_id}-${item.item_name}`}>
                    {/* --- CAMBIO #3: Renderizado condicional para carpetas y ficheros --- */}
                    <td className={`file-item ${item.is_folder ? 'is-folder' : 'is-file'}`}>
                      {item.is_folder ? (
                        // Si es una carpeta, el enlace apunta a la vista de documentos de ese cliente
                        <Link to="/app/clientes/$id/documentos/$splat" params={{ id: item.cliente_id, splat: item.item_name }}>
                          <Folder size={20} />
                          <span>{item.item_name}</span>
                        </Link>
                      ) : (
                        // Si es un fichero, simplemente mostramos el nombre
                        <div>
                          <FileText size={20} />
                          <span>{item.item_name}</span>
                        </div>
                      )}
                    </td>
                    <td>{item.cliente_nombre}</td>
                    <td style={{ textAlign: 'right' }}>
                      {/* La acción de descargar solo se muestra si NO es una carpeta */}
                      {!item.is_folder && (
                        <button
                          className="icon-button secondary"
                          title="Descargar documento"
                          onClick={async () => {
                            const fullPath = `clientes/${item.cliente_id}/${item.item_name}`;
                            try {
                              const { data, error } = await supabase.storage.from('documentos').download(fullPath);
                              if (error) throw error;
                              
                              const url = URL.createObjectURL(data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = item.item_name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);

                            } catch (e: any) { alert(e.message); }
                          }}
                        >
                          <Download size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}