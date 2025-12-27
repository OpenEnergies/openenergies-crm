// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRole = Deno.env.get('SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: {
    persistSession: false
  }
});
// Esta función buscará eventos de agenda que empiecen pronto
Deno.serve(async (req)=>{
  try {
    const now = new Date();
    const futureLimit = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos en el futuro
    // 1. Buscar eventos de agenda (no renovaciones) que empiecen en los próximos 15 min
    const { data: eventos, error: errE } = await supabase.from('agenda_eventos').select('id, user_id, titulo, fecha_inicio, empresa_id').gte('fecha_inicio', now.toISOString()) // Empiezan después de ahora
    .lte('fecha_inicio', futureLimit.toISOString()) // Y antes de 15 min
    .is('etiqueta', null) // Asumiendo que las renovaciones tienen etiqueta 'Renovación'
    .or('etiqueta.neq.Renovación'); // O excluimos renovaciones
    if (errE) throw errE;
    if (!eventos || eventos.length === 0) {
      return new Response(JSON.stringify({
        created: 0
      }), {
        headers: {
          'content-type': 'application/json'
        },
        status: 200
      });
    }
    const notificacionesParaInsertar = [];
    let createdCount = 0;
    for (const ev of eventos){
      // Evitar duplicados: si ya hay notificación pendiente para este evento
      const { data: exists, error: errEx } = await supabase.from('notificaciones').select('id').eq('agenda_evento_id', ev.id).eq('asunto', `Recordatorio: ${ev.titulo}`) // Usamos el asunto como ID simple
      .eq('user_id_destinatario', ev.user_id).eq('canal', 'in-app').eq('estado', 'pendiente').limit(1);
      if (errEx) throw errEx;
      if (exists && exists.length > 0) continue; // Ya existe, saltar
      // 2. Crear notificación 'in-app' para el creador del evento
      notificacionesParaInsertar.push({
        empresa_id: ev.empresa_id,
        tipo: 'agenda_recordatorio',
        asunto: `Recordatorio: ${ev.titulo}`,
        cuerpo: `Tu evento "${ev.titulo}" comienza pronto.`,
        destinatarios_emails: [],
        canal: 'in-app',
        programada_para: ev.fecha_inicio,
        estado: 'pendiente',
        leida: false,
        user_id_destinatario: ev.user_id,
        agenda_evento_id: ev.id
      });
    }
    // 3. Insertar todas las notificaciones en lote
    if (notificacionesParaInsertar.length > 0) {
      const { error: errN } = await supabase.from('notificaciones').insert(notificacionesParaInsertar);
      if (errN) throw errN;
      createdCount = notificacionesParaInsertar.length;
    }
    return new Response(JSON.stringify({
      created: createdCount
    }), {
      headers: {
        'content-type': 'application/json'
      },
      status: 200
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({
      error: e?.message ?? 'unknown'
    }), {
      headers: {
        'content-type': 'application/json'
      },
      status: 500
    });
  }
});
