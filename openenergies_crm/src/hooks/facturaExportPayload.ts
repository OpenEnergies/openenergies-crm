import { format, parseISO } from 'date-fns';
import { supabase } from '@lib/supabase';

type ExportRow = Record<string, unknown>;

type ScopeLikeFilters = {
  cliente_id?: string | null;
  comercializadoras?: string[];
  punto_ids?: string[];
};

function getString(row: ExportRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getStringFromAnyKey(row: ExportRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = getString(row, key);
    if (value) return value;
  }
  return null;
}

function getFacturaId(row: ExportRow): string | null {
  return getStringFromAnyKey(row, ['factura_id', 'id', 'FACTURA_ID', 'ID']);
}

function getNumeroFactura(row: ExportRow): string | null {
  return getStringFromAnyKey(row, ['numero_factura', 'NUMERO FACTURA', 'NUMERO_FACTURA']);
}

function getFechaEmision(row: ExportRow): string | null {
  const value = getStringFromAnyKey(row, ['fecha_emision', 'FECHA EMISION', 'FECHA_EMISION']);
  if (!value) return null;
  return value.slice(0, 10);
}

function normalizeCups(value: string): string {
  return value.trim().toUpperCase();
}

type FacturaPeriodoDbRow = {
  id: string;
  numero_factura: string | null;
  fecha_emision: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
};

function formatToMonthYY(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), 'MM/yy');
  } catch {
    if (value.length >= 7) {
      return `${value.slice(5, 7)}/${value.slice(2, 4)}`;
    }
    return value;
  }
}

async function fetchFacturacionPeriodosByFacturaId(facturaIds: string[]): Promise<Record<string, { periodo_inicio: string | null; periodo_fin: string | null }>> {
  if (facturaIds.length === 0) return {};

  const { data, error } = await supabase
    .from('facturacion_clientes')
    .select('id, numero_factura, fecha_emision, periodo_inicio, periodo_fin')
    .in('id', facturaIds)
    .is('eliminado_en', null)
    .range(0, 99999);

  if (error) throw error;

  const rows = (data || []) as FacturaPeriodoDbRow[];
  const map: Record<string, { periodo_inicio: string | null; periodo_fin: string | null }> = {};

  rows.forEach((row) => {
    map[row.id] = {
      periodo_inicio: row.periodo_inicio,
      periodo_fin: row.periodo_fin,
    };
  });

  return map;
}

async function fetchFacturacionPeriodosByNumeroFactura(numeroFacturas: string[]): Promise<Record<string, FacturaPeriodoDbRow[]>> {
  if (numeroFacturas.length === 0) return {};

  const { data, error } = await supabase
    .from('facturacion_clientes')
    .select('id, numero_factura, fecha_emision, periodo_inicio, periodo_fin')
    .in('numero_factura', numeroFacturas)
    .is('eliminado_en', null)
    .range(0, 99999);

  if (error) throw error;

  const rows = (data || []) as FacturaPeriodoDbRow[];
  const map: Record<string, FacturaPeriodoDbRow[]> = {};

  rows.forEach((row) => {
    const key = row.numero_factura || '';
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });

  return map;
}

export async function filterExportRowsByScope<T extends ExportRow>(rows: T[], filters: ScopeLikeFilters): Promise<T[]> {
  const puntoIds = new Set((filters.punto_ids || []).filter(Boolean));
  const comercializadoras = new Set((filters.comercializadoras || []).filter(Boolean));

  let puntoIdsFromDb = new Set<string>();
  let cupsFromDb = new Set<string>();

  if (puntoIds.size > 0) {
    const { data, error } = await supabase
      .from('puntos_suministro')
      .select('id, cups')
      .in('id', [...puntoIds])
      .is('eliminado_en', null)
      .range(0, 99999);

    if (error) throw error;

    (data || []).forEach((row: { id: string; cups: string | null }) => {
      if (row.id) puntoIdsFromDb.add(row.id);
      if (row.cups) cupsFromDb.add(normalizeCups(row.cups));
    });
  }

  return rows.filter((row) => {
    if (filters.cliente_id) {
      const rowClienteId = getStringFromAnyKey(row, ['cliente_id', 'CLIENTE_ID']);
      if (rowClienteId && rowClienteId !== filters.cliente_id) return false;
    }

    if (comercializadoras.size > 0) {
      const rowComercializadoraId = getString(row, 'comercializadora_id');
      if (rowComercializadoraId && !comercializadoras.has(rowComercializadoraId)) return false;
    }

    if (puntoIds.size > 0) {
      const rowPuntoId = getStringFromAnyKey(row, ['punto_id', 'PUNTO_ID', 'PUNTO ID']);
      if (rowPuntoId) {
        if (!puntoIdsFromDb.has(rowPuntoId) && !puntoIds.has(rowPuntoId)) return false;
      } else {
        const rowCups = getStringFromAnyKey(row, ['cups', 'CUPS']);
        if (!rowCups || !cupsFromDb.has(normalizeCups(rowCups))) return false;
      }
    }

    return true;
  });
}

export async function addPeriodoFacturacionToPayload<T extends ExportRow>(rows: T[]): Promise<Array<T & {
  mes_inicio: string | null;
  mes_fin: string | null;
}>> {
  if (rows.length === 0) return [];

  const ids = Array.from(new Set(rows.map(getFacturaId).filter((id): id is string => Boolean(id))));
  const numerosFactura = Array.from(new Set(rows.map(getNumeroFactura).filter((nf): nf is string => Boolean(nf))));

  const periodosByFacturaId = ids.length > 0 ? await fetchFacturacionPeriodosByFacturaId(ids) : {};
  const periodosByNumero = numerosFactura.length > 0 ? await fetchFacturacionPeriodosByNumeroFactura(numerosFactura) : {};

  return rows.map((row) => {
    const facturaId = getFacturaId(row);
    const numeroFactura = getNumeroFactura(row);
    const fechaEmision = getFechaEmision(row);

    const periodoFromId = facturaId ? periodosByFacturaId[facturaId] : undefined;

    const candidatesByNumero = numeroFactura ? (periodosByNumero[numeroFactura] || []) : [];
    const candidateByFecha = candidatesByNumero.find((candidate) => {
      const dbFecha = candidate.fecha_emision ? candidate.fecha_emision.slice(0, 10) : null;
      return Boolean(fechaEmision && dbFecha && dbFecha === fechaEmision);
    });
    const fallbackCandidate = candidatesByNumero.find((candidate) => candidate.periodo_inicio || candidate.periodo_fin);

    const periodoFromDb = periodoFromId || candidateByFecha || fallbackCandidate;

    const periodoInicioRaw = getStringFromAnyKey(row, ['periodo_inicio', 'PERIODO_INICIO']) || periodoFromDb?.periodo_inicio || null;
    const periodoFinRaw = getStringFromAnyKey(row, ['periodo_fin', 'PERIODO_FIN']) || periodoFromDb?.periodo_fin || null;

    const mesInicio = formatToMonthYY(periodoInicioRaw);
    const mesFin = formatToMonthYY(periodoFinRaw);

    return {
      ...row,
      mes_inicio: mesInicio,
      mes_fin: mesFin,
    };
  });
}
