import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';
import type { ChartDataPoint } from '@features/market-data/services/marketData';

interface SpainPortugalChartProps {
    data: ChartDataPoint[];
    height?: number;
}

/**
 * Gráfico comparativo España vs Portugal (OMIE)
 * Muestra la evolución horaria del precio del mercado diario
 */
export function SpainPortugalChart({ data, height = 320 }: SpainPortugalChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center text-slate-400" style={{ height }}>
                No hay datos disponibles
            </div>
        );
    }

    // Calcular promedios para líneas de referencia
    const avgSpain = data.reduce((sum, d) => sum + (d.omie_spain || 0), 0) / data.filter(d => d.omie_spain).length;
    const avgPortugal = data.reduce((sum, d) => sum + (d.omie_portugal || 0), 0) / data.filter(d => d.omie_portugal).length;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-900">Mercado Diario - España vs Portugal</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Precio horario del mercado mayorista (OMIE)</p>
                </div>
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        <span className="text-slate-600">España</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-slate-600">Portugal</span>
                    </div>
                </div>
            </div>

            <div style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradientSpain" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradientPortugal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            interval={3}
                            tickFormatter={(value: string) => value.endsWith(':00') ? value : ''}
                        />

                        <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}€`}
                            width={50}
                        />

                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                fontSize: '12px'
                            }}
                            formatter={(value: any, name: any) => [
                                typeof value === 'number' ? `${value.toFixed(2)} €/MWh` : '—',
                                name === 'omie_spain' ? 'España' : 'Portugal'
                            ]}
                            labelFormatter={(label) => `Hora: ${label}`}
                        />

                        {/* Líneas de referencia (promedios) */}
                        <ReferenceLine
                            y={avgSpain}
                            stroke="#f59e0b"
                            strokeDasharray="5 5"
                            strokeOpacity={0.5}
                        />
                        <ReferenceLine
                            y={avgPortugal}
                            stroke="#3b82f6"
                            strokeDasharray="5 5"
                            strokeOpacity={0.5}
                        />

                        <Area
                            type="monotone"
                            dataKey="omie_spain"
                            name="omie_spain"
                            stroke="#f59e0b"
                            fill="url(#gradientSpain)"
                            strokeWidth={2}
                        />

                        <Line
                            type="monotone"
                            dataKey="omie_portugal"
                            name="omie_portugal"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="flex justify-center gap-6 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>Media ES: <strong className="text-amber-600">{avgSpain.toFixed(2)} €/MWh</strong></span>
                <span>Media PT: <strong className="text-blue-600">{avgPortugal.toFixed(2)} €/MWh</strong></span>
                <span>Diferencia: <strong className={avgSpain > avgPortugal ? 'text-red-600' : 'text-emerald-600'}>
                    {Math.abs(avgSpain - avgPortugal).toFixed(2)} €/MWh
                </strong></span>
            </div>
        </div>
    );
}

interface PVPCChartProps {
    data: ChartDataPoint[];
    height?: number;
}

/**
 * Gráfico PVPC con periodos tarifarios coloreados
 */
export function PVPCChart({ data, height = 280 }: PVPCChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center text-slate-400" style={{ height }}>
                No hay datos disponibles
            </div>
        );
    }

    // Colorear puntos según periodo
    const getBarColor = (period: string | undefined) => {
        switch (period) {
            case 'P1': return '#ef4444'; // red
            case 'P2': return '#eab308'; // yellow
            case 'P3': return '#10b981'; // green
            default: return '#94a3b8';
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-900">Precio Voluntario para el Pequeño Consumidor (PVPC)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Tarifa regulada 2.0TD con discriminación horaria</p>
                </div>
                <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span className="text-slate-600">P1 Punta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                        <span className="text-slate-600">P2 Llano</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-600">P3 Valle</span>
                    </div>
                </div>
            </div>

            <div style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                        />

                        <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}€`}
                            width={50}
                        />

                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                fontSize: '12px'
                            }}
                            formatter={(value: any, _: any, props: any) => {
                                const period = props.payload.period;
                                const periodName = period === 'P1' ? 'Punta' : period === 'P2' ? 'Llano' : 'Valle';
                                return [typeof value === 'number' ? `${value.toFixed(2)} €/MWh (${periodName})` : '—', 'PVPC'];
                            }}
                            labelFormatter={(label) => `Hora: ${label}`}
                        />

                        <Area
                            type="monotone"
                            dataKey="pvpc"
                            stroke="#6366f1"
                            fill="#6366f1"
                            fillOpacity={0.15}
                            strokeWidth={2}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

interface SimpleLineChartProps {
    data: ChartDataPoint[];
    dataKey: 'surplus' | 'intraday';
    title: string;
    subtitle?: string;
    color?: string;
    height?: number;
    differential?: number;
    differentialLabel?: string;
}

/**
 * Gráfico de línea simple para autoconsumo e intradiario
 */
export function SimpleLineChart({
    data,
    dataKey,
    title,
    subtitle,
    color = '#10b981',
    height = 200,
    differential,
    differentialLabel
}: SimpleLineChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center text-slate-400" style={{ height }}>
                No hay datos disponibles
            </div>
        );
    }

    const avg = data.reduce((sum, d) => sum + (d[dataKey] || 0), 0) / data.filter(d => d[dataKey]).length;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold" style={{ color }}>{avg.toFixed(2)} €/MWh</p>
                    {differential !== undefined && differentialLabel && (
                        <p className={`text-xs ${differential >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {differential >= 0 ? '+' : ''}{differential.toFixed(2)} €/MWh {differentialLabel}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            interval={3}
                        />

                        <YAxis
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}€`}
                            width={45}
                        />

                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px'
                            }}
                            formatter={(value: any) => [typeof value === 'number' ? `${value.toFixed(2)} €/MWh` : '—', title]}
                        />

                        <ReferenceLine y={avg} stroke={color} strokeDasharray="5 5" strokeOpacity={0.5} />

                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            fill={`url(#gradient-${dataKey})`}
                            strokeWidth={2}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
