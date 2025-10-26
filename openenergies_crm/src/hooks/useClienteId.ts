// src/hooks/useClienteId.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from './useSession';

async function fetchClienteId(userId: string | null) {
  if (!userId) return null;

  // Consultamos la tabla de 'contactos_cliente' que enlaza al usuario (auth) con la entidad cliente (crm)
  const { data, error } = await supabase
    .from('contactos_cliente')
    .select('cliente_id')
    .eq('user_id', userId)
    .single();

  if (error) {
    // Si el error es 'PGRST116' (0 rows), significa que no hay cliente asociado, no es un error real.
    if (error.code !== 'PGRST116') {
        console.error('Error fetching cliente_id:', error);
    }
    return null;
  }
  
  return data?.cliente_id ?? null;
}

export function useClienteId() {
  const { userId, rol } = useSession();
  
  const { data: clienteId, isLoading } = useQuery({
    queryKey: ['clienteIdForUser', userId],
    queryFn: () => fetchClienteId(userId),
    // Solo activamos esta query si el usuario es un 'cliente'
    enabled: !!userId && rol === 'cliente', 
    staleTime: Infinity, // El ID de cliente de un usuario no cambia
    // --- CORRECCIÓN AQUÍ ---
    gcTime: Infinity,    // Usar gcTime en lugar de cacheTime
    // --- FIN CORRECCIÓN ---
  });

  return { clienteId, isLoading };
}