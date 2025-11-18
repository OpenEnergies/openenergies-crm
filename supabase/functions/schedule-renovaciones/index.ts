// @ts-nocheck

// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

/**
 * Invocación manual (POST) que crea notificaciones 'contrato_renovacion'
 * para contratos con aviso_renovacion=true y fecha_aviso=HOY (o >= hoy si se pasa ?mode=pending).
 * Requisitos del cliente: siempre incluir a c.moreno@openenergies.es y javier@openenergies.es en destinatarios. (EXTRANET) 
 */
Deno.serve(async (req) => {
  try {
    // Intentamos identificar al invocador para trazar en 'creada_por_user_id'
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error) userId = user?.id ?? null;
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') ?? 'today'; // 'today' | 'pending'
    const today = new Date(); today.setHours(0,0,0,0);

    // Buscar contratos con aviso activo y fecha_aviso según modo
    let filter = `aviso_renovacion.eq.true`;
    if (mode === 'today') filter += `,fecha_aviso.eq.${today.toISOString().slice(0,10)}`;
    else filter += `,fecha_aviso.gte.${today.toISOString().slice(0,10)}`;

    const { data: contratos, error: errC } = await supabase
      .from('contratos')
      .select('id, fecha_aviso, punto_id, comercializadora_id')
      .or(filter);
    if (errC) throw errC;

    if (!contratos || contratos.length === 0) {
      return new Response(JSON.stringify({ created: 0 }), { headers: { 'content-type':'application/json' }, status: 200 });
    }

    // Para cada contrato, deducir empresa_id via punto -> cliente -> empresa
    const createdIds: string[] = [];
    for (const co of contratos) {
      // Evitar duplicados: si ya hay notificación pendiente para ese contrato
      const { data: exists, error: errE } = await supabase
        .from('notificaciones')
        .select('id').eq('contrato_id', co.id).eq('tipo', 'contrato_renovacion').eq('estado', 'pendiente').maybeSingle();
      if (errE) throw errE;
      if (exists) continue;

      const { data: punto, error: errP } = await supabase
        .from('puntos_suministro')
        .select('cliente_id, cups')
        .eq('id', co.punto_id).maybeSingle();
      if (errP || !punto) continue;

      const { data: cliente, error: errCl } = await supabase
        .from('clientes')
        .select('nombre')
        .eq('id', punto.cliente_id).maybeSingle();
      if (errCl || !cliente) continue;

      // asunto y cuerpo simples; el envío real de email NO se hace aquí (solo se agenda)
      const asunto = `Aviso de renovación de contrato - CUPS ${punto.cups}`;
      const cuerpo = `Recordatorio: revisar renovación del contrato asociado al CUPS ${punto.cups} del cliente ${cliente.nombre}.`;
      const destinatarios = ['c.moreno@openenergies.es', 'javier@openenergies.es']; // requisito del cliente

      const programada = new Date(co.fecha_aviso ?? today);
      programada.setHours(9,0,0,0); // 09:00 local

      const { data: ins, error: errN } = await supabase.from('notificaciones').insert({
        empresa_id: co.comercializadora_id,
        contrato_id: co.id,
        cliente_id: null,
        tipo: 'contrato_renovacion',
        asunto,
        cuerpo,
        destinatarios_emails: destinatarios,
        canal: 'email',
        programada_para: programada.toISOString(),
        estado: 'pendiente',
        creada_por_user_id: userId
      }).select('id').maybeSingle();

      if (!errN && ins?.id) createdIds.push(ins.id);
    }

    return new Response(JSON.stringify({ created: createdIds.length, ids: createdIds }), {
      headers: { 'content-type':'application/json' },
      status: 200
    });

  } catch (e:any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), {
      headers: { 'content-type':'application/json' },
      status: 500
    });
  }
});
