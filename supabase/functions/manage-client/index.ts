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

async function handleDeleteClient(payload: any, supabaseAdmin: SupabaseClient, deletedByUserId: string | null) {
  const { clienteId } = payload;
  if (!clienteId) {
    throw new Error('El ID del cliente es obligatorio para la eliminación.');
  }

  // --- SOFT DELETE SEGURO (cumplimiento GDPR) ---

  // 1. Desactivar el usuario de autenticación (si existe)
  // Buscamos si el cliente tiene un usuario de portal asociado en 'contactos_cliente'
  const { data: contacto, error: contactoError } = await supabaseAdmin
    .from('contactos_cliente')
    .select('user_id')
    .eq('cliente_id', clienteId)
    .maybeSingle();

  if (contactoError) console.error('Error buscando contacto de cliente:', contactoError.message);

  // Si encontramos un usuario asociado, lo desactivamos en usuarios_app (soft delete)
  if (contacto?.user_id) {
    const { error: userError } = await supabaseAdmin
      .from('usuarios_app')
      .update({
        activo: false,
        eliminado_en: new Date().toISOString(),
        eliminado_por: deletedByUserId
      })
      .eq('user_id', contacto.user_id);
    
    if (userError) {
      console.error(`Error al desactivar usuario (${contacto.user_id}):`, userError.message);
    }

    // Soft delete en contactos_cliente
    const { error: contactoUpdateError } = await supabaseAdmin
      .from('contactos_cliente')
      .update({
        eliminado_en: new Date().toISOString(),
        eliminado_por: deletedByUserId
      })
      .eq('cliente_id', clienteId);

    if (contactoUpdateError) {
      console.error('Error al marcar contacto como eliminado:', contactoUpdateError.message);
    }
  }

  // 2. Los archivos del Storage se mantienen (retención legal)
  // Solo se marcan los documentos como eliminados en la tabla 'documentos'
  const { error: docsError } = await supabaseAdmin
    .from('documentos')
    .update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: deletedByUserId
    })
    .eq('cliente_id', clienteId);

  if (docsError) {
    console.error('Error al marcar documentos como eliminados:', docsError.message);
  }

  // 3. Soft delete del cliente (cumplimiento GDPR Art. 17 + retención fiscal)
  const { error: dbError } = await supabaseAdmin
    .from('clientes')
    .update({
      eliminado_en: new Date().toISOString(),
      eliminado_por: deletedByUserId
    })
    .eq('id', clienteId);

  if (dbError) {
    throw new Error(`Error al marcar el cliente como eliminado: ${dbError.message}`);
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

    // Obtener el usuario que realiza la acción (para auditoría)
    let currentUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) currentUserId = user.id;
    }

    let responseMessage = 'Acción completada con éxito';
    
    switch (action) {
      case 'delete':
        await handleDeleteClient(payload, supabaseAdmin, currentUserId);
        responseMessage = 'Cliente marcado como eliminado correctamente (soft delete).';
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