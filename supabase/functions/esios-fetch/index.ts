// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

const ESIOS_BASE_URL = "https://api.esios.ree.es";
const CORSMirror = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===========================================================================
// CONFIGURACIÓN DE REGLAS DE PUBLICACIÓN POR INDICADOR
// ===========================================================================
// Hora y minuto de Europa/Madrid en que cada indicador publica sus datos.
// referenceType: 'D+1' = publica datos de mañana, 'D-1' = publica datos de ayer
const INDICATOR_PUBLICATION_RULES: Record<number, {
    referenceType: 'D-1' | 'D+1';
    publishHour: number;
    publishMinute: number;
}> = {
    600: { referenceType: 'D+1', publishHour: 14, publishMinute: 0 },   // ~14:00
    1001: { referenceType: 'D+1', publishHour: 20, publishMinute: 20 },  // ~20:20
    1002: { referenceType: 'D+1', publishHour: 20, publishMinute: 20 },  // ~20:20
    1727: { referenceType: 'D-1', publishHour: 5, publishMinute: 0 },   // ~05:00
    1739: { referenceType: 'D-1', publishHour: 5, publishMinute: 0 },   // ~05:00
};

// Fecha fallback de arranque si no hay datos previos
const FALLBACK_START_DATE = '2026-01-01';

interface FetchRequest {
    fecha_inicio: string;  // 'YYYY-MM-DD'
    fecha_fin: string;
    indicator_ids?: number[];
    geo_ids?: number[];
}

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function getOffsetForZone(dateISO: string, timeZone: string): string {
    const utc = new Date(`${dateISO}T12:00:00Z`);
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = fmt.formatToParts(utc);
    const hh = Number(parts.find(p => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find(p => p.type === "minute")?.value ?? "0");

    let offsetMinutes = (hh - 12) * 60 + mm;
    if (offsetMinutes <= -720) offsetMinutes += 1440;
    if (offsetMinutes > 720) offsetMinutes -= 1440;

    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function resolveTimeZoneForGeo(geo_id: number): string {
    if ([8741, 8743, 8744, 8745].includes(geo_id)) return "Europe/Madrid";
    if (geo_id === 8742) return "Atlantic/Canary";
    if (geo_id === 1) return "Europe/Lisbon";
    return "Europe/Madrid";
}

function isQuarterHourIndicator(indicatorId: number): boolean {
    return indicatorId === 600;
}

function addDays(dateISO: string, deltaDays: number): string {
    const d = new Date(`${dateISO}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isWithinLocalDateRange(datetimeStr: string, startISO: string, endISO: string): boolean {
    // datetimeStr: "YYYY-MM-DD HH:mm:ss+01" (o con +01:00 dependiendo)
    const localISO = String(datetimeStr).slice(0, 10); // "YYYY-MM-DD"
    return localISO >= startISO && localISO <= endISO;
}

// ===========================================================================
// HELPERS PARA GATING Y CÁLCULO DE RANGOS ÓPTIMOS
// ===========================================================================

/**
 * Obtiene fecha y hora actual en Europe/Madrid
 */
function getMadridNow(): { date: string; hour: number; minute: number } {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = fmt.formatToParts(now);
    const dateStr = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
    return {
        date: dateStr,
        hour: Number(parts.find(p => p.type === 'hour')?.value),
        minute: Number(parts.find(p => p.type === 'minute')?.value)
    };
}

/**
 * Calcula la fecha máxima que el indicador ya ha publicado según la hora actual de Madrid.
 * - D+1: si hora >= hora_publicacion => mañana disponible, sino solo hoy
 * - D-1: si hora >= hora_publicacion => ayer disponible, sino solo anteayer
 */
function getMaxPublishedDate(indicatorId: number, madridNow: { date: string; hour: number; minute: number }): string {
    const rule = INDICATOR_PUBLICATION_RULES[indicatorId];
    if (!rule) return madridNow.date; // Sin regla => hoy como fallback conservador

    const today = madridNow.date;
    const hasPublished = madridNow.hour > rule.publishHour ||
        (madridNow.hour === rule.publishHour && madridNow.minute >= rule.publishMinute);

    if (rule.referenceType === 'D+1') {
        // Publica datos de mañana
        return hasPublished ? addDays(today, 1) : today;
    } else {
        // D-1: Publica datos de ayer
        return hasPublished ? addDays(today, -1) : addDays(today, -2);
    }
}

/**
 * Obtiene el último día completo desde esios_daily_stats para un indicador/geo.
 * Retorna null si no hay datos o error.
 */
async function getLastCompleteDate(
    supabase: any,
    indicatorId: number,
    geoId: number
): Promise<string | null> {
    const { data, error } = await supabase
        .schema('market_data')
        .from('esios_daily_stats')
        .select('fecha')
        .eq('indicator_id', indicatorId)
        .eq('geo_id', geoId)
        .eq('completo', true)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

    return error || !data ? null : data.fecha;
}


serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORSMirror });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const ESIOS_TOKEN = Deno.env.get("ESIOS_PERSONAL_TOKEN");
        if (!ESIOS_TOKEN) throw new Error("Falta configuración: ESIOS_PERSONAL_TOKEN no está definido.");

        const {
            fecha_inicio,
            fecha_fin,
            indicator_ids = [1001, 600, 1002, 1739, 1727],
            geo_ids = [8741],
        } = await req.json() as FetchRequest;

        if (!fecha_inicio || !fecha_fin) {
            return new Response(JSON.stringify({ error: "fecha_inicio y fecha_fin requeridos (YYYY-MM-DD)" }), {
                status: 400,
                headers: { ...CORSMirror, "Content-Type": "application/json" },
            });
        }

        const primaryGeoId = geo_ids?.[0] ?? 8741;

        const { data: job, error: jobError } = await supabase
            .schema("market_data")
            .from("ingestion_jobs")
            .insert({
                tipo: "manual",
                indicator_ids,
                fecha_inicio,
                fecha_fin,
                geo_id: primaryGeoId,
                estado: "running",
            })
            .select()
            .single();

        if (jobError) throw jobError;

        let totalChanges = 0;   // insertados + actualizados
        let totalReceived = 0;  // filas recibidas de la API (tras filtrar)

        // Obtener hora actual de Madrid una vez para todo el job
        const madridNow = getMadridNow();

        for (const indicatorId of indicator_ids) {

            // ✅ SOLO geo_mode (no mezclamos con requiere_geo)
            const { data: indicatorMeta, error: indicatorMetaError } = await supabase
                .schema("market_data")
                .from("esios_indicators")
                .select("geo_mode")
                .eq("id", indicatorId)
                .single();

            const geoMode = indicatorMetaError ? "filterable" : (indicatorMeta?.geo_mode ?? "filterable");

            // requestGeoIds finales (lo que pedimos y lo que insertamos)
            let requestGeoIds = geo_ids;

            // si es Spain-only, forzamos a España (3)
            if (geoMode === "spain_only") requestGeoIds = [3];

            // Determinar geo_id para cálculo de último día completo
            const geoForStats = requestGeoIds[0] ?? primaryGeoId;

            // =========================================================
            // NUEVA LÓGICA: CÁLCULO DE RANGO ÓPTIMO
            // =========================================================

            // 1. Calcular fecha máxima publicada según hora actual
            const maxPublishedDate = getMaxPublishedDate(indicatorId, madridNow);

            // 2. Obtener último día completo en BD
            const lastCompleteDate = await getLastCompleteDate(supabase, indicatorId, geoForStats);

            // 3. Calcular fecha inicio objetivo
            let fechaInicioObjetivo = lastCompleteDate
                ? addDays(lastCompleteDate, 1)
                : (fecha_inicio || FALLBACK_START_DATE);

            // Si el usuario pide un rango anterior al calculado, respetarlo
            // (permite forzar re-ingesta manual si es necesario)
            if (fecha_inicio && fecha_inicio < fechaInicioObjetivo) {
                fechaInicioObjetivo = fecha_inicio;
            }

            // 4. Calcular fecha fin objetivo (limitar a maxPublishedDate y 7 días)
            let fechaFinObjetivo = fecha_fin;
            if (fechaFinObjetivo > maxPublishedDate) {
                fechaFinObjetivo = maxPublishedDate;
            }
            // Limitar a máximo 7 días desde inicio
            const maxRangeEnd = addDays(fechaInicioObjetivo, 6);
            if (fechaFinObjetivo > maxRangeEnd) {
                fechaFinObjetivo = maxRangeEnd;
            }

            // 5. Si no hay rango válido, skip este indicador
            if (fechaInicioObjetivo > fechaFinObjetivo) {
                await supabase.schema("market_data").from("ingestion_log").insert({
                    job_id: job.id,
                    indicator_id: indicatorId,
                    fecha: fecha_fin,
                    geo_id: primaryGeoId,
                    exito: true,
                    registros_insertados: 0,
                    registros_actualizados: 0,
                    api_response_status: null,
                    api_values_updated_at: null,
                    error_message: `Skip: no valid range (inicio=${fechaInicioObjetivo} > fin=${fechaFinObjetivo}, last_complete=${lastCompleteDate ?? 'null'}, max_published=${maxPublishedDate})`,
                });
                continue;
            }

            // query de geo_ids solo si aplica
            const geoQuery =
                (geoMode === "filterable" || geoMode === "spain_only")
                    ? requestGeoIds.map(g => `&geo_ids[]=${encodeURIComponent(String(g))}`).join("")
                    : "";

            // ✅ TZ: normal por geo… excepto MIC/Excedentes que deben ir en Europe/Madrid
            const tz =
                (indicatorId === 1727 || indicatorId === 1739)
                    ? "Europe/Madrid"
                    : resolveTimeZoneForGeo(primaryGeoId);

            // =========================================================
            // CAMBIO CLAVE: start_date -1 día SOLO para indicador 600
            // =========================================================
            const startDateForQuery = isQuarterHourIndicator(indicatorId)
                ? addDays(fechaInicioObjetivo, -1)
                : fechaInicioObjetivo;

            const start = `${startDateForQuery}T00:00:00Z`;
            const end = `${fechaFinObjetivo}T23:59:59Z`;

            const url =
                `${ESIOS_BASE_URL}/indicators/${indicatorId}` +
                `?start_date=${encodeURIComponent(start)}` +
                `&end_date=${encodeURIComponent(end)}` +
                geoQuery;

            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json; application/vnd.esios-api-v1+json",
                    "x-api-key": ESIOS_TOKEN,
                },
            });

            if (!response.ok) {
                await supabase.schema("market_data").from("ingestion_log").insert({
                    job_id: job.id,
                    indicator_id: indicatorId,
                    fecha: fechaFinObjetivo,
                    geo_id: primaryGeoId,
                    exito: false,
                    registros_insertados: 0,
                    registros_actualizados: 0,
                    api_response_status: response.status,
                    api_values_updated_at: null,
                    error_message: `HTTP Error: ${response.status} ${response.statusText} (geo_ids=${JSON.stringify(requestGeoIds)})`,
                });
                continue;
            }

            const data = await response.json();
            const values = data.indicator?.values || [];
            const apiUpdatedAt = data.indicator?.values_updated_at;

            // ✅ filtrado por geoMode/requestGeoIds
            let valuesFiltered = values;
            if (geoMode === "filterable" || geoMode === "spain_only") {
                const wanted = new Set(requestGeoIds.map(Number));
                valuesFiltered = valuesFiltered.filter((v: any) => wanted.has(Number(v.geo_id)));
            }

            // ✅ Filtrar al rango objetivo (importante para 600 que pide día anterior)
            valuesFiltered = valuesFiltered.filter((v: any) =>
                isWithinLocalDateRange(String(v.datetime), fechaInicioObjetivo, fechaFinObjetivo)
            );

            if (valuesFiltered.length === 0) {
                await supabase.schema("market_data").from("ingestion_log").insert({
                    job_id: job.id,
                    indicator_id: indicatorId,
                    fecha: fechaFinObjetivo,
                    geo_id: primaryGeoId,
                    exito: true,
                    registros_insertados: 0,
                    registros_actualizados: 0,
                    api_response_status: response.status,
                    api_values_updated_at: apiUpdatedAt ?? null,
                    error_message: `No values returned from API (geo_ids=${JSON.stringify(requestGeoIds)}, range=${fechaInicioObjetivo}..${fechaFinObjetivo})`,
                });
                continue;
            }

            const rowsToInsert = valuesFiltered.map((v: any) => {
                const numericValue = (typeof v.value === "number") ? v.value : null;
                return {
                    indicator_id: indicatorId,
                    geo_id: Number(v.geo_id ?? primaryGeoId),
                    datetime_utc: v.datetime_utc,
                    datetime_local: v.datetime,
                    value: numericValue,
                    value_text: numericValue === null && v.value != null ? String(v.value) : null,
                    api_updated_at: apiUpdatedAt,
                    __geo_name: v.geo_name,
                };
            });

            // Upsert geos (FK)
            const geoRows = Array.from(
                new Map(
                    rowsToInsert
                        .filter((r: any) => r?.geo_id != null)
                        .map((r: any) => [
                            String(r.geo_id),
                            { id: Number(r.geo_id), nombre: r.__geo_name ?? `geo_${r.geo_id}`, activo: true },
                        ])
                ).values()
            );

            if (geoRows.length > 0) {
                await supabase.schema("market_data").from("esios_geos").upsert(geoRows, { onConflict: "id" });
            }

            const rowsClean = rowsToInsert.map(({ __geo_name, ...rest }: any) => rest);

            // Upsert REAL con contadores (insertados vs actualizados)
            const { data: upData, error: upErr } = await supabase
                .schema("market_data")
                .rpc("upsert_esios_values", { p_rows: rowsClean });

            if (upErr) {
                await supabase.schema("market_data").from("ingestion_log").insert({
                    job_id: job.id,
                    indicator_id: indicatorId,
                    fecha: fechaFinObjetivo,
                    geo_id: primaryGeoId,
                    exito: false,
                    error_message: upErr.message,
                });
                continue;
            }

            const recibidos = upData?.[0]?.recibidos ?? rowsClean.length;
            const insertados = upData?.[0]?.insertados ?? 0;
            const actualizados = upData?.[0]?.actualizados ?? 0;

            totalReceived += recibidos;
            totalChanges += (insertados + actualizados);

            await supabase.schema("market_data").from("ingestion_log").insert({
                job_id: job.id,
                indicator_id: indicatorId,
                fecha: fechaFinObjetivo,
                geo_id: primaryGeoId,
                exito: true,
                registros_insertados: insertados,
                registros_actualizados: actualizados,
                api_response_status: 200,
                api_values_updated_at: apiUpdatedAt,
                error_message: `range=${fechaInicioObjetivo}..${fechaFinObjetivo}, geo_ids=${JSON.stringify(requestGeoIds)}`,
            });

        }

        // Recalcular agregados
        await supabase.schema("market_data").rpc("recalculate_daily_stats", {
            p_fecha_inicio: fecha_inicio,
            p_fecha_fin: fecha_fin,
            p_indicator_id: null,
        });

        await supabase.schema("market_data").from("ingestion_jobs").update({
            estado: "completed",
            completado_en: new Date().toISOString(),
            progreso: { dias_procesados: 1, total_registros: totalChanges, total_recibidos: totalReceived }
        }).eq("id", job.id);

        return new Response(JSON.stringify({ ok: true, job_id: job.id, cambios: totalChanges, recibidos: totalReceived }), {
            headers: { ...CORSMirror, "Content-Type": "application/json" },
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...CORSMirror, "Content-Type": "application/json" },
        });
    }
});
