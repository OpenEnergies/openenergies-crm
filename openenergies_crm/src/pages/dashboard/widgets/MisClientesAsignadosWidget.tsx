// src/pages/dashboard/widgets/MisClientesAsignadosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Target, Loader2, Zap } from 'lucide-react';
import { useSession } from '@hooks/useSession';

async function fetchPuntosAsignadosCount(comercialUserId: string | null): Promise<number> {
  if (!comercialUserId) {
    return 0;
  }

  const { count, error } = await supabase
    .from('asignaciones_comercial')
    .select('*', { count: 'exact', head: true })
    .eq('comercial_user_id', comercialUserId);

  if (error) {
    console.error("Error fetching puntos asignados count:", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

export default function MisClientesAsignadosWidget() {
  const { userId } = useSession();

  const { data: count, isLoading, isError } = useQuery({
    queryKey: ['puntosAsignadosCountDashboard', userId],
    queryFn: () => fetchPuntosAsignadosCount(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Target className="w-4 h-4 text-cyan-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Mis Clientes Asignados</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400 text-center py-4">Error al cargar.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && count !== undefined && count !== null && (
        <Link
          to="/app/clientes"
          className="block text-center p-4 rounded-lg glass-card hover:bg-bg-intermediate transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">{count}</p>
          <p className="text-sm text-gray-400">Clientes Asignados</p>
        </Link>
      )}
    </div>
  );
}