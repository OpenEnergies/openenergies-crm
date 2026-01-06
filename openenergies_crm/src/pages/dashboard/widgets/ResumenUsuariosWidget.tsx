// src/pages/dashboard/widgets/ResumenUsuariosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Users, UserCheck, UserX, ShieldCheck, BriefcaseBusiness, User as UserIcon, Loader2, ArrowRight } from 'lucide-react';
import type { RolUsuario } from '@lib/types';

type UserSummaryCounts = {
  total: number;
  activos: number;
  bloqueados: number;
  roles: Record<RolUsuario, number>;
};

async function fetchUserSummaryCounts(): Promise<UserSummaryCounts> {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('activo, rol', { count: 'exact' });

  if (error) {
    console.error("Error fetching user summary counts:", error);
    throw new Error(error.message);
  }

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

function StatItem({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-intermediate/50">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-4 h-4 text-current" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export default function ResumenUsuariosWidget() {
  const { data: counts, isLoading, isError } = useQuery({
    queryKey: ['userSummaryCountsDashboard'],
    queryFn: fetchUserSummaryCounts,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-blue-400" />
        </div>
        <h3 className="text-base font-semibold text-white">Resumen de Usuarios</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400 text-center py-4">Error al cargar resumen.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && counts && (
        <div className="grid grid-cols-2 gap-3">
          <StatItem icon={Users} label="Total" value={counts.total} color="bg-fenix-500/20 text-fenix-400" />
          <StatItem icon={UserCheck} label="Activos" value={counts.activos} color="bg-green-500/20 text-green-400" />
          <StatItem icon={UserX} label="Bloqueados" value={counts.bloqueados} color="bg-red-500/20 text-red-400" />
          <StatItem icon={ShieldCheck} label="Admins" value={counts.roles.administrador} color="bg-purple-500/20 text-purple-400" />
          <StatItem icon={BriefcaseBusiness} label="Comerciales" value={counts.roles.comercial} color="bg-cyan-500/20 text-cyan-400" />
          <StatItem icon={UserIcon} label="Clientes" value={counts.roles.cliente} color="bg-amber-500/20 text-amber-400" />
        </div>
      )}

      {/* Footer link */}
      <Link
        to="/app/usuarios"
        className="flex items-center justify-end gap-1 mt-4 text-sm text-fenix-400 hover:text-fenix-300 transition-colors cursor-pointer"
      >
        Ver usuarios <ArrowRight size={14} />
      </Link>
    </div>
  );
}
