// @ts-nocheck
// Edge Function: generate-audit-report
// Genera informes de auditoría energética DOCX para clientes
// - Valida JWT del usuario
// - Obtiene datos de la RPC get_auditoria_energetica_data
// - Transforma al schema del microservicio (plantilla.json)
// - Llama al microservicio de Cloud Run (con Identity Token)
// - Sube el DOCX a Storage y crea registro en DB

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUD_RUN_AUDIT_URL = Deno.env.get("CLOUD_RUN_AUDIT_URL");
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN");

// Types matching reportDraftTypes.ts FinalReportPayload
interface RequestPayload {
    metadata: {
        titulo: string;
        cliente_id: string;
        punto_ids: string[];
        fecha_inicio: string;
        fecha_fin: string;
    };
    kpis: {
        cliente_nombre: string;
        consumo_total_kwh: number;
        coste_total_eur: number;
        precio_medio_eur_kwh: number;
        tarifas_n: number;
        puntos_n: number;
        facturas_n: number;
        mes_coste_max_nombre: string;
        mes_consumo_max_nombre: string;
    };
    secciones: {
        portada: string;
        portada_sublinea: string;
        alcance: string;
        metodologia: string;
        resumen_ejecutivo: string;
        analisis_tarifas: string;
        evolucion_mensual: string;
        potencias: string;
        extremos: string;
        limitaciones: string;
        desviaciones: string;
        conclusion: string;
        recomendaciones?: string;
    };
    tarifas: Array<{
        tarifa_nombre: string;
        consumo_kwh: number;
        coste_eur: number;
        precio_eur_kwh: number;
        datos_mensuales: Array<{
            mes: string;
            mes_nombre: string;
            consumo_kwh: number;
            coste_eur: number;
            precio_eur_kwh: number;
        }>;
        potencias: {
            p1_kw: number | null;
            p2_kw: number | null;
            p3_kw: number | null;
            p4_kw: number | null;
            p5_kw: number | null;
            p6_kw: number | null;
            puntos_con_potencia: number;
            puntos_totales: number;
            cobertura_pct: number;
            alerta_resumen: string | null;
        };
        extremos: {
            top_consumo: Array<{ cups: string; valor: number; precio_medio_eur_kwh: number }>;
            bottom_consumo: Array<{ cups: string; valor: number; precio_medio_eur_kwh: number }>;
            top_coste: Array<{ cups: string; valor: number; precio_medio_eur_kwh: number }>;
            bottom_coste: Array<{ cups: string; valor: number; precio_medio_eur_kwh: number }>;
        } | null;
    }>;
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

// Get Cloud Run Identity Token using metadata server
async function getIdentityToken(audience: string): Promise<string> {
    const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;

    const response = await fetch(metadataUrl, {
        headers: {
            "Metadata-Flavor": "Google"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get identity token: ${response.status}`);
    }

    return await response.text();
}

// Generate storage path: informes/auditoria/{informe_id}/informe.docx
function generateStoragePath(_empresaId: string, informeId: string): string {
    return `informes/auditoria/${informeId}/informe.docx`;
}

// Transform FinalReportPayload to microservice schema (plantilla.json)
function transformToMicroservicePayload(
    payload: RequestPayload,
    informeId: string
): Record<string, unknown> {
    const { metadata, kpis, secciones, tarifas } = payload;

    // Build tarifas array matching plantilla.json schema
    const tarifasTransformed = tarifas.map(tarifa => {
        // Find month with max cost and consumption
        const mesMaxCoste = tarifa.datos_mensuales.reduce((max, m) =>
            m.coste_eur > (max?.coste_eur ?? 0) ? m : max, tarifa.datos_mensuales[0]);
        const mesMaxConsumo = tarifa.datos_mensuales.reduce((max, m) =>
            m.consumo_kwh > (max?.consumo_kwh ?? 0) ? m : max, tarifa.datos_mensuales[0]);

        return {
            codigo_tarifa: tarifa.tarifa_nombre,
            nombre_tarifa: tarifa.tarifa_nombre,
            resumen: {
                coste_total_eur: tarifa.coste_eur,
                consumo_total_kwh: tarifa.consumo_kwh,
                precio_medio_eur_kwh: tarifa.precio_eur_kwh,
                mes_max_coste: mesMaxCoste?.mes ?? "",
                mes_max_consumo: mesMaxConsumo?.mes ?? ""
            },
            mensual: tarifa.datos_mensuales.map(m => ({
                mes: m.mes,
                consumo_kwh: m.consumo_kwh,
                coste_eur: m.coste_eur,
                precio_medio_eur_kwh: m.precio_eur_kwh
            })),
            potencias: {
                disponible: tarifa.potencias.cobertura_pct > 0,
                cobertura_porcentaje: tarifa.potencias.cobertura_pct,
                puntos_con_datos: tarifa.potencias.puntos_con_potencia,
                puntos_totales: tarifa.potencias.puntos_totales,
                potencias_contratadas_kw: {
                    periodo_1: tarifa.potencias.p1_kw ?? 0,
                    periodo_2: tarifa.potencias.p2_kw ?? 0,
                    periodo_3: tarifa.potencias.p3_kw ?? 0,
                    periodo_4: tarifa.potencias.p4_kw ?? 0,
                    periodo_5: tarifa.potencias.p5_kw ?? 0,
                    periodo_6: tarifa.potencias.p6_kw ?? 0
                },
                nota_interpretacion: tarifa.potencias.alerta_resumen ??
                    "Las potencias mostradas corresponden a la suma de potencias contratadas de puntos con datos disponibles para esta tarifa."
            },
            extremos_por_punto: tarifa.extremos ? {
                enmascarar_identificadores: false,
                top_mayor_consumo: tarifa.extremos.top_consumo.map(e => ({
                    punto_id: e.cups,
                    consumo_kwh: e.valor,
                    precio_medio_eur_kwh: e.precio_medio_eur_kwh
                })),
                bottom_menor_consumo: tarifa.extremos.bottom_consumo.map(e => ({
                    punto_id: e.cups,
                    consumo_kwh: e.valor,
                    precio_medio_eur_kwh: e.precio_medio_eur_kwh
                })),
                top_mayor_coste: tarifa.extremos.top_coste.map(e => ({
                    punto_id: e.cups,
                    coste_eur: e.valor,
                    precio_medio_eur_kwh: e.precio_medio_eur_kwh
                })),
                bottom_menor_coste: tarifa.extremos.bottom_coste.map(e => ({
                    punto_id: e.cups,
                    coste_eur: e.valor,
                    precio_medio_eur_kwh: e.precio_medio_eur_kwh
                }))
            } : {
                enmascarar_identificadores: false,
                top_mayor_consumo: [],
                bottom_menor_consumo: [],
                top_mayor_coste: [],
                bottom_menor_coste: []
            }
        };
    });

    // Build evolucion_global
    const allMonths = new Set<string>();
    tarifas.forEach(t => t.datos_mensuales.forEach(m => allMonths.add(m.mes)));
    const sortedMonths = Array.from(allMonths).sort();

    const evolucionMensual = sortedMonths.map(mes => {
        const totals = tarifas.reduce((acc, t) => {
            const mesData = t.datos_mensuales.find(m => m.mes === mes);
            if (mesData) {
                acc.consumo += mesData.consumo_kwh;
                acc.coste += mesData.coste_eur;
            }
            return acc;
        }, { consumo: 0, coste: 0 });

        return {
            mes,
            consumo_kwh: totals.consumo,
            coste_eur: totals.coste,
            precio_medio_eur_kwh: totals.consumo > 0 ? totals.coste / totals.consumo : 0
        };
    });

    // Format date labels
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return {
        meta: {
            id_informe: informeId,
            idioma: "es-ES",
            fecha_generacion: new Date().toISOString().split('T')[0],
            zona_horaria: "Europe/Madrid",
            version_plantilla: "v1",
            marca: {
                color_principal_hex: "#10B981",
                ruta_logo: "assets/logo.png"
            }
        },
        cliente: {
            nombre: kpis.cliente_nombre,
            identificador_fiscal: "",  // Not available in payload
            direccion: "",
            contacto: {
                nombre: "",
                correo: "",
                telefono: ""
            }
        },
        periodo: {
            fecha_inicio: metadata.fecha_inicio,
            fecha_fin: metadata.fecha_fin,
            etiqueta: `${formatDate(metadata.fecha_inicio)} – ${formatDate(metadata.fecha_fin)}`
        },
        alcance: {
            tarifas_analizadas: kpis.tarifas_n,
            puntos_con_facturacion: kpis.puntos_n,
            numero_facturas: kpis.facturas_n,
            texto_alcance: secciones.alcance,
            texto_metodologia: secciones.metodologia
        },
        kpis_globales: {
            consumo_total_kwh: kpis.consumo_total_kwh,
            coste_total_eur: kpis.coste_total_eur,
            precio_medio_eur_kwh: kpis.precio_medio_eur_kwh,
            tarifas_con_facturacion: kpis.tarifas_n,
            puntos_con_facturacion: kpis.puntos_n,
            numero_facturas: kpis.facturas_n
        },
        textos: {
            titulo_portada: secciones.portada,
            subtitulo_portada: secciones.portada_sublinea,
            resumen_ejecutivo: secciones.resumen_ejecutivo,
            texto_analisis_tarifas: secciones.analisis_tarifas,
            texto_evolucion_mensual: secciones.evolucion_mensual,
            texto_analisis_potencias: secciones.potencias,
            texto_extremos_por_tarifa: secciones.extremos,
            limitaciones_del_analisis: secciones.limitaciones,
            texto_desviaciones_editable: secciones.desviaciones,
            conclusion_final: secciones.conclusion
        },
        tarifas: tarifasTransformed,
        evolucion_global: {
            mensual: evolucionMensual,
            por_tarifa: tarifas.map(t => ({
                codigo_tarifa: t.tarifa_nombre,
                mensual: t.datos_mensuales.map(m => ({
                    mes: m.mes,
                    consumo_kwh: m.consumo_kwh,
                    coste_eur: m.coste_eur,
                    precio_medio_eur_kwh: m.precio_eur_kwh
                }))
            }))
        },
        limitaciones_y_desviaciones: {
            desviaciones_autogeneradas: [],
            desviaciones_editables: {
                texto: secciones.desviaciones
            }
        },
        recomendaciones: {
            habilitada: !!secciones.recomendaciones,
            texto: secciones.recomendaciones ?? ""
        },
        graficos: []  // Charts are generated by the microservice
    };
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

        const { metadata } = payload;

        // Validate required fields
        if (!metadata?.titulo || !metadata?.cliente_id || !metadata?.fecha_inicio || !metadata?.fecha_fin) {
            return new Response(
                JSON.stringify({ error: "Faltan campos requeridos en metadata (titulo, cliente_id, fecha_inicio, fecha_fin)" }),
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

        // 4) Validate cliente_id exists (just validate it exists, no empresa_id in clientes table)
        console.log("[DEBUG] Looking up cliente_id:", metadata.cliente_id);
        console.log("[DEBUG] Authenticated user.id:", user.id);

        const { data: cliente, error: clienteError } = await supabaseAdmin
            .from("clientes")
            .select("id, nombre")
            .eq("id", metadata.cliente_id)
            .single();

        if (clienteError || !cliente) {
            console.error("Cliente lookup error:", clienteError);
            return new Response(
                JSON.stringify({ error: "Cliente no encontrado", details: clienteError?.message }),
                { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // 5) Get empresa_id from authenticated user's profile in usuarios_app
        const { data: usuarioApp, error: usuarioError } = await supabaseAdmin
            .from("usuarios_app")
            .select("empresa_id")
            .eq("user_id", user.id)
            .single();

        if (usuarioError || !usuarioApp?.empresa_id) {
            console.error("Usuario lookup error:", usuarioError);
            return new Response(
                JSON.stringify({ error: "No se pudo obtener la empresa del usuario", details: usuarioError?.message }),
                { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        const empresaId = usuarioApp.empresa_id;

        // 6) Generate informe ID and storage path
        const informeId = crypto.randomUUID();
        const storagePath = generateStoragePath(empresaId, informeId);

        // 7) Transform payload to microservice format
        console.log("[DEBUG] Step 7: About to transform payload");
        console.log("[DEBUG] payload.tarifas.length:", payload.tarifas?.length);
        console.log("[DEBUG] payload.metadata:", JSON.stringify(payload.metadata));

        let microservicePayload;
        try {
            microservicePayload = transformToMicroservicePayload(payload, informeId);
            console.log("[DEBUG] Transform successful");
        } catch (transformError) {
            console.error("[DEBUG] Transform error:", transformError);
            return new Response(
                JSON.stringify({
                    error: "Error transformando payload",
                    details: String(transformError)
                }),
                { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // 8) Call Cloud Run microservice
        console.log("[DEBUG] Step 8: About to call Cloud Run microservice");
        console.log("[DEBUG] CLOUD_RUN_AUDIT_URL:", CLOUD_RUN_AUDIT_URL);
        console.log("[DEBUG] empresaId:", empresaId);
        console.log("[DEBUG] informeId:", informeId);
        console.log("[DEBUG] storagePath:", storagePath);

        let docxBuffer: ArrayBuffer;

        if (CLOUD_RUN_AUDIT_URL) {
            // Use INTERNAL_API_TOKEN for authentication (GCP metadata server not available in Supabase)
            console.log("[DEBUG] Calling Cloud Run with INTERNAL_API_TOKEN...");

            if (!INTERNAL_API_TOKEN) {
                console.error("[DEBUG] INTERNAL_API_TOKEN not configured");
                return new Response(
                    JSON.stringify({
                        error: "INTERNAL_API_TOKEN no configurado",
                        details: "Configure el secret INTERNAL_API_TOKEN en Supabase"
                    }),
                    { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
                );
            }

            const upstream = await fetch(`${CLOUD_RUN_AUDIT_URL}/generar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": INTERNAL_API_TOKEN
                },
                body: JSON.stringify(microservicePayload)
            });

            if (!upstream.ok) {
                const errTxt = await upstream.text();
                console.error("Microservice error:", errTxt);

                return new Response(
                    JSON.stringify({
                        error: "Error generando DOCX",
                        upstream_status: upstream.status,
                        details: errTxt
                    }),
                    { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
                );
            }

            docxBuffer = await upstream.arrayBuffer();
        } else {
            // Simulation mode: Return success without PDF
            console.log("[DEBUG] Fallback mode: CLOUD_RUN_AUDIT_URL not configured");
            console.log("[DEBUG] Creating draft record in informes_mercado...");
            console.log("[DEBUG] informeId:", informeId);
            console.log("[DEBUG] cliente_id:", metadata.cliente_id);
            console.log("[DEBUG] user.id:", user.id);

            const { data: informeRecord, error: insertError } = await supabaseAdmin
                .from("informes_mercado")
                .insert({
                    id: informeId,
                    titulo: metadata.titulo,
                    tipo_informe: "auditoria",
                    fecha_inicio: metadata.fecha_inicio,
                    fecha_fin: metadata.fecha_fin,
                    cliente_id: metadata.cliente_id,
                    parametros_config: payload,
                    creado_por: user.id,
                    estado: 'borrador',
                    ruta_storage: null
                })
                .select()
                .single();

            console.log("[DEBUG] Insert result - error:", insertError);
            console.log("[DEBUG] Insert result - data:", informeRecord);

            // Insert targets
            if (!insertError && metadata.punto_ids?.length > 0) {
                await supabaseAdmin
                    .from("informes_targets")
                    .insert(
                        metadata.punto_ids.map(punto_id => ({
                            informe_id: informeId,
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
                    message: "Informe guardado (sin DOCX - microservicio no configurado)",
                    informe: informeRecord
                }),
                { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // 8) Upload DOCX to Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from("informes-mercado")
            .upload(storagePath, docxBuffer, {
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                upsert: false
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return new Response(
                JSON.stringify({ error: "Error subiendo DOCX a Storage", details: uploadError.message }),
                { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // 9) Create record in informes_mercado table
        const { data: informeRecord, error: insertError } = await supabaseAdmin
            .from("informes_mercado")
            .insert({
                id: informeId,
                titulo: metadata.titulo,
                tipo_informe: "auditoria",
                fecha_inicio: metadata.fecha_inicio,
                fecha_fin: metadata.fecha_fin,
                cliente_id: metadata.cliente_id,
                parametros_config: payload,
                ruta_storage: storagePath,
                creado_por: user.id,
                estado: 'completado'
            })
            .select()
            .single();

        // Insert targets
        if (!insertError && metadata.punto_ids?.length > 0) {
            const { error: targetsError } = await supabaseAdmin
                .from("informes_targets")
                .insert(
                    metadata.punto_ids.map(punto_id => ({
                        informe_id: informeId,
                        punto_id
                    }))
                );

            if (targetsError) {
                console.error("Error inserting targets:", targetsError);
                // Don't fail the whole operation for this
            }
        }

        if (insertError) {
            console.error("Database insert error:", insertError);
            // Try to clean up the uploaded file
            await supabaseAdmin.storage.from("informes-mercado").remove([storagePath]);

            return new Response(
                JSON.stringify({ error: "Error guardando registro de informe", details: insertError.message }),
                { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
            );
        }

        // 10) Generate signed URL for download
        const { data: signedUrl } = await supabaseAdmin.storage
            .from("informes-mercado")
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

        // 11) Return success response
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
