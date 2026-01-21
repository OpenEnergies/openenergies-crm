import { useQuery } from '@tanstack/react-query';
import { fetchDailyStats, fetchChartData, MarketDailyStats, MarketChartData } from '../services/marketData';

const STALE_TIME = 1000 * 60 * 15; // 15 minutes

export const useMarketDailyStats = (date: Date, geoId: number) => {
    // Create a key that updates when date or geoId changes
    // Format date to string to keep referential stability in the key if the date object changes but represents same day
    const dateStr = date.toISOString().split('T')[0];

    return useQuery<MarketDailyStats | null, Error>({
        queryKey: ['market-daily', dateStr, geoId],
        queryFn: () => fetchDailyStats(date, geoId),
        staleTime: STALE_TIME,
    });
};

export const useMarketChartData = (date: Date, geoId: number) => {
    const dateStr = date.toISOString().split('T')[0];

    return useQuery<MarketChartData[], Error>({
        queryKey: ['market-chart', dateStr, geoId],
        queryFn: () => fetchChartData(date, geoId),
        staleTime: STALE_TIME,
    });
};
