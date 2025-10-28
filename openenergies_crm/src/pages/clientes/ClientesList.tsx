// @ts-nocheck
// src/pages/clientes/ClientesList.tsx
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import type { Cliente, EstadoCliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
// --- Importar Users icon ---
import { Pencil, MapPin, Building2, Trash2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { useSortableTable } from '@hooks/useSortableTable';

type ClienteConEmpresa = Cliente & {
  empresas: {
    nombre: string;
  } | null;
  estado: EstadoCliente;
  // --- Propiedad para comerciales ---
  comerciales_asignados?: { nombre: string | null, apellidos: string | null }[] | null;
};

// --- Añadir clave para ordenar por comerciales ---
type SortableClienteKey = keyof ClienteConEmpresa | 'empresa_nombre' | 'dni_cif' | 'comerciales_nombres';

const initialColumnFilters = {
  estado: [] as string[],
};

// --- Ajustar la query para seleccionar los comerciales ---
// ASUMIMOS que la RPC 'search_clientes' ya devuelve 'comerciales_asignados'
async function fetchClientes(filter: string): Promise<ClienteConEmpresa[]> {
  const selectQuery = `
    *,
    empresas ( nombre ),
    estado,
    comerciales_asignados:asignaciones_comercial (
        usuarios_app ( nombre, apellidos )
    )
  `;

  if (!filter) {
    // Si no hay filtro, hacemos un select normal con join implícito
    const { data, error } = await supabase
      .from('clientes')
      .select(selectQuery)
      .limit(100)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    // Mapear para ajustar la estructura de comerciales_asignados
    return (data || []).map(c => ({
        ...c,
        comerciales_asignados: c.comerciales_asignados?.map((a: any) => a.usuarios_app) ?? []
    })) as ClienteConEmpresa[];
  }

  // Si hay filtro, usamos la RPC (ASEGÚRATE QUE LA RPC DEVUELVA LOS COMERCIALES)
  // Si la RPC no devuelve 'comerciales_asignados' directamente con el formato deseado,
  // necesitarás ajustar la RPC o hacer una segunda query aquí.
  // Asumiendo que la RPC SÍ los devuelve en un formato similar al SELECT:
  const { data, error } = await supabase
    .rpc('search_clientes', { search_text: filter })
     // Intenta seleccionar los datos relacionados si la RPC devuelve IDs de cliente
    .select(selectQuery) // Ajusta este select si la RPC devuelve toda la data
    .limit(100)
    .order('creado_en', { ascending: false });

  if (error) throw error;
  // Mapear para ajustar la estructura si es necesario (depende de la RPC)
   return (data || []).map((c: any) => ({
        ...c,
        // Ajusta esto según cómo la RPC devuelva los comerciales
        comerciales_asignados: c.comerciales_asignados?.map((a: any) => a.usuarios_app ?? a) ?? []
    })) as ClienteConEmpresa[];
}


async function deleteCliente({ clienteId }: { clienteId: string }) {
    const { error } = await supabase.functions.invoke('manage-client', {
        body: { action: 'delete', payload: { clienteId } }
    });
    if (error) throw new Error(error.message);
}

export default function ClientesList(){
  const { rol } = useSession(); // Obtenemos el rol actual
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');

  const [clienteToDelete, setClienteToDelete] = useState<ClienteConEmpresa | null>(null);
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  const { data: fetchedData, isLoading, isError } = useQuery({
      queryKey:['clientes', filter],
      queryFn:()=>fetchClientes(filter)
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCliente,
    onSuccess: () => {
        toast.success('Cliente y todos sus datos asociados han sido eliminados.');
        setClienteToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
        toast.error(`Error al eliminar el cliente: ${error.message}`);
        setClienteToDelete(null);
    }
  });

  const filterOptions = useMemo(() => {
    return {
      estado: ['stand by', 'procesando', 'activo', 'desistido'] as EstadoCliente[]
    };
  }, []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    let items = fetchedData;
    // Filtro de columna 'estado'
    return items.filter(item => {
      const estadoItem = item.estado || 'stand by';
      return (
        (columnFilters.estado.length === 0 || columnFilters.estado.includes(estadoItem))
      );
    });
  }, [fetchedData, columnFilters]);

  // --- Actualizar useSortableTable ---
  const {
      sortedData: displayedData,
      handleSort,
      renderSortIcon
      // Añadimos la nueva clave al tipo genérico
  } = useSortableTable<ClienteConEmpresa, SortableClienteKey>(filteredData, {
      initialSortKey: 'creado_en',
      initialSortDirection: 'desc',
      sortValueAccessors: {
          empresa_nombre: (item) => item.empresas?.nombre,
          dni_cif: (item) => item.dni || item.cif,
          nombre: (item) => item.nombre,
          // Accesor para comerciales: une nombres o devuelve null
          comerciales_nombres: (item) =>
              item.comerciales_asignados && item.comerciales_asignados.length > 0
              ? item.comerciales_asignados
                  .map(c => `${c?.nombre ?? ''} ${c?.apellidos ?? ''}`.trim())
                  .filter(Boolean)
                  .join(', ')
              : null, // Devolver null si no hay comerciales para ordenar correctamente
          email_facturacion: (item) => item.email_facturacion, // Mantener este accesor
          // Añadir otros accesores si es necesario
      }
  });

  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';
  const isAdmin = rol === 'administrador'; // Variable para comprobar si es admin
  const isFiltered = filter.length > 0 || columnFilters.estado.length > 0;

  // --- Función helper para mostrar nombres de comerciales ---
  const formatComerciales = (comerciales: { nombre: string | null, apellidos: string | null }[] | null | undefined): string => {
      if (!comerciales || comerciales.length === 0) return '—';
      return comerciales
          .map(c => `${c?.nombre ?? ''} ${c?.apellidos ?? ''}`.trim()) // Une nombre y apellidos
          .filter(Boolean) // Quita nombres vacíos si los hubiera
          .join(', '); // Une con coma y espacio
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>Clientes</h2>
        {/* El botón Nuevo Cliente no cambia */}
        <Link to="/app/clientes/nuevo"><button>Nuevo Cliente</button></Link>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem', maxWidth: '400px' }}>
          <input
            placeholder="Buscar por nombre, DNI/CIF o comercializadora"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar clientes.</div>}

        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && (
          <EmptyState
            title="Sin clientes"
            description="Aún no hay clientes registrados."
            cta={<Link to="/app/clientes/nuevo"><button>Crear el primero</button></Link>}
          />
        )}

        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper" role="table" aria-label="Listado de clientes">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort('nombre')} className="sortable-header">
                      Nombre {renderSortIcon('nombre')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('empresa_nombre')} className="sortable-header">
                      Empresa {renderSortIcon('empresa_nombre')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('dni_cif')} className="sortable-header">
                      DNI/CIF {renderSortIcon('dni_cif')}
                    </button>
                  </th>
                  {/* --- Ocultar cabecera de Email si es admin --- */}
                  {!isAdmin && (
                    <th>
                      <button onClick={() => handleSort('email_facturacion')} className="sortable-header">
                        Email facturación {renderSortIcon('email_facturacion')}
                      </button>
                    </th>
                  )}
                   {/* --- Nueva cabecera para Comerciales (solo admin) --- */}
                   {isAdmin && (
                      <th>
                        <button onClick={() => handleSort('comerciales_nombres')} className="sortable-header">
                          Comerciales Asignados {renderSortIcon('comerciales_nombres')}
                        </button>
                      </th>
                   )}
                  <th>
                    <button onClick={() => handleSort('creado_en')} className="sortable-header">
                      Creado {renderSortIcon('creado_en')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('estado')} className="sortable-header">
                      Estado {renderSortIcon('estado')}
                    </button>
                    <ColumnFilterDropdown
                      columnName="Estado"
                      options={filterOptions.estado}
                      selectedOptions={columnFilters.estado}
                      onChange={(selected) => handleColumnFilterChange('estado', selected)}
                    />
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to="/app/clientes/$id" params={{ id: c.id }} className="table-action-link font-semibold">
                          {c.nombre}
                        </Link>
                      </td>
                      <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Building2 size={16} style={{ color: 'var(--muted)'}} />
                              {c.empresas?.nombre ?? 'No asignada'}
                          </div>
                      </td>
                      <td>{c.dni || c.cif || '—'}</td>
                      {/* --- Ocultar celda de Email si es admin --- */}
                      {!isAdmin && (
                        <td>{c.email_facturacion ?? '—'}</td>
                      )}
                      {/* --- Nueva celda para Comerciales (solo admin) --- */}
                      {isAdmin && (
                          <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Users size={16} style={{ color: 'var(--muted)'}} />
                                  {/* Usar la función helper */}
                                  {formatComerciales(c.comerciales_asignados)}
                              </div>
                          </td>
                      )}
                      <td>{fmtDate(c.creado_en)}</td>
                      <td>
                        <span
                          className={`status-dot ${
                            c.estado === 'activo' ? 'status-activo' :
                            c.estado === 'desistido' ? 'status-desistido' :
                            c.estado === 'procesando' ? 'status-procesando' :
                            'status-standby'
                          }`}
                          title={c.estado || 'stand by'}
                        ></span>
                        <span className="status-text">{c.estado || 'stand by'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                          <Link
                              to="/app/puntos"
                              search={{ cliente_id: c.id }}
                              className="icon-button secondary"
                              title="Ver Puntos de Suministro"
                          >
                            <MapPin size={18} />
                          </Link>
                          {canEdit && (
                            <Link
                              to="/app/clientes/$id/editar"
                              params={{ id: c.id }}
                              className="icon-button secondary"
                              title="Editar Cliente"
                            >
                              <Pencil size={18} />
                            </Link>
                          )}
                          {canDelete && (
                              <button
                                  className="icon-button danger"
                                  title="Eliminar Cliente"
                                  onClick={() => setClienteToDelete(c)}
                                  disabled={deleteMutation.isPending}
                              >
                                  <Trash2 size={18} />
                              </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    {/* --- Ajustar colSpan según si se muestra email o comerciales --- */}
                    <td colSpan={isAdmin ? 8 : 7} style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
                      Sin resultados que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación (sin cambios) */}
      {clienteToDelete && (
        <div className="modal-overlay">
            <div className="modal-content card">
                <h3 style={{marginTop: 0}}>Confirmar Eliminación</h3>
                <p>
                    ¿Estás seguro de que quieres eliminar al cliente <strong>{clienteToDelete?.nombre}</strong> de <strong>{clienteToDelete?.empresas?.nombre ?? 'N/A'}</strong>?
                    <br />
                    <span style={{color: '#b91c1c', fontWeight: 'bold'}}>
                        Se borrará tanto el cliente como todos sus puntos de suministro, contratos y documentos.
                    </span>
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button className="secondary" onClick={() => setClienteToDelete(null)}>
                        Cancelar
                    </button>
                    <button
                        className="danger"
                        onClick={() => clienteToDelete && deleteMutation.mutate({ clienteId: clienteToDelete.id })}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}