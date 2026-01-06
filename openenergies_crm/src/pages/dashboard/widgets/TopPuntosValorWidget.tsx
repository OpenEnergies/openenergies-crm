import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, TrendingUp, Zap } from 'lucide-react';
import { Link } from '@tanstack/react-router';

type TopPunto = {
    id: string;
    cups: string;
    consumo_anual_kwh: number | null;
    potencia_contratada_kw: number | null;
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
      potencia_contratada_kw,
      clientes!inner(id, nombre)
    `)
        .not('consumo_anual_kwh', 'is', null)
        .order('consumo_anual_kwh', { ascending: false, nullsFirst: false })
        .limit(5);

    if (error) throw error;
    return (data as unknown as TopPunto[]) || [];
}

function formatKwh(kwh: number): string {
    if (kwh >= 1_000_000) {
        return `${(kwh / 1_000_000).toFixed(2)} GWh`;
    } else if (kwh >= 1_000) {
        return `${(kwh / 1_000).toFixed(1)} MWh`;
    }
    return `${kwh.toLocaleString()} kWh`;
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
                        <TrendingUp className="w-5 h-5 text-fenix-500" />
                    </div>
                    <h3 className="text-base font-semibold text-white">Puntos de Alto Valor</h3>
                </div>
                <Link
                    to="/app/puntos"
                    className="text-sm text-fenix-500 hover:text-fenix-400 transition-colors"
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
                <div className="text-center py-8 text-gray-400">
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
                ${index === 0 ? 'bg-amber-500/20 text-amber-400' :
                                    index === 1 ? 'bg-gray-400/20 text-gray-300' :
                                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-bg-intermediate text-gray-400'}
              `}>
                                {index + 1}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <Link
                                    to="/app/clientes/$id"
                                    params={{ id: punto.clientes?.id || '' }}
                                    className="text-sm font-medium text-white hover:text-fenix-400 transition-colors truncate block"
                                >
                                    {punto.clientes?.nombre || 'Sin cliente'}
                                </Link>
                                <p className="text-xs text-gray-500 font-mono truncate">{punto.cups}</p>
                            </div>

                            {/* Value */}
                            <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 text-fenix-500 font-semibold">
                                    <Zap className="w-4 h-4" />
                                    <span>{punto.consumo_anual_kwh ? formatKwh(punto.consumo_anual_kwh) : '—'}</span>
                                </div>
                                {punto.potencia_contratada_kw && (
                                    <p className="text-xs text-gray-500">{punto.potencia_contratada_kw} kW</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

