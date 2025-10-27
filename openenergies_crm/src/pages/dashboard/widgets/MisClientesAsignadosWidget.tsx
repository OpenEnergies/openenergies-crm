// src/pages/dashboard/widgets/MisClientesAsignadosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Target, Loader2 } from 'lucide-react'; // Usamos Target como icono
import { useSession } from '@hooks/useSession'; // Para obtener el ID del comercial

// Función para contar los clientes asignados a un comercial específico
async function fetchClientesAsignadosCount(comercialUserId: string | null): Promise<number> {
  // Si no hay ID de comercial (p.ej., si es admin), no hay clientes asignados directamente
  if (!comercialUserId) {
    return 0;
  }

  // Contamos en la tabla de asignaciones
  const { count, error } = await supabase
    .from('asignaciones_comercial')
    .select('*', { count: 'exact', head: true }) // Solo necesitamos el conteo
    .eq('comercial_user_id', comercialUserId); // Filtramos por el ID del comercial

  if (error) {
    console.error("Error fetching clientes asignados count:", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

// Reutilizamos el KpiCard (Asegúrate de que esté disponible o cópialo aquí/muévelo a /components)
function KpiCard({ title, value, icon: Icon, linkTo }: { title: string; value: number | string; icon: React.ElementType; linkTo?: string }) {
  const content = (
     <div style={{ textAlign: 'center' }}>
       <Icon size={28} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
       <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.25rem' }}>{value}</p>
       <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{title}</p>
     </div>
  );

  if (linkTo) {
      // Puedes ajustar el enlace si quieres que lleve a una vista filtrada de "mis clientes"
      return <Link to={linkTo} className="card-link"><div className="card action-card">{content}</div></Link>;
  }
  return <div className="card">{content}</div>;
}


export default function MisClientesAsignadosWidget() {
  const { userId } = useSession(); // Obtenemos el userId del comercial logueado

  const { data: count, isLoading, isError } = useQuery({
    // La query key incluye el userId para que sea específica de este comercial
    queryKey: ['clientesAsignadosCountDashboard', userId],
    queryFn: () => fetchClientesAsignadosCount(userId),
    enabled: !!userId, // Solo se ejecuta si tenemos el userId
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  // Este widget solo tiene sentido si hay un conteo > 0,
  // pero lo mostramos siempre (con 0) para consistencia si eres comercial.
  // Podrías ocultarlo si count es 0 si lo prefieres.

  return (
    <div className="card"> {/* Contenedor principal */}
       <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1.5rem', justifyContent: 'center' }}>
         <Target size={20} /> Mis Clientes
       </h3>
       {isLoading && (
         <div style={{ textAlign: 'center', padding: '1rem' }}>
           <Loader2 className="animate-spin" size={24} />
         </div>
       )}
       {isError && (
         <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar.</p>
       )}
       {!isLoading && !isError && count !== undefined && count !== null && (
         // Mostramos una única tarjeta KPI con el conteo
         <KpiCard title="Clientes Asignados" value={count} icon={Users} linkTo="/app/clientes" />
         // Considera cambiar linkTo a una ruta filtrada si la creas
       )}
    </div>
  );
}

// Necesitarás este icono si no lo tienes ya en KpiCard o importado arriba
import { Users } from 'lucide-react';