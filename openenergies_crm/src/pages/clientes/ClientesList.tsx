// src/pages/clientes/ClientesList.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { useTheme } from '@hooks/ThemeContext';
import { Trash2, XCircle, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Plus, Loader2, Users, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSortableTable } from '@hooks/useSortableTable';
import ConfirmationModal from '@components/ConfirmationModal';
import ExportButton from '@components/ExportButton';

interface ClienteConAgregados {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  creado_en: string;
  puntos_count: number;
  total_kwh: number;
  activo: boolean;
}

const PAGE_SIZE = 50;

async function fetchClientes(search: string, empresaId?: string): Promise<ClienteConAgregados[]> {
  let query = supabase
    .from('clientes')
    .select(`
      id,
      nombre,
      dni,
      cif,
      creado_en,
      puntos_suministro!inner (
        id,
        consumo_anual_kwh,
        current_comercializadora_id,
        estado
      )
    `)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });

  if (empresaId) {
    // Filter by clients having points with this comercializadora
    query = query.eq('puntos_suministro.current_comercializadora_id', empresaId);
  } else {
    // If not filtering by empresa, we don't strictly need !inner, but for simplicity we keep the structure 
    // or relax it. However, !inner forces presence of points. 
    // To keep standard behavior (all clients even without points), we should conditionalize the select/join.
    // But `select` string is static. 
    // Actually, distinct clients behavior might be desired.
    // Let's use conditional modification of the query object if possible, but the select clause hardcodes the relationship.
    // Standard `fetchClientes` usually lists ALL clients.
    // If `empresaId` is missing, we shouldn't force `!inner`.
    // Reverting to `puntos_suministro` (left join) by default, and `!inner` filtering via `.not('puntos_suministro', 'is', null)` logic 
    // or just applying the filter on the relationship if Supabase supports it without !inner for filtering.
    // Actually, to filter parent by child, !inner is best.
    // Let's redefine the query based on empresaId presence.
  }

  // Re-declare query to handle the join type diff
  if (empresaId) {
    query = supabase
      .from('clientes')
      .select(`
          id,
          nombre,
          dni,
          cif,
          creado_en,
          puntos_suministro!inner (
             id,
             consumo_anual_kwh,
             current_comercializadora_id,
             estado
          )
        `)
      .eq('puntos_suministro.current_comercializadora_id', empresaId)
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false });
  } else {
    query = supabase
      .from('clientes')
      .select(`
          id,
          nombre,
          dni,
          cif,
          creado_en,
          puntos_suministro (
             id,
             consumo_anual_kwh,
             current_comercializadora_id,
             estado
          )
        `)
      .is('eliminado_en', null)
      .order('creado_en', { ascending: false }) as any;
  }

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,dni.ilike.%${search}%,cif.ilike.%${search}%`);
  }

  query = query.range(0, 99999);
  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((cliente: any) => {
    const puntos = cliente.puntos_suministro || [];
    const puntosActivos = puntos.filter((p: any) => p.id);
    const activo = puntosActivos.some((p: any) => p.estado === 'Aceptado');

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      dni: cliente.dni,
      cif: cliente.cif,
      creado_en: cliente.creado_en,
      puntos_count: puntosActivos.length,
      total_kwh: puntosActivos.reduce((acc: number, p: any) => acc + (Number(p.consumo_anual_kwh) || 0), 0),
      activo,
    };
  });
}

async function deleteCliente(clienteId: string) {
  const { error } = await supabase.functions.invoke('manage-client', {
    body: { action: 'delete', payload: { clienteId } }
  });
  if (error) throw new Error(error.message);
}

export default function ClientesList({ empresaId }: { empresaId?: string }) {
  const { rol } = useSession();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Border color for table separators: green in dark mode, gray in light mode
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['clientes', filter, empresaId],
    queryFn: () => fetchClientes(filter, empresaId),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const clienteId of ids) {
        await deleteCliente(clienteId);
      }
    },
    onSuccess: (_data, variables) => {
      toast.success(`${variables.length} cliente(s) eliminado(s) correctamente.`);
      setIdsToDelete([]);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
      setIdsToDelete([]);
    }
  });

  const {
    sortedData,
    handleSort,
    renderSortIcon
  } = useSortableTable<ClienteConAgregados>(fetchedData || [], {
    initialSortKey: 'creado_en',
    initialSortDirection: 'desc',
  });

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const displayedData = sortedData.slice(startIndex, endIndex);

  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const isAllSelected = displayedData.length > 0 && selectedIds.length === displayedData.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedData.length;

  const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToDelete([...selectedIds]);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    setSelectedIds([]);
  };

  if (empresaId) {
    return (
      <div className="glass-card overflow-hidden">
        {/* Integrated Header for Detail View */}
        <div className="p-6 border-b border-bg-intermediate">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Icon + Title + Counter */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-fenix-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500">Clientes</h2>
                <p className="text-sm text-gray-400">
                  {totalItems} cliente{totalItems !== 1 ? 's' : ''} encontrado{totalItems !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Right: Search + Export */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-1 md:flex-initial">
                <label className="flex items-center gap-2 text-sm font-medium text-fenix-600 dark:text-fenix-400 whitespace-nowrap">
                  <Search size={16} />
                  Buscar
                </label>
                <input
                  placeholder="Nombre, DNI..."
                  value={filter}
                  onChange={e => {
                    setFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="glass-input w-full md:w-64"
                />
              </div>
              <ExportButton
                entity="clientes"
                preFilters={{
                  comercializadora_id: empresaId,
                  search: filter
                }}
                label="Exportar"
              />
            </div>
          </div>
        </div>

        {/* Table Content (Reusing the same table structure, just wrapped differently) */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Error al cargar los clientes</p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['clientes'] })}
              className="text-primary hover:underline hover:text-fenix-400 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && fetchedData?.length === 0 ? (
          <EmptyState
            icon={<Users className="text-fenix-500" size={48} />}
            title="Sin clientes"
            description={filter ? 'No se encontraron clientes con ese criterio.' : 'No hay clientes registrados para esta empresa.'}
          />
        ) : !isLoading && !isError && (
          <div className="overflow-x-auto custom-scrollbar">
            {/* Table Logic (Duplicated for now or I could extract it, but keeping it inline to minimize risk) */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold" style={{ borderBottomColor: tableBorderColor }}>
                  <th className="p-4 rounded-tl-lg">Nombre / Razón Social</th>
                  <th className="p-4">DNI / CIF</th>
                  <th className="p-4 text-center">Puntos</th>
                  <th className="p-4 text-right">Consumo Anual</th>
                  <th className="p-4 text-center">Activo</th>
                  <th className="p-4 rounded-tr-lg text-center">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map((cliente: any) => (
                  <tr key={cliente.id} className="hover:bg-fenix-500/5 transition-colors group">
                    <td className="p-4">
                      <Link to="/app/clientes/$id" params={{ id: cliente.id }} className="font-medium text-fenix-600 dark:text-fenix-400 group-hover:text-primary transition-colors">
                        {cliente.nombre}
                      </Link>
                    </td>
                    <td className="p-4 text-secondary text-sm">{cliente.dni || cliente.cif || '—'}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cliente.puntos_count > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                        {cliente.puntos_count}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-secondary">
                      {cliente.total_kwh ? `${cliente.total_kwh.toLocaleString()} kWh` : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cliente.activo ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {cliente.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="p-4 text-center text-secondary text-sm">{fmtDate(cliente.creado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination for Integrated View */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-bg-intermediate bg-bg-intermediate/5">
                <div className="text-sm text-secondary">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-bg-intermediate disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary hover:text-primary"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-bg-intermediate disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-secondary hover:text-primary"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // GLOBAL VIEW (Existing layout)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Existing Header content without the empresaId logic (since we handled it above) */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
          </div>
          <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Clientes</h1>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 ? (
            /* Selection action bar */
            <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
              <span className="text-sm text-fenix-400 font-medium">
                {selectedIds.length} seleccionado(s)
              </span>
              <div className="flex items-center gap-1 ml-2">
                {/* Botón Editar - solo si hay 1 seleccionado */}
                {selectedIds.length === 1 && selectedIds[0] && (
                  <Link to="/app/clientes/$id/editar" params={{ id: selectedIds[0] }}>
                    <button
                      className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                      title="Editar cliente"
                    >
                      <Edit size={16} />
                    </button>
                  </Link>
                )}
                {/* Botón Eliminar */}
                <button
                  className="p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Eliminar seleccionados"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 size={16} />
                </button>
                {/* Botón Cancelar selección */}
                <button
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                  title="Cancelar selección"
                  onClick={() => setSelectedIds([])}
                >
                  <XCircle size={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <Search size={16} />
                  Buscar
                </label>
                <input
                  placeholder="Nombre, DNI o CIF..."
                  value={filter}
                  onChange={e => {
                    setFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="glass-input w-64"
                />
              </div>
              <ExportButton
                exportParams={{
                  entity: 'clientes',
                  filters: { search: filter || undefined },
                }}
              />
              <Link to="/app/clientes/nuevo">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-medium shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                  <Plus size={18} />
                  <span className="hidden sm:inline">Nuevo Cliente</span>
                </button>
              </Link>
            </>
          )}
        </div>
      </div>


      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-400">Error al cargar clientes.</p>
          </div>
        )}

        {!isLoading && !isError && (!fetchedData || fetchedData.length === 0) && !filter && (
          <EmptyState
            title="Sin clientes"
            description="Aún no hay clientes registrados."
            cta={<Link to="/app/clientes/nuevo"><button className="h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer">Crear el primero</button></Link>}
          />
        )}

        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                    style={{ borderBottomColor: tableBorderColor }}
                  >
                    <th className="w-10 p-4 text-left">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => {
                          if (input) input.indeterminate = isIndeterminate;
                        }}
                        onChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                        className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                      />
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('nombre')}
                        className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Nombre {renderSortIcon('nombre')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        DNI/CIF
                      </span>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('puntos_count')}
                        className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Puntos {renderSortIcon('puntos_count')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('total_kwh')}
                        className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        KWH {renderSortIcon('total_kwh')}
                      </button>
                    </th>
                    <th className="p-4 text-center">
                      <button
                        onClick={() => handleSort('activo')}
                        className="flex items-center justify-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Activo {renderSortIcon('activo')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('creado_en')}
                        className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Creado {renderSortIcon('creado_en')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fenix-500/10">
                  {displayedData.length > 0 ? (
                    displayedData.map(c => {
                      const isSelected = selectedIds.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={`
                            transition-colors cursor-default ${isSelected
                              ? 'bg-fenix-500/15 hover:bg-fenix-500/20'
                              : 'hover:bg-fenix-500/8'}
                          `}
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleRowSelect(c.id)}
                              aria-label={`Seleccionar ${c.nombre}`}
                              className="w-5 h-5 rounded-full border-2 border-primary bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                            />
                          </td>
                          <td className="p-4">
                            <Link
                              to="/app/clientes/$id"
                              params={{ id: c.id }}
                              className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors"
                            >
                              {c.nombre}
                            </Link>
                          </td>
                          <td className="p-4 text-gray-400">{c.dni || c.cif || '—'}</td>
                          <td className="p-4 text-gray-400">{c.puntos_count}</td>
                          <td className="p-4 text-gray-400">{c.total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${c.activo ? 'bg-green-500/15 text-green-500 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                              {c.activo ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400">{fmtDate(c.creado_en)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        Sin resultados que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t"
              style={{ borderTopColor: tableBorderColor }}
            >
              <div className="text-sm text-secondary">
                Total: <span className="text-primary font-bold">{totalItems}</span> registros •
                Página <span className="text-primary font-bold">{currentPage}</span> de <span className="text-primary font-bold">{totalPages || 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  title="Primera página"
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  title="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  title="Página siguiente"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  title="Última página"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={idsToDelete.length > 0}
        onClose={() => setIdsToDelete([])}
        onConfirm={() => deleteMutation.mutate(idsToDelete)}
        title={`Confirmar Eliminación (${idsToDelete.length})`}
        message={
          idsToDelete.length === 1
            ? '¿Estás seguro de que quieres eliminar al cliente seleccionado? Se borrarán todos sus datos asociados.'
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
