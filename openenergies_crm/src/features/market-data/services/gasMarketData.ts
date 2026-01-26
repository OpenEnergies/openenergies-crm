import { supabase } from '@lib/supabase';

// =============================================================================
// TIPOS - Gas MIBGAS
// =============================================================================

export interface GasSummary {
    fecha: string;
    pvb_price: number;
    pvb_avg: number;
    pvb_yesterday: number | null;
    pvb_change_pct: number | null;
    vtp_price: number;
}

export interface GasChartDataPoint {
    fecha: string;
    pvb_price: number;
    vtp_price: number;
}

export interface GasAggregatedStats {
    fecha_inicio: string;
    fecha_fin: string;
    pvb_avg: number;
    pvb_min: number;
    pvb_max: number;
    pvb_std: number;
    fecha_min: string;
    fecha_max: string;
    num_dias: number;
}

export interface GasIndicator {
    indicator_name: string;
    indicator_code: string;
    hub: string;
    country: string;
    price_eur_mwh: number;
    reference_price: number | null;
    change_pct: number | null;
    trade_date: string;
}

// =============================================================================
// HELPERS
// =============================================================================

export const formatDateStr = (date: Date): string => {
    const parts = date.toISOString().split('T');
    return parts[0] ?? '';
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Obtiene el resumen de gas para hoy o una fecha específica
 */
export const fetchGasSummary = async (date?: string): Promise<GasSummary | null> => {
    const { data, error } = await supabase.rpc('get_gas_summary', {
        p_date: date || formatDateStr(new Date())
    });

    if (error) {
        console.error('Error fetching gas summary:', error);
        return null;
    }

    // La RPC devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    return result || null;
};

/**
 * Obtiene datos para el gráfico de gas (serie temporal)
 */
export const fetchGasChartData = async (
    days: number = 7,
    endDate?: string
): Promise<GasChartDataPoint[]> => {
    const { data, error } = await supabase.rpc('get_gas_chart_data', {
        p_days: days,
        p_end_date: endDate || formatDateStr(new Date())
    });

    if (error) {
        console.error('Error fetching gas chart data:', error);
        return [];
    }

    return data || [];
};

/**
 * Obtiene estadísticas agregadas de gas para un periodo (7D, 30D)
 */
export const fetchGasAggregatedStats = async (
    days: number = 7,
    endDate?: string
): Promise<GasAggregatedStats | null> => {
    const { data, error } = await supabase.rpc('get_gas_aggregated_stats', {
        p_days: days,
        p_end_date: endDate || formatDateStr(new Date())
    });

    if (error) {
        console.error('Error fetching gas aggregated stats:', error);
        return null;
    }

    // La RPC devuelve un array, tomamos el primer elemento
    const result = Array.isArray(data) ? data[0] : data;
    return result || null;
};

/**
 * Obtiene los 3 indicadores principales de Gas:
 * - Day Ahead ES (GDAES_D+1)
 * - Month Ahead ES (GMAES)
 * - Day Ahead PT (GDAPT_D+1)
 */
export const fetchGasIndicators = async (date?: string): Promise<GasIndicator[]> => {
    const { data, error } = await supabase.rpc('get_gas_indicators', {
        p_date: date || formatDateStr(new Date())
    });

    if (error) {
        console.error('Error fetching gas indicators:', error);
        return [];
    }

    return data || [];
};
