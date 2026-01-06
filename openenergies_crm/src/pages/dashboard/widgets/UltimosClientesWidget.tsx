// src/pages/dashboard/widgets/UltimosClientesWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Users, Loader2, ArrowRight } from 'lucide-react';
import { fmtDate } from '@lib/utils';

type ClienteReciente = {
  id: string;
  nombre: string;
  creado_en: string | null;
};

async function fetchUltimosClientes(limit: number = 5): Promise<ClienteReciente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, creado_en')
    .order('creado_en', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching últimos clientes:", error);
    throw new Error(error.message);
  }
  return (data as ClienteReciente[]) || [];
}

export default function UltimosClientesWidget() {
  const displayLimit = 5;

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ['ultimosClientesDashboard', displayLimit],
    queryFn: () => fetchUltimosClientes(displayLimit),
    staleTime: 15 * 60 * 1000,
  });

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-violet-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Últimos Clientes</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400 text-center py-4">Error al cargar clientes.</p>
      )}

      {/* Empty */}
      {!isLoading && !isError && clientes && clientes.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No hay clientes recientes.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && clientes && clientes.length > 0 && (
        <ul className="space-y-3">
          {clientes.map(cliente => (
            <li
              key={cliente.id}
              className="flex items-center justify-between pb-3 border-b border-bg-intermediate last:border-0"
            >
              <Link
                to="/app/clientes/$id"
                params={{ id: cliente.id }}
                className="text-sm font-medium text-gray-200 hover:text-fenix-400 transition-colors truncate pr-3 cursor-pointer"
              >
                {cliente.nombre}
              </Link>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {fmtDate(cliente.creado_en)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Footer link */}
      <Link
        to="/app/clientes"
        className="flex items-center justify-end gap-1 mt-4 text-sm text-fenix-400 hover:text-fenix-300 transition-colors cursor-pointer"
      >
        Ver todos <ArrowRight size={14} />
      </Link>
    </div>
  );
}