// @ts-nocheck
// src/pages/puntos/PuntosList.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro, TipoFactura } from '@lib/types';
import { Pencil, Trash2, MapPinPlus, XCircle, Edit } from 'lucide-react'; // Edit añadido
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';
import { clsx } from '@lib/utils';

// ... (Tipos, fetchPuntos, etc. - SIN CAMBIOS) ...
type PuntoConCliente = Omit<PuntoSuministro, 'localidad' | 'provincia' | 'tipo_factura'> & {
  localidad?: string | null;
  provincia?: string | null;
  tipo_factura?: TipoFactura | null;
  clientes: { nombre: string } | null;
};
type SortablePuntoKey = keyof PuntoConCliente | 'cliente_nombre';
const initialColumnFilters = {
  localidad: [] as string[],
  provincia: [] as string[],
  tipo_factura: [] as string[],
  tarifa_acceso: [] as string[],
};
async function fetchPuntos(filter: string, clienteId?: string): Promise<PuntoConCliente[]> {
    if (!filter) {
    let q = supabase.from('puntos_suministro').select('*, clientes(nombre)').limit(100);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    const { data, error } = await q.order('cups', { ascending: true });
    if (error) throw error;
    return data as PuntoConCliente[];
  }
  const { data, error } = await supabase.rpc('search_puntos_suministro', { search_text: filter, p_cliente_id: clienteId || null }).select('*, clientes(nombre)').limit(100).order('cups', { ascending: true });
  if (error) throw error;
  return data as PuntoConCliente[];
}


export default function PuntosList({ clienteId }: { clienteId?: string }){
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['puntos', filter, clienteId],
    queryFn: () => fetchPuntos(filter, clienteId)
  });

  // ... (filterOptions, filteredData, handleColumnFilterChange, deletePuntoMutation, useSortableTable, handlers de selección, etc. - SIN CAMBIOS) ...
   const filterOptions = useMemo(() => {
     if (!fetchedData) return initialColumnFilters;
    const getUnique = (key: keyof PuntoConCliente) =>
      Array.from(new Set(fetchedData.map(p => p[key]).filter(Boolean) as string[])).sort();
    return {
      localidad: getUnique('localidad'),
      provincia: getUnique('provincia'),
      tipo_factura: getUnique('tipo_factura'),
      tarifa_acceso: getUnique('tarifa_acceso'),
    };
  }, [fetchedData]);
    const filteredData = useMemo(() => {
      if (!fetchedData) return [];
    let items = fetchedData;
    // Aplicamos filtros de columna
    return items.filter(item => {
      const localidad = item.localidad ?? null;
      const provincia = item.provincia ?? null;
      const tipoFactura = item.tipo_factura ?? null;
      const tarifaAcceso = item.tarifa_acceso ?? null;

      return (
        (columnFilters.localidad.length === 0 || (localidad && columnFilters.localidad.includes(localidad))) &&
        (columnFilters.provincia.length === 0 || (provincia && columnFilters.provincia.includes(provincia))) &&
        (columnFilters.tipo_factura.length === 0 || (tipoFactura && columnFilters.tipo_factura.includes(tipoFactura))) &&
        (columnFilters.tarifa_acceso.length === 0 || (tarifaAcceso && columnFilters.tarifa_acceso.includes(tarifaAcceso)))
      );
    });
  }, [fetchedData, columnFilters]); // Removido filter y clienteId de dependencias si no se usan aquí directamente
   const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };
  const deletePuntoMutation = useMutation({
    mutationFn: async (puntoIds: string[]) => {
      // Usamos Promise.allSettled para intentar borrar todos y reportar errores individuales
      const results = await Promise.allSettled(puntoIds.map(puntoId =>
        supabase.rpc('delete_punto_suministro', { punto_id_to_delete: puntoId })
      ));

      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)) {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          const puntoId = puntoIds[index];
          const message = error.message.includes('Aún tiene datos asociados')
                 ? `Punto ${puntoId.substring(0,8)}... no borrado: Aún tiene datos asociados.`
                 : `Error al eliminar ${puntoId.substring(0,8)}...: ${error.message}`;
           errors.push(message);
        }
      });

      if (errors.length > 0) {
        // Si hubo errores, lanzamos un error agregado
        throw new Error(errors.join('\n'));
      }

      // Pequeño delay visual si se borraron muchos
      if (puntoIds.length > 1) await new Promise(res => setTimeout(res, 300));

      return puntoIds.length - errors.length; // Devuelve número de borrados exitosos
    },
    onSuccess: (deletedCount, variables) => {
        if (deletedCount > 0) {
           toast.success(`${deletedCount} punto(s) de suministro eliminado(s).`);
        }
        // Limpiar estados incluso si hubo errores parciales
        setIdsToDelete([]);
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['puntos', filter, clienteId] });
    },
    onError: (error: Error) => {
        // Mostramos el error agregado (puede tener múltiples líneas)
        toast.error(error.message, { duration: 6000 }); // Más duración para leer errores múltiples
        setIdsToDelete([]); // Limpiar en caso de error también
    },
  });
   const {
      sortedData: displayedData,
      handleSort,
      renderSortIcon
  } = useSortableTable<PuntoConCliente & { cliente_nombre?: string | null }>(filteredData, {
      initialSortKey: 'cups',
      initialSortDirection: 'asc',
      sortValueAccessors: {
            cliente_nombre: (item: PuntoConCliente) => item.clientes?.nombre,
          titular: (item: PuntoConCliente) => item.titular,
          cups: (item: PuntoConCliente) => item.cups,
          direccion: (item: PuntoConCliente) => item.direccion,
          localidad: (item: PuntoConCliente) => item.localidad,
          provincia: (item: PuntoConCliente) => item.provincia,
          tipo_factura: (item: PuntoConCliente) => item.tipo_factura,
          tarifa_acceso: (item: PuntoConCliente) => item.tarifa_acceso,
      } as any
  });
   const isFiltered = filter.length > 0 ||
    columnFilters.localidad.length > 0 ||
    columnFilters.provincia.length > 0 ||
    columnFilters.tipo_factura.length > 0 ||
    columnFilters.tarifa_acceso.length > 0;
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


  return (
    <div className="grid">
      <div className="page-header">
        {/* El título se mantiene visible SIEMPRE */}
        {!clienteId && <h2 style={{margin:'0'}}>Puntos de suministro</h2>}
        
        {/* El contenedor de acciones siempre está presente */}
        <div className="page-actions" style={{ marginLeft: clienteId ? 'auto' : undefined }}>
          
          {/* El contenido INTERNO de las acciones cambia según la selección */}
          {selectedIds.length > 0 ? (
            // 1. Acciones contextuales (si hay selección)
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionado(s)</span>
               {selectedIds.length === 1 && (
                 <Link
                   to="/app/puntos/$id"
                   params={{ id: selectedIds[0] }}
                   className="icon-button secondary"
                   title="Editar Punto"
                 >
                   <Edit size={18} />
                 </Link>
               )}
               <button
                 className="icon-button danger"
                 title={`Eliminar ${selectedIds.length} punto(s)`}
                 onClick={handleDeleteSelected}
                 disabled={deletePuntoMutation.isPending}
               >
                 <Trash2 size={18} />
               </button>
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
                    placeholder="CUPS, dirección o titular"
                    value={filter}
                    onChange={e=>setFilter(e.target.value)}
                    aria-label="Filtro"
                    style={{ minWidth: '300px' }}
                  />
                  <Link to="/app/puntos/nuevo"><button><MapPinPlus /></button></Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {/* --- FIN ENCABEZADO --- */}

      {/* El resto (card, tabla, modal) permanece igual */}
      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar puntos.</div>}

      <div className="card">
        {/* Estados vacíos/sin resultados */}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState title="Sin puntos de suministro" description="Aún no hay puntos de suministro (CUPS) registrados." cta={<Link to="/app/puntos/nuevo"><button>Crear el primero</button></Link>}/>
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>Este cliente no tiene puntos de suministro asignados.</div>
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && displayedData.length === 0 && isFiltered && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>No se encontraron puntos que coincidan con los filtros.</div>
        )}

        {/* Tabla */}
        {!isLoading && !isError && displayedData && displayedData.length > 0 && ( // Cambiado a displayedData
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '1%', paddingRight: 0 }}><input type="checkbox" checked={isAllSelected} ref={input => { if (input) input.indeterminate = isIndeterminate; }} onChange={handleSelectAll} aria-label="Seleccionar todos los puntos"/></th>
                  <th><button onClick={() => handleSort('titular')} className="sortable-header">Titular {renderSortIcon('titular')}</button></th>
                  <th><button onClick={() => handleSort('cliente_nombre')} className="sortable-header">Cliente {renderSortIcon('cliente_nombre')}</button></th>
                  <th><button onClick={() => handleSort('cups')} className="sortable-header">CUPS {renderSortIcon('cups')}</button></th>
                  <th><button onClick={() => handleSort('direccion')} className="sortable-header">Dirección {renderSortIcon('direccion')}</button></th>
                  <th><button onClick={() => handleSort('localidad')} className="sortable-header">Localidad {renderSortIcon('localidad')}</button><ColumnFilterDropdown columnName="Localidad" options={filterOptions.localidad} selectedOptions={columnFilters.localidad} onChange={(selected) => handleColumnFilterChange('localidad', selected)}/></th>
                  <th><button onClick={() => handleSort('provincia')} className="sortable-header">Provincia {renderSortIcon('provincia')}</button><ColumnFilterDropdown columnName="Provincia" options={filterOptions.provincia} selectedOptions={columnFilters.provincia} onChange={(selected) => handleColumnFilterChange('provincia', selected)}/></th>
                  <th><button onClick={() => handleSort('tipo_factura')} className="sortable-header">Tipo Factura {renderSortIcon('tipo_factura')}</button><ColumnFilterDropdown columnName="Tipo Factura" options={filterOptions.tipo_factura} selectedOptions={columnFilters.tipo_factura} onChange={(selected) => handleColumnFilterChange('tipo_factura', selected)}/></th>
                  <th><button onClick={() => handleSort('tarifa_acceso')} className="sortable-header">Tarifa {renderSortIcon('tarifa_acceso')}</button><ColumnFilterDropdown columnName="Tarifa" options={filterOptions.tarifa_acceso} selectedOptions={columnFilters.tarifa_acceso} onChange={(selected) => handleColumnFilterChange('tarifa_acceso', selected)}/></th>
                  {/* Quitar columna acciones */}
                </tr>
              </thead>
              <tbody>
                {/* No necesitamos la condición displayedData.length > 0 aquí de nuevo */}
                {displayedData.map(p => {
                     const isSelected = selectedIds.includes(p.id);
                     return (
                    <tr key={p.id} className={clsx(isSelected && 'selected-row')}>
                       <td style={{ paddingRight: 0 }}><input type="checkbox" checked={isSelected} onChange={() => handleRowSelect(p.id)} aria-label={`Seleccionar punto ${p.cups}`}/></td>
                       <td>{p.titular}</td>
                       <td>{p.clientes?.nombre ?? '—'}</td>
                       <td>{p.cups}</td>
                       <td>{p.direccion}</td>
                       <td>{p.localidad ?? '—'}</td>
                       <td>{p.provincia ?? '—'}</td>
                       <td>{p.tipo_factura ?? '—'}</td>
                       <td><span className="kbd">{p.tarifa_acceso}</span></td>
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
            onConfirm={() => { deletePuntoMutation.mutate(idsToDelete); }}
            title={`Confirmar Eliminación (${idsToDelete.length})`}
            message={ idsToDelete.length === 1 ? `¿Estás seguro de que quieres eliminar el punto de suministro seleccionado? Si tiene contratos o datos asociados, no se podrá eliminar.` : `¿Estás seguro de que quieres eliminar los ${idsToDelete.length} puntos de suministro seleccionados? Los puntos con contratos o datos asociados no se eliminarán.` }
            confirmText={`Sí, Eliminar ${idsToDelete.length}`}
            cancelText="Cancelar"
            confirmButtonClass="danger"
            isConfirming={deletePuntoMutation.isPending}
          />
    </div>
  );
}