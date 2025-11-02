// src/hooks/useNotifications.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from './useSession';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Definimos el tipo de notificaci贸n que esperamos
export type AppNotification = {
  id: string;
  asunto: string;
  cuerpo: string;
  tipo: string;
  creada_en: string;
  leida: boolean;
  contrato_id?: string | null;
  agenda_evento_id?: string | null;
  // A帽ade otras claves si las necesitas (ej. cliente_id)
};

// Funci贸n para obtener las notificaciones NO LE脥DAS
async function fetchUnreadNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, asunto, cuerpo, tipo, creada_en, leida, contrato_id, agenda_evento_id' )
    .eq('user_id_destinatario', userId) // <-- Asume que esta columna existe
    .eq('leida', false)                 // <-- Asume que esta columna existe
    .eq('canal', 'in-app')              // <-- Filtra solo por notificaciones de la app
    .order('creada_en', { ascending: false })
    .limit(10); // Traemos las 10 m谩s recientes no le铆das

  if (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
  return data as AppNotification[];
}

export function useNotifications() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', userId];

  // Query para obtener los datos iniciales
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKey,
    queryFn: () => fetchUnreadNotifications(userId!),
    enabled: !!userId, // Solo se ejecuta si el usuario est谩 logueado
    staleTime: 5 * 60 * 1000, // 5 minutos de stale time
  });

  // Escucha en tiempo real (Realtime) por NUEVAS notificaciones
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime:notificaciones:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id_destinatario=eq.${userId}`, // Escucha solo inserciones para este usuario
        },
        (payload) => {
          console.log('Nueva notificaci贸n recibida:', payload.new);
          // Muestra un Toast
          toast.success(`Nueva notificaci贸n: ${payload.new.asunto}`, {
            icon: '馃敂',
          });
          // Invalida la query para que se refresque la lista y el contador
          queryClient.invalidateQueries({ queryKey: queryKey });
        }
      )
      .subscribe();

    // Limpieza al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, queryKey]);

  return {
    notifications: data ?? [],
    unreadCount: data?.length ?? 0,
    isLoading,
    isError,
  };
}