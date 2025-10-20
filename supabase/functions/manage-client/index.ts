// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;

async function listAllFilesRecursively(
  supabaseAdmin: SupabaseClient,
  path: string
): Promise<string[]> {
  const { data: items, error: listError } = await supabaseAdmin.storage
    .from('documentos')
    .list(path);

  if (listError) {
    console.error(`Error listando ${path}:`, listError.message);
    return [];
  }

  let filePaths: string[] = [];
  for (const item of items) {
    const fullPath = `${path}/${item.name}`;
    if (item.id) {
      // Es un fichero, añadir a la lista
      filePaths.push(fullPath);
    } else {
      // Es una carpeta, listar su contenido recursivamente
      const subPaths = await listAllFilesRecursively(supabaseAdmin, fullPath);
      filePaths = filePaths.concat(subPaths);
      // Añadir el placeholder de la carpeta (para borrar la carpeta misma)
      if (item.name !== '.emptyFolderPlaceholder') {
        filePaths.push(`${fullPath}/.emptyFolderPlaceholder`);
      }
    }
  }
  return filePaths;
}

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
  const clientFolderPath = `clientes/${clienteId}`;
  
  // Usamos la nueva función auxiliar
  const allPathsToDelete = await listAllFilesRecursively(supabaseAdmin, clientFolderPath);

  if (allPathsToDelete.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage
      .from('documentos')
      .remove(allPathsToDelete);
      
    if (removeError) {
      // No lanzar error fatal, solo log
      console.error(`Error al borrar archivos del storage en ${clientFolderPath}:`, removeError.message);
    }
  }

  // 3. Borrar el cliente de la base de datos (Sin cambios)
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