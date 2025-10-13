import { useSession } from '@hooks/useSession';
import type { RolUsuario } from '@lib/types';
import { Navigate, useLocation } from '@tanstack/react-router';
import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';

// Función para obtener el perfil completo del usuario, incluida la nueva bandera
const fetchUserProfile = async (userId: string | null) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('forzar_cambio_password')
    .eq('user_id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, userId } = useSession();
  const location = useLocation();

  // Usamos useQuery para obtener el perfil del usuario de forma eficiente
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId, // Solo ejecuta la consulta si hay un userId
  });

  const isLoading = sessionLoading || profileLoading;

  if (isLoading) {
    return <div className="card">Cargando sesión...</div>;
  }

  if (!userId) {
    return <Navigate to="/login" />;
  }

  // ¡LÓGICA DE REDIRECCIÓN!
  if (userProfile?.forzar_cambio_password && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" />;
  }
  
  // Si el usuario ya está en la página de cambio de contraseña, no lo redirijas de nuevo
  if (!userProfile?.forzar_cambio_password && location.pathname === '/force-change-password') {
      return <Navigate to="/app" />;
  }


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
