import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import type { UsuarioApp, RolUsuario, UUID } from '@lib/types';

type SessionInfo = {
  userId: UUID | null;
  rol: RolUsuario | null;
  empresaId: UUID | null;
  nombre: string | null;
  apellidos: string | null;
  loading: boolean;
};

export function useSession(): SessionInfo {
  const [state, setState] = useState<SessionInfo>({ userId: null, rol: null, empresaId: null, nombre: null, apellidos: null, loading: true });

  useEffect(() => {
    let mounted = true;

    // Esta función carga el perfil del usuario una vez que tenemos una sesión
    async function loadProfile(session: any) {
      const userId = session?.user?.id;
      if (!userId) {
        if (mounted) setState({ userId: null, rol: null, empresaId: null, nombre: null, apellidos: null, loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('usuarios_app')
        .select('user_id, rol, empresa_id, nombre, apellidos')
        .eq('user_id', userId)
        .single(); // Usamos single() que da error si no lo encuentra, es más estricto

      if (error) {
        console.error('[useSession] Error al buscar el perfil:', error.message);
        if (mounted) setState({ userId, rol: null, empresaId: null, nombre: null, apellidos: null, loading: false });
        return;
      }
      
      if (data && mounted) {
        setState({ 
          userId, 
          rol: data.rol as RolUsuario, 
          empresaId: data.empresa_id, 
          nombre: data.nombre,
          apellidos: data.apellidos,
          loading: false 
        });
      }
    }
    
    // Verificamos la sesión inicial al cargar el componente
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            loadProfile(session);
        } else {
            if (mounted) setState({ userId: null, rol: null, empresaId: null, nombre: null, apellidos: null, loading: false });
        }
    });

    // Y nos suscribimos a futuros cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });
    
    return () => { 
      mounted = false; 
      subscription?.unsubscribe(); 
    };
  }, []);

  return state;
}
