// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// --- !! IMPORTANTE !! ---
// Pega aquí el UUID de tu empresa "Open Energies" que obtuvimos en la Fase 1.
const OPEN_ENERGIES_EMPRESA_ID = '860e5d61-9e6f-471f-8424-4803772a342c';

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
      // Es un fichero
      filePaths.push(fullPath);
    } else {
      // Es una carpeta
      const subPaths = await listAllFilesRecursively(supabaseAdmin, fullPath);
      filePaths = filePaths.concat(subPaths);
      if (item.name !== '.emptyFolderPlaceholder') {
        filePaths.push(`${fullPath}/.emptyFolderPlaceholder`);
      }
    }
  }
  return filePaths;
}

// --- 1. Lógica de Creación de Colaboradores (Administradores / Comerciales) ---
async function handleCreateUser(payload: any, supabaseAdmin: SupabaseClient) {
  const { creationType, userData } = payload;
  const { email, rol, empresa_id, nombre, apellidos, telefono, password } = userData;

  if (!email || !rol || !nombre || !apellidos) {
    throw new Error('Faltan datos obligatorios: email, rol, nombre y apellidos');
  }

  // --- CAMBIO CLAVE #1: Lógica de Negocio Centralizada ---
  // Si el nuevo usuario es un 'comercial', forzamos que su empresa sea 'Open Energies'.
  // Para cualquier otro rol (como 'administrador'), usamos la empresa que venga del formulario.
  const finalEmpresaId = (rol === 'comercial' || rol === 'administrador') ? OPEN_ENERGIES_EMPRESA_ID : empresa_id;

  if (!finalEmpresaId) {
      throw new Error("El campo 'empresa_id' es obligatorio.");
  }

  let newAuthUser = null;

  // Se mantiene tu lógica original para crear el usuario en el sistema de autenticación de Supabase.
  if (creationType === 'invite') {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (error) throw error;
    newAuthUser = data.user;
  } else if (creationType === 'create_with_password') {
    if (!password) {
      throw new Error('La contraseña es obligatoria para este método de creación');
    }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    newAuthUser = data.user;
  }

  if (!newAuthUser) {
    throw new Error('No se pudo crear el usuario en el sistema de autenticación.');
  }

  // Ahora se inserta el perfil en 'usuarios_app' usando el 'finalEmpresaId' que hemos calculado.
  const profileData = {
    user_id: newAuthUser.id,
    empresa_id: finalEmpresaId, // <-- Se usa la variable con la lógica de negocio.
    rol,
    nombre,
    apellidos,
    telefono,
    email,
    activo: true,
    forzar_cambio_password: creationType === 'create_with_password',
  };

  const { error: profileError } = await supabaseAdmin.from('usuarios_app').insert(profileData);

  // Si la creación del perfil falla, borramos el usuario de Auth para no dejar datos huérfanos.
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id);
    throw profileError;
  }
}

// --- 2. Lógica para dar de alta un Cliente ---
// Esta función gestiona la creación del cliente y, opcionalmente, su acceso al portal.
async function handleOnboardClient(payload: any, supabaseAdmin: SupabaseClient) {
  const { clientData, createPortalAccess, userData, creatingUser } = payload;
  if (!clientData || !clientData.empresa_id) throw new Error('Los datos del cliente y su empresa asociada son obligatorios.');

  // --- CAMBIO CLAVE #2: Se elimina la referencia a 'comercializadora' ---
  // Ahora la propiedad del cliente es directa a una 'empresa' (sea Open Energies u otra).

  // 1. Crear el registro en la tabla 'clientes'
  const { data: newClient, error: clientError } = await supabaseAdmin
    .from('clientes')
    .insert(clientData)
    .select()
    .single();
    
  if (clientError) throw clientError;

  let newAuthUser = null;

  // Si se solicita crear acceso al portal, se crea el usuario y se vincula.
  if (createPortalAccess && userData) {
    try {
      // 2. Crear usuario en Auth
      const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('Fallo al crear el usuario en Auth.');
      newAuthUser = data.user;
      
      // 3. Crear perfil del usuario en 'usuarios_app'
      const { error: profileError } = await supabaseAdmin.from('usuarios_app').insert({
        user_id: newAuthUser.id,
        empresa_id: clientData.empresa_id, // El usuario-cliente pertenece a la misma empresa que la ficha de cliente.
        rol: 'cliente', // El rol siempre será 'cliente' en este flujo.
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        email: userData.email,
        activo: true,
        forzar_cambio_password: true,
      });
      if (profileError) throw profileError;

      // 4. Vincular usuario y cliente en 'contactos_cliente'
      const { error: contactError } = await supabaseAdmin.from('contactos_cliente').insert({
        cliente_id: newClient.id,
        user_id: newAuthUser.id,
      });
      if (contactError) throw contactError;

    } catch (error) {
      // Rollback: Si algo falla, borramos el cliente para no dejar datos inconsistentes.
      await supabaseAdmin.from('clientes').delete().eq('id', newClient.id);
      throw error;
    }
  }

  // --- Lógica de Auto-asignación para Comerciales (SIN CAMBIOS) ---
  // Esta lógica sigue siendo válida y funciona perfectamente.
  if (creatingUser?.rol === 'comercial' && creatingUser?.id) {
    const { error: assignError } = await supabaseAdmin
      .from('asignaciones_comercial')
      .insert({ cliente_id: newClient.id, comercial_user_id: creatingUser.id });
    
    if (assignError) {
      if (newAuthUser) await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id);
      await supabaseAdmin.from('clientes').delete().eq('id', newClient.id);
      throw new Error(`El cliente se creó, pero falló la auto-asignación: ${assignError.message}`);
    }
  }

  return { newClientId: newClient.id };
}


// --- FUNCIONES AUXILIARES (SIN CAMBIOS) ---
// El resto de funciones que me pasaste (toggle-active, reset-password, delete)
// no se ven afectadas por el cambio de rol y siguen siendo válidas.
// Las incluyo aquí para que el fichero esté completo.

async function handleToggleActive(payload: any, supabaseAdmin: SupabaseClient) {
  const { userId, newActiveState } = payload;
  if (!userId || typeof newActiveState !== 'boolean') {
    throw new Error('Faltan datos para cambiar el estado del usuario.');
  }
  const { error } = await supabaseAdmin.from('usuarios_app').update({ activo: newActiveState }).eq('user_id', userId);
  if (error) throw error;
}

async function handleResetPassword(payload: any, supabaseAdmin: SupabaseClient) {
  const { email } = payload;
  if (!email) throw new Error('El email es necesario para restablecer la contraseña.');
  const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: email });
  if (error) throw error;
}

async function handleDeleteUser(payload: any, supabaseAdmin: SupabaseClient) {
  const { userId } = payload;
  if (!userId) throw new Error('El ID del usuario es necesario para eliminarlo.');

  const { data: userProfile, error: profileError } = await supabaseAdmin.from('usuarios_app').select('rol').eq('user_id', userId).single();
  if (profileError) console.warn("No se encontró perfil para el usuario, se intentará borrar solo de Auth.");

  // --- LÓGICA DE BORRADO DE CLIENTE ACTUALIZADA ---
  if (userProfile?.rol === 'cliente') {
    const { data: contacto, error: contactoError } = await supabaseAdmin
      .from('contactos_cliente')
      .select('cliente_id')
      .eq('user_id', userId)
      .single();
      
    if (contactoError) throw new Error('No se pudo encontrar el cliente asociado para eliminarlo.');
    
    const clienteId = contacto.cliente_id;

    // --- INICIO: NUEVA LÓGICA DE BORRADO DE STORAGE ---
    const clientFolderPath = `clientes/${clienteId}`;
    const allPathsToDelete = await listAllFilesRecursively(supabaseAdmin, clientFolderPath);

    if (allPathsToDelete.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from('documentos')
        .remove(allPathsToDelete);
      if (removeError) console.warn(`Error al borrar archivos de storage para cliente ${clienteId}:`, removeError.message);
    }
    // --- FIN: NUEVA LÓGICA DE BORRADO DE STORAGE ---

    // Borrar al cliente de la BBDD (la cascada se encarga del resto)
    const { error: clienteError } = await supabaseAdmin.from('clientes').delete().eq('id', clienteId);
    if (clienteError) throw new Error(`Error al eliminar la ficha del cliente: ${clienteError.message}`);
  }

  // Borrar usuario de Auth (esto se hace para todos los roles)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) throw authError;
}

// --- Handler Principal (SIN CAMBIOS) ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let responseMessage = '';
    let responseData = {};

    switch (action) {
      case 'create':
        await handleCreateUser(payload, supabaseAdmin);
        responseMessage = 'Usuario creado correctamente';
        break;
      case 'toggle-active':
        await handleToggleActive(payload, supabaseAdmin);
        responseMessage = 'Estado del usuario actualizado';
        break;
      case 'reset-password':
        await handleResetPassword(payload, supabaseAdmin);
        responseMessage = 'Correo de restablecimiento de contraseña enviado';
        break;
      case 'delete':
        await handleDeleteUser(payload, supabaseAdmin);
        responseMessage = 'Usuario eliminado correctamente';
        break;
      case 'onboard-client':
        responseData = await handleOnboardClient(payload, supabaseAdmin);
        responseMessage = 'Cliente creado correctamente';
        break;
      default:
        throw new Error('Acción no válida');
    }

    return new Response(JSON.stringify({ message: responseMessage, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (e: any) {
    console.error(`Error en la Edge Function 'manage-user':`, e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});