// @ts-nocheck
// Edge Function: generate-comparative-audit-report
// Genera informes comparativos con mercado DOCX para clientes
// - Valida JWT del usuario
// - Obtiene datos de facturación agregados del cliente
// - Calcula precios de mercado desde market_data (ESIOS + MIBGAS)
// - Aplica regla "favorable sí o sí" (mercado >= cliente + margen)
// - Transforma al schema del microservicio comparativa
// - Llama al microservicio de Cloud Run
// - Sube el DOCX a Storage y crea registro en DB

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// ─── Environment variables ───
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUD_RUN_COMPARATIVA_URL = Deno.env.get("CLOUD_RUN_COMPARATIVA_URL");
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN");

// ─── Config ───
const MARGEN_MINIMO = 0.03; // 3% minimum margin: market >= client * 1.03
const ELEC_INDICATOR_ID = 1001; // PVPC 2.0TD
const ELEC_GEO_ID = 8741; // Península
const MWH_TO_KWH = 1000;

// ─── Types ───
interface RequestPayload {
  mode?: "preview" | "generate"; // preview = return JSON only, generate = return DOCX binary
  metadata: {
    titulo: string;
    cliente_id: string;
    punto_ids: string[];
    fecha_inicio: string;
    fecha_fin: string;
  };
  overrides?: {
    textos?: Record<string, string>;
    precios_mercado?: {
      electricidad?: Record<string, number>; // mes -> €/kWh
      gas?: Record<string, number>; // mes -> €/kWh
    };
    recomendaciones?: {
      habilitada: boolean;
      texto: string;
    };
    comparativa_global?: Record<string, unknown>;
    // Full override arrays from frontend (source of truth for generate mode)
    energias?: unknown[];
    kpis_globales?: Record<string, unknown>;
  };
}

interface EsiosDailyStat {
  fecha: string;
  valor_medio: number;
  valor_min: number;
  valor_max: number;
  media_p1: number | null;
  media_p2: number | null;
  media_p3: number | null;
  desviacion_std: number | null;
  num_valores: number;
}

interface MibgasDaily {
  fecha: string;
  pvb_avg_eur_mwh: number;
}

interface FacturaRow {
  punto_id: string;
  cliente_id: string;
  fecha_emision: string;
  tipo_factura: "Luz" | "Gas";
  tarifa: string;
  consumo_kwh: number;
  precio_eur_kwh: number;
  total: number;
  potencia_kw_min: number | null;
  potencia_kw_max: number | null;
  cups: string;
}

// ─── CORS ───
function corsHeaders(origin: string | null, req: Request) {
  const reqHeaders = req.headers.get("Access-Control-Request-Headers");
  const reqMethod = req.headers.get("Access-Control-Request-Method") ?? "POST";
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
    "Access-Control-Allow-Methods": `${reqMethod}, OPTIONS`,
    "Access-Control-Allow-Headers": reqHeaders ?? "authorization, x-client-info, apikey, content-type",
    "Access-Control-Expose-Headers": "Content-Disposition, X-Informe-Id",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Helpers ───

function toYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7); // "2026-01-15" -> "2026-01"
}

/** trimmed mean: remove top/bottom 10% and average */
function trimmedMean(values: number[], trimPct = 0.1): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimPct);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

/** Apply "favorable sí o sí": market must be >= client * (1 + margin) */
function applyFavorableFloor(
  marketPrice: number,
  clientPrice: number,
  margin: number = MARGEN_MINIMO
): number {
  const floor = clientPrice * (1 + margin);
  return Math.max(marketPrice, floor);
}

function generateStoragePath(informeId: string): string {
  return `informes/comparativa/${informeId}/informe.docx`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "N/D";
  return val.toFixed(decimals);
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "N/D";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

// ─── Main Handler ───
serve(async (req) => {
  const origin = req.headers.get("Origin");
  const CORS = corsHeaders(origin, req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Parse request
    const raw = await req.text();
    const payload: RequestPayload = JSON.parse(raw);
    const { metadata, overrides } = payload;
    const mode = payload.mode || "generate"; // default to generate for backwards compat

    if (
      !metadata?.titulo ||
      !metadata?.cliente_id ||
      !metadata?.fecha_inicio ||
      !metadata?.fecha_fin
    ) {
      return new Response(
        JSON.stringify({
          error: "Faltan campos requeridos en metadata (titulo, cliente_id, fecha_inicio, fecha_fin)",
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2) Auth
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado", details: authError?.message }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 3) Validate client
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from("clientes")
      .select("id, nombre, cif, tipo")
      .eq("id", metadata.cliente_id)
      .is("eliminado_en", null)
      .single();

    if (clienteError || !cliente) {
      return new Response(
        JSON.stringify({ error: "Cliente no encontrado", details: clienteError?.message }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 3b) Decrypt sensitive data (CIF/DNI)
    let cifDescifrado = cliente.cif || ""; // fallback to masked value if decrypt fails
    try {
      const { data: datosDescifrados, error: decryptError } = await supabaseAdmin.rpc(
        "descifrar_datos_informe",
        {
          p_entidad_tipo: "cliente",
          p_entidad_id: metadata.cliente_id,
        }
      );

      if (!decryptError && datosDescifrados && typeof datosDescifrados === 'object') {
        const d = datosDescifrados as Record<string, string>;
        cifDescifrado = d.cif || d.dni || cliente.cif || "";
        console.log("[COMP] CIF descifrado correctamente:", cifDescifrado ? 'OK' : 'vacío');
      } else {
        console.warn("[COMP] No se pudo descifrar CIF, usando valor enmascarado:", decryptError?.message);
      }
    } catch (e) {
      console.warn("[COMP] Error descifrando CIF:", e);
    }

    // 4) Get empresa_id
    const { data: usuarioApp } = await supabaseAdmin
      .from("usuarios_app")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();

    if (!usuarioApp?.empresa_id) {
      return new Response(
        JSON.stringify({ error: "No se pudo obtener la empresa del usuario" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 5) Fetch billing data (aggregated by tarifa + month + energy type)
    console.log("[COMP] Fetching billing data for cliente:", metadata.cliente_id);

    let facturasQuery = supabaseAdmin
      .from("facturacion_clientes")
      .select(
        "punto_id, cliente_id, fecha_emision, tipo_factura, tarifa, consumo_kwh, precio_eur_kwh, total, potencia_kw_min, potencia_kw_max"
      )
      .eq("cliente_id", metadata.cliente_id)
      .gte("fecha_emision", metadata.fecha_inicio)
      .lte("fecha_emision", metadata.fecha_fin)
      .is("eliminado_en", null);

    if (metadata.punto_ids && metadata.punto_ids.length > 0) {
      facturasQuery = facturasQuery.in("punto_id", metadata.punto_ids);
    }

    const { data: facturas, error: facturasError } = await facturasQuery;
    if (facturasError) {
      return new Response(
        JSON.stringify({ error: "Error obteniendo facturas", details: facturasError.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!facturas || facturas.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se encontraron facturas en el rango seleccionado" }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const luFactCount = facturas.filter(f => f.tipo_factura === "Luz").length;
    const gasFactCount = facturas.filter(f => f.tipo_factura === "Gas").length;
    console.log(`[COMP] Facturas breakdown: ${luFactCount} Luz, ${gasFactCount} Gas, total: ${facturas.length}`);

    // Get CUPS for each punto
    const puntoIds = [...new Set(facturas.map((f: FacturaRow) => f.punto_id))];
    const { data: puntos } = await supabaseAdmin
      .from("puntos_suministro")
      .select("id, cups, tarifa, tipo_factura, p1_kw, p2_kw, p3_kw, p4_kw, p5_kw, p6_kw")
      .in("id", puntoIds);

    const puntoMap = new Map(
      (puntos || []).map((p: { id: string }) => [p.id, p])
    );

    const enrichedFacturas: FacturaRow[] = facturas.map((f: FacturaRow) => ({
      ...f,
      cups: (puntoMap.get(f.punto_id) as any)?.cups || f.punto_id,
    }));

    // 6) Fetch market data: ESIOS (electricity)
    console.log("[COMP] Fetching ESIOS market data");
    const { data: esiosData, error: esiosError } = await supabaseAdmin
      .schema("market_data")
      .from("esios_daily_stats")
      .select("fecha, valor_medio, valor_min, valor_max, media_p1, media_p2, media_p3, desviacion_std, num_valores")
      .eq("indicator_id", ELEC_INDICATOR_ID)
      .eq("geo_id", ELEC_GEO_ID)
      .gte("fecha", metadata.fecha_inicio)
      .lte("fecha", metadata.fecha_fin)
      .eq("completo", true);

    if (esiosError) console.error("[COMP] ESIOS query error:", esiosError.message);
    
    // 7) Fetch market data: MIBGAS (gas)
    console.log("[COMP] Fetching MIBGAS market data");
    const { data: mibgasData, error: mibgasError } = await supabaseAdmin
      .schema("market_data")
      .from("mibgas_indexes_daily")
      .select("fecha, pvb_avg_eur_mwh")
      .gte("fecha", metadata.fecha_inicio)
      .lte("fecha", metadata.fecha_fin);

    if (mibgasError) console.error("[COMP] MIBGAS query error:", mibgasError.message);

    // ─── Aggregate market data by month ───

    // Electricity
    const elecByMonth = new Map<
      string,
      { values: number[]; mins: number[]; maxs: number[]; p1s: number[]; p2s: number[]; p3s: number[]; days: number }
    >();
    for (const row of esiosData || []) {
      const ym = toYearMonth(row.fecha);
      if (!elecByMonth.has(ym)) {
        elecByMonth.set(ym, { values: [], mins: [], maxs: [], p1s: [], p2s: [], p3s: [], days: 0 });
      }
      const bucket = elecByMonth.get(ym)!;
      bucket.values.push(Number(row.valor_medio) / MWH_TO_KWH);
      bucket.mins.push(Number(row.valor_min) / MWH_TO_KWH);
      bucket.maxs.push(Number(row.valor_max) / MWH_TO_KWH);
      if (row.media_p1 != null) bucket.p1s.push(Number(row.media_p1) / MWH_TO_KWH);
      if (row.media_p2 != null) bucket.p2s.push(Number(row.media_p2) / MWH_TO_KWH);
      if (row.media_p3 != null) bucket.p3s.push(Number(row.media_p3) / MWH_TO_KWH);
      bucket.days++;
    }

    // Gas
    const gassByMonth = new Map<string, { values: number[]; days: number }>();
    for (const row of mibgasData || []) {
      const ym = toYearMonth(row.fecha);
      if (!gassByMonth.has(ym)) {
        gassByMonth.set(ym, { values: [], days: 0 });
      }
      const bucket = gassByMonth.get(ym)!;
      bucket.values.push(Number(row.pvb_avg_eur_mwh) / MWH_TO_KWH);
      bucket.days++;
    }

    // ─── Build aggregated structure ───
    type TipoEnergia = "electricidad" | "gas";
    interface AggMonth {
      consumo: number;
      coste: number;
      puntos: Set<string>;
      facturas: number;
    }
    interface AggTarifa {
      byMonth: Map<string, AggMonth>;
      puntos: Set<string>;
      facturas: number;
      consumo: number;
      coste: number;
    }
    interface AggEnergia {
      tarifas: Map<string, AggTarifa>;
    }

    const energiaMap = new Map<TipoEnergia, AggEnergia>();

    for (const f of enrichedFacturas) {
      const tipo: TipoEnergia = f.tipo_factura === "Luz" ? "electricidad" : "gas";
      const mes = toYearMonth(f.fecha_emision);
      const tarifaKey = f.tarifa || "sin_tarifa";

      if (!energiaMap.has(tipo)) {
        energiaMap.set(tipo, { tarifas: new Map() });
      }
      const ener = energiaMap.get(tipo)!;

      if (!ener.tarifas.has(tarifaKey)) {
        ener.tarifas.set(tarifaKey, {
          byMonth: new Map(),
          puntos: new Set(),
          facturas: 0,
          consumo: 0,
          coste: 0,
        });
      }
      const tar = ener.tarifas.get(tarifaKey)!;

      if (!tar.byMonth.has(mes)) {
        tar.byMonth.set(mes, { consumo: 0, coste: 0, puntos: new Set(), facturas: 0 });
      }
      const m = tar.byMonth.get(mes)!;

      const consumo = Number(f.consumo_kwh) || 0;
      const precioEnergia = Number(f.precio_eur_kwh) || 0;
      const costeEnergia = consumo * precioEnergia;

      m.consumo += consumo;
      m.coste += costeEnergia;
      m.puntos.add(f.punto_id);
      m.facturas += 1;

      tar.puntos.add(f.punto_id);
      tar.facturas += 1;
      tar.consumo += consumo;
      tar.coste += costeEnergia;
    }

    // ─── Compute per-punto extremos ───
    const puntoAgg = new Map<string, { cups: string; consumo: number; coste: number; wpNum: number; wpDen: number }>();
    for (const f of enrichedFacturas) {
      const key = `${f.tipo_factura}|${f.tarifa || "sin_tarifa"}|${f.punto_id}`;
      if (!puntoAgg.has(key)) {
        puntoAgg.set(key, { cups: f.cups, consumo: 0, coste: 0, wpNum: 0, wpDen: 0 });
      }
      const pa = puntoAgg.get(key)!;
      const c = Number(f.consumo_kwh) || 0;
      const p = Number(f.precio_eur_kwh) || 0;
      const costeEnergia = c * p;
      
      pa.consumo += c;
      pa.coste += costeEnergia; 
      if (p > 0 && c > 0) {
        pa.wpNum += p * c;
        pa.wpDen += c;
      }
    }

    function getExtremos(tipoFactura: string, tarifa: string) {
      const prefix = `${tipoFactura}|${tarifa}|`;
      const items = Array.from(puntoAgg.entries())
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => ({
          cups: v.cups,
          consumo_kwh: v.consumo,
          coste_eur: v.coste,
          precio_medio_eur_kwh: v.wpDen > 0 ? v.wpNum / v.wpDen : null,
        }));

      const byConsumo = [...items].sort((a, b) => b.consumo_kwh - a.consumo_kwh);
      const byCoste = [...items].sort((a, b) => b.coste_eur - a.coste_eur);

      return {
        top_consumo: byConsumo.slice(0, 3),
        bottom_consumo: byConsumo.slice(-3).reverse(),
        top_coste: byCoste.slice(0, 3),
        bottom_coste: byCoste.slice(-3).reverse(),
      };
    }

    // ─── Compute potencias by tarifa ───
    function getPotencias(tipoFactura: string, tarifa: string) {
      const puntosInTarifa = new Set<string>();
      for (const f of enrichedFacturas) {
        if (f.tipo_factura === tipoFactura && (f.tarifa || "sin_tarifa") === tarifa) {
          puntosInTarifa.add(f.punto_id);
        }
      }

      let totalP1 = 0, totalP2 = 0, totalP3 = 0, totalP4 = 0, totalP5 = 0, totalP6 = 0;
      let puntosConDatos = 0;

      for (const pid of puntosInTarifa) {
        const p = puntoMap.get(pid) as any;
        if (p && (p.p1_kw || p.p2_kw || p.p3_kw)) {
          totalP1 += Number(p.p1_kw) || 0;
          totalP2 += Number(p.p2_kw) || 0;
          totalP3 += Number(p.p3_kw) || 0;
          totalP4 += Number(p.p4_kw) || 0;
          totalP5 += Number(p.p5_kw) || 0;
          totalP6 += Number(p.p6_kw) || 0;
          puntosConDatos++;
        }
      }

      return {
        disponible: puntosConDatos > 0,
        cobertura_porcentaje: puntosInTarifa.size > 0 ? (puntosConDatos / puntosInTarifa.size) * 100 : 0,
        puntos_con_datos: puntosConDatos,
        puntos_totales: puntosInTarifa.size,
        p1_kw: totalP1,
        p2_kw: totalP2,
        p3_kw: totalP3,
        p4_kw: totalP4,
        p5_kw: totalP5,
        p6_kw: totalP6,
      };
    }

    // ─── Build energias array for microservice ───
    const energias: unknown[] = [];
    let globalConsumo = 0;
    let globalCoste = 0;
    let globalPuntos = new Set<string>();
    let globalFacturas = 0;
    let globalWpNum = 0;
    let globalWpDen = 0;
    let globalMarketWpNum = 0;
    let globalMarketWpDen = 0;

    for (const [tipo, ener] of energiaMap.entries()) {
      const isElec = tipo === "electricidad";
      const marketByMonth = isElec ? elecByMonth : gassByMonth;
      const marketSource = isElec
        ? `ESIOS PVPC 2.0TD (ind. ${ELEC_INDICATOR_ID}, geo ${ELEC_GEO_ID})`
        : "MIBGAS PVB (pvb_avg_eur_mwh)";

      // Build market serie_mensual
      const allMonths = new Set<string>();
      for (const [, tar] of ener.tarifas) {
        for (const m of tar.byMonth.keys()) allMonths.add(m);
      }
      const sortedMonths = [...allMonths].sort();

      const serieMensual = sortedMonths.map((mes) => {
        const mkt = marketByMonth.get(mes);
        if (!mkt || mkt.values.length === 0) {
          return {
            mes,
            precio_medio_eur_kwh: null,
            precio_min_eur_kwh: null,
            precio_max_eur_kwh: null,
            volatilidad_eur_kwh: null,
            dias_con_datos: 0,
          };
        }

        const rawMean = trimmedMean(mkt.values);
        const min = Math.min(...(isElec ? mkt.mins : mkt.values));
        const max = Math.max(...(isElec ? mkt.maxs : mkt.values));
        const std =
          mkt.values.length > 1
            ? Math.sqrt(
                mkt.values.reduce((s, v) => s + (v - rawMean) ** 2, 0) / (mkt.values.length - 1)
              )
            : 0;

        return {
          mes,
          precio_medio_eur_kwh: rawMean,
          precio_min_eur_kwh: min,
          precio_max_eur_kwh: max,
          volatilidad_eur_kwh: std,
          dias_con_datos: mkt.days,
        };
      });

      // Build tarifas
      const tarifasArr: unknown[] = [];
      for (const [tarifaKey, tar] of ener.tarifas) {
        const tipoFactura = isElec ? "Luz" : "Gas";
        const precioMedioCliente = tar.consumo > 0 ? tar.coste / tar.consumo : 0;

        const mensual = sortedMonths.map((mes) => {
          const md = tar.byMonth.get(mes);
          if (!md) {
            const mktSerie0 = serieMensual.find((s) => s.mes === mes);
            return {
              mes,
              consumo_kwh: 0,
              coste_eur: 0,
              precio_cliente_eur_kwh: null,
              precio_mercado_eur_kwh: null,
              precio_mercado_medio_raw: mktSerie0?.precio_medio_eur_kwh ?? null,
              precio_mercado_max_raw: mktSerie0?.precio_max_eur_kwh ?? null,
              delta_abs_eur_kwh: null,
              delta_pct: null,
              impacto_eur: null,
              num_puntos: 0,
            };
          }

          const clientPrice = md.consumo > 0 ? md.coste / md.consumo : 0;

          // Get raw market data for this month
          const mktSerie = serieMensual.find((s) => s.mes === mes);
          const rawMedio = mktSerie?.precio_medio_eur_kwh ?? null;
          const rawMax = mktSerie?.precio_max_eur_kwh ?? null;

          // Determine final market price
          let marketPrice: number | null = null;

          if (mode === "preview") {
            marketPrice = rawMedio;
          } else {
            // Generate mode: check for per-energy overrides
            if (isElec && overrides?.precios_mercado?.electricidad?.[mes] != null) {
              marketPrice = overrides.precios_mercado.electricidad[mes];
            } else if (!isElec && overrides?.precios_mercado?.gas?.[mes] != null) {
              marketPrice = overrides.precios_mercado.gas[mes];
            } else {
              marketPrice = rawMedio;
              // Apply favorable floor
              if (marketPrice != null && clientPrice > 0) {
                marketPrice = applyFavorableFloor(marketPrice, clientPrice, MARGEN_MINIMO);
              }
            }
          }

          const deltaAbs =
            clientPrice > 0 && marketPrice != null ? clientPrice - marketPrice : null;
          const deltaPct =
            deltaAbs != null && marketPrice != null && marketPrice > 0
              ? (deltaAbs / marketPrice) * 100
              : null;
          const impacto = deltaAbs != null ? deltaAbs * md.consumo : null;

          return {
            mes,
            consumo_kwh: md.consumo,
            coste_eur: md.coste,
            precio_cliente_eur_kwh: clientPrice > 0 ? clientPrice : null,
            precio_mercado_eur_kwh: marketPrice,
            precio_mercado_medio_raw: rawMedio,
            precio_mercado_max_raw: rawMax,
            delta_abs_eur_kwh: deltaAbs,
            delta_pct: deltaPct,
            impacto_eur: impacto,
            num_puntos: md.puntos.size,
          };
        });

        // Tarifa-level market aggregates
        const tarifaMarketPrices = mensual
          .filter((m) => m.precio_mercado_eur_kwh != null && m.consumo_kwh > 0)
          .map((m) => ({
            price: m.precio_mercado_eur_kwh!,
            consumo: m.consumo_kwh,
          }));
        const tarifaMarketWpNum = tarifaMarketPrices.reduce((s, m) => s + m.price * m.consumo, 0);
        const tarifaMarketWpDen = tarifaMarketPrices.reduce((s, m) => s + m.consumo, 0);
        const tarifaMarketAvg = tarifaMarketWpDen > 0 ? tarifaMarketWpNum / tarifaMarketWpDen : null;

        const deltaAbs =
          precioMedioCliente > 0 && tarifaMarketAvg != null
            ? precioMedioCliente - tarifaMarketAvg
            : null;
        const deltaPct =
          deltaAbs != null && tarifaMarketAvg != null && tarifaMarketAvg > 0
            ? (deltaAbs / tarifaMarketAvg) * 100
            : null;
        const impacto = deltaAbs != null ? deltaAbs * tar.consumo : null;

        tarifasArr.push({
          tarifa: tarifaKey,
          kpis: {
            consumo_total_kwh: tar.consumo,
            coste_total_eur: tar.coste,
            precio_medio_eur_kwh: precioMedioCliente > 0 ? precioMedioCliente : null,
            num_puntos: tar.puntos.size,
            num_facturas: tar.facturas,
          },
          comparativa: {
            precio_cliente_eur_kwh: precioMedioCliente > 0 ? precioMedioCliente : null,
            precio_mercado_eur_kwh: tarifaMarketAvg,
            delta_abs_eur_kwh: deltaAbs,
            delta_pct: deltaPct,
            impacto_eur: impacto,
          },
          mensual,
          extremos: getExtremos(tipoFactura, tarifaKey),
          potencias: getPotencias(tipoFactura, tarifaKey),
        });

        // Accumulate globals
        globalConsumo += tar.consumo;
        globalCoste += tar.coste;
        globalFacturas += tar.facturas;
        for (const p of tar.puntos) globalPuntos.add(p);
        if (precioMedioCliente > 0) {
          globalWpNum += precioMedioCliente * tar.consumo;
          globalWpDen += tar.consumo;
        }
        if (tarifaMarketAvg != null && tar.consumo > 0) {
          globalMarketWpNum += tarifaMarketAvg * tar.consumo;
          globalMarketWpDen += tar.consumo;
        }
      }

      energias.push({
        energia: tipo,
        mercado: {
          fuente: marketSource,
          unidad: "€/kWh",
          granularidad: "diaria",
          serie_mensual: serieMensual,
        },
        tarifas: tarifasArr,
      });
    }

    // ─── Global KPIs ───
    const precioMedioGlobal = globalWpDen > 0 ? globalWpNum / globalWpDen : null;
    const precioMercadoGlobal = globalMarketWpDen > 0 ? globalMarketWpNum / globalMarketWpDen : null;
    const deltaGlobal =
      precioMedioGlobal != null && precioMercadoGlobal != null
        ? precioMedioGlobal - precioMercadoGlobal
        : null;
    const deltaPctGlobal =
      deltaGlobal != null && precioMercadoGlobal != null && precioMercadoGlobal > 0
        ? (deltaGlobal / precioMercadoGlobal) * 100
        : null;
    const impactoGlobal = deltaGlobal != null ? deltaGlobal * globalConsumo : null;

    const numTarifas = Array.from(energiaMap.values()).reduce(
      (s, e) => s + e.tarifas.size,
      0
    );

    // ─── Build default texts ───
    
    // [MOVED HERE to avoid ReferenceError]
    // In generate mode, frontend overrides are the source of truth
    const useOverrideEnergias = mode === "generate" && overrides?.energias;
    const useOverrideKpis = mode === "generate" && overrides?.kpis_globales;
    const useOverrideComp = mode === "generate" && overrides?.comparativa_global;

    // In generate mode, energias from frontend overrides are the source of truth

    const textoOverrides = overrides?.textos || {};
    const periodoEtiqueta = `${formatDate(metadata.fecha_inicio)} – ${formatDate(metadata.fecha_fin)}`;

    const defaultTextos = {
      titulo_portada: "Informe de auditoría energética comparativa con el mercado",
      subtitulo_portada:
        textoOverrides.subtitulo_portada ||
        "Análisis de facturación del cliente versus precios de mercado mayorista",
      resumen_ejecutivo:
        textoOverrides.resumen_ejecutivo ||
        `El presente informe analiza la facturación de ${cliente.nombre} durante el periodo ${periodoEtiqueta}, comparando los precios medios ponderados de energía con los precios de referencia del mercado mayorista. Se han analizado ${globalPuntos.size} puntos de suministro en ${numTarifas} tarifas, procesando ${globalFacturas} facturas con un consumo total de ${Math.round(globalConsumo).toLocaleString("es-ES")} kWh y un coste de energía de ${globalCoste.toFixed(2)} € (sin incluir término de potencia ni impuestos).`,
      texto_metodologia:
        textoOverrides.texto_metodologia ||
        "Para la elaboración de este informe se han cruzado los datos de facturación del cliente con los precios de referencia del mercado mayorista. Para la electricidad, se ha utilizado el indicador PVPC 2.0TD de la plataforma ESIOS de Red Eléctrica de España. Para el gas natural, se ha utilizado el índice PVB medio diario de la plataforma MIBGAS. Todos los precios de mercado se han convertido de €/MWh a €/kWh para su comparación directa con los precios de facturación.",
      texto_fuentes_notas:
        textoOverrides.texto_fuentes_notas ||
        "• Los precios de mercado son valores mayoristas y no incluyen peajes, cargos ni impuestos.\n• La comparación se realiza sobre el componente de energía de la factura.\n• Las medias mensuales se calculan como media representativa de los valores diarios del periodo.",
      texto_comparativa_global: (() => {
        // If user manually edited the text, respect that
        if (textoOverrides.texto_comparativa_global) {
          if (mode !== "generate" || !useOverrideComp) {
            return textoOverrides.texto_comparativa_global;
          }
        }
        // Use the FINAL values (overrides if in generate mode, else Edge Function calculated)
        const pCliente = useOverrideKpis
          ? (overrides!.kpis_globales as any).precio_medio_eur_kwh
          : precioMedioGlobal;
        const pMercado = useOverrideComp
          ? (overrides!.comparativa_global as any).precio_mercado_medio_eur_kwh
          : precioMercadoGlobal;
        const dPct = useOverrideComp
          ? (overrides!.comparativa_global as any).delta_pct
          : deltaPctGlobal;
        const imp = useOverrideComp
          ? (overrides!.comparativa_global as any).impacto_economico_eur
          : impactoGlobal;
        return `A nivel global, el cliente ha pagado un precio medio de ${fmtNum(pCliente, 4)} €/kWh frente a un precio medio de mercado de ${fmtNum(pMercado, 4)} €/kWh, lo que representa una diferencia del ${fmtPct(dPct)}. Esto se traduce en un impacto económico estimado de ${fmtNum(imp, 2)} € en el periodo analizado.`;
      })(),
      texto_intro_electricidad:
        textoOverrides.texto_intro_electricidad || "",
      texto_intro_gas: textoOverrides.texto_intro_gas || "",
      texto_extremos:
        textoOverrides.texto_extremos ||
        "A continuación se detallan los puntos de suministro con mayor y menor consumo y coste por tarifa.",
      texto_limitaciones:
        textoOverrides.texto_limitaciones || "",
      desviaciones_texto:
        textoOverrides.desviaciones_texto ||
        "No se han identificado desviaciones significativas en los datos de mercado durante el periodo.",
      conclusion_final: (() => {
        // Same logic as texto_comparativa_global: in generate mode with overrides,
        // regenerate from override values to keep conclusion consistent with KPIs/section 3.
        if (textoOverrides.conclusion_final) {
          if (mode !== "generate" || !useOverrideComp) {
            return textoOverrides.conclusion_final;
          }
        }
        const dPct = useOverrideComp
          ? (overrides!.comparativa_global as any).delta_pct
          : deltaPctGlobal;
        const imp = useOverrideComp
          ? (overrides!.comparativa_global as any).impacto_economico_eur
          : impactoGlobal;
        return `El análisis revela que ${cliente.nombre} paga, en promedio, un ${fmtPct(dPct)} respecto al precio de referencia del mercado mayorista, con un impacto económico estimado de ${fmtNum(imp, 2)} € en el periodo analizado.`;
      })(),
    };

    // ─── Build final microservice payload ───

    const recomendaciones = overrides?.recomendaciones || { habilitada: false, texto: "" };
    const informeId = crypto.randomUUID();

    const microservicePayload = {
      meta: {
        id_informe: informeId,
        idioma: "es-ES",
        fecha_generacion: new Date().toISOString().split("T")[0],
        zona_horaria: "Europe/Madrid",
        version_plantilla: "1.0.0",
        marca: { color_principal_hex: "#10B981", ruta_logo: null },
        tipo_informe: "comparativa_mercado",
      },
      cliente: {
        nombre: cliente.nombre,
        identificador_fiscal: cifDescifrado || "",
      },
      periodo: {
        fecha_inicio: metadata.fecha_inicio,
        fecha_fin: metadata.fecha_fin,
        etiqueta: periodoEtiqueta,
      },
      kpis_globales: useOverrideKpis ? overrides!.kpis_globales : {
        consumo_total_kwh: globalConsumo,
        coste_total_eur: globalCoste,
        precio_medio_eur_kwh: precioMedioGlobal,
        num_tarifas: numTarifas,
        num_puntos: globalPuntos.size,
        num_facturas: globalFacturas,
      },
      comparativa_global: useOverrideComp ? overrides!.comparativa_global : {
        precio_mercado_medio_eur_kwh: precioMercadoGlobal,
        delta_abs_eur_kwh: deltaGlobal,
        delta_pct: deltaPctGlobal,
        impacto_economico_eur: impactoGlobal,
      },
      energias: useOverrideEnergias ? overrides!.energias : energias,
      textos: defaultTextos,
      recomendaciones,
      parametros_config: {
        electricidad_market_source: {
          indicator_id: ELEC_INDICATOR_ID,
          geo_id: ELEC_GEO_ID,
          fuente: "ESIOS PVPC 2.0TD",
        },
        gas_market_source: {
          dataset: "mibgas_indexes_daily",
          campo: "pvb_avg_eur_mwh",
          fuente: "MIBGAS PVB",
        },
        margen_minimo: MARGEN_MINIMO,
      },
    };

    // ─── MODE: PREVIEW — return JSON only (no DOCX generation) ───
    if (mode === "preview") {
      console.log("[COMP] Preview mode — returning calculated_data only");
      return new Response(
        JSON.stringify({
          success: true,
          mode: "preview",
          calculated_data: microservicePayload,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ─── MODE: GENERATE — call Cloud Run, return DOCX binary ───
    const storagePath = generateStoragePath(informeId);
    let docxBuffer: ArrayBuffer;

    if (!CLOUD_RUN_COMPARATIVA_URL) {
      return new Response(
        JSON.stringify({
          error: "CLOUD_RUN_COMPARATIVA_URL no configurado. No se puede generar el DOCX.",
          calculated_data: microservicePayload,
        }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!INTERNAL_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "INTERNAL_API_TOKEN no configurado" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log("[COMP] Calling Cloud Run:", CLOUD_RUN_COMPARATIVA_URL);

    const upstream = await fetch(`${CLOUD_RUN_COMPARATIVA_URL}/generar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": INTERNAL_API_TOKEN,
      },
      body: JSON.stringify(microservicePayload),
    });

    if (!upstream.ok) {
      const errTxt = await upstream.text();
      console.error("[COMP] Microservice error:", errTxt);
      return new Response(
        JSON.stringify({
          error: "Error generando DOCX",
          upstream_status: upstream.status,
          details: errTxt,
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    docxBuffer = await upstream.arrayBuffer();

    // 9) Upload to Storage (BLOCKING)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("informes-mercado")
      .upload(storagePath, docxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[COMP] Storage upload error:", uploadErr);
    } else {
      console.log("[COMP] DOCX archived in storage:", storagePath);
    }

    // 10) Create DB record (non-blocking)
    supabaseAdmin
      .from("informes_mercado")
      .insert({
        id: informeId,
        titulo: metadata.titulo,
        tipo_informe: "mercado",
        fecha_inicio: metadata.fecha_inicio,
        fecha_fin: metadata.fecha_fin,
        cliente_id: metadata.cliente_id,
        parametros_config: microservicePayload,
        ruta_storage: storagePath,
        creado_por: user.id,
        estado: "completado",
      })
      .then(({ error: insertErr }) => {
        if (insertErr) console.error("[COMP] DB insert error (non-fatal):", insertErr);
      });

    if (metadata.punto_ids?.length > 0) {
      supabaseAdmin
        .from("informes_targets")
        .insert(metadata.punto_ids.map((pid) => ({ informe_id: informeId, punto_id: pid })))
        .then(({ error: targetErr }) => {
          if (targetErr) console.error("[COMP] Targets insert error (non-fatal):", targetErr);
        });
    }

    // 11) Return DOCX binary directly
    const filename = `informe_comparativa_${metadata.titulo.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Informe-Id": informeId,
      },
    });
  } catch (e) {
    console.error("[COMP] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", details: String(e) }),
      { status: 500, headers: { ...corsHeaders(req.headers.get("Origin"), req), "Content-Type": "application/json" } }
    );
  }
});