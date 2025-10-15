// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js';

// Esta función crea un cliente de Supabase con los permisos de administrador correctos.
// La usaremos en todas nuestras funciones.
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Esta es la función para obtener el usuario, ahora en un solo lugar.
export async function getUserFromRequest(req: Request, supabaseClient: SupabaseClient) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization header');
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseClient.auth.getUser(token);
  if (error) throw new Error(`Invalid token: ${error.message}`);
  return data.user;
}