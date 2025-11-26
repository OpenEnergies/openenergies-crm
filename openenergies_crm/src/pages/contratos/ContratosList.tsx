// src/pages/contratos/ContratosList.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { Trash2, XCircle, Edit, ArrowUpDown, ArrowUp, ArrowDown, BadgePlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
// import DateFilterDropdown from '@components/DateFilterDropdown'; // Deshabilitamos filtro fecha complejo por ahora
import { toast } from 'react-hot-toast';
import { fmtDate, clsx } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Pagination } from '@components/Pagination';
import { EmptyState } from '@components/EmptyState';

type ContratoExtendido = Contrato & {
  puntos_suministro: { cups: string; direccion: string; clientes: { nombre: string } | null; } | null;
  empresas: { nombre: string } | null;
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
  clienteId?: string;
}

async function fetchContratos({ filter, page, pageSize, sortField, sortOrder, avisoFilter, clienteId }: FetchParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const selectQuery = `*, puntos_suministro ( cups, direccion, clientes ( nombre ) ), empresas ( nombre )`;
  let query;

  if (filter) {
    query = supabase.rpc('search_contratos', { search_text: filter, p_cliente_id: clienteId || null })
      .select(selectQuery);
  } else {
    query = supabase.from('contratos').select(selectQuery, { count: 'exact' });
    if (clienteId) query = query.eq('cliente_id', clienteId); // Asumiendo que contratos tiene cliente_id
  }

  // Filtro booleano de Aviso (Mapeo 'Sí'/'No' a true/false)
  if (avisoFilter.length > 0) {
    const wantsTrue = avisoFilter.includes('Sí');
    const wantsFalse = avisoFilter.includes('No');
    if (wantsTrue && !wantsFalse) query = query.eq('aviso_renovacion', true);
    if (!wantsTrue && wantsFalse) query = query.eq('aviso_renovacion', false);
  }

  query = query.order(sortField, { ascending: sortOrder === 'asc' })
               .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as ContratoExtendido[], count: count || 0 };
}

export default function ContratosList({ clienteId }: { clienteId?: string }) {
  const queryClient = useQueryClient();
  const { rol } = useSession();
  
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortField, setSortField] = useState<SortField>('fecha_inicio');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [avisoFilter, setAvisoFilter] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  useEffect(() => { setPage(1); }, [filter, avisoFilter, clienteId]);

  const { data: queryData, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['contratos', filter, page, sortField, sortOrder, avisoFilter, clienteId],
    queryFn: () => fetchContratos({ filter, page, pageSize, sortField, sortOrder, avisoFilter, clienteId }),
    placeholderData: (prev) => prev
  });

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
      setIdsToDelete([]);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
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
        {!clienteId && <h2 style={{margin:0}}>Contratos</h2>}
        <div className="page-actions" style={{ marginLeft: clienteId ? 'auto' : undefined }}>
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
              {!clienteId && (
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
               cta={canEdit && !clienteId ? <Link to="/app/contratos/nuevo"><button>Crear primero</button></Link> : null}
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
                    <th>Comercializadora</th>
                    <th><button onClick={() => handleSort('oferta')} className="sortable-header">Oferta {renderSortIcon('oferta')}</button></th>
                    <th><button onClick={() => handleSort('fecha_inicio')} className="sortable-header">Inicio {renderSortIcon('fecha_inicio')}</button></th>
                    <th><button onClick={() => handleSort('fecha_fin')} className="sortable-header">Fin {renderSortIcon('fecha_fin')}</button></th>
                    <th>
                      Aviso
                      <ColumnFilterDropdown columnName="Aviso" options={['Sí', 'No']} selectedOptions={avisoFilter} onChange={setAvisoFilter} />
                    </th>
                  </tr>
                </thead>
                <tbody style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
                  {contratos.map(c => (
                    <tr key={c.id} className={clsx(selectedIds.includes(c.id) && 'selected-row')}>
                      <td><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleRowSelect(c.id)}/></td>
                      <td>{c.puntos_suministro?.cups ?? '—'}</td>
                      <td>{c.empresas?.nombre ?? '—'}</td>
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
      <ConfirmationModal
        isOpen={idsToDelete.length > 0}
        onClose={() => setIdsToDelete([])}
        onConfirm={() => deleteMutation.mutate(idsToDelete)}
        title="Eliminar Contratos"
        message="¿Seguro que deseas eliminar los contratos seleccionados?"
        confirmButtonClass="danger"
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}