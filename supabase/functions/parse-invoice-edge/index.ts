// @ts-nocheck

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

// Tipos de salida (opcionales)
type PrecioPotencia = { periodo: string; precio_eur_kw_ano: number };
type PrecioEnergia = { periodo: string; precio_eur_kwh: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Lee secretos (usa tus nombres existentes)
    const msBase   = Deno.env.get("CLOUD_RUN_URL");
    const msToken  = Deno.env.get("INTERNAL_API_TOKEN");
    const llmModel = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";

    if (!msBase || !msToken) {
      return new Response(
        JSON.stringify({ error: "Faltan CLOUD_RUN_URL o INTERNAL_API_TOKEN" }),
        { status: 500, headers: corsHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const pretty: boolean = !!body?.pretty;

    let pdf_base64: string = body?.pdf_base64 ?? "";
    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: "Falta 'pdf_base64' en el body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    // Acepta base64 “puro” o data URL
    if (!pdf_base64.startsWith("data:")) {
      pdf_base64 = `data:application/pdf;base64,${pdf_base64}`;
    }

    // Llama al microservicio con LLM forzado
    const resp = await fetch(`${msBase}/parse-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Token": msToken,
      },
      body: JSON.stringify({
        pdf_base64,
        pretty,
        use_llm: true,
        llm_model: llmModel,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: `Microservicio error ${resp.status}`, details: text }),
        { status: 502, headers: corsHeaders },
      );
    }

    const salida = await resp.json();
    const r = salida?.result ?? salida ?? {};

    // Mapeo robusto
    const titular = r?.titular?.nombre ?? null;
    const doc = r?.documento ?? {};
    const nif = doc?.nif ?? doc?.valor ?? null;

    const sum = r?.suministro ?? {};
    const direccion = sum?.via ?? sum?.texto ?? null;
    const cp  = sum?.cp ?? "";
    const pob = sum?.poblacion ?? "";
    const prov = sum?.provincia ?? "";
    const poblacion = (cp && pob ? `${cp} ${pob}` : "") || pob || prov || cp || null;

    const cups  = r?.cups?.valor ?? null;
    const otros = r?.alquiler_contador?.importe_eur ?? null;

    const p_pot: PrecioPotencia[] = Array.isArray(r?.precios?.potencia)
      ? r.precios.potencia.map((p: any) => ({
          periodo: String(p?.periodo ?? ""),
          precio_eur_kw_ano: Number(p?.precio_eur_kw_ano ?? 0) || 0,
        }))
      : [];

    const p_ener: PrecioEnergia[] = Array.isArray(r?.precios?.energia)
      ? r.precios.energia.map((e: any) => ({
          periodo: String(e?.periodo ?? ""),
          precio_eur_kwh: Number(e?.precio_eur_kwh ?? 0) || 0,
        }))
      : [];

    const reduced = { titular, nif, direccion, poblacion, cups, otros, p_pot, p_ener };
    return new Response(JSON.stringify(reduced), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Edge error", message: String(err?.message ?? err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});