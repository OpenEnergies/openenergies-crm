// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { factorId, code } = await req.json();
    if (!factorId || !code) throw new Error('Factor ID y código son obligatorios');

    const supabaseAdmin = createAdminClient();
    const user = await getUserFromRequest(req, supabaseAdmin);
    
    const { data: challengeData, error: challengeError } = await supabaseAdmin.auth.admin.mfa.challenge({ userId: user.id, factorId });
    if (challengeError) throw challengeError;
    
    const { error: verifyError } = await supabaseAdmin.auth.admin.mfa.verify({
        userId: user.id, factorId, challengeId: challengeData.id, code,
    });
    if (verifyError) throw verifyError;

    return new Response(JSON.stringify({ message: '2FA activado correctamente' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    });
  }
});