// src/hooks/useSession.ts
import { useQuery } from '@tanstack/react-query'; // Importa useQuery
import { supabase } from '@lib/supabase';
import type { UsuarioApp, RolUsuario, UUID } from '@lib/types';

type SessionData = {
  userId: UUID | null;
  rol: RolUsuario | null;
  empresaId: UUID | null;
  nombre: string | null;
  apellidos: string | null;
  avatar_url: string | null; // <-- Incluye avatar_url
};

const fetchSessionData = async (): Promise<SessionData> => {
    // 1. Obtener sesión de Supabase Auth
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('[useSession] Error fetching session:', sessionError.message);
        // Devuelve estado "no logueado" pero sin lanzar error para no romper la app
        return { userId: null, rol: null, empresaId: null, nombre: null, apellidos: null, avatar_url: null };
    }

    if (!session?.user?.id) {
        // No hay sesión activa
        return { userId: null, rol: null, empresaId: null, nombre: null, apellidos: null, avatar_url: null };
    }

    const userId = session.user.id;

    // 2. Obtener perfil de usuarios_app
    try {
        const { data: profile, error: profileError } = await supabase
            .from('usuarios_app')
            .select('user_id, rol, empresa_id, nombre, apellidos, avatar_url') // <-- Selecciona avatar_url
            .eq('user_id', userId)
            .single();

        if (profileError) {
            // Si el perfil no se encuentra o hay error, devuelve datos parciales
            console.error('[useSession] Error fetching profile:', profileError.message);
            return { userId, rol: null, empresaId: null, nombre: null, apellidos: null, avatar_url: null };
        }

        // 3. Devuelve los datos combinados
        return {
            userId,
            rol: profile?.rol as RolUsuario ?? null,
            empresaId: profile?.empresa_id ?? null,
            nombre: profile?.nombre ?? null,
            apellidos: profile?.apellidos ?? null,
            avatar_url: profile?.avatar_url ?? null, // <-- Devuelve avatar_url
        };
    } catch (dbError) {
        // Captura errores inesperados de la BBDD
        console.error('[useSession] Database error fetching profile:', dbError);
        return { userId, rol: null, empresaId: null, nombre: null, apellidos: null, avatar_url: null };
    }
};

export function useSession() {
    const { data, isLoading, isError, error, refetch } = useQuery<SessionData, Error>({
        // --- Usa una QUERY KEY FIJA para la sesión ---
        queryKey: ['sessionData'],
        queryFn: fetchSessionData,
        staleTime: 5 * 60 * 1000, // 5 minutos de caché antes de considerar "stale"
        refetchOnWindowFocus: true, // Refresca al volver a la pestaña (útil si cambia en otra pestaña)
        // Podrías añadir un listener a onAuthStateChange aquí si necesitas reactividad instantánea al login/logout,
        // pero para la actualización del avatar, la invalidación es suficiente.
    });

    // Devuelve los datos cacheados por React Query + estado de carga/error
    return {
        userId: data?.userId ?? null,
        rol: data?.rol ?? null,
        empresaId: data?.empresaId ?? null,
        nombre: data?.nombre ?? null,
        apellidos: data?.apellidos ?? null,
        avatar_url: data?.avatar_url ?? null, // <-- Expone avatar_url
        loading: isLoading,
        error: isError ? error : null,
        refetchSession: refetch // Expone la función refetch por si se necesita
    };
}
