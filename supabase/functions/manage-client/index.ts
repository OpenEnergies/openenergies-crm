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

async function handleDeleteClient(
  payload: any, 
  supabaseAdmin: SupabaseClient, 
  supabaseUser: SupabaseClient | null,
  deletedByUserId: string | null
) {
  const { clienteId } = payload;
  if (!clienteId) {
    throw new Error('El ID del cliente es obligatorio para la eliminación.');
  }

  // --- SOFT DELETE CON ANONIMIZACIÓN AUTOMÁTICA (cumplimiento GDPR) ---
  
  // Verificar que el usuario está autenticado
  if (!supabaseUser || !deletedByUserId) {
    throw new Error('Se requiere autenticación para eliminar clientes.');
  }

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
  }

  // 2. Soft delete del cliente USANDO EL CLIENTE DEL USUARIO
  // Esto permite que el trigger verifique is_admin() y ejecute la anonimización automática
  const { error: dbError } = await supabaseUser
    .from('clientes')
    .update({
      eliminado_en: new Date().toISOString()
      // eliminado_por y la anonimización se manejan automáticamente por el trigger
    })
    .eq('id', clienteId);

  if (dbError) {
    // Si el error es de autorización, dar mensaje claro
    if (dbError.code === 'AUTHZ' || dbError.message.includes('Solo administradores')) {
      throw new Error('Solo los administradores pueden eliminar clientes.');
    }
    throw new Error(`Error al eliminar el cliente: ${dbError.message}`);
  }

  // Nota: El trigger 'trg_auto_anonimizar_cliente' se encarga automáticamente de:
  // - Anonimizar datos del cliente (nombre, dni, cif, email, telefonos, numero_cuenta, representante)
  // - Soft delete de contactos_cliente
  // - Anonimizar y soft delete de puntos_suministro
  // - Soft delete de contratos (y anonimizar numero_cuenta)
  // - Soft delete de documentos
  // - Soft delete de comparativas
  // - Soft delete de notificaciones
  // - Soft delete de facturacion_clientes
  // - Eliminar client_secrets (IBAN en vault)
  // - Registrar evento de auditoría
}

// Handler Principal que dirige las acciones
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
    
    // Cliente admin para operaciones que necesitan bypasear RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Cliente con el token del usuario para operaciones con RLS
    let supabaseUser: SupabaseClient | null = null;
    let currentUserId: string | null = null;
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        currentUserId = user.id;
        // Crear cliente con el token del usuario (respeta RLS y auth.uid())
        supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
      }
    }

    let responseMessage = 'Acción completada con éxito';
    
    switch (action) {
      case 'delete':
        await handleDeleteClient(payload, supabaseAdmin, supabaseUser, currentUserId);
        responseMessage = 'Cliente eliminado y anonimizado correctamente (GDPR compliant).';
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