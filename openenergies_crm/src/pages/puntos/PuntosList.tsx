import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro, TipoFactura } from '@lib/types';
import { Trash2, MapPinPlus, XCircle, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';
import { clsx } from '@lib/utils';
import { Pagination } from '@components/Pagination';
import { useEmpresas } from '@hooks/useEmpresas';

type PuntoConCliente = Omit<PuntoSuministro, 'localidad' | 'provincia' | 'tipo_factura'> & {
  localidad?: string | null;
  provincia?: string | null;
  tipo_factura?: TipoFactura | null;
  clientes: { id: string, nombre: string } | null;
  empresas?: { id: string, nombre: string } | null;
};

type SortField = 'cups' | 'direccion' | 'localidad' | 'provincia' | 'tarifa_acceso';
type SortOrder = 'asc' | 'desc';

interface FetchParams {
  filter: string;
  page: number;
  pageSize: number;
  sortField: SortField;
  sortOrder: SortOrder;
  filters: typeof initialColumnFilters;
  clienteId?: string;
  empresaId?: string;
}

const initialColumnFilters = {
  localidad: [] as string[],
  provincia: [] as string[],
  tipo_factura: [] as string[],
  tarifa_acceso: [] as string[],
  comercializadora: [] as string[],
};

async function fetchPuntosFilters(clienteId?: string) {
  const { data, error } = await supabase.rpc('get_puntos_filters_values', { 
    p_cliente_id: clienteId || null 
  });
  if (error) { console.error('Error fetching filters:', error); return null; }
  return data;
}

async function fetchPuntos({ filter, page, pageSize, sortField, sortOrder, filters, clienteId, empresaId }: FetchParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const selectStr = '*, clientes(id, nombre), empresas:current_comercializadora_id(id, nombre)';
  let query: any;

  if (filter) {
    // CAMBIO: Usamos (as any) para permitir pasar { count: 'exact' } al select posterior al RPC.
    // Esto soluciona que devuelva 0 registros en el count cuando se usa el buscador.
    query = (supabase.rpc('search_puntos_suministro', { 
      search_text: filter, 
      p_cliente_id: clienteId || null 
    }) as any).select(selectStr, { count: 'exact' });
  } else {
    query = supabase.from('puntos_suministro')
      .select(selectStr, { count: 'exact' });
    
    if (clienteId) query = query.eq('cliente_id', clienteId);
    if (empresaId) query = query.eq('current_comercializadora_id', empresaId);
  }

  // Aplicación de filtros de columna
  if (filters.localidad.length > 0) query = query.in('localidad', filters.localidad);
  if (filters.provincia.length > 0) query = query.in('provincia', filters.provincia);
  if (filters.tipo_factura.length > 0) query = query.in('tipo_factura', filters.tipo_factura);
  if (filters.tarifa_acceso.length > 0) query = query.in('tarifa_acceso', filters.tarifa_acceso);
  
  if (filters.comercializadora.length > 0) {
      query = query.in('current_comercializadora_id', filters.comercializadora);
  }

  query = query.order(sortField, { ascending: sortOrder === 'asc' });

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;
  return { data: data as PuntoConCliente[], count: count || 0 };
}

export default function PuntosList({ clienteId, empresaId }: { clienteId?: string, empresaId?: string }) {
  const queryClient = useQueryClient();
  const { empresas: listaEmpresas } = useEmpresas();
  
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortField, setSortField] = useState<SortField>('cups');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  useEffect(() => { setPage(1); }, [filter, columnFilters, clienteId, empresaId]);

  const { data: queryData, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['puntos', filter, page, sortField, sortOrder, columnFilters, clienteId, empresaId],
    queryFn: () => fetchPuntos({ 
      filter, page, pageSize, sortField, sortOrder, filters: columnFilters, clienteId, empresaId
    }),
    placeholderData: (prev) => prev
  });

  const { data: serverFilters } = useQuery({
    queryKey: ['puntosFilters', clienteId],
    queryFn: () => fetchPuntosFilters(clienteId),
    staleTime: 5 * 60 * 1000, 
  });

  const filterOptions = useMemo(() => {
    const base = serverFilters || { localidad: [], provincia: [], tipo_factura: [], tarifa_acceso: [] };
    return { ...base };
  }, [serverFilters]);
  
  const empresaNombreToId = useMemo(() => {
      const map: Record<string, string> = {};
      listaEmpresas.forEach(e => map[e.nombre] = e.id);
      return map;
  }, [listaEmpresas]);

  const handleComercializadoraFilterChange = (nombres: string[]) => {
      // CAMBIO: as string[] para corregir error TS
      const ids = nombres.map(n => empresaNombreToId[n]).filter(Boolean) as string[];
      setColumnFilters(prev => ({ ...prev, comercializadora: ids }));
  };

  const puntos = queryData?.data || [];
  const totalCount = queryData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.3 }} />;
    return sortOrder === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '4px' }} /> : <ArrowDown size={14} style={{ marginLeft: '4px' }} />;
  };

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const deletePuntoMutation = useMutation({
    mutationFn: async (puntoIds: string[]) => {
      const results = await Promise.allSettled(puntoIds.map(puntoId =>
        supabase.rpc('delete_punto_suministro', { punto_id_to_delete: puntoId })
      ));
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)) {
          errors.push(`Error al eliminar punto ${puntoIds[index]}`);
        }
      });
      if (errors.length > 0) throw new Error(errors.join('\n'));
      if (puntoIds.length > 1) await new Promise(res => setTimeout(res, 300));
    },
    onSuccess: () => {
        toast.success('Puntos eliminados.');
        setIdsToDelete([]); setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
    onError: (error: Error) => { toast.error(error.message); setIdsToDelete([]); },
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? puntos.map(p => p.id) : []);
  };
  const handleRowSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleDeleteSelected = () => setIdsToDelete([...selectedIds]);

  return (
    <div className="grid">
      <div className="page-header">
        {!clienteId && !empresaId && <h2 style={{ margin: 0 }}>Puntos de Suministro</h2>}
        <div className="page-actions" style={{ marginLeft: (clienteId || empresaId) ? 'auto' : undefined }}>
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionados</span>
               {selectedIds.length === 1 && <Link to="/app/puntos/$id" params={{ id: selectedIds[0]! }} className="icon-button secondary"><Edit size={18}/></Link>}
               <button className="icon-button danger" onClick={handleDeleteSelected}><Trash2 size={18}/></button>
               <button className="icon-button secondary" onClick={() => setSelectedIds([])}><XCircle size={18}/></button>
            </div>
          ) : (
            <>
              {!clienteId && !empresaId && (
                <>
                  <input placeholder="Buscar (CUPS, Direc., Comerc...)" value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: '250px' }}/>
                  <Link to="/app/puntos/nuevo"><button><MapPinPlus /></button></Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}
        {isError && <div style={{ padding: '2rem', color: 'red' }}>Error al cargar datos.</div>}

        {!isLoading && !isError && puntos.length === 0 && (
          <div style={{ padding: '2rem' }}>
             <EmptyState title="Sin resultados" description="No hay puntos que coincidan con los filtros." />
          </div>
        )}

        {!isLoading && !isError && puntos.length > 0 && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '1%' }}><input type="checkbox" checked={selectedIds.length === puntos.length && puntos.length > 0} onChange={handleSelectAll}/></th>
                    {/* CAMBIO: Ocultar columna Comercializadora si estamos en ficha de empresa */}
                    {!empresaId && (
                      <th>
                          <div style={{display:'flex', alignItems:'center'}}>
                              Comercializadora
                              <ColumnFilterDropdown 
                                  columnName="Comercializadora" 
                                  options={listaEmpresas.map(e => e.nombre)}
                                  selectedOptions={columnFilters.comercializadora.map(id => listaEmpresas.find(e => e.id === id)?.nombre || '')} 
                                  onChange={handleComercializadoraFilterChange}
                              />
                          </div>
                      </th>
                    )}
                    {/* CAMBIO: Ocultar columna Cliente si estamos en ficha de cliente */}
                    {!clienteId && (
                      <th>Cliente</th>
                    )}
                    <th><button onClick={() => handleSort('cups')} className="sortable-header">CUPS {renderSortIcon('cups')}</button></th>
                    <th><button onClick={() => handleSort('direccion')} className="sortable-header">Dirección {renderSortIcon('direccion')}</button></th>
                    <th><button onClick={() => handleSort('localidad')} className="sortable-header">Localidad {renderSortIcon('localidad')}</button>
                        <ColumnFilterDropdown columnName="Localidad" options={filterOptions.localidad} selectedOptions={columnFilters.localidad} onChange={(s) => handleColumnFilterChange('localidad', s)}/>
                    </th>
                    <th><button onClick={() => handleSort('provincia')} className="sortable-header">Provincia {renderSortIcon('provincia')}</button>
                        <ColumnFilterDropdown columnName="Provincia" options={filterOptions.provincia} selectedOptions={columnFilters.provincia} onChange={(s) => handleColumnFilterChange('provincia', s)}/>
                    </th>
                    <th>Tipo Fact. <ColumnFilterDropdown columnName="Tipo" options={filterOptions.tipo_factura} selectedOptions={columnFilters.tipo_factura} onChange={(s) => handleColumnFilterChange('tipo_factura', s)}/></th>
                    <th><button onClick={() => handleSort('tarifa_acceso')} className="sortable-header">Tarifa {renderSortIcon('tarifa_acceso')}</button>
                        <ColumnFilterDropdown columnName="Tarifa" options={filterOptions.tarifa_acceso} selectedOptions={columnFilters.tarifa_acceso} onChange={(s) => handleColumnFilterChange('tarifa_acceso', s)}/>
                    </th>
                  </tr>
                </thead>
                <tbody style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
                  {puntos.map(p => (
                    <tr key={p.id} className={clsx(selectedIds.includes(p.id) && 'selected-row')}>
                      <td><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleRowSelect(p.id)} /></td>
                      
                      {!empresaId && (
                        <td>
                          {p.empresas ? (
                              <Link to="/app/empresas/$id" params={{ id: p.empresas.id }} className="table-action-link">{p.empresas.nombre}</Link>
                          ) : '—'}
                        </td>
                      )}
                      
                      {!clienteId && (
                        <td>
                          {p.clientes ? (
                              <Link to="/app/clientes/$id" params={{ id: p.clientes.id }} className="table-action-link">{p.clientes.nombre}</Link>
                          ) : '—'}
                        </td>
                      )}
                      
                      <td>{p.cups}</td>
                      <td>{p.direccion}</td>
                      <td>{p.localidad ?? '—'}</td>
                      <td>{p.provincia ?? '—'}</td>
                      <td>{p.tipo_factura ?? '—'}</td>
                      <td><span className="kbd">{p.tarifa_acceso}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalItems={totalCount} onPageChange={setPage} isLoading={isPlaceholderData} />
          </>
        )}
      </div>
      <ConfirmationModal isOpen={idsToDelete.length > 0} onClose={() => setIdsToDelete([])} onConfirm={() => deletePuntoMutation.mutate(idsToDelete)} title="Eliminar Puntos" message="¿Seguro que quieres eliminar los puntos seleccionados?" confirmButtonClass="danger" isConfirming={deletePuntoMutation.isPending} />
    </div>
  );
}