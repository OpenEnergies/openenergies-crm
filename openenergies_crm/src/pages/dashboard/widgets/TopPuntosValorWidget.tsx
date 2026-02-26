import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, TrendingUp, Zap } from 'lucide-react';
import { Link } from '@tanstack/react-router';

type TopPunto = {
    id: string;
    cups: string;
    consumo_anual_kwh: number | null;
    p1_kw: number | null;
    clientes: {
        id: string;
        nombre: string;
    } | null;
};

async function fetchTopPuntos(): Promise<TopPunto[]> {
    const { data, error } = await supabase
        .from('puntos_suministro')
        .select(`
      id,
      cups,
      consumo_anual_kwh,
      p1_kw,
      clientes!inner(id, nombre)
    `)
        .not('consumo_anual_kwh', 'is', null)
        .order('consumo_anual_kwh', { ascending: false, nullsFirst: false })
        .limit(5);

    if (error) throw error;
    return (data as unknown as TopPunto[]) || [];
}

function formatKwh(kwh: number): string {
    return `${(kwh).toFixed(1)} kWh`;
}

export default function TopPuntosValorWidget() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard-top-puntos'],
        queryFn: fetchTopPuntos,
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
                    <h3 className="text-base font-bold text-primary">Puntos de Alto Valor</h3>
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
                            key={punto.id}
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
                                    params={{ id: punto.id }}
                                    className="text-sm font-bold text-secondary hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors truncate block"
                                >
                                    {punto.clientes?.nombre || 'Sin cliente'}
                                </Link>
                                <p className="text-xs text-secondary opacity-60 font-mono truncate">{punto.cups}</p>
                            </div>

                            {/* Value */}
                            <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 text-fenix-600 dark:text-fourth font-bold">
                                    <Zap className="w-4 h-4" />
                                    <span>{punto.consumo_anual_kwh ? formatKwh(punto.consumo_anual_kwh) : '—'}</span>
                                </div>
                                {punto.p1_kw && (
                                    <p className="text-xs text-secondary opacity-60 font-medium">{punto.p1_kw} kW</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

