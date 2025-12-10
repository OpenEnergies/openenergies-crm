// src/pages/empresas/EmpresasList.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate, clsx } from '@lib/utils';
import { Pencil, HousePlus, DollarSign, Archive, ArchiveRestore, Inbox, XCircle, Edit, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PreciosEmpresaModal from './PreciosEmpresaModal';
import ConfirmationModal from '@components/ConfirmationModal';
import { Pagination } from '@components/Pagination';

// --- Componente Logo ---
function EmpresaLogo({ url, size = 20 }: { url?: string | null; size?: number }) {
  const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%239ca3af">?</text></svg>';
  return <img src={url ?? placeholder} alt="" width={size} height={size} style={{ objectFit: 'contain', borderRadius: 4, background: '#fff', border: '1px solid #e5e7eb' }} onError={(e) => { if (e.currentTarget.src !== placeholder) e.currentTarget.src = placeholder; }} />;
}

type EmpresaConConteo = Empresa & {
  contratos_activos: { count: number }[];
  logo_url?: string | null;
};

type SortField = 'nombre' | 'cif' | 'tipo' | 'creada_en' | 'archived_at';
type SortOrder = 'asc' | 'desc';

interface FetchParams {
  mode: 'active' | 'archived';
  page: number;
  pageSize: number;
  sortField: SortField;
  sortOrder: SortOrder;
}

async function fetchEmpresas({ mode, page, pageSize, sortField, sortOrder }: FetchParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('empresas')
    .select(`
      *,
      logo_url,
      contratos_activos:contratos!comercializadora_id(count)
    `, { count: 'exact' })
    .eq('is_archived', mode === 'archived')
    .order(sortField, { ascending: sortOrder === 'asc' })
    .range(from, to);

  if (error) throw error;
  return { data: data as EmpresaConConteo[], count: count || 0 };
}

export default function EmpresasList({ mode = 'active' }: { mode?: 'active' | 'archived' }) {
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortField, setSortField] = useState<SortField>(mode === 'active' ? 'creada_en' : 'archived_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToArchive, setIdsToArchive] = useState<string[]>([]);
  const [idsToUnarchive, setIdsToUnarchive] = useState<string[]>([]);
  const [modalState, setModalState] = useState<{ id: string; nombre: string } | null>(null);

  useEffect(() => { setPage(1); }, [mode]);

  const { data: queryData, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['empresas', mode, page, sortField, sortOrder],
    queryFn: () => fetchEmpresas({ mode, page, pageSize, sortField, sortOrder }),
    placeholderData: (prev) => prev
  });

  const empresas = queryData?.data || [];
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

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('empresas').update({ is_archived: true, archived_at: new Date().toISOString() }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Empresas archivadas.');
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setSelectedIds([]); setIdsToArchive([]);
    },
    onError: (e) => toast.error(e.message)
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('empresas').update({ is_archived: false, archived_at: null }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Empresas recuperadas.');
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setSelectedIds([]); setIdsToUnarchive([]);
    },
    onError: (e) => toast.error(e.message)
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? empresas.map(x => x.id) : []);
  };
  const handleRowSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="grid">
      <div className="page-header">
        {mode === 'active' ? <h2 style={{margin:0}}>Empresas</h2> : 
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/app/empresas" className="icon-button secondary"><ArrowLeft size={20}/></Link>
            <h2 style={{margin:0}}>Empresas Archivadas</h2>
          </div>
        }
        <div className="page-actions">
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
              <span>{selectedIds.length} seleccionadas</span>
              {mode === 'active' && (
                <>
                  {selectedIds.length === 1 && <Link to="/app/empresas/$id/editar" params={{ id: selectedIds[0]! }} className="icon-button secondary"><Edit size={18}/></Link>}
                  {selectedIds.length === 1 && empresas.find(e=>e.id===selectedIds[0]!)?.tipo === 'comercializadora' && 
                    <button className="icon-button secondary" onClick={() => setModalState({ id: selectedIds[0]!, nombre: empresas.find(e=>e.id===selectedIds[0]!)?.nombre! })}><DollarSign size={18}/></button>
                  }
                  <button className="icon-button danger" onClick={() => setIdsToArchive([...selectedIds])}><Archive size={18}/></button>
                </>
              )}
              {mode === 'archived' && (
                <button className="icon-button secondary" onClick={() => setIdsToUnarchive([...selectedIds])}><ArchiveRestore size={18}/></button>
              )}
              <button className="icon-button secondary" onClick={() => setSelectedIds([])}><XCircle size={18}/></button>
            </div>
          ) : (
            mode === 'active' && (
              <>
                <Link to="/app/empresas/archivadas"><button className="secondary" title="Archivadas"><Inbox size={22}/></button></Link>
                <Link to="/app/empresas/nueva"><button><HousePlus size={22}/></button></Link>
              </>
            )
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && <div style={{padding: '2rem', textAlign: 'center'}}>Cargando...</div>}
        {!isLoading && !isError && empresas.length === 0 && (
          <div style={{padding: '2rem'}}>
            <EmptyState title="Sin empresas" description="No hay empresas registradas." />
          </div>
        )}

        {!isLoading && !isError && empresas.length > 0 && (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '1%' }}><input type="checkbox" checked={selectedIds.length === empresas.length} onChange={handleSelectAll}/></th>
                    <th><button onClick={() => handleSort('nombre')} className="sortable-header">Nombre {renderSortIcon('nombre')}</button></th>
                    <th><button onClick={() => handleSort('cif')} className="sortable-header">CIF {renderSortIcon('cif')}</button></th>
                    <th><button onClick={() => handleSort('tipo')} className="sortable-header">Tipo {renderSortIcon('tipo')}</button></th>
                    <th>Contratos Activos</th>
                    <th><button onClick={() => handleSort(mode === 'active' ? 'creada_en' : 'archived_at')} className="sortable-header">{mode==='active'?'Creada':'Archivada'} {renderSortIcon(mode === 'active' ? 'creada_en' : 'archived_at')}</button></th>
                  </tr>
                </thead>
                <tbody style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
                  {empresas.map(e => (
                    <tr key={e.id} className={clsx(selectedIds.includes(e.id) && 'selected-row')}>
                      <td><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => handleRowSelect(e.id)} /></td>
                      {/* --- NOMBRE CLICABLE --- */}
                      <td>
                        <Link to="/app/empresas/$id" params={{ id: e.id }} className="table-action-link font-semibold" style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <EmpresaLogo url={e.logo_url}/><span>{e.nombre}</span>
                        </Link>
                      </td>
                      <td>{e.cif ?? '—'}</td>
                      <td><span className="kbd">{e.tipo}</span></td>
                      <td>{e.contratos_activos[0]?.count ?? 0}</td>
                      <td>{fmtDate(mode === 'active' ? e.creada_en : e.archived_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalItems={totalCount} onPageChange={setPage} isLoading={isPlaceholderData} />
          </>
        )}
      </div>

      <ConfirmationModal isOpen={idsToArchive.length > 0} onClose={() => setIdsToArchive([])} onConfirm={() => archiveMutation.mutate(idsToArchive)} title="Archivar" message="¿Archivar empresas?" confirmButtonClass="danger" />
      <ConfirmationModal isOpen={idsToUnarchive.length > 0} onClose={() => setIdsToUnarchive([])} onConfirm={() => unarchiveMutation.mutate(idsToUnarchive)} title="Recuperar" message="¿Recuperar empresas?" confirmButtonClass="secondary" />
      {modalState && <PreciosEmpresaModal empresaId={modalState.id} empresaNombre={modalState.nombre} onClose={() => setModalState(null)} />}
    </div>
  );
}