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
    let mounted = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      if (!userId) {
        mounted && setState({ userId: null, rol: null, empresaId: null, loading: false });
        return;
      }
      // Buscar perfil en usuarios_app (RLS permite ver el propio registro)
      const { data, error } = await supabase
        .from('usuarios_app')
        .select('user_id, rol, empresa_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error(error);
        mounted && setState({ userId, rol: null, empresaId: null, loading: false });
        return;
      }
      mounted && setState({ userId, rol: (data?.rol ?? null) as any, empresaId: data?.empresa_id ?? null, loading: false });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
        load();
    });
    return () => { mounted = false; sub?.subscription.unsubscribe(); };
  }, []);

  return state;
}
