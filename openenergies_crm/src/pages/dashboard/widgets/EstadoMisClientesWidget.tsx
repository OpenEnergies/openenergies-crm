// src/pages/dashboard/widgets/EstadoMisClientesWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { BarChart3, Loader2 } from 'lucide-react'; // Usamos BarChart3 como icono
import { useSession } from '@hooks/useSession';
import type { EstadoCliente } from '@lib/types';

// Tipo para almacenar los conteos por estado
type EstadoClientesSummary = Record<EstadoCliente | 'total', number>;

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
    return summary; // Si no es comercial, devuelve ceros
  }

  // 1. Obtenemos los IDs de los clientes asignados
  const { data: asignaciones, error: asignError } = await supabase
    .from('asignaciones_comercial')
    .select('cliente_id')
    .eq('comercial_user_id', comercialUserId);

  if (asignError) {
    console.error("Error fetching asignaciones:", asignError);
    throw new Error(asignError.message);
  }

  const clienteIds = asignaciones?.map(a => a.cliente_id) ?? [];

  if (clienteIds.length === 0) {
    return summary; // Si no tiene clientes asignados, devuelve ceros
  }

  // 2. Obtenemos el estado de esos clientes
  const { data: clientes, error: clientesError } = await supabase
    .from('clientes')
    .select('estado')
    .in('id', clienteIds); // Filtramos por los IDs obtenidos

  if (clientesError) {
    console.error("Error fetching estado clientes:", clientesError);
    throw new Error(clientesError.message);
  }

  // 3. Contamos los clientes por estado
  summary.total = clientes?.length ?? 0;
  clientes?.forEach(cliente => {
    const estado = cliente.estado as EstadoCliente | null ?? 'stand by'; // Usamos 'stand by' si es null
    if (summary[estado] !== undefined) {
      summary[estado]++;
    }
  });

  return summary;
}

// Mapa de estados a clases de status-dot (para el color)
const estadoDotClass: Record<EstadoCliente, string> = {
    'activo': 'status-activo',
    'procesando': 'status-procesando',
    'stand by': 'status-standby',
    'desistido': 'status-desistido',
};


export default function EstadoMisClientesWidget() {
  const { userId } = useSession(); // Obtenemos el userId del comercial

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['estadoClientesAsignadosDashboard', userId],
    queryFn: () => fetchEstadoClientesAsignados(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  // Excluimos 'total' para el mapeo de la lista
  const estadosAMostrar = Object.keys(summary ?? {}).filter(k => k !== 'total') as EstadoCliente[];

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <BarChart3 size={20} /> Estado de Mis Clientes
      </h3>
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {isError && (
        <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar estados.</p>
      )}
      {!isLoading && !isError && summary && summary.total === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No tienes clientes asignados.</p>
      )}
      {!isLoading && !isError && summary && summary.total > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {estadosAMostrar.map((estado) => (
            <li key={estado} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '0.5rem', fontSize: '0.9rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'capitalize' }}>
                <span className={`status-dot ${estadoDotClass[estado]}`}></span> {/* Punto de color */}
                {estado}
              </span>
              <span style={{ fontWeight: 'bold' }}>
                {summary[estado]}
              </span>
            </li>
          ))}
          {/* Total */}
           <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', marginTop: '0.25rem', borderTop: '1px solid var(--border-color)', fontWeight: 'bold' }}>
              <span>Total</span>
              <span>{summary.total}</span>
           </li>
        </ul>
      )}
    </div>
  );
}