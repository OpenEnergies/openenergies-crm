// src/pages/clientes/ClienteActividad.tsx
// Página de Actividad del Cliente - Vista en ficha de cliente

import { useState, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import { ActividadChat } from '@components/actividad';
import { useActividadCliente } from '@hooks/useActividadLog';
import type { ActividadFilters as FiltersType } from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';

export default function ClienteActividad() {
  const { theme } = useTheme();
  const { id: clienteId } = useParams({ from: clienteDetailRoute.id });
  const [filters, setFilters] = useState<FiltersType>({});
  const [page, setPage] = useState(0);

  const {
    data,
    isLoading,
    refetch,
  } = useActividadCliente(clienteId, filters, { page, pageSize: 30 });

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

  if (!clienteId) {
    return (
      <div className={`
        p-6 rounded-xl
        ${theme === 'dark' ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}
      `} role="alert">
        Error: ID de cliente no encontrado en la URL.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chat de actividad (sin filtro de cliente, ya está en contexto) */}
      <ActividadChat
        entries={data?.data || []}
        isLoading={isLoading}
        hasMore={data?.hasMore || false}
        onLoadMore={handleLoadMore}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        clienteId={clienteId}
        showClienteFilter={false}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
