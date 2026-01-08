// src/pages/clientes/ClientesList.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Trash2, XCircle, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Plus, Loader2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSortableTable } from '@hooks/useSortableTable';
import ConfirmationModal from '@components/ConfirmationModal';

interface ClienteConAgregados {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  creado_en: string;
  puntos_count: number;
  total_kwh: number;
}

const PAGE_SIZE = 50;

async function fetchClientes(search: string): Promise<ClienteConAgregados[]> {
  let query = supabase
    .from('clientes')
    .select(`
      id,
      nombre,
      dni,
      cif,
      creado_en,
      puntos_suministro (
        id,
        consumo_anual_kwh
      )
    `)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,dni.ilike.%${search}%,cif.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((cliente: any) => {
    const puntos = cliente.puntos_suministro || [];
    const puntosActivos = puntos.filter((p: any) => p.id);

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      dni: cliente.dni,
      cif: cliente.cif,
      creado_en: cliente.creado_en,
      puntos_count: puntosActivos.length,
      total_kwh: puntosActivos.reduce((acc: number, p: any) => acc + (Number(p.consumo_anual_kwh) || 0), 0),
    };
  });
}

async function deleteCliente(clienteId: string) {
  const { error } = await supabase.functions.invoke('manage-client', {
    body: { action: 'delete', payload: { clienteId } }
  });
  if (error) throw new Error(error.message);
}

export default function ClientesList() {
  const { rol } = useSession();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['clientes', filter],
    queryFn: () => fetchClientes(filter),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-fenix-500" />
          </div>
          <h1 className="text-2xl font-bold text-fenix-500">Clientes</h1>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 ? (
            /* Selection action bar */
            <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
              <span className="text-sm text-fenix-400 font-medium">
                {selectedIds.length} seleccionado(s)
              </span>
              <div className="flex items-center gap-1 ml-2">
                {selectedIds.length === 1 && canEdit && selectedIds[0] && (
                  <Link
                    to="/app/clientes/$id/editar"
                    params={{ id: selectedIds[0] }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors"
                    title="Editar Cliente"
                  >
                    <Edit size={16} />
                  </Link>
                )}
                {canDelete && (
                  <button
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={`Eliminar ${selectedIds.length} cliente(s)`}
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
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
                  <tr className="border-b-2 border-bg-intermediate bg-bg-intermediate">
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
                        className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Nombre {renderSortIcon('nombre')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                        DNI/CIF
                      </span>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('creado_en')}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Creado {renderSortIcon('creado_en')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('puntos_count')}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Puntos {renderSortIcon('puntos_count')}
                      </button>
                    </th>
                    <th className="p-4 text-left">
                      <button
                        onClick={() => handleSort('total_kwh')}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        KWH {renderSortIcon('total_kwh')}
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
                              className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                            />
                          </td>
                          <td className="p-4">
                            <Link
                              to="/app/clientes/$id"
                              params={{ id: c.id }}
                              className="font-medium text-white hover:text-fenix-400 transition-colors"
                            >
                              {c.nombre}
                            </Link>
                          </td>
                          <td className="p-4 text-gray-400">{c.dni || c.cif || '—'}</td>
                          <td className="p-4 text-gray-400">{fmtDate(c.creado_en)}</td>
                          <td className="p-4 text-gray-400">{c.puntos_count}</td>
                          <td className="p-4 text-gray-400">{c.total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        Sin resultados que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-bg-intermediate">
              <div className="text-sm text-gray-400">
                Total: <span className="text-white font-medium">{totalItems}</span> registros •
                Página <span className="text-white font-medium">{currentPage}</span> de <span className="text-white font-medium">{totalPages || 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  title="Primera página"
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  title="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  title="Página siguiente"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
