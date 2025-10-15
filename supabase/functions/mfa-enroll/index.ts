// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- ¡CORRECCIÓN CLAVE! ---

    // Paso 1: Crear un cliente NORMAL para obtener el usuario de forma segura.
    // Este cliente usará el token 'Authorization' que viene en la petición.
    const supabase = createClient(supabaseUrl, Deno.env.get('ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    // Paso 2: Crear un cliente ADMIN solo para la operación privilegiada.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Paso 3: Ejecutar la operación de admin.
    const { data, error: enrollError } = await supabaseAdmin.auth.admin.mfa.enroll({
      userId: user.id,
      issuer: 'Open Energies CRM',
    });
    if (enrollError) throw enrollError;

    // --- FIN DE LA CORRECCIÓN ---

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error en mfa-enroll:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})