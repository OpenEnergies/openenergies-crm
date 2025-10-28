// src/pages/dashboard/widgets/ResumenUsuariosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Users, UserCheck, UserX, ShieldCheck, BriefcaseBusiness, User as UserIcon, Loader2 } from 'lucide-react';
import type { RolUsuario } from '@lib/types';

// Tipo para almacenar los conteos
type UserSummaryCounts = {
  total: number;
  activos: number;
  bloqueados: number;
  roles: Record<RolUsuario, number>;
};

// Función para obtener todos los conteos en una sola consulta
async function fetchUserSummaryCounts(): Promise<UserSummaryCounts> {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('activo, rol', { count: 'exact' }); // Pedimos 'activo' y 'rol' y el conteo total

  if (error) {
    console.error("Error fetching user summary counts:", error);
    throw new Error(error.message);
  }

  // Calculamos los diferentes conteos a partir de los datos
  const total = data?.length ?? 0;
  const activos = data?.filter(u => u.activo).length ?? 0;
  const bloqueados = total - activos;
  const roles: Record<RolUsuario, number> = {
    administrador: 0,
    comercial: 0,
    cliente: 0,
  };

  data?.forEach(u => {
    if (roles[u.rol as RolUsuario] !== undefined) {
      roles[u.rol as RolUsuario]++;
    }
  });

  return { total, activos, bloqueados, roles };
}

// Componente KpiCard reutilizable
function KpiCard({ title, value, icon: Icon, linkTo }: { title: string; value: number | string; icon: React.ElementType; linkTo?: string }) {
  const content = (
     <div style={{ textAlign: 'center' }}>
       <Icon size={28} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
       <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.25rem' }}>{value}</p>
       <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{title}</p>
     </div>
  );

  if (linkTo) {
      return <Link to={linkTo} className="card-link"><div className="card action-card">{content}</div></Link>;
  }
  return <div className="card">{content}</div>; // Sin hover si no hay link
}


export default function ResumenUsuariosWidget() {
  const { data: counts, isLoading, isError } = useQuery({
    queryKey: ['userSummaryCountsDashboard'],
    queryFn: fetchUserSummaryCounts,
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  return (
    <div className="card"> {/* Contenedor principal del widget */}
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <Users size={20} /> Resumen de Usuarios
      </h3>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {isError && (
        <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar resumen.</p>
      )}

      {/* Cuadrícula para las tarjetas KPI */}
      {!isLoading && !isError && counts && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.8rem' }}>
          <KpiCard title="Total Usuarios" value={counts.total} icon={Users} linkTo="/app/usuarios" />
          <KpiCard title="Activos" value={counts.activos} icon={UserCheck} linkTo="/app/usuarios" />
          <KpiCard title="Bloqueados" value={counts.bloqueados} icon={UserX} linkTo="/app/usuarios" />
          <KpiCard title="Admins" value={counts.roles.administrador} icon={ShieldCheck} linkTo="/app/usuarios" />
          <KpiCard title="Comerciales" value={counts.roles.comercial} icon={BriefcaseBusiness} linkTo="/app/usuarios" />
          <KpiCard title="Clientes" value={counts.roles.cliente} icon={UserIcon} linkTo="/app/usuarios" />
        </div>
      )}
    </div>
  );
}