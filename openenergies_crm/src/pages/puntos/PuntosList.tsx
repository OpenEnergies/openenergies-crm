import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro, TipoFactura } from '@lib/types';
import { Pencil, Trash2, MapPinPlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';


type PuntoConCliente = Omit<PuntoSuministro, 'localidad' | 'provincia' | 'tipo_factura'> & {
  localidad?: string | null;
  provincia?: string | null;
  tipo_factura?: TipoFactura | null; // Usar el tipo importado
  clientes: { nombre: string } | null;
};

// Incluimos claves reales y 'cliente_nombre' como virtual
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
  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['puntos', filter, clienteId],
    queryFn: () => fetchPuntos(filter, clienteId)
  });

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

  // --- 👇 3. Filtra primero por columna ---
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    // Aplicamos también el filtro de texto general si existe
    let items = fetchedData;
    if (filter && !clienteId) { // Solo filtramos texto si no estamos en la vista de un cliente específico
        // La función RPC ya filtra si 'filter' tiene valor, esto sería redundante
        // a menos que la RPC no funcione como esperamos.
    }

    // Aplicamos filtros de columna
    return items.filter(item => {
      // Usamos '?? null' para asegurar que comparamos null si el valor no existe
      const localidad = item.localidad ?? null;
      const provincia = item.provincia ?? null;
      const tipoFactura = item.tipo_factura ?? null;
      const tarifaAcceso = item.tarifa_acceso ?? null;

      return (
        (columnFilters.localidad.length === 0 || columnFilters.localidad.includes(localidad!)) &&
        (columnFilters.provincia.length === 0 || columnFilters.provincia.includes(provincia!)) &&
        (columnFilters.tipo_factura.length === 0 || columnFilters.tipo_factura.includes(tipoFactura!)) &&
        (columnFilters.tarifa_acceso.length === 0 || columnFilters.tarifa_acceso.includes(tarifaAcceso!))
      );
    });
  // Añadimos 'filter' a las dependencias
  }, [fetchedData, columnFilters, filter, clienteId]);
  
  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const [puntoToDelete, setPuntoToDelete] = useState<PuntoConCliente | null>(null);
  const deletePuntoMutation = useMutation({
    mutationFn: async (puntoId: string) => {
      const { error } = await supabase.rpc('delete_punto_suministro', {
        punto_id_to_delete: puntoId
      });
      if (error) {
           const message = error.message.includes('Aún tiene datos asociados')
              ? 'No se pudo borrar: Aún tiene datos asociados (contratos, documentos, etc.).'
              : `Error al eliminar: ${error.message}`;
           throw new Error(message);
      }
    },
    onSuccess: () => {
        toast.success('Punto de Suministro eliminado.');
        setPuntoToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['puntos', filter, clienteId] });
    },
    onError: (error: Error) => {
        toast.error(error.message);
        setPuntoToDelete(null);
    },
  });

  const {
      sortedData: displayedData,
      handleSort,
      renderSortIcon
  } = useSortableTable<PuntoConCliente & { cliente_nombre?: string | null }>(filteredData, {
      initialSortKey: 'cups', // Orden inicial por CUPS
      initialSortDirection: 'asc',
      // Cast to any because the hook expects a single generic parameter;
      // this preserves the custom virtual key 'cliente_nombre'.
      sortValueAccessors: {
          // Clave virtual para nombre de cliente
          cliente_nombre: (item: PuntoConCliente) => item.clientes?.nombre,
          // Accessors explícitos para manejar posibles nulls
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

  return (
    <div className="grid">
      {!clienteId && (
        <div className="page-header">
          <h2 style={{margin:'0'}}>Puntos de suministro</h2>
          <div className="page-actions" style={{width: '100%', maxWidth: 500}}>
            <input 
              placeholder="CUPS, dirección o titular" 
              value={filter} 
              onChange={e=>setFilter(e.target.value)} 
              aria-label="Filtro" 
            />
            <Link to="/app/puntos/nuevo"><button><MapPinPlus /></button></Link>
          </div>
        </div>
      )}

      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar puntos.</div>}
      
      <div className="card">
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState
            title="Sin puntos de suministro"
            description="Aún no hay puntos de suministro (CUPS) registrados."
            cta={<Link to="/app/puntos/nuevo"><button>Crear el primero</button></Link>}
          />
        )}
        
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
             Este cliente no tiene puntos de suministro asignados.
           </div>
        )}

        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort('titular')} className="sortable-header">
                      Titular {renderSortIcon('titular')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('cliente_nombre')} className="sortable-header">
                      Cliente {renderSortIcon('cliente_nombre')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('cups')} className="sortable-header">
                      CUPS {renderSortIcon('cups')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('direccion')} className="sortable-header">
                      Dirección {renderSortIcon('direccion')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('localidad')} className="sortable-header">
                      Localidad {renderSortIcon('localidad')}
                    </button>
                    <ColumnFilterDropdown
                      columnName="Localidad"
                      options={filterOptions.localidad}
                      selectedOptions={columnFilters.localidad}
                      onChange={(selected) => handleColumnFilterChange('localidad', selected)}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('provincia')} className="sortable-header">
                      Provincia {renderSortIcon('provincia')}
                    </button>
                    <ColumnFilterDropdown
                      columnName="Provincia"
                      options={filterOptions.provincia}
                      selectedOptions={columnFilters.provincia}
                      onChange={(selected) => handleColumnFilterChange('provincia', selected)}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('tipo_factura')} className="sortable-header">
                      Tipo Factura {renderSortIcon('tipo_factura')}
                    </button>
                     <ColumnFilterDropdown
                      columnName="Tipo Factura"
                      options={filterOptions.tipo_factura}
                      selectedOptions={columnFilters.tipo_factura}
                      onChange={(selected) => handleColumnFilterChange('tipo_factura', selected)}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('tarifa_acceso')} className="sortable-header">
                      Tarifa {renderSortIcon('tarifa_acceso')}
                    </button>
                     <ColumnFilterDropdown
                      columnName="Tarifa"
                      options={filterOptions.tarifa_acceso}
                      selectedOptions={columnFilters.tarifa_acceso}
                      onChange={(selected) => handleColumnFilterChange('tarifa_acceso', selected)}
                    />
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              {/* --- CUERPO CORREGIDO --- */}
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(p => (
                    <tr key={p.id}>
                      <td>{p.titular}</td>
                      <td>{p.clientes?.nombre ?? '—'}</td>
                      <td>{p.cups}</td>
                      <td>{p.direccion}</td>
                      <td>{p.localidad ?? '—'}</td>
                      <td>{p.provincia ?? '—'}</td>
                      <td>{p.tipo_factura ?? '—'}</td>
                      <td><span className="kbd">{p.tarifa_acceso}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/app/puntos/$id`} params={{ id: p.id }} className="icon-button secondary" title="Editar Punto de Suministro">
                          <Pencil size={18} />
                        </Link>
                        <button className="icon-button danger" title="Eliminar Punto de Suministro" onClick={() => setPuntoToDelete(p)} disabled={deletePuntoMutation.isPending}>
                           <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
                      Sin resultados que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
               {/* --- FIN CUERPO CORREGIDO --- */}
            </table>
          </div>
        )}
      </div>
      
      {puntoToDelete && (
          <ConfirmationModal
            isOpen={!!puntoToDelete}
            onClose={() => setPuntoToDelete(null)}
            onConfirm={() => {
              // Corregido: Chequeo de null
              if (puntoToDelete) {
                deletePuntoMutation.mutate(puntoToDelete.id);
              }
            }}
            title="Confirmar Eliminación"
             // Corregido: Usar ?. (optional chaining)
            message={`¿Estás seguro de que quieres eliminar el punto de suministro con CUPS "${puntoToDelete?.cups}"?`}
            confirmText="Sí, Eliminar"
            cancelText="Cancelar"
            confirmButtonClass="danger"
            isConfirming={deletePuntoMutation.isPending}
          />
      )}
    </div>
  );
}