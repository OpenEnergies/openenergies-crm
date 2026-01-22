import { useQuery } from '@tanstack/react-query';
import {
    fetchLastCompleteDate,
    fetchDailyStatsForDate,
    fetchComparisonData,
    fetchSpainPortugalChart,
    fetchPVPCChart,
    fetchTopHours,
    fetchSurplusComparison,
    fetchIntradayComparison,
    generateInsights,
    MarketSummary,
    ComparisonData,
    ChartDataPoint,
    TopHour,
    MarketInsight,
} from '../services/marketData';

const STALE_TIME = 1000 * 60 * 15; // 15 minutos

const formatDateStr = (date: Date): string => {
    const iso = date.toISOString();
    return iso.split('T')[0] || '';
};

// =============================================================================
// HOOKS - Fecha de referencia
// =============================================================================

/**
 * Obtiene el último día completo disponible para un indicador
     */
export const useLastCompleteDate = (indicatorId: number, geoId: number) => {
    return useQuery<string | null, Error>({
        queryKey: ['market-last-complete', indicatorId, geoId],
        queryFn: () => fetchLastCompleteDate(indicatorId, geoId),
        staleTime: STALE_TIME,
    });
};

// =============================================================================
// HOOKS - Stats Diarios
// =============================================================================

/**
 * Obtiene el resumen de mercado para una fecha
 */
export const useMarketSummary = (date: Date) => {
    const dateStr = formatDateStr(date);

    return useQuery<MarketSummary, Error>({
        queryKey: ['market-summary', dateStr],
        queryFn: () => fetchDailyStatsForDate(dateStr),
        staleTime: STALE_TIME,
    });
};

/**
 * Obtiene datos de comparación: hoy vs ayer vs media semanal
 */
export const useMarketComparison = (date: Date) => {
    return useQuery<ComparisonData, Error>({
        queryKey: ['market-comparison', formatDateStr(date)],
        queryFn: () => fetchComparisonData(date),
        staleTime: STALE_TIME,
    });
};

// =============================================================================
// HOOKS - Gráficos
// =============================================================================

/**
 * Gráfico comparativo España vs Portugal (OMIE 600)
 */
export const useSpainPortugalChart = (date: Date) => {
    const dateStr = formatDateStr(date);

    return useQuery<ChartDataPoint[], Error>({
        queryKey: ['market-chart-espt', dateStr],
        queryFn: () => fetchSpainPortugalChart(dateStr),
        staleTime: STALE_TIME,
    });
};

/**
 * Gráfico PVPC con periodos tarifarios
 */
export const usePVPCChart = (date: Date, geoId: number = 8741) => {
    const dateStr = formatDateStr(date);

    return useQuery<ChartDataPoint[], Error>({
        queryKey: ['market-chart-pvpc', dateStr, geoId],
        queryFn: () => fetchPVPCChart(dateStr, geoId),
        staleTime: STALE_TIME,
    });
};

/**
 * Top 3 horas más baratas y más caras
 */
export const useTopHours = (date: Date, indicatorId: number, geoId: number) => {
    const dateStr = formatDateStr(date);

    return useQuery<{ cheapest: TopHour[]; expensive: TopHour[] }, Error>({
        queryKey: ['market-top-hours', dateStr, indicatorId, geoId],
        queryFn: () => fetchTopHours(dateStr, indicatorId, geoId),
        staleTime: STALE_TIME,
    });
};

/**
 * Datos de autoconsumo/excedentes con comparativa
 */
export const useSurplusComparison = (date: Date) => {
    const dateStr = formatDateStr(date);

    return useQuery<{
        surplus: ChartDataPoint[];
        differentialVsMarket: number;
        differentialVsPVPC: number;
        dataDate: string;
    } | null, Error>({
        queryKey: ['market-surplus', dateStr],
        queryFn: () => fetchSurplusComparison(date),
        staleTime: STALE_TIME,
    });
};

/**
 * Datos de intradiario continuo con comparativa
 */
export const useIntradayComparison = (date: Date) => {
    const dateStr = formatDateStr(date);

    return useQuery<{
        intraday: ChartDataPoint[];
        differential: number;
        dataDate: string;
    } | null, Error>({
        queryKey: ['market-intraday', dateStr],
        queryFn: () => fetchIntradayComparison(date),
        staleTime: STALE_TIME,
    });
};

// =============================================================================
// HOOKS - Insights
// =============================================================================

/**
 * Genera insights automáticos para el mercado
 */
export const useMarketInsights = (date: Date) => {
    return useQuery<MarketInsight[], Error>({
        queryKey: ['market-insights', formatDateStr(date)],
        queryFn: () => generateInsights(date),
        staleTime: STALE_TIME,
    });
};

// =============================================================================
// HOOKS - Multi-día (7D, 30D)
// =============================================================================

import { fetchAggregatedStats, fetchMultiDayChart, type TimeRange } from '../services/marketData';
export type { TimeRange } from '../services/marketData';

/**
 * Obtiene estadísticas agregadas para un rango temporal
 */
export const useAggregatedStats = (date: Date, range: TimeRange, indicatorId: number, geoId: number) => {
    return useQuery<import('../services/marketData').DailyStats | null, Error>({
        queryKey: ['market-aggregated-stats', formatDateStr(date), range, indicatorId, geoId],
        queryFn: () => fetchAggregatedStats(date, range, indicatorId, geoId),
        staleTime: STALE_TIME,
        enabled: range !== '1D', // Solo para rangos > 1D
    });
};

/**
 * Obtiene datos de gráfico para un rango temporal
 */
export const useMultiDayChart = (date: Date, range: TimeRange, indicatorId: number, geoId: number) => {
    return useQuery<ChartDataPoint[], Error>({
        queryKey: ['market-multi-day-chart', formatDateStr(date), range, indicatorId, geoId],
        queryFn: () => fetchMultiDayChart(date, range, indicatorId, geoId),
        staleTime: STALE_TIME,
    });
};

// =============================================================================
// LEGACY EXPORTS (mantener compatibilidad con código existente)
// =============================================================================

export interface MarketDailyStats {
    date: string;
    avg_price_omie: number;
    avg_price_pvpc: number;
    avg_price_surplus: number;
    period_1_price?: number;
    period_2_price?: number;
    period_3_price?: number;
    omie_change_pct?: number;
}

export interface MarketChartData {
    hour: string;
    price_omie: number;
    price_pvpc: number;
    period_discriminator: 'P1' | 'P2' | 'P3';
}

/**
 * @deprecated Usar useMarketSummary en su lugar
 */
export const useMarketDailyStats = (date: Date, geoId: number) => {
    const dateStr = formatDateStr(date);

    return useQuery<MarketDailyStats | null, Error>({
        queryKey: ['market-daily', dateStr, geoId],
        queryFn: async () => {
            const summary = await fetchDailyStatsForDate(dateStr);
            if (!summary.omie_spain && !summary.pvpc) return null;

            return {
                date: dateStr,
                avg_price_omie: summary.omie_spain?.valor_medio || 0,
                avg_price_pvpc: summary.pvpc?.valor_medio || 0,
                avg_price_surplus: summary.surplus?.valor_medio || 0,
                period_1_price: summary.pvpc?.media_p1,
                period_2_price: summary.pvpc?.media_p2,
                period_3_price: summary.pvpc?.media_p3,
            };
        },
        staleTime: STALE_TIME,
    });
};

/**
 * @deprecated Usar useSpainPortugalChart o usePVPCChart en su lugar
 */
export const useMarketChartData = (date: Date, geoId: number) => {
    const dateStr = formatDateStr(date);

    return useQuery<MarketChartData[], Error>({
        queryKey: ['market-chart', dateStr, geoId],
        queryFn: async () => {
            const [spainPortugal, pvpc] = await Promise.all([
                fetchSpainPortugalChart(dateStr),
                fetchPVPCChart(dateStr, geoId),
            ]);

            // Combinar datos para compatibilidad
            return spainPortugal.map((sp, i) => ({
                hour: sp.hour,
                price_omie: sp.omie_spain || 0,
                price_pvpc: pvpc[i]?.pvpc || 0,
                period_discriminator: pvpc[i]?.period || 'P3',
            }));
        },
        staleTime: STALE_TIME,
    });
};
