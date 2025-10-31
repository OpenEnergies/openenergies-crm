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
// --- Importar nuevos iconos ---
import { Pencil, MapPin, Building2, Trash2, Users, XCircle, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { useSortableTable } from '@hooks/useSortableTable';
// --- Importar ConfirmationModal ---
import ConfirmationModal from '@components/ConfirmationModal'; // Adjust path if needed
import { clsx } from '@lib/utils'; // Import clsx

type ClienteConEmpresa = Cliente & {
  empresas: {
    nombre: string;
  } | null;
  estado: EstadoCliente;
  comerciales_asignados?: { nombre: string | null, apellidos: string | null }[] | null;
};

type SortableClienteKey = keyof ClienteConEmpresa | 'empresa_nombre' | 'dni_cif' | 'comerciales_nombres';

const initialColumnFilters = {
  estado: [] as string[],
};

// fetchClientes y deleteCliente (SIN CAMBIOS, asumiendo que deleteCliente puede manejar un ID)
// Si necesitas borrado múltiple real, la función deleteCliente (o la Edge Function) debe modificarse
async function fetchClientes(filter: string): Promise<ClienteConEmpresa[]> {
    // ... (código existente de fetchClientes) ...
     const selectQuery = `
    *,
    empresas ( nombre ),
    estado,
    comerciales_asignados:asignaciones_comercial (
        usuarios_app ( nombre, apellidos )
    )
  `;

  if (!filter) {
    const { data, error } = await supabase
      .from('clientes')
      .select(selectQuery)
      .limit(100)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return (data || []).map(c => ({
        ...c,
        comerciales_asignados: c.comerciales_asignados?.map((a: any) => a.usuarios_app) ?? []
    })) as ClienteConEmpresa[];
  }

  const { data, error } = await supabase
    .rpc('search_clientes', { search_text: filter })
    .select(selectQuery) // Ajusta este select si la RPC devuelve toda la data
    .limit(100)
    .order('creado_en', { ascending: false });

  if (error) throw error;
   return (data || []).map((c: any) => ({
        ...c,
        comerciales_asignados: c.comerciales_asignados?.map((a: any) => a.usuarios_app ?? a) ?? []
    })) as ClienteConEmpresa[];
}

async function deleteCliente({ clienteId }: { clienteId: string }) {
    const { error } = await supabase.functions.invoke('manage-client', {
        body: { action: 'delete', payload: { clienteId } }
    });
    if (error) throw new Error(error.message);
}
// --- Fin funciones sin cambios ---

export default function ClientesList(){
  const { rol } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  // --- (1) Estado para IDs seleccionados ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // --- Estado para el modal de borrado (ahora guarda IDs) ---
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
      queryKey:['clientes', filter],
      queryFn:()=>fetchClientes(filter)
  });

  // --- Mutación de borrado (adaptada para potencialmente borrar varios) ---
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Idealmente, tu backend (manage-client) aceptaría un array de IDs
      // Si no, iteramos aquí (menos eficiente):
      for (const clienteId of ids) {
        // Podrías añadir un try/catch por ID si quieres continuar aunque uno falle
        await deleteCliente({ clienteId });
      }
      // Simular un pequeño retardo si borras muchos para que el usuario vea el cambio
      if (ids.length > 1) await new Promise(res => setTimeout(res, 300));
    },
    onSuccess: (data, variables) => { // variables contiene los IDs que se mandaron a borrar
        toast.success(`${variables.length} cliente(s) eliminado(s) correctamente.`);
        setIdsToDelete([]); // Limpiar IDs a borrar
        setSelectedIds([]); // Limpiar selección
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
        toast.error(`Error al eliminar cliente(s): ${error.message}`);
        setIdsToDelete([]); // Limpiar aunque falle
    }
  });

  const filterOptions = useMemo(() => { // Sin cambios
    return { estado: ['stand by', 'procesando', 'activo', 'desistido'] as EstadoCliente[] };
  }, []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => { // Sin cambios
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const filteredData = useMemo(() => { // Sin cambios
    if (!fetchedData) return [];
    let items = fetchedData;
    return items.filter(item => {
      const estadoItem = item.estado || 'stand by';
      return (columnFilters.estado.length === 0 || columnFilters.estado.includes(estadoItem));
    });
  }, [fetchedData, columnFilters]);

  const { // Sin cambios
      sortedData: displayedData,
      handleSort,
      renderSortIcon
  } = useSortableTable<ClienteConEmpresa, SortableClienteKey>(filteredData, {
      initialSortKey: 'creado_en',
      initialSortDirection: 'desc',
      sortValueAccessors: { /* ... accesors existentes ... */
          empresa_nombre: (item) => item.empresas?.nombre,
          dni_cif: (item) => item.dni || item.cif,
          nombre: (item) => item.nombre,
          comerciales_nombres: (item) =>
              item.comerciales_asignados && item.comerciales_asignados.length > 0
              ? item.comerciales_asignados
                  .map(c => `${c?.nombre ?? ''} ${c?.apellidos ?? ''}`.trim())
                  .filter(Boolean)
                  .join(', ')
              : null,
          email_facturacion: (item) => item.email_facturacion,
      }
  });

  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';
  const isAdmin = rol === 'administrador';
  const isFiltered = filter.length > 0 || columnFilters.estado.length > 0;

  // --- Helper para formatear comerciales (sin cambios) ---
  const formatComerciales = (comerciales: { nombre: string | null, apellidos: string | null }[] | null | undefined): string => { /* ... código existente ... */
      if (!comerciales || comerciales.length === 0) return '—';
      return comerciales
          .map(c => `${c?.nombre ?? ''} ${c?.apellidos ?? ''}`.trim())
          .filter(Boolean)
          .join(', ');
  };

  // --- (2) Handlers para checkboxes ---
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map(item => item.id)); // Seleccionar todos los IDs *visibles*
    } else {
      setSelectedIds([]); // Deseleccionar todos
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  // --- Determinar estado de la cabecera checkbox ---
  const isAllSelected = displayedData.length > 0 && selectedIds.length === displayedData.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedData.length;

  // --- Handler para el botón de borrado contextual ---
  const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToDelete([...selectedIds]); // Prepara los IDs para el modal
    }
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>Clientes</h2>
        {/* --- (3) Acciones Contextuales y Botón Nuevo --- */}
        <div className="page-actions">
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionado(s)</span>
               {/* Botón Editar (solo si 1 seleccionado) */}
               {selectedIds.length === 1 && canEdit && (
                 <Link
                   to="/app/clientes/$id/editar"
                   params={{ id: selectedIds[0] }}
                   className="icon-button secondary"
                   title="Editar Cliente"
                 >
                   <Edit size={18} />
                 </Link>
               )}
               {/* Botón Borrar (si 1 o más seleccionados) */}
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
               {/* Botón Limpiar Selección */}
               <button
                 className="icon-button secondary"
                 title="Limpiar selección"
                 onClick={() => setSelectedIds([])}
               >
                 <XCircle size={18} />
               </button>
            </div>
          ) : (
             // Mostrar buscador y botón de nuevo si no hay selección
             <>
               <input
                 placeholder="Buscar por nombre, DNI/CIF o comercializadora"
                 value={filter}
                 onChange={e => setFilter(e.target.value)}
                 style={{ minWidth: '300px' }} // Un poco más ancho quizás
               />
               <Link to="/app/clientes/nuevo"><button>Nuevo Cliente</button></Link>
             </>
          )}
        </div>
        {/* --- Fin Acciones --- */}
      </div>

      <div className="card">
        {/* Input de filtro movido al header */}
        {/* ... isLoading, isError, EmptyState ... (sin cambios) */}
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
                  {/* --- (4) Cabecera Checkbox --- */}
                  <th style={{ width: '1%', paddingRight: 0 }}> {/* Ajustar ancho y padding */}
                     <input
                       type="checkbox"
                       checked={isAllSelected}
                       ref={input => { // Para manejar estado indeterminado
                         if (input) input.indeterminate = isIndeterminate;
                       }}
                       onChange={handleSelectAll}
                       aria-label="Seleccionar todos los clientes"
                     />
                  </th>
                  {/* --- Resto de cabeceras --- */}
                  <th> {/* Nombre */}
                    <button onClick={() => handleSort('nombre')} className="sortable-header">
                      Nombre {renderSortIcon('nombre')}
                    </button>
                  </th>
                  <th> {/* Empresa */}
                    <button onClick={() => handleSort('empresa_nombre')} className="sortable-header">
                      Empresa {renderSortIcon('empresa_nombre')}
                    </button>
                  </th>
                  <th> {/* DNI/CIF */}
                    <button onClick={() => handleSort('dni_cif')} className="sortable-header">
                      DNI/CIF {renderSortIcon('dni_cif')}
                    </button>
                  </th>
                  {!isAdmin && ( /* Email */
                    <th>
                      <button onClick={() => handleSort('email_facturacion')} className="sortable-header">
                        Email facturación {renderSortIcon('email_facturacion')}
                      </button>
                    </th>
                  )}
                   {isAdmin && ( /* Comerciales */
                      <th>
                        <button onClick={() => handleSort('comerciales_nombres')} className="sortable-header">
                          Comerciales {renderSortIcon('comerciales_nombres')}
                        </button>
                      </th>
                   )}
                  <th> {/* Creado */}
                    <button onClick={() => handleSort('creado_en')} className="sortable-header">
                      Creado {renderSortIcon('creado_en')}
                    </button>
                  </th>
                  <th> {/* Estado */}
                    <button onClick={() => handleSort('estado')} className="sortable-header">
                      Estado {renderSortIcon('estado')}
                    </button>
                    <ColumnFilterDropdown /* ... props ... */
                      columnName="Estado"
                      options={filterOptions.estado}
                      selectedOptions={columnFilters.estado}
                      onChange={(selected) => handleColumnFilterChange('estado', selected)}
                    />
                  </th>
                  {/* --- (5) Eliminar cabecera Acciones --- */}
                  {/* <th style={{ textAlign: 'right' }}>Acciones</th> */}
                </tr>
              </thead>
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(c => {
                    const isSelected = selectedIds.includes(c.id); // Check si la fila está seleccionada
                    return (
                    // --- (6) Añadir clase condicional a <tr> ---
                    <tr key={c.id} className={clsx(isSelected && 'selected-row')}>
                       {/* --- (7) Celda Checkbox --- */}
                       <td style={{ paddingRight: 0 }}>
                         <input
                           type="checkbox"
                           checked={isSelected}
                           onChange={() => handleRowSelect(c.id)}
                           aria-label={`Seleccionar cliente ${c.nombre}`}
                         />
                       </td>
                       {/* --- Resto de celdas --- */}
                      <td> {/* Nombre */}
                        <Link to="/app/clientes/$id" params={{ id: c.id }} className="table-action-link font-semibold">
                          {c.nombre}
                        </Link>
                      </td>
                      <td> {/* Empresa */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Building2 size={16} style={{ color: 'var(--muted)'}} />
                              {c.empresas?.nombre ?? 'No asignada'}
                          </div>
                      </td>
                      <td>{c.dni || c.cif || '—'}</td> {/* DNI/CIF */}
                      {!isAdmin && ( /* Email */
                        <td>{c.email_facturacion ?? '—'}</td>
                      )}
                      {isAdmin && ( /* Comerciales */
                          <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Users size={16} style={{ color: 'var(--muted)'}} />
                                  {formatComerciales(c.comerciales_asignados)}
                              </div>
                          </td>
                      )}
                      <td>{fmtDate(c.creado_en)}</td> {/* Creado */}
                      <td> {/* Estado */}
                        <span className={`status-dot ${ /* ... clases ... */
                            c.estado === 'activo' ? 'status-activo' :
                            c.estado === 'desistido' ? 'status-desistido' :
                            c.estado === 'procesando' ? 'status-procesando' :
                            'status-standby'
                          }`} title={c.estado || 'stand by'}></span>
                        <span className="status-text">{c.estado || 'stand by'}</span>
                      </td>
                      {/* --- (8) Eliminar celda Acciones --- */}
                      {/* <td style={{ textAlign: 'right' }}> ... </td> */}
                    </tr>
                  )})
                ) : ( // Mensaje "Sin resultados" (sin cambios, solo ajustar colSpan)
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
                      Sin resultados que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Modal de confirmación adaptado --- */}
      <ConfirmationModal
        // Se abre si hay IDs preparados para borrar
        isOpen={idsToDelete.length > 0}
        // Al cerrar, limpiar los IDs a borrar
        onClose={() => setIdsToDelete([])}
        // Al confirmar, llamar a la mutación con los IDs
        onConfirm={() => {
          deleteMutation.mutate(idsToDelete);
        }}
        title={`Confirmar Eliminación (${idsToDelete.length})`}
        message={
            idsToDelete.length === 1
            ? `¿Estás seguro de que quieres eliminar al cliente seleccionado? Se borrarán todos sus datos asociados.`
            : `¿Estás seguro de que quieres eliminar los ${idsToDelete.length} clientes seleccionados? Se borrarán todos sus datos asociados.`
        }
        confirmText={`Sí, Eliminar ${idsToDelete.length}`}
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}