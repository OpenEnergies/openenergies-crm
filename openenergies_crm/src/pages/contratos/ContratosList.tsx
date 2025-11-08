// @ts-nocheck
// src/pages/contratos/ContratosList.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { Pencil, Trash2, BadgePlus, XCircle, Edit } from 'lucide-react'; // Edit añadido
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { toast } from 'react-hot-toast';
import { fmtDate } from '@lib/utils';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { useSortableTable } from '@hooks/useSortableTable';
import { clsx } from '@lib/utils';

// ... (Tipos, fetchContratos, etc. - SIN CAMBIOS) ...
type ContratoExtendido = Contrato & {
  puntos_suministro: { cups: string; direccion: string; clientes: { nombre: string } | null; } | null;
  empresas: { nombre: string } | null;
};
type SortableContratoKey = keyof ContratoExtendido | 'cups' | 'comercializadora_nombre';
const initialColumnFilters = {
  fecha_inicio: { year: null, month: null, day: null } as DateParts,
  fecha_fin: { year: null, month: null, day: null } as DateParts,
  aviso_renovacion: [] as string[],
};
async function fetchContratos(filter: string, clienteId?: string): Promise<ContratoExtendido[]> {
    const selectQuery = `*, puntos_suministro ( cups, direccion, clientes ( nombre ) ), empresas ( nombre )`;
    const { data, error } = await supabase.rpc('search_contratos', {
        search_text: filter,
        p_cliente_id: clienteId || null
    }).select(selectQuery).order('fecha_inicio', { ascending: false }).limit(100);
    if (error) throw error;
    return data as ContratoExtendido[];
}


export default function ContratosList({ clienteId }: { clienteId?: string }){
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const queryClient = useQueryClient();
  const { rol } = useSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
      queryKey: ['contratos', filter, clienteId],
      queryFn: () => fetchContratos(filter, clienteId),
  });

  // ... (filterOptions, filteredData, handleColumnFilterChange, deleteContratoMutation, useSortableTable, handlers de selección, etc. - SIN CAMBIOS) ...
  const filterOptions = useMemo(() => {
    if (!fetchedData) return { fecha_inicio: [], fecha_fin: [], aviso_renovacion: [] };
    const getUniqueDates = (key: 'fecha_inicio' | 'fecha_fin') =>
      fetchedData.map(c => c[key] ? new Date(c[key]!) : null).filter(Boolean) as Date[];
    const avisoOptions = Array.from(new Set(fetchedData.map(c => c.aviso_renovacion ? 'Sí' : 'No')));
    return {
      fecha_inicio: getUniqueDates('fecha_inicio'),
      fecha_fin: getUniqueDates('fecha_fin'),
      aviso_renovacion: avisoOptions,
    };
  }, [fetchedData]);
   const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[] | DateParts) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };
   const filteredData = useMemo(() => {
     if (!fetchedData) return [];
    return fetchedData.filter(item => {
      const inicio = item.fecha_inicio ? new Date(item.fecha_inicio) : null;
      const fin = item.fecha_fin ? new Date(item.fecha_fin) : null;
      const formattedAviso = item.aviso_renovacion ? 'Sí' : 'No';
      const checkDate = (date: Date | null, filter: DateParts) => {
          if (!date && (filter.year || filter.month || filter.day)) return false; // Si no hay fecha y el filtro no está vacío, no coincide
          if (!date) return true; // Si no hay fecha y el filtro está vacío, coincide

          // Si hay fecha, comparar partes si el filtro tiene valor
          if (filter.year && date.getFullYear().toString() !== filter.year) return false;
          if (filter.month && (date.getMonth() + 1).toString().padStart(2, '0') !== filter.month) return false;
          if (filter.day && date.getDate().toString().padStart(2, '0') !== filter.day) return false;
          return true; // Coincide si pasa todas las comprobaciones
      };
      return (
        checkDate(inicio, columnFilters.fecha_inicio) &&
        checkDate(fin, columnFilters.fecha_fin) &&
        (columnFilters.aviso_renovacion.length === 0 || columnFilters.aviso_renovacion.includes(formattedAviso))
      );
    });
  }, [fetchedData, columnFilters]);
  const deleteContratoMutation = useMutation({
    mutationFn: async (contratoIds: string[]) => {
      const { error } = await supabase.from('contratos').delete().in('id', contratoIds);
      if (error) throw error;
      if (contratoIds.length > 1) await new Promise(res => setTimeout(res, 300));
    },
    onSuccess: (data, variables) => {
      toast.success(`${variables.length} contrato(s) eliminado(s).`);
      setIdsToDelete([]);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['contratos', filter, clienteId] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
      setIdsToDelete([]);
    },
  });
   const {
        sortedData: displayedData,
        handleSort,
        renderSortIcon
    } = useSortableTable<ContratoExtendido>(filteredData, {
        initialSortKey: 'fecha_inicio',
        initialSortDirection: 'desc',
        sortValueAccessors: {
            puntos_suministro: (item) => item.puntos_suministro?.cups,
            empresas: (item) => item.empresas?.nombre,
            oferta: (item) => item.oferta,
            fecha_inicio: (item) => item.fecha_inicio ? new Date(item.fecha_inicio) : null,
            fecha_fin: (item) => item.fecha_fin ? new Date(item.fecha_fin) : null,
            aviso_renovacion: (item) => item.aviso_renovacion,
        }
    });
   const isFiltered = filter.length > 0 ||
                     columnFilters.fecha_inicio.year !== null || columnFilters.fecha_inicio.month !== null || columnFilters.fecha_inicio.day !== null ||
                     columnFilters.fecha_fin.year !== null || columnFilters.fecha_fin.month !== null || columnFilters.fecha_fin.day !== null ||
                     columnFilters.aviso_renovacion.length > 0;
   const canCreate = rol === 'administrador' || rol === 'comercial';
   const canEdit = rol === 'administrador' || rol === 'comercial';
   const canDelete = rol === 'administrador' || rol === 'comercial';
   const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
   };
   const handleRowSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
   };
   const isAllSelected = displayedData.length > 0 && selectedIds.length === displayedData.length;
   const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedData.length;
   const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToDelete([...selectedIds]);
    }
  };
  const pageActionsStyle: React.CSSProperties = {
    marginLeft: clienteId ? 'auto' : undefined,
  };

  if (!clienteId) {
    if (selectedIds.length === 0) {
      // Si no hay selección, aplicar el max-width para el buscador
      pageActionsStyle.width = '100%';
      pageActionsStyle.maxWidth = 500;
    }
    // Si HAY selección, no se añade max-width,
    // permitiendo que .contextual-actions se alinee a la derecha.
  }

  return (
    <div className="grid">
      <div className="page-header">
        {/* El título se mantiene visible SIEMPRE */}
        {!clienteId && <h2 style={{margin:0}}>Contratos</h2>}
        
        {/* El contenedor de acciones siempre está presente */}
        <div className="page-actions" style={pageActionsStyle}>
          
          {/* El contenido INTERNO de las acciones cambia según la selección */}
          {selectedIds.length > 0 ? (
            // 1. Acciones contextuales (si hay selección)
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionado(s)</span>
               {selectedIds.length === 1 && canEdit && (
                 <Link
                   to="/app/contratos/$id"
                   params={{ id: selectedIds[0] }}
                   className="icon-button secondary"
                   title="Editar Contrato"
                 >
                   <Edit size={18} />
                 </Link>
               )}
               {canDelete && (
                  <button
                    className="icon-button danger"
                    title={`Eliminar ${selectedIds.length} contrato(s)`}
                    onClick={handleDeleteSelected}
                    disabled={deleteContratoMutation.isPending}
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
            // 2. Acciones por defecto (si NO hay selección)
            <>
              {!clienteId && (
                  <>
                    <input
                      placeholder="Buscar por Comercializadora o CUPS..."
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                     />
                    {canCreate && (
                      <Link to="/app/contratos/nuevo"><button><BadgePlus /></button></Link>
                    )}
                  </>
              )}
            </>
          )}
        </div>
      </div>

      {/* El resto (card, tabla, modal) permanece igual */}
      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar contratos.</div>}

      <div className="card">
        {/* Estados vacíos/sin resultados */}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState title="Sin contratos" description="Aún no hay contratos registrados." cta={canCreate ? <Link to="/app/contratos/nuevo"><button>Crear el primero</button></Link> : null}/>
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>Este cliente no tiene contratos asignados.</div>
        )}
         {!isLoading && !isError && fetchedData && fetchedData.length > 0 && displayedData.length === 0 && isFiltered && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>No se encontraron contratos que coincidan con los filtros.</div>
        )}

        {/* Tabla */}
        {!isLoading && !isError && displayedData && displayedData.length > 0 && ( // Cambiado a displayedData
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '1%', paddingRight: 0 }}><input type="checkbox" checked={isAllSelected} ref={input => { if (input) input.indeterminate = isIndeterminate; }} onChange={handleSelectAll} aria-label="Seleccionar todos los contratos"/></th>
                  <th><button onClick={() => handleSort('puntos_suministro')} className="sortable-header">CUPS {renderSortIcon('puntos_suministro')}</button></th>
                  <th><button onClick={() => handleSort('empresas')} className="sortable-header">Comercializadora {renderSortIcon('empresas')}</button></th>
                  <th><button onClick={() => handleSort('oferta')} className="sortable-header">Oferta {renderSortIcon('oferta')}</button></th>
                  <th><button onClick={() => handleSort('fecha_inicio')} className="sortable-header">Inicio {renderSortIcon('fecha_inicio')}</button><DateFilterDropdown columnName="Fecha Inicio" options={filterOptions.fecha_inicio} selectedDate={columnFilters.fecha_inicio} onChange={(selected) => handleColumnFilterChange('fecha_inicio', selected)}/></th>
                  <th><button onClick={() => handleSort('fecha_fin')} className="sortable-header">Fin {renderSortIcon('fecha_fin')}</button><DateFilterDropdown columnName="Fecha Fin" options={filterOptions.fecha_fin} selectedDate={columnFilters.fecha_fin} onChange={(selected) => handleColumnFilterChange('fecha_fin', selected)}/></th>
                  <th><button onClick={() => handleSort('aviso_renovacion')} className="sortable-header">Aviso {renderSortIcon('aviso_renovacion')}</button><ColumnFilterDropdown columnName="Aviso" options={filterOptions.aviso_renovacion} selectedOptions={columnFilters.aviso_renovacion} onChange={(selected) => handleColumnFilterChange('aviso_renovacion', selected as string[])}/></th>
                  {/* Quitar columna acciones */}
                </tr>
              </thead>
              <tbody>
                {/* No necesitamos la condición aquí */}
                {displayedData.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                    <tr key={c.id} className={clsx(isSelected && 'selected-row')}>
                       <td style={{ paddingRight: 0 }}><input type="checkbox" checked={isSelected} onChange={() => handleRowSelect(c.id)} aria-label={`Seleccionar contrato ${c.oferta || c.id}`}/></td>
                      <td>{c.puntos_suministro?.cups ?? '—'}</td>
                      <td>{c.empresas?.nombre ?? '—'}</td>
                      <td>{c.oferta ?? '—'}</td>
                      <td>{fmtDate(c.fecha_inicio)}</td>
                      <td>{fmtDate(c.fecha_fin)}</td>
                      <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                      {/* Quitar celda acciones */}
                    </tr>
                  )})}
                 {/* Mensaje 'Sin resultados' movido fuera del map */}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ConfirmationModal
          isOpen={idsToDelete.length > 0}
          onClose={() => setIdsToDelete([])}
          onConfirm={() => { deleteContratoMutation.mutate(idsToDelete); }}
          title={`Confirmar Eliminación (${idsToDelete.length})`}
          message={ idsToDelete.length === 1 ? `¿Estás seguro de que quieres eliminar el contrato seleccionado?` : `¿Estás seguro de que quieres eliminar los ${idsToDelete.length} contratos seleccionados?` }
          confirmText={`Sí, Eliminar ${idsToDelete.length}`}
          cancelText="Cancelar"
          confirmButtonClass="danger"
          isConfirming={deleteContratoMutation.isPending}
        />
    </div>
  );
}