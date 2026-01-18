// src/pages/analytics/ActividadPage.tsx
// Página de Actividad Global - Vista de todo el CRM

import { useState, useCallback } from 'react';
import { Activity } from 'lucide-react';
import { ActividadChat } from '@components/actividad';
import { useActividadLog } from '@hooks/useActividadLog';
import type { ActividadFilters as FiltersType } from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';

export default function ActividadPage() {
    const { theme } = useTheme();
    const [filters, setFilters] = useState<FiltersType>({});
    const [page, setPage] = useState(0);

    const {
        data,
        isLoading,
        refetch,
    } = useActividadLog(filters, { page, pageSize: 30 });

    const handleLoadMore = useCallback(() => {
        setPage((p) => p + 1);
    }, []);

    const handleFiltersChange = useCallback((newFilters: FiltersType) => {
        setFilters(newFilters);
        setPage(0); // Reset page when filters change
    }, []);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className={`
          w-14 h-14 rounded-2xl flex items-center justify-center
          ${theme === 'dark'
                        ? 'bg-gradient-to-br from-fenix-500/20 to-fenix-600/20 ring-1 ring-fenix-500/20'
                        : 'bg-gradient-to-br from-fenix-100 to-fenix-200'}
        `}>
                    <Activity className={`w-7 h-7 ${theme === 'dark' ? 'text-fenix-500' : 'text-fenix-600'}`} />
                </div>
                <div>
                    <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-fenix-500' : 'text-fenix-600'}`}>
                        Actividad Global
                    </h1>
                    <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                        Historial de cambios y notas en todo el CRM
                    </p>
                </div>
            </div>

            {/* Chat de actividad */}
            <ActividadChat
                entries={data?.data || []}
                isLoading={isLoading}
                hasMore={data?.hasMore || false}
                onLoadMore={handleLoadMore}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                clienteId={null}
                showClienteFilter={true}
                onRefresh={handleRefresh}
            />
        </div>
    );
}
