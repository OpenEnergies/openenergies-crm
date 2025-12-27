// @ts-nocheck
// Edge Function: añade "branding" al payload y llama al microservicio de PDF
// - Lee empresa_id del body
// - Resuelve nombre + logo privado desde Storage
// - Adjunta branding al payload y reenvía al microservicio
// - CORS y manejo de OPTIONS
// index.ts (Supabase Edge Function: generate-comparison-pdf)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Usa los nombres que TÚ tienes como secrets:
const MICROSERVICE_URL = Deno.env.get("CLOUD_RUN_URL"); // <--- si tus secrets usan CLOUD_RUN_URL
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN"); // <--- token interno del Cloud Run
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
function arrayBufferToBase64(ab) {
  let binary = '';
  const bytes = new Uint8Array(ab);
  for(let i = 0; i < bytes.byteLength; i++)binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function corsHeaders(origin, req) {
  const reqHeaders = req.headers.get("Access-Control-Request-Headers");
  const reqMethod = req.headers.get("Access-Control-Request-Method") ?? "POST";
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders ?? "authorization, x-client-info, apikey, content-type",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Access-Control-Max-Age": "86400"
  };
}
serve(async (req)=>{
  const origin = req.headers.get("Origin");
  const CORS = corsHeaders(origin, req);
  // Preflight SIEMPRE OK
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    // 1) Lee y parsea el JSON del front
    const raw = await req.text();
    const payload = JSON.parse(raw);
    // 2) Crea clientes supabase
    //    - user-scope (RLS) para leer 'empresas' con el token del usuario
    //    - service role para descargar el logo privado del bucket
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? ""
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });
    // 3) Resuelve branding a partir de empresa_id
    const empresaId = payload?.empresa_id ?? null;
    let branding = {
      mode: "none"
    };
    if (empresaId) {
      // 3.1) Lee empresa (respeta RLS)
      const { data: emp, error: empErr } = await supabaseUser.from("empresas").select("id, nombre").eq("id", empresaId).single();
      if (!empErr && emp) {
        // 3.2) Intenta descargar el logo privado {empresa_id}.png
        const path = `${empresaId}.png`;
        const { data: blob, error: logoErr } = await supabaseAdmin.storage.from("logos_empresas").download(path);
        let logoDataUrl = null;
        if (!logoErr && blob && blob.size > 0) {
          if (blob.size <= MAX_LOGO_BYTES) {
            const ab = await blob.arrayBuffer();
            const b64 = arrayBufferToBase64(ab);
            // Asumimos PNG (según tu convención {empresa_id}.png)
            logoDataUrl = `data:image/png;base64,${b64}`;
          }
        }
        branding = logoDataUrl ? {
          mode: "logo+name",
          company_id: emp.id,
          company_name: emp.nombre,
          logo_data_url: logoDataUrl
        } : {
          mode: "name",
          company_id: emp.id,
          company_name: emp.nombre
        };
      } else {
        branding = {
          mode: "none"
        };
      }
    }
    // 4) Adjunta branding y elimina empresa_id
    payload.branding = branding;
    delete payload.empresa_id;
    // 5) Llama al microservicio con el payload ENRIQUECIDO
    if (!MICROSERVICE_URL || !INTERNAL_API_TOKEN) {
      return new Response(JSON.stringify({
        error: "Faltan CLOUD_RUN_URL o INTERNAL_API_TOKEN"
      }), {
        status: 500,
        headers: {
          ...CORS,
          "Content-Type": "application/json"
        }
      });
    }
    const upstream = await fetch(`${MICROSERVICE_URL}/generate-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Token": INTERNAL_API_TOKEN
      },
      body: JSON.stringify(payload)
    });
    if (upstream.ok) {
      const bin = await upstream.arrayBuffer();
      return new Response(bin, {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="comparativa.pdf"'
        }
      });
    }
    const errTxt = await upstream.text();
    return new Response(JSON.stringify({
      upstream_status: upstream.status,
      error: errTxt
    }), {
      status: 502,
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      status: 500,
      headers: {
        ...CORS,
        "Content-Type": "application/json"
      }
    });
  }
});
