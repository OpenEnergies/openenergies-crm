import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { Trash2, XCircle, Edit, ArrowUpDown, ArrowUp, ArrowDown, BadgePlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { toast } from 'react-hot-toast';
import { fmtDate, clsx } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Pagination } from '@components/Pagination';
import { EmptyState } from '@components/EmptyState';
import { useEmpresas } from '@hooks/useEmpresas';

type ContratoExtendido = Contrato & {
  puntos_suministro: { cups: string; direccion: string; clientes: { nombre: string } | null; } | null;
  empresas: { id: string, nombre: string } | null;
};

type SortField = 'fecha_inicio' | 'fecha_fin' | 'oferta' | 'estado' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface FetchParams {
  filter: string;
  page: number;
  pageSize: number;
  sortField: SortField;
  sortOrder: SortOrder;
  avisoFilter: string[];
  dateFilters: { inicio: DateParts; fin: DateParts; };
  clienteId?: string;
  empresaId?: string;
  comercializadoraFilter?: string[];
}

const initialDateFilter: DateParts = { year: null, month: null, day: null };

async function fetchContratosDates() {
  const { data, error } = await supabase.rpc('get_contratos_dates');
  if (error) { console.error(error); return { fecha_inicio: [], fecha_fin: [] }; }
  return data;
}

async function fetchContratos({ filter, page, pageSize, sortField, sortOrder, avisoFilter, dateFilters, clienteId, empresaId, comercializadoraFilter }: FetchParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let selectQuery = `*, puntos_suministro ( cups, direccion, clientes ( nombre ) ), empresas ( id, nombre )`;
  let query: any;

  if (filter) {
    // CAMBIO: Cast a any para permitir .select con count tras rpc
    query = (supabase.rpc('search_contratos', { search_text: filter, p_cliente_id: clienteId || null }) as any)
      .select(selectQuery, { count: 'exact' });
  } else {
    if (clienteId) {
      selectQuery = `*, puntos_suministro!inner ( cups, direccion, clientes ( nombre ) ), empresas ( id, nombre )`;
      query = supabase.from('contratos').select(selectQuery, { count: 'exact' }).eq('puntos_suministro.cliente_id', clienteId);
    } else {
      query = supabase.from('contratos').select(selectQuery, { count: 'exact' });
    }
  }

  if (empresaId) {
      query = query.eq('comercializadora_id', empresaId);
  }

  if (avisoFilter.length > 0) {
    const wantsTrue = avisoFilter.includes('Sí');
    const wantsFalse = avisoFilter.includes('No');
    if (wantsTrue && !wantsFalse) query = query.eq('aviso_renovacion', true);
    if (!wantsTrue && wantsFalse) query = query.eq('aviso_renovacion', false);
  }
  
  if (comercializadoraFilter && comercializadoraFilter.length > 0) {
      query = query.in('comercializadora_id', comercializadoraFilter);
  }

  const applyDateFilter = (col: string, part: DateParts) => {
    if (part.year) {
      const yearStart = `${part.year}-01-01`;
      const yearEnd = `${part.year}-12-31`;
      if (part.month) {
         const m = part.month;
         const dateStart = `${part.year}-${m}-01`;
         let nextM = parseInt(m) + 1;
         let nextY = parseInt(part.year);
         if (nextM > 12) { nextM = 1; nextY++; }
         const dateEnd = `${nextY}-${nextM.toString().padStart(2,'0')}-01`;
         if (part.day) query = query.eq(col, `${part.year}-${m}-${part.day}`);
         else query = query.gte(col, dateStart).lt(col, dateEnd);
      } else {
         query = query.gte(col, yearStart).lte(col, yearEnd);
      }
    }
  };

  applyDateFilter('fecha_inicio', dateFilters.inicio);
  applyDateFilter('fecha_fin', dateFilters.fin);

  query = query.order(sortField, { ascending: sortOrder === 'asc' }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as ContratoExtendido[], count: count || 0 };
}

export default function ContratosList({ clienteId, empresaId }: { clienteId?: string, empresaId?: string }) {
  const queryClient = useQueryClient();
  const { rol } = useSession();
  const { empresas: listaEmpresas } = useEmpresas();
  
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortField, setSortField] = useState<SortField>('fecha_inicio');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [avisoFilter, setAvisoFilter] = useState<string[]>([]);
  const [comercializadoraFilter, setComercializadoraFilter] = useState<string[]>([]);
  const [dateFilterInicio, setDateFilterInicio] = useState<DateParts>(initialDateFilter);
  const [dateFilterFin, setDateFilterFin] = useState<DateParts>(initialDateFilter);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  useEffect(() => { setPage(1); }, [filter, avisoFilter, comercializadoraFilter, dateFilterInicio, dateFilterFin, clienteId, empresaId]);

  const { data: queryData, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['contratos', filter, page, sortField, sortOrder, avisoFilter, comercializadoraFilter, dateFilterInicio, dateFilterFin, clienteId, empresaId],
    queryFn: () => fetchContratos({ 
      filter, page, pageSize, sortField, sortOrder, avisoFilter, clienteId, empresaId,
      comercializadoraFilter,
      dateFilters: { inicio: dateFilterInicio, fin: dateFilterFin }
    }),
    placeholderData: (prev) => prev
  });

  const { data: dateOptionsRaw } = useQuery({ queryKey: ['contratosDates'], queryFn: fetchContratosDates, staleTime: 5 * 60 * 1000 });

  const filterOptions = useMemo(() => {
    const toDates = (arr: string[]) => (arr || []).map(d => new Date(d));
    return {
      fecha_inicio: toDates(dateOptionsRaw?.fecha_inicio),
      fecha_fin: toDates(dateOptionsRaw?.fecha_fin),
      aviso: ['Sí', 'No']
    };
  }, [dateOptionsRaw]);

  const empresaNombreToId = useMemo(() => {
      const map: Record<string, string> = {};
      listaEmpresas.forEach(e => map[e.nombre] = e.id);
      return map;
  }, [listaEmpresas]);

  const handleComercializadoraFilterChange = (nombres: string[]) => {
      // CAMBIO: as string[] para corregir error TS
      const ids = nombres.map(n => empresaNombreToId[n]).filter(Boolean) as string[];
      setComercializadoraFilter(ids);
  };

  const contratos = queryData?.data || [];
  const totalCount = queryData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('contratos').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contratos eliminados.');
      setIdsToDelete([]); setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['contratosDates'] });
    },
    onError: (e) => toast.error(e.message)
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.3 }} />;
    return sortOrder === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '4px' }} /> : <ArrowDown size={14} style={{ marginLeft: '4px' }} />;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? contratos.map(c => c.id) : []);
  };
  const handleRowSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const canEdit = rol === 'administrador' || rol === 'comercial';

  return (
    <div className="grid">
      <div className="page-header">
        {!clienteId && !empresaId && <h2 style={{margin:0}}>Contratos</h2>}
        <div className="page-actions" style={{ marginLeft: (clienteId || empresaId) ? 'auto' : undefined }}>
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
               <span>{selectedIds.length} seleccionados</span>
               {selectedIds.length === 1 && canEdit && (
                 <Link to="/app/contratos/$id" params={{ id: selectedIds[0]! }} className="icon-button secondary"><Edit size={18}/></Link>
               )}
               <button className="icon-button danger" onClick={() => setIdsToDelete([...selectedIds])}><Trash2 size={18}/></button>
               <button className="icon-button secondary" onClick={() => setSelectedIds([])}><XCircle size={18}/></button>
            </div>
          ) : (
            <>
              {!clienteId && !empresaId && (
                <>
                  <input placeholder="Buscar..." value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: '250px' }} />
                  {canEdit && <Link to="/app/contratos/nuevo"><button><BadgePlus /></button></Link>}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && <div style={{padding: '2rem', textAlign: 'center'}}>Cargando...</div>}
        {isError && <div style={{padding: '2rem', color: 'red'}}>Error al cargar.</div>}

        {!isLoading && !isError && contratos.length === 0 && (
          <div style={{padding: '2rem'}}>
             <EmptyState title="Sin contratos" description="No se encontraron contratos." 
               cta={canEdit && !clienteId && !empresaId ? <Link to="/app/contratos/nuevo"><button>Crear primero</button></Link> : null}
             />
          </div>
        )}

        {!isLoading && !isError && contratos.length > 0 && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '1%' }}><input type="checkbox" checked={selectedIds.length === contratos.length} onChange={handleSelectAll}/></th>
                    <th>CUPS</th>
                    {/* CAMBIO: Ocultar columna Comercializadora si estamos en ficha de empresa */}
                    {!empresaId && (
                      <th>
                          <div style={{display:'flex', alignItems:'center'}}>
                              Comercializadora
                              <ColumnFilterDropdown 
                                  columnName="Comercializadora" 
                                  options={listaEmpresas.map(e => e.nombre)} 
                                  selectedOptions={comercializadoraFilter.map(id => listaEmpresas.find(e => e.id === id)?.nombre || '')} 
                                  onChange={handleComercializadoraFilterChange} 
                              />
                          </div>
                      </th>
                    )}
                    <th><button onClick={() => handleSort('oferta')} className="sortable-header">Oferta {renderSortIcon('oferta')}</button></th>
                    <th>
                        <button onClick={() => handleSort('fecha_inicio')} className="sortable-header">Inicio {renderSortIcon('fecha_inicio')}</button>
                        <DateFilterDropdown columnName="Fecha Inicio" options={filterOptions.fecha_inicio} selectedDate={dateFilterInicio} onChange={setDateFilterInicio} />
                    </th>
                    <th>
                        <button onClick={() => handleSort('fecha_fin')} className="sortable-header">Fin {renderSortIcon('fecha_fin')}</button>
                        <DateFilterDropdown columnName="Fecha Fin" options={filterOptions.fecha_fin} selectedDate={dateFilterFin} onChange={setDateFilterFin} />
                    </th>
                    <th>
                      Aviso
                      <ColumnFilterDropdown columnName="Aviso" options={filterOptions.aviso} selectedOptions={avisoFilter} onChange={setAvisoFilter} />
                    </th>
                  </tr>
                </thead>
                <tbody style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
                  {contratos.map(c => (
                    <tr key={c.id} className={clsx(selectedIds.includes(c.id) && 'selected-row')}>
                      <td><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleRowSelect(c.id)}/></td>
                      <td>{c.puntos_suministro?.cups ?? '—'}</td>
                      
                      {!empresaId && (
                        <td>
                          {c.empresas ? (
                              <Link to="/app/empresas/$id" params={{ id: c.empresas.id }} className="table-action-link">{c.empresas.nombre}</Link>
                          ) : '—'}
                        </td>
                      )}
                      
                      <td>{c.oferta ?? '—'}</td>
                      <td>{fmtDate(c.fecha_inicio)}</td>
                      <td>{fmtDate(c.fecha_fin)}</td>
                      <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalItems={totalCount} onPageChange={setPage} isLoading={isPlaceholderData} />
          </>
        )}
      </div>
      <ConfirmationModal isOpen={idsToDelete.length > 0} onClose={() => setIdsToDelete([])} onConfirm={() => deleteMutation.mutate(idsToDelete)} title="Eliminar Contratos" message="¿Seguro que deseas eliminar los contratos seleccionados?" confirmButtonClass="danger" isConfirming={deleteMutation.isPending} />
    </div>
  );
}