// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;

async function handleDeleteClient(payload: any, supabaseAdmin: SupabaseClient) {
  const { clienteId } = payload;
  if (!clienteId) {
    throw new Error('El ID del cliente es obligatorio para la eliminación.');
  }

  // --- BORRADO EN CASCADA SEGURO ---

  // 1. Borrar el usuario de autenticación (si existe)
  // Buscamos si el cliente tiene un usuario de portal asociado en 'contactos_cliente'
  const { data: contacto, error: contactoError } = await supabaseAdmin
    .from('contactos_cliente')
    .select('user_id')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  if (contactoError) console.error('Error buscando contacto de cliente:', contactoError.message);

  // Si encontramos un usuario asociado, lo eliminamos de Auth
  if (contacto?.user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(contacto.user_id);
    if (authError) {
      // No lanzamos un error fatal, pero lo registramos.
      console.error(`Error al eliminar el usuario de Auth (${contacto.user_id}):`, authError.message);
    }
  }

  // 2. Borrar todos los archivos del Storage
  const folderPath = `clientes/${clienteId}`;
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from('documentos')
    .list(folderPath);
  
  if (listError) console.warn(`No se pudo listar archivos en ${folderPath}:`, listError.message);

  if (files && files.length > 0) {
    const filePaths = files.map(file => `${folderPath}/${file.name}`);
    const { error: removeError } = await supabaseAdmin.storage.from('documentos').remove(filePaths);
    if (removeError) console.error(`Error al borrar archivos del storage en ${folderPath}:`, removeError.message);
  }

  // 3. Borrar el cliente de la base de datos
  // Si tienes 'ON DELETE CASCADE' en las Foreign Keys de tus tablas, Supabase se encargará del resto.
  // Si no, este es el lugar para añadir los DELETEs manuales en el orden correcto (contratos -> puntos -> cliente).
  // Por simplicidad y buenas prácticas, asumimos que el borrado en cascada está configurado o que un trigger lo maneja.
  // El borrado directo del cliente es el paso final.
  const { error: dbError } = await supabaseAdmin
    .from('clientes')
    .delete()
    .eq('id', clienteId);

  if (dbError) {
    throw new Error(`Error al borrar el cliente de la base de datos: ${dbError.message}`);
  }
}

// Handler Principal que dirige las acciones
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let responseMessage = 'Acción completada con éxito';
    
    switch (action) {
      case 'delete':
        await handleDeleteClient(payload, supabaseAdmin);
        responseMessage = 'Cliente eliminado correctamente y todos sus datos asociados.';
        break;

      default:
        throw new Error(`Acción no válida: ${action}`);
    }

    return new Response(JSON.stringify({ message: responseMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (e: any) {
    console.error(`Error en la Edge Function 'manage-client':`, e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});