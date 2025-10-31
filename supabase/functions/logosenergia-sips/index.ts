// supabase/functions/logosenergia-sips/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CRM_BASE_URL = Deno.env.get("CRM_BASE_URL") ?? "https://jaeva.logosenergia.wolfcrm.es";
const CRM_USER = Deno.env.get("CRM_USER");
const CRM_PASS = Deno.env.get("CRM_PASS");


// util para asegurarnos de que siempre hay barra
function urlJoin(base: string, path: string) {
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (!path.startsWith("/")) path = "/" + path;
  return base + path;
}

// CookieJar (sin cambios)
class CookieJar {
  private jar = new Map<string, string>();
  mergeFrom(res: Response) {
    this.mergeFromHeaders(res.headers as any);
  }
  mergeFromHeaders(headers: Headers & { getSetCookie?: () => string[] }) {
    let cookieList: string[] = [];
    if (typeof headers.getSetCookie === "function") {
      cookieList = headers.getSetCookie();
    } else {
      const raw = headers.get("set-cookie");
      if (raw) {
        cookieList = raw.split(/,(?=[^ ;]+=)/);
      }
    }
    for (const rawCookie of cookieList) {
      const item = rawCookie.split(";")[0].trim();
      const eq = item.indexOf("=");
      if (eq === -1) continue;
      const name = item.slice(0, eq);
      const value = item.slice(eq + 1);
      this.jar.set(name, value);
    }
  }
  toHeader(): string {
    return Array.from(this.jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}


// helpers de parseo (sin cambios)
function extractCsrfFromJs(js: string) {
  const mKey = js.match(/CSRFTokenKey:\s*"([^"]+)"/);
  const mValue = js.match(/CSRFToken:\s*"([^"]+)"/);
  const mStr = js.match(/CSRFTokenString:\s*"([^"]+)"/);
  return {
    csrfKey: mKey ? mKey[1] : "",
    csrfValue: mValue ? mValue[1] : "",
    csrfString: mStr ? mStr[1] : "",
    raw: js,
  };
}
function getTableHtml(html: string, headingText: string): string | null {
  const panelIdx = html.indexOf(`>${headingText}</div>`);
  if (panelIdx === -1) return null;
  const tableStart = html.indexOf("<table", panelIdx);
  if (tableStart === -1) return null;
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd === -1) return null;
  return html.slice(tableStart, tableEnd + "</table>".length);
}
function parseKeyValueTable(tableHtml: string): Record<string, string> {
  const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const out: Record<string, string> = {};
  for (const r of rows) {
    const tds = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (tds.length >= 2) {
      const key = tds[0][1].replace(/<[^>]+>/g, "").trim();
      const val = tds[1][1].replace(/<[^>]+>/g, "").trim();
      if (key) out[key] = val;
    }
  }
  return out;
}

// (Sin cambios) Parseo para Consumo Anual ('.' = miles)
function parseConsumoTable(tableHtml: string): Record<string, number> {
  const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const consumos: Record<string, number> = {};
  for (const r of rows) {
    const tds = [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)];
    if (tds.length === 2) {
      const periodo = tds[0][1].replace(/<[^>]+>/g, "").trim();
      const valor = tds[1][1].replace(/<[^>]+>/g, "").trim();
      if (!periodo) continue;
      // "1.162" -> 1162 (Correcto)
      const num = Number(valor.replace(/\./g, "").replace(",", "."));
      if (periodo === "Total") {
        consumos["Total"] = num;
      } else {
        consumos[periodo] = num;
      }
    }
  }
  return consumos;
}

// --- (INICIO) MODIFICACIÓN: Dos funciones de parseo ---

/**
 * Parsea tablas de lectura (Activa, Reactiva) donde '.' es separador de MILES.
 * (ej: "13.857" -> 13857)
 */
function parseLecturasTable_Thousands(tableHtml: string) {
  const bodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!bodyMatch) return [];
  const bodyHtml = bodyMatch[1];
  const rows = [...bodyHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const lecturas: any[] = [];
  for (const r of rows) {
    const tds = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (tds.length >= 2) {
      const fecha = tds[0][1].replace(/<[^>]+>/g, "").trim();
      const tipo = tds[1][1].replace(/<[^>]+>/g, "").trim();
      const p: number[] = [];
      for (let i = 2; i < tds.length; i++) {
        let v = tds[i][1].replace(/<[^>]+>/g, "").trim();
        // --- LÓGICA: '.' es miles ---
        const num = v ? Number(v.replace(/\./g, "").replace(",", ".")) : 0;
        p.push(num);
      }
      lecturas.push({
        fecha, tipo,
        P1: p[0] ?? null, P2: p[1] ?? null, P3: p[2] ?? null,
        P4: p[3] ?? null, P5: p[4] ?? null, P6: p[5] ?? null,
      });
    }
  }
  return lecturas;
}

/**
 * Parsea tablas de lectura (Maxímetro) donde '.' es separador DECIMAL.
 * (ej: "4.844" -> 4.844, "140" -> 140)
 */
function parseLecturasTable_Decimals(tableHtml: string) {
    const bodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
    if (!bodyMatch) return [];
    const bodyHtml = bodyMatch[1];
    const rows = [...bodyHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    const lecturas: any[] = [];
    for (const r of rows) {
      const tds = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      if (tds.length >= 2) {
        const fecha = tds[0][1].replace(/<[^>]+>/g, "").trim();
        const tipo = tds[1][1].replace(/<[^>]+>/g, "").trim();
        const p: number[] = [];
        for (let i = 2; i < tds.length; i++) {
          let v = tds[i][1].replace(/<[^>]+>/g, "").trim();
          
          // --- LÓGICA: '.' es decimal ---
          // Quitamos comas (miles, si las hubiera) y dejamos el punto.
          // "4.844" -> "4.844" -> 4.844
          // "140" -> "140" -> 140
          // "1.234,56" (formato ES) -> "1234.56" -> 1234.56
          const num = v ? Number(v.replace(/,/g, "")) : 0; // Se simplifica, asumiendo que no hay ',' y '.' a la vez
          
          p.push(num);
        }
        lecturas.push({
          fecha, tipo,
          P1: p[0] ?? null, P2: p[1] ?? null, P3: p[2] ?? null,
          P4: p[3] ?? null, P5: p[4] ?? null, P6: p[5] ?? null,
        });
      }
    }
    return lecturas;
  }

// --- (FIN) MODIFICACIÓN ---


// --- (INICIO) Helpers de Agregación (con filtro de 12 meses) ---

function parseDMY(dateStr: string): Date {
  const parts = dateStr.split('/');
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function formatMMYY(date: Date): string {
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString().slice(-2);
  return `${m}/${y}`;
}

/**
 * Agrega lecturas por mes ("MM/YY") y suma duplicados,
 * DENTRO DE UNA VENTANA DE 12 MESES desde la lectura más reciente.
 */
function aggregateReadings(readings: any[]): Record<string, Record<string, number>> {
  if (!readings || readings.length === 0) {
    return {};
  }

  const sortedReadings = readings.sort((a, b) => parseDMY(b.fecha).getTime() - parseDMY(a.fecha).getTime());

  const mostRecentDate = parseDMY(sortedReadings[0].fecha);
  
  // --- LÓGICA DE 12 MESES (Corregida en v2) ---
  // Fecha de corte: 11 meses antes del primer día del mes más reciente.
  // Ej: Si la más reciente es (Julio) 15/07/25 (Mes 6).
  // getMonth() - 11 = 6 - 11 = -5.
  // new Date(2025, -5, 1) = 01/08/24. (Correcto, incluye 12 meses: 08/24 a 07/25)
  const cutoffDate = new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth() - 11, 1);
  cutoffDate.setHours(0, 0, 0, 0);

  const aggregation: Record<string, Record<string, number>> = {};

  for (const reading of sortedReadings) {
    const currentDate = parseDMY(reading.fecha);

    // Si la lectura es anterior a nuestra fecha de corte (ej: 31/07/24), parar.
    if (currentDate < cutoffDate) {
      break;
    }

    const monthKey = formatMMYY(currentDate); // "MM/YY"

    if (!aggregation[monthKey]) {
      aggregation[monthKey] = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    }

    for (let i = 1; i <= 6; i++) {
      const pValue = Number(reading[`P${i}`]) || 0;
      if (pValue) {
          aggregation[monthKey][`P${i}`] += pValue;
      }
    }
  }
  
  return aggregation;
}

// --- (FIN) Helpers de Agregación ---

serve(async (req) => {
  // CORS (sin cambios)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { cups } = await req.json();
    if (!cups || typeof cups !== "string") {
      return new Response(JSON.stringify({ error: "cups requerido" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    if (!CRM_USER || !CRM_PASS) {
      return new Response(
        JSON.stringify({ error: "Faltan credenciales CRM (CRM_USER, CRM_PASS) en las variables de entorno de la Edge Function." }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
      );
    }
    
    // Proceso de Login (Pasos 1-5, sin cambios)
    const jar = new CookieJar();
    const resLanding = await fetch(CRM_BASE_URL, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "es-ES" } });
    jar.mergeFrom(resLanding);
    const resCfg = await fetch(urlJoin(CRM_BASE_URL, "/application/jsConfig.php?template=/js/config.js"), { headers: { Cookie: jar.toHeader(), Referer: CRM_BASE_URL + "/", "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "es-ES" } });
    jar.mergeFrom(resCfg);
    const cfgText = await resCfg.text();
    const csrfPre = extractCsrfFromJs(cfgText);
    const bodyLogin = `${csrfPre.csrfString}&cmd=login&userLogin=${encodeURIComponent(CRM_USER)}` + `&userPassword=${encodeURIComponent(CRM_PASS)}&keepAlive=on`;
    const resLogin = await fetch(urlJoin(CRM_BASE_URL, "/"), {
      method: "POST",
      headers: { Cookie: jar.toHeader(), Origin: CRM_BASE_URL, Referer: CRM_BASE_URL + "/", "User-Agent": "Mozilla/5.0", Accept: "text/html", "Accept-Language": "es-ES", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: bodyLogin, redirect: "manual"
    });
    jar.mergeFromHeaders(resLogin.headers);
    const location = resLogin.headers.get("location") ?? resLogin.headers.get("Location") ?? "/";
    const resInside = await fetch(location.startsWith("http") ? location : urlJoin(CRM_BASE_URL, location), { method: "GET", headers: { Cookie: jar.toHeader(), "User-Agent": "Mozilla/5.0" } });
    jar.mergeFromHeaders(resInside.headers);
    const resCfgLogged = await fetch(urlJoin(CRM_BASE_URL, "/application/jsConfig.php?template=/js/config.js"), { method: "GET", headers: { Cookie: jar.toHeader(), Referer: urlJoin(CRM_BASE_URL, "/"), "User-Agent": "Mozilla/5.0" } });
    jar.mergeFromHeaders(resCfgLogged.headers);
    const cfgLoggedText = await resCfgLogged.text();
    const csrfLogged = extractCsrfFromJs(cfgLoggedText);

    //
    // 6) llamar al SIPS (sin cambios)
    //
    const sipsUrl =
      urlJoin(CRM_BASE_URL, "/custom/logosenergia/sips/index.php") +
      `?cmd=search&Q_SUPPLY=Electricidad&Q_CUPS=${encodeURIComponent(cups)}` +
      `&LECTURAS_MEDIDAS=1&${csrfLogged.csrfString}`;

    const resSips = await fetch(sipsUrl, {
      method: "GET",
      headers: { Cookie: jar.toHeader(), Referer: urlJoin(CRM_BASE_URL, "/custom/logosenergia/sips/?cmd=t&") + csrfLogged.csrfString, "User-Agent": "Mozilla/5.0" },
    });
    const htmlSips = await resSips.text();

    //
    // 7) PARSEAR (¡MODIFICADO!)
    //
    const datosSuministroHtml = getTableHtml(htmlSips, "Datos suministro");
    const datosSuministro = datosSuministroHtml
      ? parseKeyValueTable(datosSuministroHtml)
      : {};

    const consumoHtml = getTableHtml(htmlSips, "Consumo (kWh)");
    const consumo = consumoHtml ? parseConsumoTable(consumoHtml) : {}; // ('.' = miles)

    // --- (INICIO) MODIFICACIÓN: Llamadas a parsers específicos ---
    const lecturasActivaHtml = getTableHtml(
      htmlSips,
      "Lecturas de activa (últimas 20)",
    );
    // Usamos el parser de MILES para Activa
    const lecturasActiva = lecturasActivaHtml
      ? parseLecturasTable_Thousands(lecturasActivaHtml)
      : [];

    const lecturasReactivaHtml = getTableHtml(
      htmlSips,
      "Lecturas de reactiva (últimas 20)",
    );
    // Usamos el parser de MILES para Reactiva
    const lecturasReactiva = lecturasReactivaHtml
      ? parseLecturasTable_Thousands(lecturasReactivaHtml)
      : [];

    const lecturasMaximetroHtml = getTableHtml(
      htmlSips,
      "Lecturas de maxímetro (últimas 20)",
    );
    // Usamos el parser de DECIMALES para Maxímetro
    const lecturasMaximetro = lecturasMaximetroHtml
      ? parseLecturasTable_Decimals(lecturasMaximetroHtml)
      : [];
    // --- (FIN) MODIFICACIÓN ---

    const cupsMatch = htmlSips.match(/name="Q_CUPS"[^>]*value="([^"]+)"/);
    const cupsDevuelto = cupsMatch ? cupsMatch[1] : null;

    // --- (INICIO) LÓGICA DE TRANSFORMACIÓN (SIN CAMBIOS) ---
    
    // Comprobar si hay datos
    const isLoginPage =
        htmlSips.includes("name=\"userLogin\"") ||
        htmlSips.includes("cmd=login") ||
        htmlSips.includes("Iniciar sesión");
    
    if (!Object.keys(datosSuministro).length) {
      return new Response(JSON.stringify({
          ok: false,
          reason: "No se han encontrado datos para ese CUPS, o la sesión de login ha fallado.",
          debug: { /* ... debug info ... */ },
      }), {
          status: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 1. Extraer datos simples
    const CUPS = cupsDevuelto || datosSuministro.CUPS || cups;
    const tarifa = datosSuministro.Tarifa;

    // 2. Parsear Potencias Contratadas
    const PotContratada = {};
    for (let i = 1; i <= 6; i++) {
      PotContratada[`P${i}`] = parseFloat(datosSuministro[`Pot Cont P${i}`] || '0');
    }

    // 3. Parsear Consumo Anual
    const ConsumoAnual = { ...consumo };
    delete ConsumoAnual["Total"];

    // 4. Parsear Consumo Mensual (Agregado y filtrado a 12 meses)
    const ConsumoMensual = aggregateReadings(lecturasActiva);

    // 5. Parsear Potencia Consumida (Agregado y filtrado a 12 meses)
    const PotenciaConsumida = aggregateReadings(lecturasMaximetro);

    // 6. Construir el objeto final
    const finalResult = [{
      CUPS: CUPS,
      Tarifa: tarifa,
      PotContratada: PotContratada,
      ConsumoAnual: ConsumoAnual,
      ConsumoMensual: ConsumoMensual,
      PotenciaConsumida: PotenciaConsumida
    }];
    
    // --- (FIN) LÓGICA DE TRANSFORMACIÓN ---

    // Devolver el nuevo resultado transformado
    return new Response(JSON.stringify(finalResult), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});