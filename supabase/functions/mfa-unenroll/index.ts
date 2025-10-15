// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { factorId } = await req.json();
    if (!factorId) throw new Error('Factor ID es obligatorio');
    
    const supabaseAdmin = createAdminClient();
    const user = await getUserFromRequest(req, supabaseAdmin);

    const { error } = await supabaseAdmin.auth.admin.mfa.unenroll({ userId: user.id, factorId });
    if (error) throw error;

    return new Response(JSON.stringify({ message: '2FA desactivado correctamente' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});