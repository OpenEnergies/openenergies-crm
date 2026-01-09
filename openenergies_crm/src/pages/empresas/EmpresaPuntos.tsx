// src/pages/empresas/EmpresaPuntos.tsx
import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { empresaDetailRoute } from '@router/routes';
import { EmptyState } from '@components/EmptyState';
import { Pagination } from '@components/Pagination';
import { ExternalLink, Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

interface PuntoDeEmpresa {
  id: string;
  cups: string;
  direccion_sum: string | null;
  tarifa: string | null;
  consumo_anual_kwh: number | null;
  estado: string | null;
  cliente: {
    id: string;
    nombre: string;
  } | null;
}

async function fetchPuntosDeEmpresa(empresaId: string): Promise<PuntoDeEmpresa[]> {
  const { data, error } = await supabase
    .from('puntos_suministro')
    .select(`
      id,
      cups,
      direccion_sum,
      tarifa,
      consumo_anual_kwh,
      estado,
      clientes!inner (
        id,
        nombre
      )
    `)
    .eq('current_comercializadora_id', empresaId)
    .is('eliminado_en', null)
    .order('cups');

  if (error) throw error;

  return (data || []).map(p => ({
    id: p.id,
    cups: p.cups,
    direccion_sum: p.direccion_sum,
    tarifa: p.tarifa,
    consumo_anual_kwh: p.consumo_anual_kwh,
    estado: p.estado,
    cliente: p.clientes as any,
  }));
}

export default function EmpresaPuntos() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
  const [currentPage, setCurrentPage] = useState(1);

  const { data: puntos, isLoading, isError } = useQuery({
    queryKey: ['empresa-puntos', empresaId],
    queryFn: () => fetchPuntosDeEmpresa(empresaId),
    enabled: !!empresaId,
  });

  // Pagination logic
  const totalItems = puntos?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedPuntos = puntos?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ) || [];

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
        <span className="text-secondary font-medium">Cargando puntos de suministro...</span>
      </div>
    );
  }

  if (isError) {
    return <div className="glass-card p-6 text-red-400">Error al cargar los puntos.</div>;
  }

  if (!puntos?.length) {
    return (
      <div className="glass-card">
        <EmptyState
          title="Sin puntos"
          description="No hay puntos de suministro asociados a esta comercializadora."
        />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-primary bg-bg-intermediate">
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">CUPS</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Cliente</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Dirección</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Tarifa</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Consumo Anual</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPuntos.map((punto) => (
              <tr key={punto.id} className="border-b border-primary/10 hover:bg-bg-intermediate/50 transition-colors cursor-pointer">
                <td className="p-4">
                  <Link
                    to="/app/puntos/$id"
                    params={{ id: punto.id }}
                    className="inline-flex items-center gap-2 text-fenix-600 dark:text-fourth hover:text-fenix-500 transition-colors"
                  >
                    <code className="font-mono text-sm">{punto.cups}</code>
                    <ExternalLink size={14} />
                  </Link>
                </td>
                <td className="p-4">
                  {punto.cliente ? (
                    <Link
                      to="/app/clientes/$id"
                      params={{ id: punto.cliente.id }}
                      className="text-primary font-bold hover:text-fenix-600 dark:hover:text-fourth transition-colors"
                    >
                      {punto.cliente.nombre}
                    </Link>
                  ) : <span className="text-secondary opacity-50">—</span>}
                </td>
                <td className="p-4 text-secondary">{punto.direccion_sum || '—'}</td>
                <td className="p-4">
                  {punto.tarifa && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-secondary">
                      {punto.tarifa}
                    </span>
                  )}
                </td>
                <td className="p-4 text-secondary">
                  {punto.consumo_anual_kwh
                    ? `${punto.consumo_anual_kwh.toLocaleString('es-ES')} kWh`
                    : '—'}
                </td>
                <td className="p-4">
                  {punto.estado && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-secondary">
                      {punto.estado}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

