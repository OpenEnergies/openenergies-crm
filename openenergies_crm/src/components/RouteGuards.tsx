import { useSession } from '@hooks/useSession';
import type { RolUsuario } from '@lib/types';
import { Navigate } from '@tanstack/react-router';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, userId } = useSession();
  if (loading) return <div className="card">Cargando sesión…</div>;
  if (!userId) return <Navigate to="/login" />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }:{ roles: RolUsuario[]; children: React.ReactNode }) {
  const { loading, rol } = useSession();
  if (loading) return <div className="card">Comprobando permisos…</div>;
  if (!rol || !roles.includes(rol)) {
    return <div className="card" role="alert">No tienes permiso para acceder a esta sección.</div>;
  }
  return <>{children}</>;
}
