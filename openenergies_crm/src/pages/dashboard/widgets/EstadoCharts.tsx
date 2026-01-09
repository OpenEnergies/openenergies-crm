import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, MapPin, FileText } from 'lucide-react';
import type { EstadoCliente } from '@lib/types';

type ChartData = {
    puntosEstados: Record<string, number>;
    contratosEstados: Record<string, number>;
};

const ESTADO_PUNTO_COLORS: Record<string, string> = {
    'activo': 'bg-green-500',
    'Aceptado': 'bg-emerald-500', // Added missing state
    'procesando': 'bg-yellow-500',
    'stand by': 'bg-gray-400',
    'desistido': 'bg-red-500',
};

const ESTADO_CONTRATO_COLORS: Record<string, string> = {
    'activo': 'bg-fenix-500',
    'pendiente': 'bg-yellow-500',
    'En curso': 'bg-blue-500',
    'expirado': 'bg-red-500',
    'cancelado': 'bg-gray-400',
};

async function fetchChartData(): Promise<ChartData> {
    // Fetch clientes agrupados por estado (for supply points)
    const { data: clientes } = await supabase
        .from('puntos_suministro')
        .select('estado');

    const puntosEstados: Record<string, number> = {};
    clientes?.forEach(c => {
        const estado = c.estado || 'stand by';
        puntosEstados[estado] = (puntosEstados[estado] || 0) + 1;
    });

    // Fetch contratos agrupados por estado
    const { data: contratos } = await supabase
        .from('contratos')
        .select('estado');

    const contratosEstados: Record<string, number> = {};
    contratos?.forEach(c => {
        const estado = c.estado || 'Sin estado';
        contratosEstados[estado] = (contratosEstados[estado] || 0) + 1;
    });

    return { puntosEstados, contratosEstados };
}

function HorizontalBarChart({
    data,
    colors,
    title,
    icon: Icon
}: {
    data: Record<string, number>;
    colors: Record<string, string>;
    title: string;
    icon: React.ElementType;
}) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);


    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                </div>
                <h3 className="text-base font-bold text-primary">{title}</h3>
            </div>

            <div className="space-y-3">
                {entries.map(([estado, count]) => {
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const barColor = colors[estado] || 'bg-bg-intermediate';

                    return (
                        <div key={estado}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-secondary font-medium truncate capitalize">{estado}</span>
                                <span className="text-sm font-bold text-fenix-600 dark:text-fourth ml-2">{count}</span>
                            </div>
                            <div className="h-2 bg-bg-intermediate rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}

                {entries.length === 0 && (
                    <p className="text-secondary opacity-60 text-sm text-center py-4 italic">Sin datos disponibles</p>
                )}
            </div>

            {total > 0 && (
                <p className="text-xs text-secondary opacity-60 mt-4 text-right italic font-medium">Total: {total}</p>
            )}
        </div>
    );
}

export default function EstadoCharts() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard-estado-charts'],
        queryFn: fetchChartData,
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {[1, 2].map(i => (
                    <div key={i} className="glass-card p-5 flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
                    </div>
                ))}
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="glass-card p-5 text-center text-red-600 dark:text-red-400 font-medium italic">
                Error al cargar los gráficos
            </div>
        );
    }

    return (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <HorizontalBarChart
                data={data.puntosEstados}
                colors={ESTADO_PUNTO_COLORS}
                title="Estado de Puntos de Suministro"
                icon={MapPin}
            />
            <HorizontalBarChart
                data={data.contratosEstados}
                colors={ESTADO_CONTRATO_COLORS}
                title="Estado de Contratos"
                icon={FileText}
            />
        </div>
    );
}

