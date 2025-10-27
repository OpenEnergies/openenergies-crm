// src/pages/dashboard/widgets/ContratosPorVencerWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { fmtDate } from '@lib/utils';

// -------- Tipos RAW (lo que puede venir de Supabase) --------
type ClienteRaw = { id: string; nombre: string };
type PuntoRawObj = { cups: string; clientes: ClienteRaw[] | ClienteRaw | null };
type PuntoRaw = PuntoRawObj | PuntoRawObj[] | null;
type EmpresaRawUnit = { nombre: string };
type EmpresaRaw = EmpresaRawUnit | EmpresaRawUnit[] | null;

type ContratoPorVencerRaw = {
  id: string;
  fecha_fin: string | null;
  puntos_suministro: PuntoRaw;
  empresas: EmpresaRaw;
};

// -------- Tipo NORMALIZADO (lo que usa tu UI) --------
type ContratoPorVencer = {
  id: string;
  fecha_fin: string | null;
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
      fecha_fin,
      puntos_suministro!inner (
        cups,
        clientes ( id, nombre )
      ),
      empresas ( nombre )
      `
    )
    .eq('estado', 'activo')
    .gte('fecha_fin', todayISO)
    .lte('fecha_fin', futureDateISO)
    .order('fecha_fin', { ascending: true })
    .limit(limit)
    .returns<ContratoPorVencerRaw[]>(); // Tipamos SOLO la respuesta cruda

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
      fecha_fin: row.fecha_fin,
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
    <div className="card" >
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <AlertTriangle size={20} /> Contratos por Vencer ({days} días)
      </h3>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {isError && <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar.</p>}

      {!isLoading && !isError && contratos && (
        <div>
          {count > 0 && (
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', margin: '0 0 1rem' }}>
              {count}{count >= displayLimit ? '+' : ''} Contratos
            </p>
          )}

          {contratos.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {contratos.map((contrato) => {
                const cliente = contrato.puntos_suministro?.clientes;
                const clienteNombre = cliente?.nombre ?? 'Cliente Desconocido';
                const clienteId = cliente?.id;
                const comercializadoraNombre = contrato.empresas?.nombre ?? 'Com. Desc.';
                const cups = contrato.puntos_suministro?.cups ?? 'CUPS Desc.';

                return (
                  <li
                    key={contrato.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-color-light)',
                      paddingBottom: '0.5rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clienteId ? (
                        <Link to="/app/clientes/$id" params={{ id: clienteId }} title={cups}>
                          {clienteNombre}
                        </Link>
                      ) : (
                        <span title={cups}>{clienteNombre}</span>
                      )}
                      <br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{comercializadoraNombre}</span>
                    </span>

                    <span
                      style={{
                        color: 'var(--danger-color, #DC2626)',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        marginLeft: '1rem',
                        textAlign: 'right',
                      }}
                    >
                      Vence:
                      <br /> {fmtDate(contrato.fecha_fin)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay contratos venciendo pronto.</p>
          )}

          {count > 0 && (
            <div style={{ textAlign: 'right' }}>
              <Link to="/app/renovaciones" style={{ fontSize: '0.9rem' }}>
                Ver todos &rarr;
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
