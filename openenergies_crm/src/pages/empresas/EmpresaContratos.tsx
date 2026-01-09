// src/pages/empresas/EmpresaContratos.tsx
import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { empresaDetailRoute } from '@router/routes';
import { EmptyState } from '@components/EmptyState';
import { Pagination } from '@components/Pagination';
import { fmtDate } from '@lib/utils';
import { ExternalLink, CheckCircle, Circle, Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

interface ContratoDeEmpresa {
  id: string;
  estado: string;
  fotovoltaica: string | null;
  cobrado: boolean;
  fecha_renovacion: string | null;
  fecha_activacion: string | null;
  punto: {
    id: string;
    cups: string;
  } | null;
  cliente: {
    id: string;
    nombre: string;
  } | null;
}

async function fetchContratosDeEmpresa(empresaId: string): Promise<ContratoDeEmpresa[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select(`
      id,
      estado,
      fotovoltaica,
      cobrado,
      fecha_renovacion,
      fecha_activacion,
      puntos_suministro!inner (
        id,
        cups,
        clientes (
          id,
          nombre
        )
      )
    `)
    .eq('comercializadora_id', empresaId)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });

  if (error) throw error;

  return (data || []).map(c => ({
    id: c.id,
    estado: c.estado,
    fotovoltaica: c.fotovoltaica,
    cobrado: c.cobrado,
    fecha_renovacion: c.fecha_renovacion,
    fecha_activacion: c.fecha_activacion,
    punto: c.puntos_suministro as any,
    cliente: (c.puntos_suministro as any)?.clientes || null,
  }));
}

export default function EmpresaContratos() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
  const [currentPage, setCurrentPage] = useState(1);

  const { data: contratos, isLoading, isError } = useQuery({
    queryKey: ['empresa-contratos', empresaId],
    queryFn: () => fetchContratosDeEmpresa(empresaId),
    enabled: !!empresaId,
  });

  // Pagination logic
  const totalItems = contratos?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedContratos = contratos?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ) || [];

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
        <span className="text-secondary font-medium">Cargando contratos...</span>
      </div>
    );
  }

  if (isError) {
    return <div className="glass-card p-6 text-red-400">Error al cargar los contratos.</div>;
  }

  if (!contratos?.length) {
    return (
      <div className="glass-card">
        <EmptyState
          title="Sin contratos"
          description="No hay contratos asociados a esta comercializadora."
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
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Cliente</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">CUPS</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Estado</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">FV</th>
              <th className="p-4 text-center text-xs font-bold text-primary uppercase tracking-wider">Cobrado</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Activación</th>
              <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Renovación</th>
            </tr>
          </thead>
          <tbody>
            {paginatedContratos.map((contrato) => (
              <tr key={contrato.id} className="border-b border-primary/10 hover:bg-bg-intermediate/50 transition-colors cursor-pointer">
                <td className="p-4">
                  {contrato.cliente ? (
                    <Link
                      to="/app/clientes/$id"
                      params={{ id: contrato.cliente.id }}
                      className="text-primary font-bold hover:text-fenix-600 dark:hover:text-fourth transition-colors"
                    >
                      {contrato.cliente.nombre}
                    </Link>
                  ) : <span className="text-secondary opacity-50">—</span>}
                </td>
                <td className="p-4">
                  {contrato.punto ? (
                    <Link
                      to="/app/contratos/$id"
                      params={{ id: contrato.id }}
                      className="inline-flex items-center gap-2 text-fenix-600 dark:text-fourth hover:text-fenix-500 transition-colors"
                    >
                      <code className="font-mono text-sm">{contrato.punto.cups}</code>
                      <ExternalLink size={14} />
                    </Link>
                  ) : <span className="text-secondary opacity-50">—</span>}
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-secondary">
                    {contrato.estado}
                  </span>
                </td>
                <td className="p-4">
                  {contrato.fotovoltaica && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      {contrato.fotovoltaica}
                    </span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {contrato.cobrado ? (
                    <CheckCircle size={18} className="text-green-600 dark:text-green-400 mx-auto" />
                  ) : (
                    <Circle size={18} className="text-secondary opacity-50 mx-auto" />
                  )}
                </td>
                <td className="p-4 text-secondary">{fmtDate(contrato.fecha_activacion)}</td>
                <td className="p-4 text-secondary">{fmtDate(contrato.fecha_renovacion)}</td>
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

