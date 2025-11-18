// src/pages/dashboard/widgets/UltimosClientesWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Users, Loader2 } from 'lucide-react'; // Usamos Users como icono
import { fmtDate } from '@lib/utils'; // Para formatear la fecha

// Tipo para los clientes recientes
type ClienteReciente = {
  id: string;
  nombre: string;
  creado_en: string | null;
};

// Función para obtener los últimos clientes
async function fetchUltimosClientes(limit: number = 5): Promise<ClienteReciente[]> {
  // Nota: Si en el futuro necesitas filtrar por comercial,
  // necesitarías pasar el userId del comercial y hacer un join
  // con la tabla 'asignaciones_comercial'.
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, creado_en')
    .order('creado_en', { ascending: false, nullsFirst: false }) // Los más recientes primero, nulls al final
    .limit(limit);

  if (error) {
    console.error("Error fetching últimos clientes:", error);
    throw new Error(error.message);
  }
  return (data as ClienteReciente[]) || [];
}

export default function UltimosClientesWidget() {
  const displayLimit = 5; // Cuántos clientes mostrar

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ['ultimosClientesDashboard', displayLimit],
    queryFn: () => fetchUltimosClientes(displayLimit),
    staleTime: 15 * 60 * 1000, // Cachear por 15 minutos
  });

  return (
    <div className="card"> {/* Usamos card para el estilo */}
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <Users size={20} /> Últimos Clientes Añadidos
      </h3>
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {isError && (
        <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar clientes.</p>
      )}
      {!isLoading && !isError && clientes && clientes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay clientes recientes.</p>
      )}
      {!isLoading && !isError && clientes && clientes.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {clientes.map(cliente => (
            <li key={cliente.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '0.5rem' }}>
              {/* Enlace al perfil del cliente */}
              <Link to="/app/clientes/$id" params={{ id: cliente.id }} className="table-action-link" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cliente.nombre}
              </Link>
              {/* Fecha de creación */}
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                {fmtDate(cliente.creado_en)}
              </span>
            </li>
          ))}
           {/* Enlace opcional para ver todos los clientes */}
           <li style={{ textAlign: 'right', marginTop: '0.5rem' }}>
            <Link to="/app/clientes" style={{ fontSize: '0.9rem' }}>Ver todos los clientes &rarr;</Link>
          </li>
        </ul>
      )}
    </div>
  );
}