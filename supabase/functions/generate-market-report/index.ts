// @ts-nocheck
// Edge Function: generate-market-report
// Genera informes de mercado PDF para múltiples clientes y puntos de suministro
// - Valida JWT del usuario
// - Obtiene datos de facturación y mercado
// - Llama al microservicio de generación de PDF
// - Sube el PDF a Storage y crea registro en DB

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MICROSERVICE_URL = Deno.env.get("CLOUD_RUN_URL");
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN");

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

// Types
interface InformeConfig {
  titulo: string;
  tipo_informe: 'auditoria' | 'comparativa';
  fecha_inicio: string;
  fecha_fin: string;
  cliente_id: string;
  punto_ids: string[];
}

interface InformeContent {
  graficos_seleccionados: string[];
  resumen_ejecutivo: {
    coste_total: string;
    consumo_total: string;
    ahorro_potencial: string;
  };
  analisis_mercado: string;
  incidencias: {
    excesos_potencia: boolean;
    energia_reactiva: boolean;
    desviaciones_consumo: boolean;
    penalizaciones: boolean;
  };
  recomendaciones: {
    sin_inversion: string[];
    con_inversion: string[];
  };
  conclusion_tipo: 'favorable' | 'informativa';
  precio_medio_pagado?: number;
  precio_medio_mercado?: number;
}

interface RequestPayload {
  config: InformeConfig;
  content: InformeContent;
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(ab: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// CORS headers helper
function corsHeaders(origin: string | null, req: Request) {
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

// Generate unique filename
function generateFilename(config: InformeConfig, clienteId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedTitle = config.titulo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30);
  return `${clienteId}/${config.tipo_informe}_${sanitizedTitle}_${timestamp}.pdf`;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const CORS = corsHeaders(origin, req);

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1) Parse request body
    const raw = await req.text();
    const payload: RequestPayload = JSON.parse(raw);

    const { config, content } = payload;

    // Validate required fields
    if (!config?.titulo || !config?.tipo_informe || !config?.fecha_inicio || !config?.fecha_fin || !config?.cliente_id) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos en config (titulo, tipo_informe, fecha_inicio, fecha_fin, cliente_id)" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2) Create Supabase clients
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
      auth: { persistSession: false }
    });

    // 3) Validate user JWT
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado", details: authError?.message }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 4) Validate cliente_id belongs to user's empresa
    const { data: cliente, error: clienteError } = await supabaseUser
      .from("clientes")
      .select("id, nombre, empresa_id")
      .eq("id", config.cliente_id)
      .single();

    if (clienteError || !cliente) {
      return new Response(
        JSON.stringify({ error: "Cliente no encontrado o sin acceso" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const clienteId = cliente.id;
    const empresaId = cliente.empresa_id;

    // 5) Fetch billing data using RPC
    const { data: facturacionData, error: factError } = await supabaseUser
      .rpc('get_informe_facturacion_data', {
        p_cliente_id: config.cliente_id,
        p_punto_ids: config.punto_ids,
        p_fecha_inicio: config.fecha_inicio,
        p_fecha_fin: config.fecha_fin
      });

    if (factError) {
      console.error("Error fetching facturacion data:", factError);
      // Continue with empty data rather than failing
    }

    // 6) Fetch market data using RPC
    const { data: marketData, error: marketError } = await supabaseUser
      .rpc('get_informe_market_data', {
        p_fecha_inicio: config.fecha_inicio,
        p_fecha_fin: config.fecha_fin,
        p_indicator_ids: [600, 1001]  // SPOT and PVPC
      });

    if (marketError) {
      console.error("Error fetching market data:", marketError);
      // Continue with empty data rather than failing
    }

    // 7) Fetch client and point details
    const clienteData = {
      id: cliente.id,
      nombre: cliente.nombre,
      email_facturacion: null,
      estado: null
    };

    const { data: puntosData } = await supabaseUser
      .from("puntos_suministro")
      .select("id, cups, direccion, titular, tarifa_acceso, potencia_contratada_kw")
      .in("id", config.punto_ids);

    // 8) Get empresa branding
    let branding = { mode: "none" };
    
    const { data: emp } = await supabaseUser
      .from("empresas")
      .select("id, nombre")
      .eq("id", empresaId)
      .single();

    if (emp) {
      // Try to get logo
      const path = `${empresaId}.png`;
      const { data: blob, error: logoErr } = await supabaseAdmin.storage
        .from("logos_empresas")
        .download(path);

      let logoDataUrl = null;
      if (!logoErr && blob && blob.size > 0 && blob.size <= MAX_LOGO_BYTES) {
        const ab = await blob.arrayBuffer();
        const b64 = arrayBufferToBase64(ab);
        logoDataUrl = `data:image/png;base64,${b64}`;
      }

      branding = logoDataUrl
        ? { mode: "logo+name", company_id: emp.id, company_name: emp.nombre, logo_data_url: logoDataUrl }
        : { mode: "name", company_id: emp.id, company_name: emp.nombre };
    }

    // 9) Build full payload for PDF microservice
    const pdfPayload = {
      tipo: "informe_mercado",
      config: {
        ...config,
        cliente_id: clienteId
      },
      content,
      data: {
        facturacion: facturacionData || { resumen: {}, por_mes: [], por_punto: [] },
        mercado: marketData || { estadisticas_diarias: [], resumen_periodo: [] },
        cliente: clienteData,
        puntos: puntosData || []
      },
      branding,
      generated_at: new Date().toISOString()
    };

    // 10) Call PDF microservice (or simulate if not configured)
    let pdfBuffer: ArrayBuffer;

    if (MICROSERVICE_URL && INTERNAL_API_TOKEN) {
      const upstream = await fetch(`${MICROSERVICE_URL}/generate-market-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Auth-Token": INTERNAL_API_TOKEN
        },
        body: JSON.stringify(pdfPayload)
      });

      if (!upstream.ok) {
        const errTxt = await upstream.text();
        console.error("Microservice error:", errTxt);
        
        // Fall back to creating a placeholder PDF response
        return new Response(
          JSON.stringify({
            error: "Error generando PDF",
            upstream_status: upstream.status,
            details: errTxt
          }),
          { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      pdfBuffer = await upstream.arrayBuffer();
    } else {
      // Simulation mode: Return the payload data instead of PDF
      console.log("Microservice not configured, returning payload data");
      
      // Create a "mock" record without PDF
      const { data: informeRecord, error: insertError } = await supabaseAdmin
        .from("informes_mercado")
        .insert({
          titulo: config.titulo,
          tipo_informe: config.tipo_informe,
          fecha_inicio: config.fecha_inicio,
          fecha_fin: config.fecha_fin,
          cliente_id: config.cliente_id,
          parametros_config: content,
          creado_por: user.id,
          estado: 'borrador',
          ruta_storage: null
        })
        .select()
        .single();

      // Insert targets
      if (!insertError && informeRecord && config.punto_ids?.length > 0) {
        await supabaseAdmin
          .from("informes_targets")
          .insert(
            config.punto_ids.map(punto_id => ({
              informe_id: informeRecord.id,
              punto_id
            }))
          );
      }

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Error guardando informe", details: insertError.message }),
          { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Informe guardado (sin PDF - microservicio no configurado)",
          informe: informeRecord,
          payload_preview: {
            data_summary: {
              facturas_count: facturacionData?.resumen?.total_facturas || 0,
              importe_total: facturacionData?.resumen?.importe_total || 0,
              market_data_days: marketData?.estadisticas_diarias?.length || 0
            }
          }
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 11) Upload PDF to Storage
    const filename = generateFilename(config, clienteId);
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from("informes-mercado")
      .upload(filename, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Error subiendo PDF a Storage", details: uploadError.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 12) Create record in informes_mercado table
    const { data: informeRecord, error: insertError } = await supabaseAdmin
      .from("informes_mercado")
      .insert({
        titulo: config.titulo,
        tipo_informe: config.tipo_informe,
        fecha_inicio: config.fecha_inicio,
        fecha_fin: config.fecha_fin,
        cliente_id: config.cliente_id,
        parametros_config: content,
        ruta_storage: filename,
        creado_por: user.id,
        estado: 'completado'
      })
      .select()
      .single();

    // Insert targets
    if (!insertError && informeRecord && config.punto_ids?.length > 0) {
      const { error: targetsError } = await supabaseAdmin
        .from("informes_targets")
        .insert(
          config.punto_ids.map(punto_id => ({
            informe_id: informeRecord.id,
            punto_id
          }))
        );
      
      if (targetsError) {
        console.error("Error inserting targets:", targetsError);
        // No fallar la operación completa, solo registrar
      }
    }

    if (insertError) {
      console.error("Database insert error:", insertError);
      // Try to clean up the uploaded file
      await supabaseAdmin.storage.from("informes-mercado").remove([filename]);
      
      return new Response(
        JSON.stringify({ error: "Error guardando registro de informe", details: insertError.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 13) Generate signed URL for download
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("informes-mercado")
      .createSignedUrl(filename, 3600); // 1 hour expiry

    // 14) Return success response
    return new Response(
      JSON.stringify({
        success: true,
        informe: informeRecord,
        download_url: signedUrl?.signedUrl,
        expires_in: 3600
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", details: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
