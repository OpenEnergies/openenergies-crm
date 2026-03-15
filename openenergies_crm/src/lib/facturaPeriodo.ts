import { format, parseISO } from 'date-fns';
import { supabase } from '@lib/supabase';

export interface FacturaPeriodoInfo {
  periodo_inicio_mes: string | null;
  periodo_fin_mes: string | null;
}

interface ConsumoPeriodoRow {
  factura_id: string;
  mes: string;
}

const CHUNK_SIZE = 200;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function fetchFacturaPeriodos(facturaIds: string[]): Promise<Record<string, FacturaPeriodoInfo>> {
  const uniqueIds = Array.from(new Set(facturaIds.filter(Boolean)));
  const result: Record<string, FacturaPeriodoInfo> = {};

  if (uniqueIds.length === 0) {
    return result;
  }

  const chunks = chunkArray(uniqueIds, CHUNK_SIZE);

  for (const idsChunk of chunks) {
    const { data, error } = await supabase
      .from('consumos_facturacion')
      .select('factura_id, mes')
      .in('factura_id', idsChunk)
      .is('eliminado_en', null)
      .order('mes', { ascending: true });

    if (error) {
      throw error;
    }

    (data as ConsumoPeriodoRow[] | null)?.forEach((row) => {
      if (!row.factura_id || !row.mes) return;

      const current = result[row.factura_id];
      if (!current) {
        result[row.factura_id] = {
          periodo_inicio_mes: row.mes,
          periodo_fin_mes: row.mes,
        };
        return;
      }

      if (!current.periodo_inicio_mes || row.mes < current.periodo_inicio_mes) {
        current.periodo_inicio_mes = row.mes;
      }
      if (!current.periodo_fin_mes || row.mes > current.periodo_fin_mes) {
        current.periodo_fin_mes = row.mes;
      }
    });
  }

  return result;
}

function formatMonth(dateValue: string): string {
  try {
    return format(parseISO(dateValue), 'MM/yyyy');
  } catch {
    return dateValue.slice(0, 7);
  }
}

export function formatPeriodoFacturacion(inicio: string | null, fin: string | null): string {
  if (!inicio && !fin) return '—';
  if (inicio && !fin) return formatMonth(inicio);
  if (!inicio && fin) return formatMonth(fin);
  if (inicio === fin) return formatMonth(inicio as string);
  return `${formatMonth(inicio as string)} - ${formatMonth(fin as string)}`;
}

export function toMonthKey(dateValue: string | null): string | null {
  if (!dateValue) return null;
  return dateValue.slice(0, 7);
}
