import { useQuery } from '@tanstack/react-query';
import {
    fetchGasSummary,
    fetchGasChartData,
    fetchGasAggregatedStats,
    fetchGasIndicators,
    GasSummary,
    GasChartDataPoint,
    GasAggregatedStats,
    GasIndicator,
} from '../services/gasMarketData';

const STALE_TIME = 1000 * 60 * 15; // 15 minutos

// =============================================================================
// HOOKS - Gas MIBGAS
// =============================================================================

/**
 * Hook para obtener el resumen de gas del día
 */
export const useGasSummary = (date?: string) => {
    return useQuery<GasSummary | null, Error>({
        queryKey: ['gas-summary', date],
        queryFn: () => fetchGasSummary(date),
        staleTime: STALE_TIME,
    });
};

/**
 * Hook para obtener datos del gráfico de gas
 */
export const useGasChartData = (days: number = 7, endDate?: string) => {
    return useQuery<GasChartDataPoint[], Error>({
        queryKey: ['gas-chart', days, endDate],
        queryFn: () => fetchGasChartData(days, endDate),
        staleTime: STALE_TIME,
    });
};

/**
 * Hook para obtener estadísticas agregadas de gas
 */
export const useGasAggregatedStats = (days: number = 7, endDate?: string) => {
    return useQuery<GasAggregatedStats | null, Error>({
        queryKey: ['gas-aggregated', days, endDate],
        queryFn: () => fetchGasAggregatedStats(days, endDate),
        staleTime: STALE_TIME,
    });
};

/**
 * Hook para obtener los 3 indicadores principales de gas
 */
export const useGasIndicators = (date?: string) => {
    return useQuery<GasIndicator[], Error>({
        queryKey: ['gas-indicators', date],
        queryFn: () => fetchGasIndicators(date),
        staleTime: STALE_TIME,
    });
};

// Re-export types para conveniencia
export type { GasSummary, GasChartDataPoint, GasAggregatedStats, GasIndicator };
