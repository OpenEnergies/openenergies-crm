import { z } from 'zod';

// ============ TYPES ============

export type MetricMeasure =
  | 'total'
  | 'consumo_kwh'
  | 'precio_eur_kwh'
  | 'potencia_kw';

export type MetricAggregation = 'sum' | 'avg' | 'min' | 'max';
export type ChartType = 'bar' | 'line' | 'scatter' | 'pie';
export type GroupByOption = 'month' | 'client' | 'point' | 'retailer' | 'invoice_type';
export type TopMode = 'top' | 'bottom';

export interface MetricConfig {
  id: string;
  measure: MetricMeasure;
  aggregation: MetricAggregation;
  chartType: ChartType;
  groupBy: GroupByOption;
  topN: number;
  topMode: TopMode;
}

export interface SharedFilters {
  cliente_ids: string[] | null;
  punto_ids: string[] | null;
  comercializadora_ids: string[] | null;
  tipo_factura_val: string | null;
  tarifa_vals: string[] | null;
  provincia_vals: string[] | null;
  fecha_desde: string;
  fecha_hasta: string;
}

export const AggregateResponseSchema = z.object({
  summary: z.record(z.any()),
  groups: z.array(z.record(z.any())).nullable(),
  meta: z.object({
    group_by: z.string(),
    date_from: z.string(),
    date_to: z.string(),
    row_count: z.number(),
  }),
});

export type AggregateResponse = z.infer<typeof AggregateResponseSchema>;

// ============ CONSTANTS ============

export const MEASURE_LABELS: Record<string, string> = {
  total: 'Importe (€)',
  consumo_kwh: 'Consumo (kWh)',
  precio_eur_kwh: 'Precio (€/kWh)',
  potencia_kw: 'Potencia (kW)',
};

export const AGG_LABELS: Record<string, string> = {
  sum: 'Suma',
  avg: 'Media',
  min: 'Mínimo',
  max: 'Máximo',
};

export const GROUP_LABELS: Record<GroupByOption, string> = {
  month: 'Mes',
  client: 'Sociedad',
  point: 'CUPS',
  retailer: 'Comercializadora',
  invoice_type: 'Suministro',
};

export const CHART_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const getChartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length] ?? '#10B981';

export const formatValue = (val: number, measure: string): string => {
  if (measure.includes('total') || measure.includes('importe')) {
    return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  }
  if (measure.includes('kwh')) {
    if (measure.includes('precio') || measure.includes('pvp')) {
      return val.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 4,
      });
    }
    return val.toLocaleString('es-ES') + ' kWh';
  }
  if (measure.includes('potencia')) return val.toLocaleString('es-ES') + ' kW';
  return val.toLocaleString('es-ES');
};

// ============ HELPERS ============

let _counter = 0;
export const createMetricId = (): string => `m-${Date.now()}-${++_counter}`;

export const createDefaultMetric = (overrides?: Partial<MetricConfig>): MetricConfig => ({
  id: createMetricId(),
  measure: 'consumo_kwh',
  aggregation: 'sum',
  chartType: 'bar',
  groupBy: 'month',
  topN: 20,
  topMode: 'top',
  ...overrides,
});
