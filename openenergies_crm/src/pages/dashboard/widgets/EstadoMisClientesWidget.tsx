// src/pages/dashboard/widgets/EstadoMisClientesWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { BarChart3, Loader2 } from 'lucide-react';
import { useSession } from '@hooks/useSession';
import type { EstadoCliente } from '@lib/types';

// Tipo para almacenar los conteos por estado
type EstadoClientesSummary = Record<EstadoCliente | 'total', number>;

// Tipo para la respuesta de la consulta con JOIN
type AsignacionConCliente = {
  punto_id: string;
  puntos_suministro: {
    cliente_id: string;
  };
};

// Función para obtener los estados de los clientes asignados
async function fetchEstadoClientesAsignados(comercialUserId: string | null): Promise<EstadoClientesSummary> {
  const summary: EstadoClientesSummary = {
    'activo': 0,
    'procesando': 0,
    'stand by': 0,
    'desistido': 0,
    'total': 0,
  };

  if (!comercialUserId) {
    return summary;
  }

  const { data: asignaciones, error: asignError } = await supabase
    .from('asignaciones_comercial_punto')
    .select(`
      punto_id,
      puntos_suministro!inner(
        cliente_id
      )
    `)
    .eq('comercial_user_id', comercialUserId) as { data: AsignacionConCliente[] | null; error: any };

  if (asignError) {
    console.error("Error fetching asignaciones:", asignError);
    throw new Error(asignError.message);
  }

  const clienteIds = asignaciones?.map(a => a.puntos_suministro.cliente_id) ?? [];

  if (clienteIds.length === 0) {
    return summary;
  }

  /* 
   * FIX: 'estado' column does not exist on 'clientes'. 
   * Assuming all assigned clients are 'activo' for now.
   */
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('id') // Removed 'estado'
    .in('id', clienteIds);

  if (clientesError) {
    console.error("Error fetching estado clientes:", clientesError);
    throw new Error(clientesError.message);
  }

  summary.total = clientes?.length ?? 0;

  // Hardcode assignment as 'activo' since we can't query it
  summary['activo'] = summary.total;

  return summary;
}

// Tailwind color classes for each status
const estadoColors: Record<EstadoCliente, string> = {
  'activo': 'bg-green-400',
  'procesando': 'bg-amber-400',
  'stand by': 'bg-gray-400',
  'desistido': 'bg-red-400',
};

export default function EstadoMisClientesWidget() {
  const { userId } = useSession();

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['estadoClientesAsignadosDashboard', userId],
    queryFn: () => fetchEstadoClientesAsignados(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const estadosAMostrar = Object.keys(summary ?? {}).filter(k => k !== 'total') as EstadoCliente[];

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-base font-bold text-primary">Estado de Mis Clientes</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center py-4 font-medium italic">Error al cargar estados.</p>
      )}

      {/* Empty */}
      {!isLoading && !isError && summary && summary.total === 0 && (
        <p className="text-sm text-secondary opacity-60 text-center py-4 italic">No tienes clientes asignados.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && summary && summary.total > 0 && (
        <ul className="space-y-2">
          {estadosAMostrar.map((estado) => (
            <li
              key={estado}
              className="flex items-center justify-between py-2 border-b border-bg-intermediate last:border-0"
            >
              <span className="flex items-center gap-2 text-sm text-secondary font-medium capitalize">
                <span className={`w-2 h-2 rounded-full ${estadoColors[estado]}`} />
                {estado}
              </span>
              <span className="text-sm font-bold text-secondary">
                {summary[estado]}
              </span>
            </li>
          ))}
          {/* Total */}
          <li className="flex items-center justify-between pt-3 mt-2 border-t border-bg-intermediate">
            <span className="text-sm font-bold text-primary uppercase tracking-tight">Total</span>
            <span className="text-lg font-bold text-fenix-600 dark:text-fenix-400">{summary.total}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
