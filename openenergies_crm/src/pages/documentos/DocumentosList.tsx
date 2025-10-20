// @ts-nocheck
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { Link } from '@tanstack/react-router'
import { RootDocumentItem } from '@lib/types' // <-- Importamos el tipo actualizado
import { Download, Folder, FileText } from 'lucide-react'
import { useSession } from '@hooks/useSession'
import { EmptyState } from '@components/EmptyState'
import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast';

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
  const { data, isLoading, isError } = useQuery({
    queryKey: ['all_root_documents'],
    queryFn: fetchAllRootDocuments,
  })

  const canUpload = rol === 'administrador' || rol === 'comercial'

  const filteredData = useMemo(() => {
    if (!data) return []
    if (!filter) return data

    return data.filter(
      item =>
        // Los 'item.item_name' ahora están limpios (ej: 'factura.pdf' o 'Mi Carpeta')
        (item.item_name && item.item_name.toLowerCase().includes(filter.toLowerCase())) ||
        (item.cliente_nombre && item.cliente_nombre.toLowerCase().includes(filter.toLowerCase()))
    )
  }, [data, filter])

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Documentos Globales</h2>
        <div className="page-actions">
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

        {filteredData && filteredData.length === 0 && !isLoading && (
          <EmptyState
            title={filter ? 'Sin resultados' : 'Sin documentos'}
            description={
              filter
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
                {filteredData.map(item => (
                  // --- CAMBIO #1: Usamos 'full_path' como key ---
                  // Es único (ej: 'uuid/fichero.pdf' o 'uuid/carpeta/.empty...')
                  // Esto soluciona el error de "key" en la consola.
                  <tr key={item.full_path}>
                    <td className={`file-item ${item.is_folder ? 'is-folder' : 'is-file'}`}>
                      {item.is_folder ? (
                        <Link
                          to="/app/clientes/$id/documentos/$splat"
                          // 'item.item_name' ahora es el nombre limpio de la carpeta
                          params={{ id: item.cliente_id, splat: item.item_name }}
                        >
                          <Folder size={20} />
                          <span>{item.item_name}</span>
                        </Link>
                      ) : (
                        <div>
                          <FileText size={20} />
                          <span>{item.item_name}</span>
                        </div>
                      )}
                    </td>
                    <td>{item.cliente_nombre}</td>
                    <td style={{ textAlign: 'right' }}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}