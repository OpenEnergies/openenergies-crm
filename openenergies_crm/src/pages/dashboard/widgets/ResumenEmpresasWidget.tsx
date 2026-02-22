// src/pages/dashboard/widgets/ResumenEmpresasWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Building2, Store, Loader2, ArrowRight } from 'lucide-react';
import type { Empresa } from '@lib/types';

type EmpresaSummaryCounts = {
  total: number;
  tipos: Record<Empresa['tipo'], number>;
};

async function fetchEmpresaSummaryCounts(): Promise<EmpresaSummaryCounts> {
  const { data, error, count } = await supabase
    .from('empresas')
    .select('tipo', { count: 'exact' });

  if (error) {
    console.error("Error fetching empresa summary counts:", error);
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const tipos: Record<Empresa['tipo'], number> = {
    openenergies: 0,
    comercializadora: 0,
  };

  (data || []).forEach(e => {
    if (e.tipo && tipos[e.tipo as Empresa['tipo']] !== undefined) {
      tipos[e.tipo as Empresa['tipo']]++;
    }
  });

  return { total, tipos };
}

export default function ResumenEmpresasWidget() {
  const { data: counts, isLoading, isError } = useQuery({
    queryKey: ['empresaSummaryCountsDashboard'],
    queryFn: fetchEmpresaSummaryCounts,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="text-base font-bold text-primary">Comercializadoras</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center py-4 font-medium italic">Error al cargar resumen.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && counts && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/app/empresas"
            className="flex flex-col items-center p-4 rounded-lg bg-bg-intermediate/50 hover:bg-bg-intermediate transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
              <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-secondary">{counts.tipos.comercializadora}</p>
            <p className="text-xs text-secondary opacity-70 font-semibold uppercase tracking-tight">Comercializadoras</p>
          </Link>

          {(counts.tipos.openenergies ?? 0) > 0 && (
            <Link
              to="/app/empresas"
              className="flex flex-col items-center p-4 rounded-lg bg-bg-intermediate/50 hover:bg-bg-intermediate transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mb-2">
                <Building2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-secondary">{counts.tipos.openenergies}</p>
              <p className="text-xs text-secondary opacity-70 font-semibold uppercase tracking-tight">Internas</p>
            </Link>
          )}
        </div>
      )}

      {/* Footer link */}
      <Link
        to="/app/empresas"
        className="flex items-center justify-end gap-1 mt-4 text-sm text-fenix-400 hover:text-fenix-300 transition-colors cursor-pointer"
      >
        Ver comercializadoras <ArrowRight size={14} />
      </Link>
    </div>
  );
}
