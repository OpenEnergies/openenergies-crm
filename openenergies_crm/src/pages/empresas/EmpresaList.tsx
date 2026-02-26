import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { Edit, HousePlus, Building2, Loader2, XCircle, Archive, RotateCcw, ArrowLeft } from 'lucide-react';
import { useSortableTable } from '@hooks/useSortableTable';
import { useTheme } from '@hooks/ThemeContext';
import { toast } from 'react-hot-toast';
import EmpresaLogo from '@components/EmpresaLogo';
import ExportButton from '@components/ExportButton';

async function fetchEmpresas(archived: boolean) {
  const query = supabase
    .from('empresas')
    .select('*')
    .eq('tipo', 'comercializadora')
    .order('creada_en', { ascending: false });

  if (archived) {
    query.eq('is_archived', true);
  } else {
    query.or('is_archived.is.null,is_archived.eq.false');
  }

  query.range(0, 99999);
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
  const { theme } = useTheme();

  // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

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
      toast.success('Comercializadora restaurada correctamente');
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isArchivedMode ? 'bg-bg-intermediate' : 'bg-fenix-500/20'}`}>
            {isArchivedMode ? <Archive className="w-5 h-5 text-secondary" /> : <Building2 className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isArchivedMode ? 'text-secondary' : 'text-fenix-600 dark:text-fenix-500'}`}>
              {isArchivedMode ? 'Com. Archivadas' : 'Gestión de Comercializadoras'}
            </h1>
            {isArchivedMode && <p className="text-sm text-secondary opacity-70">Comercializadoras que han sido archivadas</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isArchivedMode && (
            <Link to="/app/empresas">
              <button className="flex items-center gap-2 h-11 px-4 rounded-lg bg-bg-intermediate hover:bg-bg-intermediate/80 text-primary font-medium transition-colors cursor-pointer">
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
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                    title="Editar Comercializadora"
                  >
                    <Edit size={16} />
                  </Link>
                )}
                {selectedIds.length === 1 && selectedIds[0] && isArchivedMode && (
                  <button
                    onClick={() => restoreMutation.mutate(selectedIds[0]!)}
                    className="p-1.5 rounded-lg text-secondary hover:text-fenix-600 dark:hover:text-fenix-400 hover:bg-fenix-500/10 transition-colors cursor-pointer"
                    title="Restaurar Comercializadora"
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
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
            !isArchivedMode && (
              <div className="flex items-center gap-3">
                <ExportButton
                  exportParams={{
                    entity: 'empresas',
                    filters: { is_archived: false },
                  }}
                />
                <Link to="/app/empresas/nueva">
                  <button className="flex items-center gap-2 h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer">
                    <HousePlus size={18} />
                    <span className="hidden sm:inline">Nueva</span>
                  </button>
                </Link>
              </div>
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
            <p className="text-red-400">Error al cargar las comercializadoras.</p>
          </div>
        )}

        {fetchedData && fetchedData.length === 0 && !isLoading && (
          <EmptyState
            title="Sin comercializadoras"
            description="Aún no hay comercializadoras registradas."
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
                <tr
                  className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                  style={{ borderBottomColor: tableBorderColor }}
                >
                  <th className="p-4 w-10 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={input => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={handleSelectAll}
                      aria-label="Seleccionar todas"
                      className="w-5 h-5 rounded-full border-2 border-slate-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                    />
                  </th>
                  <th className="w-14 p-4 text-left">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Logo</span>
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
                    <button
                      onClick={() => handleSort('cif')}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      CIF {renderSortIcon('cif')}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('creada_en')}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
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
                          className="w-5 h-5 rounded-full border-2 border-primary bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      <td className="p-4">
                        <EmpresaLogo
                          logoUrl={e.logo_url}
                          nombre={e.nombre}
                          size="sm"
                        />
                      </td>
                      <td className="p-4">
                        <Link
                          to="/app/empresas/$id"
                          params={{ id: e.id }}
                          className="text-fenix-600 dark:text-fourth font-bold hover:underline transition-colors cursor-pointer"
                        >
                          {e.nombre}
                        </Link>
                      </td>
                      <td className="p-4 text-secondary font-medium">{e.cif ?? '—'}</td>
                      <td className="p-4 text-secondary text-sm font-medium">{fmtDate(e.creada_en)}</td>
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

