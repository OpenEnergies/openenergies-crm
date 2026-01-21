// src/pages/empresas/EmpresaActividad.tsx
// Página de Actividad de la Empresa - Vista en ficha de empresa

import { useState, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import { ActividadChat } from '@components/actividad';
import { useActividadEmpresa } from '@hooks/useActividadLog';
import type { ActividadFilters as FiltersType } from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';

export default function EmpresaActividad() {
    const { theme } = useTheme();
    const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
    const [filters, setFilters] = useState<FiltersType>({});
    const [page, setPage] = useState(0);

    const {
        data,
        isLoading,
        refetch,
    } = useActividadEmpresa(empresaId, filters, { page, pageSize: 30 });

    const handleLoadMore = useCallback(() => {
        setPage((p) => p + 1);
    }, []);

    const handleFiltersChange = useCallback((newFilters: FiltersType) => {
        setFilters(newFilters);
        setPage(0);
    }, []);

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    if (!empresaId) {
        return (
            <div className={`
        p-6 rounded-xl
        ${theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}
      `} role="alert">
                Error: ID de empresa no encontrado en la URL.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Chat de actividad (sin filtro de empresa, ya está en contexto) */}
            <ActividadChat
                entries={data?.data || []}
                isLoading={isLoading}
                hasMore={data?.hasMore || false}
                onLoadMore={handleLoadMore}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                empresaId={empresaId}
                showClienteFilter={false}
                onRefresh={handleRefresh}
            />
        </div>
    );
}
