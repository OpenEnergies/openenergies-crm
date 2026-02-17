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
  try {
    // --- 👇 Envuelve la creación/invitación en try...catch ---
    if (creationType === 'invite') {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://openenergies.crm.converlysolutions.com/auth/reset-password'
      });
      if (error) throw error; // Lanza el error para ser capturado abajo
      newAuthUser = data.user;
    } else if (creationType === 'create_with_password') {
      if (!password) {
        throw new Error('La contraseña es obligatoria para este método de creación');
      }
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Asume confirmado ya que lo crea un admin
      });
      if (error) throw error; // Lanza el error para ser capturado abajo
      newAuthUser = data.user;
    }
    // --- Fin try...catch ---
  } catch (error) {
    // --- 👇 Captura y verifica el error específico ---
    // Supabase a veces usa 'User already registered' o similar, comprobamos ambos
    const message = error.message.toLowerCase();
    if (message.includes('user already registered') || message.includes('email address has already been registered')) {
      // Si el email ya existe, lanza un error específico y claro
      throw new Error(`Ya existe un usuario registrado con el email ${email}.`);
    } else {
      // Si es otro error de Auth, lo relanzamos
      console.error("Error inesperado en Auth:", error); // Loguea el error completo
      throw new Error(`Error al crear usuario en Auth: ${error.message}`); // Lanza un error más genérico pero informativo
    }
    // --- Fin verificación ---
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
    // Campos de auditoría (securización BBDD)
    creado_en: new Date().toISOString(),
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
  if (!clientData) throw new Error('Los datos del cliente son obligatorios.');

  // 1. Separar empresa_id del resto de datos del cliente
  const { empresa_id, ...clienteInsertData } = clientData;

  // 2. Crear el registro en la tabla 'clientes' (SIN empresa_id)
  const { data: newClient, error: clientError } = await supabaseAdmin
    .from('clientes')
    .insert(clienteInsertData) // <-- Usamos el objeto limpio
    .select()
    .single();

  if (clientError) throw clientError;

  let newAuthUser = null;

  // Si se solicita crear acceso al portal
  if (createPortalAccess && userData) {
    // Para crear el usuario, NECESITAMOS una empresa_id. 
    // Si no venía en clientData, usamos la de Open Energies por defecto o lanzamos error.
    const targetEmpresaId = empresa_id || OPEN_ENERGIES_EMPRESA_ID;

    try {
      // ... (Creación de usuario en Auth igual que antes) ...
      const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });
      if (authError) throw authError;
      newAuthUser = data.user;

      // 3. Crear perfil en 'usuarios_app'
      const { error: profileError } = await supabaseAdmin.from('usuarios_app').insert({
        user_id: newAuthUser.id,
        empresa_id: targetEmpresaId, // <-- Aquí SÍ usamos la empresa_id
        rol: 'cliente',
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        email: userData.email,
        activo: true,
        forzar_cambio_password: true,
      });
      if (profileError) throw profileError;

      // ... (Vincular contacto igual que antes) ...
      const { error: contactError } = await supabaseAdmin.from('contactos_cliente').insert({
        cliente_id: newClient.id,
        user_id: newAuthUser.id,
      });
      if (contactError) throw contactError;

    } catch (error) {
      await supabaseAdmin.from('clientes').delete().eq('id', newClient.id);
      throw error;
    }
  }
  // Auto-asignación de comerciales: gestionada por trigger en BBDD (trg_auto_assign_comercial)
  // Cuando un comercial crea un punto de suministro, se auto-asigna automáticamente.

  return { newClientId: newClient.id };
}


// --- 3. Lógica para crear usuario de acceso para un cliente EXISTENTE ---
async function handleCreateClientUser(payload: any, supabaseAdmin: SupabaseClient) {
  const { clienteId, email, password, clienteNombre } = payload;

  if (!clienteId || !email || !password) {
    throw new Error('Faltan datos obligatorios: clienteId, email y password.');
  }

  // Verificar que el cliente existe
  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('id, nombre')
    .eq('id', clienteId)
    .is('eliminado_en', null)
    .single();
  if (clienteError || !cliente) throw new Error('No se encontró el cliente especificado.');

  // Verificar que no tenga ya un usuario vinculado
  const { data: existingLink } = await supabaseAdmin
    .from('contactos_cliente')
    .select('user_id')
    .eq('cliente_id', clienteId)
    .is('eliminado_en', null)
    .maybeSingle();
  if (existingLink) throw new Error('Este cliente ya tiene un usuario de acceso asociado.');

  // Extraer nombre y apellidos del nombre del cliente
  const nombreCompleto = clienteNombre || cliente.nombre || 'Cliente';
  const partes = nombreCompleto.trim().split(' ');
  const nombre = partes[0];
  const apellidos = partes.slice(1).join(' ') || '-';

  // 1. Crear usuario en Auth
  let newAuthUser = null;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;
    newAuthUser = data.user;
  } catch (error: any) {
    const message = error.message?.toLowerCase() || '';
    if (message.includes('user already registered') || message.includes('email address has already been registered')) {
      throw new Error(`Ya existe un usuario registrado con el email ${email}.`);
    }
    throw new Error(`Error al crear usuario en Auth: ${error.message}`);
  }

  if (!newAuthUser) throw new Error('No se pudo crear el usuario en el sistema de autenticación.');

  // 2. Crear perfil en usuarios_app
  const { error: profileError } = await supabaseAdmin.from('usuarios_app').insert({
    user_id: newAuthUser.id,
    empresa_id: OPEN_ENERGIES_EMPRESA_ID,
    rol: 'cliente',
    nombre,
    apellidos,
    email,
    activo: true,
    forzar_cambio_password: true,
    creado_en: new Date().toISOString(),
  });
  if (profileError) {
    // Rollback: eliminar usuario de Auth
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id);
    throw new Error(`Error al crear perfil de usuario: ${profileError.message}`);
  }

  // 3. Vincular en contactos_cliente
  const { error: contactError } = await supabaseAdmin.from('contactos_cliente').insert({
    cliente_id: clienteId,
    user_id: newAuthUser.id,
  });
  if (contactError) {
    // Rollback: eliminar perfil y usuario de Auth
    await supabaseAdmin.from('usuarios_app').delete().eq('user_id', newAuthUser.id);
    await supabaseAdmin.auth.admin.deleteUser(newAuthUser.id);
    throw new Error(`Error al vincular usuario con cliente: ${contactError.message}`);
  }
}

// --- FUNCIONES AUXILIARES (SIN CAMBIOS) ---

async function handleToggleActive(payload: any, supabaseAdmin: SupabaseClient) {
  const { userId, newActiveState, modifiedBy } = payload;
  if (!userId || typeof newActiveState !== 'boolean') {
    throw new Error('Faltan datos para cambiar el estado del usuario.');
  }
  const { error } = await supabaseAdmin.from('usuarios_app').update({
    activo: newActiveState,
    // Campos de auditoría (securización BBDD)
    modificado_en: new Date().toISOString(),
    modificado_por: modifiedBy || null
  }).eq('user_id', userId);
  if (error) throw error;
}

async function handleResetPassword(payload: any, supabaseAdmin: SupabaseClient) {
  const { email } = payload;
  if (!email) throw new Error('El email es necesario para restablecer la contraseña.');

  // Usar resetPasswordForEmail para enviar el email de recuperación al usuario
  // generateLink solo genera el enlace pero NO envía el email
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://openenergies.crm.converlysolutions.com/auth/reset-password',
  });
  if (error) throw error;
}

async function handleDeleteUser(payload: any, supabaseAdmin: SupabaseClient) {
  const { userId, adminUserId } = payload;
  if (!userId) throw new Error('El ID del usuario es necesario para eliminarlo.');

  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('usuarios_app')
    .select('rol, email, nombre, apellidos')
    .eq('user_id', userId)
    .single();
  if (profileError) console.warn("No se encontró perfil para el usuario, se intentará borrar solo de Auth.");

  // --- LÓGICA DE BORRADO DE CLIENTE ---
  if (userProfile?.rol === 'cliente') {
    const { data: contacto, error: contactoError } = await supabaseAdmin
      .from('contactos_cliente')
      .select('cliente_id')
      .eq('user_id', userId)
      .single();

    if (contactoError) throw new Error('No se pudo encontrar el cliente asociado para eliminarlo.');

    const clienteId = contacto.cliente_id;

    // Borrar archivos de storage
    const clientFolderPath = `clientes/${clienteId}`;
    const allPathsToDelete = await listAllFilesRecursively(supabaseAdmin, clientFolderPath);

    if (allPathsToDelete.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from('documentos')
        .remove(allPathsToDelete);
      if (removeError) console.warn(`Error al borrar archivos de storage para cliente ${clienteId}:`, removeError.message);
    }

    // Borrar al cliente de la BBDD (la cascada se encarga del resto)
    const { error: clienteError } = await supabaseAdmin.from('clientes').delete().eq('id', clienteId);
    if (clienteError) throw new Error(`Error al eliminar la ficha del cliente: ${clienteError.message}`);
  }

  // --- PROCESO DE ELIMINACIÓN PARA COMERCIALES/ADMINS ---
  // Usamos el patrón de seguridad del sistema:
  // 1. Soft delete + anonimización de datos en public (GDPR)
  // 2. Registrar evento de seguridad
  // 3. Eliminar de auth.users (para que no pueda hacer login)

  if (userProfile?.rol === 'comercial' || userProfile?.rol === 'administrador') {
    // --- PASO 1: Soft delete de vacaciones asociadas ---
    const { error: vacacionesError } = await supabaseAdmin
      .from('vacaciones')
      .update({
        eliminado_en: new Date().toISOString(),
        eliminado_por: adminUserId || null
      })
      .eq('user_id', userId)
      .is('eliminado_en', null);
    if (vacacionesError) console.warn(`Error al soft-delete vacaciones: ${vacacionesError.message}`);

    // --- PASO 2: Reasignar clientes del comercial ---
    // Los clientes asignados se reasignan al admin que ejecuta la acción
    if (userProfile?.rol === 'comercial' && adminUserId) {
      const { error: reasignError } = await supabaseAdmin
        .from('asignaciones_comercial')
        .update({ comercial_user_id: adminUserId })
        .eq('comercial_user_id', userId);
      if (reasignError) console.warn(`Error al reasignar clientes: ${reasignError.message}`);
    }

    // --- PASO 3: Anonimizar datos del usuario (GDPR) ---
    const hashId = `${userId.substring(0, 8)}_${Date.now()}`;
    const { error: anonError } = await supabaseAdmin
      .from('usuarios_app')
      .update({
        nombre: 'USUARIO_ELIMINADO',
        apellidos: hashId,
        email: `eliminado_${hashId}@gdpr.eliminado`,
        telefono: null,
        avatar_url: null,
        activo: false,
        eliminado_en: new Date().toISOString(),
        eliminado_por: adminUserId || null,
        modificado_en: new Date().toISOString(),
        modificado_por: adminUserId || null
      })
      .eq('user_id', userId);
    if (anonError) throw new Error(`Error al anonimizar usuario: ${anonError.message}`);

    // --- PASO 4: Registrar evento de seguridad en audit ---
    // Esto se hace llamando a una función de BD que registra en audit.security_events
    const { error: auditError } = await supabaseAdmin.rpc('log_user_deletion_event', {
      p_deleted_user_id: userId,
      p_deleted_by: adminUserId,
      p_original_email: userProfile?.email || 'unknown',
      p_original_rol: userProfile?.rol || 'unknown'
    });
    // No lanzamos error si falla el log de auditoría, solo advertimos
    if (auditError) console.warn(`Advertencia: No se pudo registrar evento de auditoría: ${auditError.message}`);

  } else if (!userProfile) {
    // Si no hay perfil, limpiamos las referencias manualmente (modo legacy/fallback)
    // Esto solo debería ocurrir en casos de datos inconsistentes

    // Limpiar referencias de auditoría en vacaciones
    await supabaseAdmin.from('vacaciones').update({ creado_por: null }).eq('creado_por', userId);
    await supabaseAdmin.from('vacaciones').update({ modificado_por: null }).eq('modificado_por', userId);
    await supabaseAdmin.from('vacaciones').update({ eliminado_por: null }).eq('eliminado_por', userId);

    // Limpiar referencias en client_secrets
    await supabaseAdmin.from('client_secrets').update({ created_by: null }).eq('created_by', userId);
    await supabaseAdmin.from('client_secrets').update({ updated_by: null }).eq('updated_by', userId);

    // Limpiar referencias en solicitudes_eliminacion
    await supabaseAdmin.from('solicitudes_eliminacion').update({ solicitado_por: null }).eq('solicitado_por', userId);
    await supabaseAdmin.from('solicitudes_eliminacion').update({ verificado_por: null }).eq('verificado_por', userId);
    await supabaseAdmin.from('solicitudes_eliminacion').update({ anonimizado_por: null }).eq('anonimizado_por', userId);
  }

  // --- PASO FINAL: Deshabilitar usuario en Auth y liberar email ---
  // NO eliminamos de auth.users porque:
  // 1. RLS con relforcerowsecurity=TRUE bloquea el CASCADE hacia usuarios_app
  // 2. Soft delete + anonimización cumple con GDPR sin eliminar físicamente
  // 3. Mantiene integridad referencial y rastro de auditoría completo
  // El usuario queda "baneado" permanentemente y no puede hacer login
  // IMPORTANTE: Cambiamos el email para liberar el original y permitir reutilización
  const deletedEmailSuffix = `deleted_${userId.slice(0, 8)}_${Date.now()}@gdpr.deleted`;
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: deletedEmailSuffix,  // Liberar email original para reutilización
    ban_duration: '876000h',  // Ban por 100 años = permanente
    user_metadata: {
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: adminUserId,
      original_email: userProfile?.email || 'unknown'  // Guardar email original para auditoría
    }
  });
  if (banError) {
    console.warn(`Advertencia: No se pudo deshabilitar usuario en auth: ${banError.message}`);
    // No lanzamos error porque el soft delete + anonimización ya se completó
    // El usuario ya no aparecerá en la UI y sus datos están anonimizados
  }
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
      case 'create-client-user':
        await handleCreateClientUser(payload, supabaseAdmin);
        responseMessage = 'Usuario de acceso creado correctamente para el cliente';
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