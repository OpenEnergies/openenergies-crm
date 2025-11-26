// src/pages/clientes/ClientesList.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import type { Cliente, EstadoCliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate, clsx } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Trash2, XCircle, Edit, ArrowUpDown, ArrowUp, ArrowDown, Users } from 'lucide-react'; // Iconos de ordenación
import { toast } from 'react-hot-toast';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import ConfirmationModal from '@components/ConfirmationModal';
import { Pagination } from '@components/Pagination'; // <--- IMPORTAR EL NUEVO COMPONENTE

type ClienteConEmpresa = Cliente & {
  empresas: { nombre: string } | null;
  estado: EstadoCliente;
  comerciales_asignados?: { nombre: string | null, apellidos: string | null }[] | null;
};

const initialColumnFilters = {
  estado: [] as string[],
};

// --- Tipos para la Paginación y Ordenación ---
type SortField = 'nombre' | 'creado_en' | 'email_facturacion' | 'estado'; // Solo columnas reales de BBDD
type SortOrder = 'asc' | 'desc';

interface FetchParams {
  filter: string;
  page: number;
  pageSize: number;
  sortField: SortField;
  sortOrder: SortOrder;
  estadoFilters: string[];
}

// --- Nueva función de fetch robusta con paginación ---
async function fetchClientes({ filter, page, pageSize, sortField, sortOrder, estadoFilters }: FetchParams) {
  // 1. Calcular rango para Supabase (0-based)
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Query Base
  const selectQuery = `
    *,
    estado,
    comerciales_asignados:asignaciones_comercial (
        usuarios_app ( nombre, apellidos )
    )
  `;

  let query;

  if (filter) {
    // Usando RPC para búsqueda de texto
    query = (supabase.rpc('search_clientes', { search_text: filter }) as any)
      .select(selectQuery, { count: 'exact' }); // count: exact es CLAVE para paginación
  } else {
    // Consulta normal
    query = (supabase.from('clientes') as any)
      .select(selectQuery, { count: 'exact' });
  }

  // Aplicar filtros de columna (Estado)
  if (estadoFilters.length > 0) {
    query = query.in('estado', estadoFilters);
  }

  // Aplicar Ordenación
  // Nota: 'dni_cif' es complejo de ordenar en servidor sin una columna computada, 
  // por simplicidad usamos columnas directas.
  query = query.order(sortField, { ascending: sortOrder === 'asc' });

  // Aplicar Paginación
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  // Mapeo de datos (limpieza de comerciales)
  const clientes = (data || []).map((c: any) => ({
    ...c,
    comerciales_asignados: c.comerciales_asignados?.map((a: any) => a.usuarios_app ?? a) ?? []
  })) as ClienteConEmpresa[];

  return { data: clientes, count: count || 0 };
}

async function deleteCliente({ clienteId }: { clienteId: string }) {
    const { error } = await supabase.functions.invoke('manage-client', {
        body: { action: 'delete', payload: { clienteId } }
    });
    if (error) throw new Error(error.message);
}

export default function ClientesList() {
  const { rol } = useSession();
  const queryClient = useQueryClient();
  
  // Estados de Control de Tabla
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50); // 50 registros por página es un buen estándar
  const [sortField, setSortField] = useState<SortField>('creado_en');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  // Estados de Selección
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  // Resetear página si cambia el filtro
  useEffect(() => {
    setPage(1);
  }, [filter, columnFilters]);

  // Query Principal
  const { data: queryData, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['clientes', filter, page, pageSize, sortField, sortOrder, columnFilters.estado],
    queryFn: () => fetchClientes({ 
      filter, 
      page, 
      pageSize, 
      sortField, 
      sortOrder,
      estadoFilters: columnFilters.estado 
    }),
    placeholderData: (previousData) => previousData // Mantiene los datos viejos mientras carga los nuevos (evita parpadeo)
  });

  const clientes = queryData?.data || [];
  const totalCount = queryData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // --- Handlers de Ordenación Manual ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc'); // Default a ascendente al cambiar columna
    }
  };

  // Renderizador de icono de ordenación
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.3 }} />;
    return sortOrder === 'asc' 
      ? <ArrowUp size={14} style={{ marginLeft: '4px' }} /> 
      : <ArrowDown size={14} style={{ marginLeft: '4px' }} />;
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const clienteId of ids) {
        await deleteCliente({ clienteId });
      }
      if (ids.length > 1) await new Promise(res => setTimeout(res, 300));
    },
    onSuccess: (data, variables) => {
        toast.success(`${variables.length} cliente(s) eliminado(s) correctamente.`);
        setIdsToDelete([]);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
        toast.error(`Error al eliminar cliente(s): ${error.message}`);
        setIdsToDelete([]);
    }
  });

  const filterOptions = useMemo(() => {
    return { estado: ['stand by', 'procesando', 'activo', 'desistido'] as EstadoCliente[] };
  }, []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';
  const isAdmin = rol === 'administrador';

  const formatComerciales = (comerciales: { nombre: string | null, apellidos: string | null }[] | null | undefined): string => {
      if (!comerciales || comerciales.length === 0) return '—';
      return comerciales
          .map(c => `${c?.nombre ?? ''} ${c?.apellidos ?? ''}`.trim())
          .filter(Boolean)
          .join(', ');
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(clientes.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const isAllSelected = clientes.length > 0 && selectedIds.length === clientes.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < clientes.length;

  const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToDelete([...selectedIds]);
    }
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>Clientes</h2>
        <div className="page-actions">
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionado(s)</span>
               {selectedIds.length === 1 && canEdit && (
                 <Link
                   to="/app/clientes/$id/editar"
                   params={{ id: selectedIds[0]! }}
                   className="icon-button secondary"
                   title="Editar Cliente"
                 >
                   <Edit size={18} />
                 </Link>
               )}
               {canDelete && (
                  <button
                    className="icon-button danger"
                    title={`Eliminar ${selectedIds.length} cliente(s)`}
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={18} />
                  </button>
               )}
               <button
                 className="icon-button secondary"
                 title="Limpiar selección"
                 onClick={() => setSelectedIds([])}
               >
                 <XCircle size={18} />
               </button>
            </div>
          ) : (
             <>
               <input
                 placeholder="Buscar por nombre o DNI/CIF"
                 value={filter}
                 onChange={e => setFilter(e.target.value)}
                 style={{ minWidth: '300px' }}
               />
               <Link to="/app/clientes/nuevo"><button>Nuevo Cliente</button></Link>
             </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}> {/* Padding 0 para que la tabla y paginación toquen bordes */}
         {isLoading && <div style={{padding: '2rem', textAlign: 'center'}}>Cargando...</div>}
        {isError && <div role="alert" style={{padding: '2rem', color: 'red'}}>Error al cargar clientes.</div>}

        {!isLoading && !isError && clientes.length === 0 && (
          <div style={{padding: '2rem'}}>
            <EmptyState
              title="Sin clientes"
              description="No se encontraron clientes con los filtros actuales."
              cta={!filter && columnFilters.estado.length === 0 ? <Link to="/app/clientes/nuevo"><button>Crear el primero</button></Link> : null}
            />
          </div>
        )}

        {!isLoading && !isError && clientes.length > 0 && (
          <>
            <div className="table-wrapper" role="table" aria-label="Listado de clientes">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '1%', paddingRight: 0 }}>
                       <input
                         type="checkbox"
                         checked={isAllSelected}
                         ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                         onChange={handleSelectAll}
                         aria-label="Seleccionar todos"
                       />
                    </th>
                    <th>
                      <button onClick={() => handleSort('nombre')} className="sortable-header">
                        Nombre {renderSortIcon('nombre')}
                      </button>
                    </th>
                    <th>
                        {/* DNI/CIF no tiene ordenación servidor simple por ser 2 columnas mezcladas, lo dejamos fijo o requeriría computed column */}
                        DNI/CIF 
                    </th>
                    {!isAdmin && (
                      <th>
                        <button onClick={() => handleSort('email_facturacion')} className="sortable-header">
                          Email {renderSortIcon('email_facturacion')}
                        </button>
                      </th>
                    )}
                     {isAdmin && ( 
                        <th>Comerciales</th>
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
                  </tr>
                </thead>
                <tbody style={isPlaceholderData ? { opacity: 0.5 } : {}}>
                  {clientes.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                    <tr key={c.id} className={clsx(isSelected && 'selected-row')}>
                       <td style={{ paddingRight: 0 }}>
                         <input
                           type="checkbox"
                           checked={isSelected}
                           onChange={() => handleRowSelect(c.id)}
                         />
                       </td>
                      <td> 
                        <Link to="/app/clientes/$id" params={{ id: c.id }} className="table-action-link font-semibold">
                          {c.nombre}
                        </Link>
                      </td>
                      <td>{c.dni || c.cif || '—'}</td> 
                      {!isAdmin && (
                        <td>{c.email_facturacion ?? '—'}</td>
                      )}
                      {isAdmin && ( 
                          <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Users size={16} style={{ color: 'var(--muted)'}} />
                                  {formatComerciales(c.comerciales_asignados)}
                              </div>
                          </td>
                      )}
                      <td>{fmtDate(c.creado_en)}</td> 
                      <td> 
                        <span className={`status-dot ${ 
                            c.estado === 'activo' ? 'status-activo' :
                            c.estado === 'desistido' ? 'status-desistido' :
                            c.estado === 'procesando' ? 'status-procesando' :
                            'status-standby'
                          }`} title={c.estado || 'stand by'}></span>
                        <span className="status-text">{c.estado || 'stand by'}</span>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            
            {/* --- COMPONENTE DE PAGINACIÓN --- */}
            <Pagination 
              page={page}
              totalPages={totalPages}
              totalItems={totalCount}
              onPageChange={setPage}
              isLoading={isPlaceholderData} // Deshabilita botones mientras recarga
            />
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={idsToDelete.length > 0}
        onClose={() => setIdsToDelete([])}
        onConfirm={() => {
          deleteMutation.mutate(idsToDelete);
        }}
        title={`Confirmar Eliminación (${idsToDelete.length})`}
        message={`¿Estás seguro de que quieres eliminar los ${idsToDelete.length} clientes seleccionados?`}
        confirmText={`Sí, Eliminar`}
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}