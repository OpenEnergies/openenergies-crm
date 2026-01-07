// src/pages/empresas/EmpresaPuntos.tsx
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { empresaDetailRoute } from '@router/routes';
import { EmptyState } from '@components/EmptyState';
import { ExternalLink, Loader2 } from 'lucide-react';

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

  const { data: puntos, isLoading, isError } = useQuery({
    queryKey: ['empresa-puntos', empresaId],
    queryFn: () => fetchPuntosDeEmpresa(empresaId),
    enabled: !!empresaId,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
        <span className="text-gray-400">Cargando puntos de suministro...</span>
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
            <tr className="border-b border-bg-intermediate">
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">CUPS</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Dirección</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tarifa</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Consumo Anual</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((punto) => (
              <tr key={punto.id} className="border-b border-bg-intermediate hover:bg-bg-intermediate transition-colors cursor-pointer">
                <td className="p-4">
                  <Link
                    to="/app/puntos/$id"
                    params={{ id: punto.id }}
                    className="inline-flex items-center gap-2 text-fenix-400 hover:text-fenix-300 transition-colors"
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
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      {punto.cliente.nombre}
                    </Link>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="p-4 text-gray-400">{punto.direccion_sum || '—'}</td>
                <td className="p-4">
                  {punto.tarifa && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-gray-300">
                      {punto.tarifa}
                    </span>
                  )}
                </td>
                <td className="p-4 text-gray-400">
                  {punto.consumo_anual_kwh
                    ? `${punto.consumo_anual_kwh.toLocaleString('es-ES')} kWh`
                    : '—'}
                </td>
                <td className="p-4">
                  {punto.estado && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-gray-300">
                      {punto.estado}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

