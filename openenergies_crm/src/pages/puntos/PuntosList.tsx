import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro } from '@lib/types';
import { Pencil, Trash2, MapPinPlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';

type PuntoConCliente = PuntoSuministro & {
  localidad?: string | null;
  provincia?: string | null;
  tipo_factura?: 'Luz' | 'Gas' | null;
  clientes: { nombre: string } | null
};

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
  
  const displayedData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      return (
        (columnFilters.localidad.length === 0 || columnFilters.localidad.includes(item.localidad!)) &&
        (columnFilters.provincia.length === 0 || columnFilters.provincia.includes(item.provincia!)) &&
        (columnFilters.tipo_factura.length === 0 || columnFilters.tipo_factura.includes(item.tipo_factura!)) &&
        (columnFilters.tarifa_acceso.length === 0 || columnFilters.tarifa_acceso.includes(item.tarifa_acceso))
      );
    });
  }, [fetchedData, columnFilters]);
  
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
                  <th>Titular</th>
                  <th>Cliente</th>
                  <th>CUPS</th>
                  <th>Dirección</th>
                  <th>
                    Localidad
                    <ColumnFilterDropdown
                      columnName="Localidad"
                      options={filterOptions.localidad}
                      selectedOptions={columnFilters.localidad}
                      onChange={(selected) => handleColumnFilterChange('localidad', selected)}
                    />
                  </th>
                  <th>
                    Provincia
                    <ColumnFilterDropdown
                      columnName="Provincia"
                      options={filterOptions.provincia}
                      selectedOptions={columnFilters.provincia}
                      onChange={(selected) => handleColumnFilterChange('provincia', selected)}
                    />
                  </th>
                  <th>
                    Tipo Factura
                     <ColumnFilterDropdown
                      columnName="Tipo Factura"
                      options={filterOptions.tipo_factura}
                      selectedOptions={columnFilters.tipo_factura}
                      onChange={(selected) => handleColumnFilterChange('tipo_factura', selected)}
                    />
                  </th>
                  <th>
                    Tarifa
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