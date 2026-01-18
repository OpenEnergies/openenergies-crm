// @ts-nocheck
// supabase/functions/export-data/index.ts
// Edge Function: Genera archivos CSV respetando RLS

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// CORS headers
function corsHeaders(origin: string | null, req: Request) {
    const reqHeaders = req.headers.get("Access-Control-Request-Headers");
    return {
        "Access-Control-Allow-Origin": origin ?? "*",
        "Vary": "Origin, Access-Control-Request-Headers",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": reqHeaders ?? "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
    };
}

// CSV helper - properly escapes values
function escapeCSV(value: any): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // If contains semicolon, newline, or quote, wrap in quotes and escape existing quotes
    if (str.includes(";") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function arrayToCSV(headers: string[], rows: any[][]): string {
    const headerRow = headers.map(escapeCSV).join(";");
    const dataRows = rows.map(row => row.map(escapeCSV).join(";"));
    return [headerRow, ...dataRows].join("\n");
}

// Entity configurations with Spanish column names
const ENTITY_CONFIG: Record<string, {
    table: string;
    select: string;
    columns: { key: string; label: string; transform?: (v: any, row: any) => any }[];
    defaultSort?: { column: string; ascending: boolean };
}> = {
    clientes: {
        table: "clientes",
        select: "id, nombre, dni, cif, email, telefonos, tipo, numero_cuenta, representante, creado_en, puntos_suministro(id, consumo_anual_kwh)",
        columns: [
            { key: "nombre", label: "Nombre" },
            { key: "dni", label: "DNI" },
            { key: "cif", label: "CIF" },
            { key: "tipo", label: "Tipo Cliente" },
            { key: "numero_cuenta", label: "No Cuenta" },
            { key: "representante", label: "Representante" },
            { key: "email", label: "Email" },
            { key: "telefonos", label: "Telefonos" },
            { key: "creado_en", label: "Fecha Creacion", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "puntos_count", label: "Num Puntos", transform: (_, row) => row.puntos_suministro?.length ?? 0 },
            { key: "total_kwh", label: "kWh Total", transform: (_, row) => row.puntos_suministro?.reduce((acc: number, p: any) => acc + (Number(p.consumo_anual_kwh) || 0), 0) ?? 0 },
        ],
        defaultSort: { column: "creado_en", ascending: false },
    },
    puntos_suministro: {
        table: "puntos_suministro",
        select: "id, cups, direccion_sum, localidad_sum, provincia_sum, tarifa, consumo_anual_kwh, p1_kw, p2_kw, p3_kw, p4_kw, p5_kw, p6_kw, clientes(nombre), current_comercializadora_id, comercializadoras:empresas!current_comercializadora_id(nombre)",
        columns: [
            { key: "cups", label: "CUPS" },
            { key: "cliente_nombre", label: "Cliente", transform: (_, row) => row.clientes?.nombre ?? "" },
            { key: "direccion_sum", label: "Direccion" },
            { key: "localidad_sum", label: "Localidad" },
            { key: "provincia_sum", label: "Provincia" },
            { key: "tarifa", label: "Tarifa" },
            { key: "consumo_anual_kwh", label: "Consumo Anual (kWh)" },
            { key: "p1_kw", label: "P1 (kW)" },
            { key: "p2_kw", label: "P2 (kW)" },
            { key: "p3_kw", label: "P3 (kW)" },
            { key: "comercializadora_nombre", label: "Comercializadora", transform: (_, row) => row.comercializadoras?.nombre ?? "" },
        ],
        defaultSort: { column: "cups", ascending: true },
    },
    contratos: {
        table: "contratos",
        select: "id, estado, fotovoltaica, cobrado, fecha_firma, fecha_renovacion, observaciones, puntos_suministro(cups, clientes(nombre)), comercializadoras:empresas!contratos_comercializadora_id_fkey(nombre), canales(nombre)",
        columns: [
            { key: "cups", label: "CUPS", transform: (_, row) => row.puntos_suministro?.cups ?? "" },
            { key: "cliente_nombre", label: "Cliente", transform: (_, row) => row.puntos_suministro?.clientes?.nombre ?? "" },
            { key: "comercializadora_nombre", label: "Comercializadora", transform: (_, row) => row.comercializadoras?.nombre ?? "" },
            { key: "canal_nombre", label: "Canal", transform: (_, row) => row.canales?.nombre ?? "" },
            { key: "estado", label: "Estado" },
            { key: "fotovoltaica", label: "Fotovoltaica" },
            { key: "cobrado", label: "Cobrado", transform: (v) => v ? "Si" : "No" },
            { key: "fecha_firma", label: "Fecha Firma", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "fecha_renovacion", label: "Fecha Renovacion", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "observaciones", label: "Observaciones" },
        ],
        defaultSort: { column: "fecha_firma", ascending: false },
    },
    facturas: {
        table: "facturacion_clientes",
        select: "id, numero_factura, tipo_factura, fecha_emision, fecha_inicio, fecha_fin, consumo_kwh, precio_eur_kwh, total, potencia_kw_min, potencia_kw_max, observaciones, puntos_suministro(cups, clientes(nombre)), comercializadora:empresas!comercializadora_id(nombre)",
        columns: [
            { key: "numero_factura", label: "Num Factura" },
            { key: "cups", label: "CUPS", transform: (_, row) => row.puntos_suministro?.cups ?? "" },
            { key: "cliente_nombre", label: "Cliente", transform: (_, row) => row.puntos_suministro?.clientes?.nombre ?? "" },
            { key: "comercializadora_nombre", label: "Comercializadora", transform: (_, row) => row.comercializadora?.nombre ?? "" },
            { key: "tipo_factura", label: "Tipo" },
            { key: "fecha_emision", label: "Fecha Emision", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "fecha_inicio", label: "Fecha Inicio", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "fecha_fin", label: "Fecha Fin", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
            { key: "consumo_kwh", label: "Consumo (kWh)" },
            { key: "precio_eur_kwh", label: "Precio (EUR/kWh)" },
            { key: "total", label: "Total (EUR)" },
            { key: "potencia_kw_min", label: "Pot. Min (kW)" },
            { key: "potencia_kw_max", label: "Pot. Max (kW)" },
        ],
        defaultSort: { column: "fecha_emision", ascending: false },
    },
    renovaciones: {
        table: "contratos",
        select: "id, estado, fecha_renovacion, puntos_suministro(cups, clientes(nombre)), comercializadoras:empresas!contratos_comercializadora_id_fkey(nombre)",
        columns: [
            { key: "cups", label: "CUPS", transform: (_, row) => row.puntos_suministro?.cups ?? "" },
            { key: "cliente_nombre", label: "Cliente", transform: (_, row) => row.puntos_suministro?.clientes?.nombre ?? "" },
            { key: "comercializadora_nombre", label: "Comercializadora", transform: (_, row) => row.comercializadoras?.nombre ?? "" },
            { key: "estado", label: "Estado" },
            { key: "fecha_renovacion", label: "Fecha Renovacion", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
        ],
        defaultSort: { column: "fecha_renovacion", ascending: true },
    },
    usuarios_app: {
        table: "usuarios_app",
        select: "user_id, nombre, apellidos, email, rol, activo, creado_en, empresas(nombre)",
        columns: [
            { key: "nombre_completo", label: "Nombre", transform: (_, row) => `${row.nombre ?? ""} ${row.apellidos ?? ""}`.trim() },
            { key: "email", label: "Email" },
            { key: "rol", label: "Rol" },
            { key: "empresa_nombre", label: "Empresa", transform: (_, row) => row.empresas?.nombre ?? "" },
            { key: "activo", label: "Estado", transform: (v) => v ? "Activo" : "Bloqueado" },
            { key: "creado_en", label: "Fecha Creacion", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
        ],
        defaultSort: { column: "creado_en", ascending: false },
    },
    empresas: {
        table: "empresas",
        select: "id, nombre, cif, tipo, creada_en",
        columns: [
            { key: "nombre", label: "Nombre" },
            { key: "cif", label: "CIF" },
            { key: "tipo", label: "Tipo" },
            { key: "creada_en", label: "Fecha Creacion", transform: (v) => v ? new Date(v).toLocaleDateString("es-ES") : "" },
        ],
        defaultSort: { column: "nombre", ascending: true },
    },
};

serve(async (req) => {
    const origin = req.headers.get("Origin");
    const CORS = corsHeaders(origin, req);

    // Preflight
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
        const body = await req.json();
        const { entity, filters = {} } = body;

        // Validate entity
        const config = ENTITY_CONFIG[entity];
        if (!config) {
            return new Response(JSON.stringify({ error: `Invalid entity: ${entity}` }), {
                status: 400,
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        // Create Supabase client with user JWT (respects RLS)
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: { Authorization: req.headers.get("Authorization") ?? "" },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        // Build query
        let query = supabase
            .from(config.table)
            .select(config.select)
            .is("eliminado_en", null);

        // Apply filters
        if (filters.search) {
            if (entity === "clientes") {
                query = query.or(`nombre.ilike.%${filters.search}%,dni.ilike.%${filters.search}%,cif.ilike.%${filters.search}%`);
            } else if (entity === "puntos_suministro") {
                query = query.or(`cups.ilike.%${filters.search}%,direccion_sum.ilike.%${filters.search}%`);
            }
        }

        if (filters.cliente_id) {
            if (entity === "puntos_suministro" || entity === "facturas" || entity === "contratos" || entity === "renovaciones") {
                query = query.eq("cliente_id", filters.cliente_id);
            }
        }

        if (filters.empresa_id || filters.comercializadora_id) {
            const empId = filters.empresa_id || filters.comercializadora_id;
            if (entity === "puntos_suministro") {
                query = query.eq("current_comercializadora_id", empId);
            } else if (entity === "contratos" || entity === "renovaciones" || entity === "facturas") {
                query = query.eq("comercializadora_id", empId);
            }
        }

        if (filters.estado && Array.isArray(filters.estado) && filters.estado.length > 0) {
            query = query.in("estado", filters.estado);
        }

        if (filters.fotovoltaica && Array.isArray(filters.fotovoltaica) && filters.fotovoltaica.length > 0) {
            query = query.in("fotovoltaica", filters.fotovoltaica);
        }

        if (filters.cobrado && Array.isArray(filters.cobrado) && filters.cobrado.length > 0) {
            const cobradoValues = filters.cobrado.map((v: string) => v === "true");
            query = query.in("cobrado", cobradoValues);
        }

        if (filters.rol && Array.isArray(filters.rol) && filters.rol.length > 0) {
            query = query.in("rol", filters.rol);
        }

        if (filters.fecha_desde) {
            query = query.gte(entity === "facturas" ? "fecha_emision" : "fecha_renovacion", filters.fecha_desde);
        }

        if (filters.fecha_hasta) {
            query = query.lte(entity === "facturas" ? "fecha_emision" : "fecha_renovacion", filters.fecha_hasta);
        }

        if (filters.is_archived !== undefined) {
            if (filters.is_archived) {
                query = query.eq("is_archived", true);
            } else {
                query = query.or("is_archived.is.null,is_archived.eq.false");
            }
        }

        // Apply default sort
        if (config.defaultSort) {
            query = query.order(config.defaultSort.column, { ascending: config.defaultSort.ascending });
        }

        // Execute query
        const { data, error } = await query;

        if (error) {
            console.error("Query error detailed:", JSON.stringify(error));
            return new Response(JSON.stringify({ error: `Query failed: ${error.message} - Hint: ${error.hint || 'none'} - Details: ${error.details || 'none'}` }), {
                status: 500,
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        if (!data || data.length === 0) {
            return new Response(JSON.stringify({ error: "No hay datos para exportar" }), {
                status: 404,
                headers: { ...CORS, "Content-Type": "application/json" },
            });
        }

        // Transform data for CSV
        const headers = config.columns.map(col => col.label);
        const rows = data.map((row: any) => {
            return config.columns.map(col => {
                const value = col.transform
                    ? col.transform(row[col.key], row)
                    : row[col.key];
                return value ?? "";
            });
        });

        // Generate CSV with UTF-8 BOM for Excel compatibility
        const csvContent = arrayToCSV(headers, rows);
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const csvBytes = new TextEncoder().encode(csvContent);
        const finalContent = new Uint8Array(bom.length + csvBytes.length);
        finalContent.set(bom, 0);
        finalContent.set(csvBytes, bom.length);

        // Return CSV file
        const filename = `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;
        return new Response(finalContent, {
            status: 200,
            headers: {
                ...CORS,
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (e) {
        console.error("Export error:", e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }
});
