import { supabase } from '@lib/supabase';

export interface MarketDailyStats {
    date: string;
    avg_price_omie: number;
    avg_price_pvpc: number;
    avg_price_surplus: number; // Indicator 1739
    period_1_price?: number;
    period_2_price?: number;
    period_3_price?: number;
    // Pre-calculated change/trend can be here or computed on FE
    omie_change_pct?: number;
}

export interface MarketChartData {
    hour: string; // HH:mm
    price_omie: number;
    price_pvpc: number;
    period_discriminator: 'P1' | 'P2' | 'P3';
}

export const fetchDailyStats = async (date: Date, geoId: number): Promise<MarketDailyStats | null> => {
    // Format date as YYYY-MM-DD for the query
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
        .schema('market_data')
        .from('dashboard_summary_v')
        .select('*, date:fecha')
        .eq('fecha', dateStr)
        .eq('fecha', dateStr)
        .in('geo_id', [geoId, 1]); // Handle potential ID mismatch (OMIE uses 1, PVPC uses 8741)

    if (error) {
        console.error('Error fetching daily stats:', error);
        throw error;
    }

    if (!data || data.length === 0) return null;

    // Pivot data: Map specific indicators to the single stats object
    // IDs: 1001 (PVPC), 600 (OMIE/SPOT), 1739 (Excedentes)
    const stats: MarketDailyStats = {
        date: dateStr as string,
        avg_price_omie: 0,
        avg_price_pvpc: 0,
        avg_price_surplus: 0,
        period_1_price: 0,
        period_2_price: 0,
        period_3_price: 0
    };

    data.forEach((row: any) => {
        if (row.indicator_id === 1001) { // PVPC
            stats.avg_price_pvpc = row.valor_medio;
            stats.period_1_price = row.media_p1;
            stats.period_2_price = row.media_p2;
            stats.period_3_price = row.media_p3;
        } else if (row.indicator_id === 600) { // OMIE / SPOT
            stats.avg_price_omie = row.valor_medio;
        } else if (row.indicator_id === 1739) { // Excedentes
            stats.avg_price_surplus = row.valor_medio;
        }
    });

    return stats;
};

export const fetchChartData = async (date: Date, geoId: number): Promise<MarketChartData[]> => {
    const dateStr = date.toISOString().split('T')[0];

    // Explicitly set schema for RPC
    const { data, error } = await supabase
        .schema('market_data')
        .rpc('get_market_chart_data', {
            p_geo_id: geoId,
            p_date: dateStr
        });

    if (error) {
        console.error('Error fetching market chart data:', error);
        throw error;
    }

    return data || [];
};
