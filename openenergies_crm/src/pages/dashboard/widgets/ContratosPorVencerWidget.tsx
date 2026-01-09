// src/pages/dashboard/widgets/ContratosPorVencerWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { fmtDate } from '@lib/utils';

// -------- Tipos RAW (lo que puede venir de Supabase) --------
type ClienteRaw = { id: string; nombre: string };
type PuntoRawObj = { cups: string; clientes: ClienteRaw[] | ClienteRaw | null };
type PuntoRaw = PuntoRawObj | PuntoRawObj[] | null;
type EmpresaRawUnit = { nombre: string };
type EmpresaRaw = EmpresaRawUnit | EmpresaRawUnit[] | null;

type ContratoPorVencerRaw = {
  id: string;
  fecha_renovacion: string | null;
  puntos_suministro: PuntoRaw;
  empresas: EmpresaRaw;
};

// -------- Tipo NORMALIZADO (lo que usa tu UI) --------
type ContratoPorVencer = {
  id: string;
  fecha_renovacion: string | null;
  puntos_suministro: {
    cups: string;
    clientes: { id: string; nombre: string } | null;
  } | null;
  empresas: { nombre: string } | null;
};

// -------- Helper: convierte (T | T[] | null) -> T | null --------
function unwrapArray<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return (Array.isArray(value) ? value[0] ?? null : value) as T | null;
}

// -------- Fetch NORMALIZADO --------
async function fetchProximosContratosPorVencer(
  daysThreshold: number = 90,
  limit: number = 3
): Promise<ContratoPorVencer[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysThreshold);

  const todayISO = today.toISOString().split('T')[0];
  const futureDateISO = futureDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('contratos')
    .select(
      `
      id,
      fecha_renovacion,
      puntos_suministro!inner (
        cups,
        clientes ( id, nombre )
      ),
      empresas ( nombre )
      `
    )
    .gte('fecha_renovacion', todayISO)
    .lte('fecha_renovacion', futureDateISO)
    .order('fecha_renovacion', { ascending: true })
    .limit(limit)
    .returns<ContratoPorVencerRaw[]>();

  if (error) {
    console.error('Error fetching próximos contratos por vencer:', error);
    throw new Error(error.message);
  }

  // Normalización -> tipo final ContratoPorVencer
  const normalized: ContratoPorVencer[] = (data ?? []).map((row) => {
    const ps = unwrapArray<PuntoRawObj>(row.puntos_suministro as PuntoRawObj | PuntoRawObj[] | null);
    const cliente = ps ? unwrapArray<ClienteRaw>(ps.clientes as ClienteRaw | ClienteRaw[] | null) : null;
    const empresa = unwrapArray<EmpresaRawUnit>(row.empresas as EmpresaRawUnit | EmpresaRawUnit[] | null);

    return {
      id: row.id,
      fecha_renovacion: row.fecha_renovacion,
      puntos_suministro: ps
        ? {
          cups: ps.cups,
          clientes: cliente ? { id: cliente.id, nombre: cliente.nombre } : null,
        }
        : null,
      empresas: empresa ? { nombre: empresa.nombre } : null,
    };
  });

  return normalized;
}

export default function ContratosPorVencerWidget() {
  const days = 90;
  const displayLimit = 3;

  const { data: contratos, isLoading, isError } = useQuery<ContratoPorVencer[]>({
    queryKey: ['proximosContratosPorVencer', days, displayLimit],
    queryFn: () => fetchProximosContratosPorVencer(days, displayLimit),
    staleTime: 60 * 60 * 1000,
  });

  const count = contratos?.length ?? 0;

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-base font-bold text-primary">Contratos por Vencer</h3>
        <span className="ml-auto text-xs text-secondary opacity-70 bg-bg-intermediate px-2 py-1 rounded-full font-bold uppercase tracking-tight">
          {days} días
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center py-4 font-medium italic">Error al cargar.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && contratos && (
        <>
          {count > 0 && (
            <p className="text-3xl font-bold text-secondary text-center mb-4">
              {count}{count >= displayLimit ? '+' : ''}
              <span className="text-lg font-normal text-secondary opacity-60 ml-2">contratos</span>
            </p>
          )}

          {contratos.length > 0 ? (
            <ul className="space-y-3">
              {contratos.map((contrato) => {
                const cliente = contrato.puntos_suministro?.clientes;
                const clienteNombre = cliente?.nombre ?? 'Cliente Desconocido';
                const clienteId = cliente?.id;
                const comercializadoraNombre = contrato.empresas?.nombre ?? 'Com. Desc.';
                const cups = contrato.puntos_suministro?.cups ?? 'CUPS Desc.';

                return (
                  <li
                    key={contrato.id}
                    className="flex items-center justify-between pb-3 border-b border-bg-intermediate last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      {clienteId ? (
                        <Link
                          to="/app/clientes/$id"
                          params={{ id: clienteId }}
                          className="text-sm font-bold text-secondary hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors truncate block cursor-pointer"
                          title={cups}
                        >
                          {clienteNombre}
                        </Link>
                      ) : (
                        <span className="text-sm font-bold text-secondary truncate block" title={cups}>
                          {clienteNombre}
                        </span>
                      )}
                      <span className="text-xs text-secondary opacity-60 font-mono italic">{comercializadoraNombre}</span>
                    </div>

                    <div className="text-right ml-3">
                      <span className="text-xs text-secondary opacity-60 font-medium">Vence</span>
                      <span className="block text-sm font-bold text-amber-600 dark:text-amber-400">
                        {fmtDate(contrato.fecha_renovacion)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-secondary opacity-60 text-center py-4 italic">No hay contratos venciendo pronto.</p>
          )}

          {count > 0 && (
            <Link
              to="/app/renovaciones"
              className="flex items-center justify-end gap-1 mt-4 text-sm text-fenix-400 hover:text-fenix-300 transition-colors cursor-pointer"
            >
              Ver todos <ArrowRight size={14} />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

