import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { Edit, HousePlus, Building2, Loader2, XCircle, Archive, RotateCcw, ArrowLeft } from 'lucide-react';
import { useSortableTable } from '@hooks/useSortableTable';
import { toast } from 'react-hot-toast';

async function fetchEmpresas(archived: boolean) {
  const query = supabase
    .from('empresas')
    .select('*')
    .order('creada_en', { ascending: false });

  if (archived) {
    query.eq('is_archived', true);
  } else {
    query.or('is_archived.is.null,is_archived.eq.false');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Empresa[];
}

interface EmpresasListProps {
  mode?: 'active' | 'archived';
}

export default function EmpresasList({ mode = 'active' }: EmpresasListProps) {
  const isArchivedMode = mode === 'archived';
  const queryClient = useQueryClient();
  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['empresas', mode],
    queryFn: () => fetchEmpresas(isArchivedMode)
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
  } = useSortableTable<Empresa>(fetchedData, {
    initialSortKey: 'nombre',
    initialSortDirection: 'asc'
  });

  // Selection handlers
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

  // Restore archived empresa
  const restoreMutation = useMutation({
    mutationFn: async (empresaId: string) => {
      const { error } = await supabase
        .from('empresas')
        .update({ is_archived: false, archived_at: null })
        .eq('id', empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Empresa restaurada correctamente');
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      setSelectedIds([]);
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isArchivedMode ? 'bg-gray-500/20' : 'bg-fenix-500/20'}`}>
            {isArchivedMode ? <Archive className="w-5 h-5 text-gray-400" /> : <Building2 className="w-5 h-5 text-fenix-400" />}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isArchivedMode ? 'text-gray-400' : 'text-fenix-500'}`}>
              {isArchivedMode ? 'Empresas Archivadas' : 'Gestión de Empresas'}
            </h1>
            {isArchivedMode && <p className="text-sm text-gray-500">Empresas que han sido archivadas</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isArchivedMode && (
            <Link to="/app/empresas">
              <button className="flex items-center gap-2 h-11 px-4 rounded-lg bg-bg-intermediate hover:bg-bg-intermediate/80 text-gray-300 font-medium transition-colors cursor-pointer">
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Volver</span>
              </button>
            </Link>
          )}
          {selectedIds.length > 0 ? (
            /* Selection action bar - compact inline style */
            <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
              <span className="text-sm text-fenix-400 font-medium">
                {selectedIds.length} seleccionado(s)
              </span>
              <div className="flex items-center gap-1 ml-2">
                {selectedIds.length === 1 && selectedIds[0] && !isArchivedMode && (
                  <Link
                    to="/app/empresas/$id/editar"
                    params={{ id: selectedIds[0] }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                    title="Editar Empresa"
                  >
                    <Edit size={16} />
                  </Link>
                )}
                {selectedIds.length === 1 && selectedIds[0] && isArchivedMode && (
                  <button
                    onClick={() => restoreMutation.mutate(selectedIds[0]!)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-fenix-400 hover:bg-fenix-500/10 transition-colors cursor-pointer"
                    title="Restaurar Empresa"
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw size={16} />
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
            !isArchivedMode && (
              <Link to="/app/empresas/nueva">
                <button className="flex items-center gap-2 h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer">
                  <HousePlus size={18} />
                  <span className="hidden sm:inline">Nueva</span>
                </button>
              </Link>
            )
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
            <p className="text-red-400">Error al cargar las empresas.</p>
          </div>
        )}

        {fetchedData && fetchedData.length === 0 && !isLoading && (
          <EmptyState
            title="Sin empresas"
            description="Aún no hay empresas colaboradoras registradas."
            cta={
              <Link to="/app/empresas/nueva">
                <button className="h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer">
                  Crear la primera
                </button>
              </Link>
            }
          />
        )}

        {fetchedData && fetchedData.length > 0 && (
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
                      aria-label="Seleccionar todas"
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
                    <button
                      onClick={() => handleSort('cif')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      CIF {renderSortIcon('cif')}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('tipo')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Tipo {renderSortIcon('tipo')}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('creada_en')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-200 uppercase tracking-wider hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Creada en {renderSortIcon('creada_en')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map(e => {
                  const isSelected = selectedIds.includes(e.id);
                  return (
                    <tr
                      key={e.id}
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
                          onChange={() => handleRowSelect(e.id)}
                          aria-label={`Seleccionar ${e.nombre}`}
                          className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      <td className="p-4">
                        <Link
                          to="/app/empresas/$id"
                          params={{ id: e.id }}
                          className="text-fenix-400 hover:text-fenix-300 font-medium transition-colors cursor-pointer"
                        >
                          {e.nombre}
                        </Link>
                      </td>
                      <td className="p-4 text-gray-400">{e.cif ?? '—'}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-md bg-bg-intermediate text-gray-300">
                          {e.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{fmtDate(e.creada_en)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

