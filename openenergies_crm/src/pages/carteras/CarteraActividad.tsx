import { useCallback, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ActividadChat } from '@components/actividad';
import { useActividadLog } from '@hooks/useActividadLog';
import type { ActividadFilters as FiltersType } from '@lib/actividadTypes';
import { useGrupoClienteDetail } from '@hooks/useGruposClientes';

export default function CarteraActividad() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data: grupo } = useGrupoClienteDetail(id);
  const [filters, setFilters] = useState<FiltersType>({});
  const [page, setPage] = useState(0);

  const scopedFilters: FiltersType =
    grupo && grupo.cliente_ids.length > 0
      ? { ...filters, cliente_ids: grupo.cliente_ids }
      : { ...filters, cliente_id: '00000000-0000-0000-0000-000000000000' };

  const { data, isLoading, refetch } = useActividadLog(
    scopedFilters,
    { page, pageSize: 30 },
  );

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const handleFiltersChange = useCallback((next: FiltersType) => {
    setFilters(next);
    setPage(0);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <ActividadChat
        entries={data?.data || []}
        isLoading={isLoading}
        hasMore={data?.hasMore || false}
        onLoadMore={handleLoadMore}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        showClienteFilter={false}
        onRefresh={refetch}
      />
    </div>
  );
}
