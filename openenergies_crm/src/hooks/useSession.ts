import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import type { UsuarioApp, RolUsuario, UUID } from '@lib/types';

type SessionInfo = {
  userId: UUID | null;
  rol: RolUsuario | null;
  empresaId: UUID | null;
  loading: boolean;
};

export function useSession(): SessionInfo {
  const [state, setState] = useState<SessionInfo>({ userId: null, rol: null, empresaId: null, loading: true });

  useEffect(() => {
    console.log('[useSession] Hook montado. Iniciando comprobación de sesión.');
    let mounted = true;

    async function load() {
      console.log('[useSession] Buscando sesión de Supabase Auth...');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      if (!userId) {
        console.log('[useSession] No se encontró sesión. Usuario no logueado.');
        if (mounted) setState({ userId: null, rol: null, empresaId: null, loading: false });
        return;
      }
      
      console.log(`[useSession] Sesión encontrada para el usuario ID: ${userId}. Buscando perfil en 'usuarios_app'...`);
      
      // Buscar perfil en usuarios_app (RLS permite ver el propio registro)
      const { data, error } = await supabase
        .from('usuarios_app')
        .select('user_id, rol, empresa_id')
        .eq('user_id', userId)
        .maybeSingle(); // maybeSingle() es clave, devuelve null si no lo encuentra en vez de un array vacío.

      if (error) {
        console.error('[useSession] Error al buscar el perfil de usuario:', error.message);
        if (mounted) setState({ userId, rol: null, empresaId: null, loading: false });
        return;
      }
      
      if (!data) {
        console.warn(`[useSession] ¡Alerta! Se encontró un usuario en Auth (ID: ${userId}) pero no tiene un perfil correspondiente en la tabla 'usuarios_app'.`);
        if (mounted) setState({ userId, rol: null, empresaId: null, loading: false });
        return;
      }

      console.log(`[useSession] Perfil encontrado. Rol asignado: ${data.rol}`);
      if (mounted) setState({ userId, rol: data.rol as any, empresaId: data.empresa_id ?? null, loading: false });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[useSession] Cambio de estado de autenticación detectado: ${event}. Recargando perfil.`);
        load();
    });
    
    return () => { 
      console.log('[useSession] Hook desmontado. Limpiando subscripción.');
      mounted = false; 
      sub?.subscription.unsubscribe(); 
    };
  }, []);

  return state;
}
