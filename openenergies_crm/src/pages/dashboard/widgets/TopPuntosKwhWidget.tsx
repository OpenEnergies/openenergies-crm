// src/pages/dashboard/widgets/TopPuntosKwhWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, TrendingUp, Zap } from 'lucide-react';
import { Link } from '@tanstack/react-router';

type TopPuntoKwh = {
    punto_id: string;
    cups: string;
    total_kwh: number;
    cliente_nombre: string;
};

async function fetchTopPuntosKwh(): Promise<TopPuntoKwh[]> {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const sinceStr = since.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('facturacion_clientes')
        .select('punto_id, consumo_kwh, puntos_suministro!inner(id, cups, clientes!inner(nombre))')
        .is('eliminado_en', null)
        .gte('fecha_emision', sinceStr);

    if (error) throw error;

    // Aggregate by punto_id
    const byPunto: Record<string, { punto_id: string; cups: string; total_kwh: number; cliente_nombre: string }> = {};
    (data || []).forEach((row: any) => {
        const puntoId = row.punto_id;
        if (!puntoId) return;
        const ps = Array.isArray(row.puntos_suministro) ? row.puntos_suministro[0] : row.puntos_suministro;
        const cups = ps?.cups || '';
        const clienteNombre = ps?.clientes
            ? (Array.isArray(ps.clientes) ? ps.clientes[0]?.nombre : ps.clientes.nombre) || 'Sin sociedad'
            : 'Sin sociedad';

        if (!byPunto[puntoId]) {
            byPunto[puntoId] = { punto_id: puntoId, cups, total_kwh: 0, cliente_nombre: clienteNombre };
        }
        byPunto[puntoId].total_kwh += Number(row.consumo_kwh) || 0;
    });

    return Object.values(byPunto)
        .sort((a, b) => b.total_kwh - a.total_kwh)
        .slice(0, 5);
}

export default function TopPuntosKwhWidget() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard-top-puntos-kwh'],
        queryFn: fetchTopPuntosKwh,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                    </div>
                    <h3 className="text-base font-bold text-primary">Top 5 Puntos por kWh</h3>
                </div>
                <Link
                    to="/app/puntos"
                    className="text-sm font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors cursor-pointer"
                >
                    Ver todos →
                </Link>
            </div>

            {/* Content */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
                </div>
            )}

            {isError && (
                <div className="text-center py-8 text-red-400">
                    Error al cargar los datos
                </div>
            )}

            {data && data.length === 0 && (
                <div className="text-center py-8 text-secondary opacity-60 font-medium italic">
                    No hay puntos con consumo registrado
                </div>
            )}

            {data && data.length > 0 && (
                <div className="space-y-3">
                    {data.map((punto, index) => (
                        <div
                            key={punto.punto_id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-bg-intermediate hover:bg-fenix-500/5 transition-colors"
                        >
                            {/* Rank */}
                            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${index === 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                    index === 1 ? 'bg-slate-400/20 text-slate-600 dark:text-slate-400' :
                                        index === 2 ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                                            'bg-bg-intermediate text-secondary opacity-50'}
              `}>
                                {index + 1}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <Link
                                    to="/app/puntos/$id/detalle"
                                    params={{ id: punto.punto_id }}
                                    className="text-sm font-bold text-secondary hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors truncate block"
                                >
                                    {punto.cliente_nombre}
                                </Link>
                                <p className="text-xs text-secondary opacity-60 font-mono truncate">{punto.cups}</p>
                            </div>

                            {/* Value */}
                            <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 text-fenix-600 dark:text-fourth font-bold">
                                    <Zap className="w-4 h-4" />
                                    <span>{punto.total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kWh</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
