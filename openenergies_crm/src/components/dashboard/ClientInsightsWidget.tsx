// src/components/dashboard/ClientInsightsWidget.tsx
// Client-level dashboard insights: KPIs + monthly charts (default export)
// Cost breakdown bar exported separately as CostBreakdownWidget
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useTheme } from '@hooks/ThemeContext';
import {
    BarChart3, TrendingUp, Zap, Loader2, Receipt,
} from 'lucide-react';
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────
interface FacturaRow {
    fecha_emision: string;
    consumo_kwh: number | null;
    total: number;
    precio_eur_kwh: number | null;
    tipo_factura: string | null;
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ── Data Hook: invoices for a given year (or last 12 months if no year) ─────
function useClientFacturas(clienteId?: string, empresaId?: string, year?: number) {
    return useQuery<FacturaRow[]>({
        queryKey: ['client-dashboard-facturas', clienteId, empresaId, year ?? 'last12'],
        queryFn: async () => {
            let query = supabase
                .from('facturacion_clientes')
                .select('fecha_emision, consumo_kwh, total, precio_eur_kwh, tipo_factura')
                .is('eliminado_en', null)
                .order('fecha_emision', { ascending: true });

            if (year) {
                query = query.gte('fecha_emision', `${year}-01-01`).lte('fecha_emision', `${year}-12-31`);
            } else {
                const since = new Date();
                since.setFullYear(since.getFullYear() - 1);
                query = query.gte('fecha_emision', since.toISOString().split('T')[0]);
            }

            if (clienteId) {
                query = query.eq('cliente_id', clienteId);
            }
            if (empresaId) {
                query = query.eq('comercializadora_id', empresaId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data ?? []) as FacturaRow[];
        },
        staleTime: 5 * 60 * 1000,
    });
}

// ── Main Component (KPIs + 3 monthly charts) ───────────────────
// year: if provided, fetches that year's data; otherwise last 12 months
// month: 0-11, if provided KPIs aggregate only that month (charts stay full year)
export default function ClientInsightsWidget({ clienteId, empresaId, year, month }: { clienteId?: string, empresaId?: string, year?: number, month?: number }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { data: facturas, isLoading } = useClientFacturas(clienteId, empresaId, year);

    // Filter facturas for KPIs when in monthly mode
    const kpiFacturas = useMemo(() => {
        if (!facturas) return [];
        if (month === undefined) return facturas;
        return facturas.filter(f => new Date(f.fecha_emision).getMonth() === month);
    }, [facturas, month]);

    // ── Derived data (uses kpiFacturas for KPIs) ──
    const consumoAnual = useMemo(() => {
        return kpiFacturas.reduce((sum, f) => sum + (f.consumo_kwh || 0), 0);
    }, [kpiFacturas]);

    const costeAnual = useMemo(() => {
        return kpiFacturas.reduce((sum, f) => sum + (f.total || 0), 0);
    }, [kpiFacturas]);

    const numFacturas = kpiFacturas.length;

    const periodLabel = month !== undefined ? MONTH_LABELS[month] + ' ' + (year ?? '') : (year ? String(year) : '12 meses');

    // ── Monthly breakdown ──
    const monthlyData = useMemo(() => {
        const months = MONTH_LABELS.map(label => ({
            mes: label,
            consumo: 0,
            coste: 0,
            _precioSum: 0,
            _precioCount: 0,
            precio: null as number | null,
        }));

        facturas?.forEach(f => {
            const mIdx = new Date(f.fecha_emision).getMonth();
            if (months[mIdx]) {
                months[mIdx].consumo += f.consumo_kwh || 0;
                months[mIdx].coste += f.total || 0;
                if (f.precio_eur_kwh) {
                    months[mIdx]._precioSum += f.precio_eur_kwh;
                    months[mIdx]._precioCount += 1;
                }
            }
        });

        return months.map(m => ({
            mes: m.mes,
            consumo: Math.round(m.consumo),
            coste: Math.round(m.coste * 100) / 100,
            precio: m._precioCount > 0 ? Math.round((m._precioSum / m._precioCount) * 10000) / 10000 : null,
        }));
    }, [facturas]);

    // ── Chart styling ──
    const chartColors = {
        consumo: isDark ? '#34d399' : '#10b981',
        coste: isDark ? '#60a5fa' : '#3b82f6',
        precio: isDark ? '#f59e0b' : '#d97706',
        grid: isDark ? '#334155' : '#e2e8f0',
        text: isDark ? '#94a3b8' : '#64748b',
    };

    const tooltipStyle = {
        backgroundColor: isDark ? '#1e293b' : '#fff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        color: isDark ? '#e2e8f0' : '#1e293b',
        fontSize: '12px',
    };

    if (isLoading) {
        return (
            <div className="glass-card p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
                <span className="text-sm text-secondary">Cargando datos del cliente…</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Consumo */}
                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <BarChart3 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Consumo ({periodLabel})</p>
                        <p className="text-xl font-bold text-primary">{consumoAnual.toLocaleString('es-ES')} kWh</p>
                    </div>
                </div>

                {/* Coste */}
                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Coste ({periodLabel})</p>
                        <p className="text-xl font-bold text-primary">
                            {costeAnual.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </p>
                    </div>
                </div>

                {/* Facturas */}
                <div className="glass-card p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Facturas ({periodLabel})</p>
                        <p className="text-xl font-bold text-primary">{numFacturas}</p>
                    </div>
                </div>
            </div>

            {/* ── Monthly Charts Row: Consumo, Coste, Precio ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Consumo Mensual */}
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Consumo Mensual (kWh)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="clConsumoGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColors.consumo} stopOpacity={0.25} />
                                    <stop offset="100%" stopColor={chartColors.consumo} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                            <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                            <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: any) => [`${Number(value).toLocaleString('es-ES')} kWh`, 'Consumo']}
                            />
                            <Area type="monotone" dataKey="consumo" stroke={chartColors.consumo} strokeWidth={2.5}
                                fill="url(#clConsumoGrad)"
                                dot={(props: any) => {
                                    const { cx, cy, index } = props;
                                    const isSelected = month !== undefined && index === month;
                                    return <circle cx={cx} cy={cy} r={isSelected ? 7 : 3} fill={chartColors.consumo} stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 2 : 0} style={isSelected ? { filter: `drop-shadow(0 0 6px ${chartColors.consumo})` } : undefined} />;
                                }}
                                activeDot={{ r: 5 }}
                                connectNulls />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Coste Mensual */}
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                            <Receipt className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Coste Mensual (€)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="clCosteGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColors.coste} stopOpacity={0.25} />
                                    <stop offset="100%" stopColor={chartColors.coste} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                            <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                            <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: any) => [`${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste']}
                            />
                            <Area type="monotone" dataKey="coste" stroke={chartColors.coste} strokeWidth={2.5}
                                fill="url(#clCosteGrad)"
                                dot={(props: any) => {
                                    const { cx, cy, index } = props;
                                    const isSelected = month !== undefined && index === month;
                                    return <circle cx={cx} cy={cy} r={isSelected ? 7 : 3} fill={chartColors.coste} stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 2 : 0} style={isSelected ? { filter: `drop-shadow(0 0 6px ${chartColors.coste})` } : undefined} />;
                                }}
                                activeDot={{ r: 5 }}
                                connectNulls />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Precio kWh */}
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Precio (€/kWh)</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="clPrecioGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColors.precio} stopOpacity={0.25} />
                                    <stop offset="100%" stopColor={chartColors.precio} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                            <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                            <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                formatter={(value: any) => [value != null ? `${Number(value).toFixed(4)} €/kWh` : 'N/D', 'Precio']}
                            />
                            <Area type="monotone" dataKey="precio" stroke={chartColors.precio} strokeWidth={2.5}
                                fill="url(#clPrecioGrad)"
                                dot={(props: any) => {
                                    const { cx, cy, index } = props;
                                    const isSelected = month !== undefined && index === month;
                                    return <circle cx={cx} cy={cy} r={isSelected ? 7 : 3} fill={chartColors.precio} stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 2 : 0} style={isSelected ? { filter: `drop-shadow(0 0 6px ${chartColors.precio})` } : undefined} />;
                                }}
                                activeDot={{ r: 5 }}
                                connectNulls />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// ── Cost Breakdown Widget (full-width, separate placement) ──────
// year/month: same logic as ClientInsightsWidget — month filters the breakdown data
export function CostBreakdownWidget({ clienteId, empresaId, year, month }: { clienteId?: string, empresaId?: string, year?: number, month?: number }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { data: facturas, isLoading } = useClientFacturas(clienteId, empresaId, year);

    // Filter by month for breakdown if monthly mode
    const filteredFacturas = useMemo(() => {
        if (!facturas) return [];
        if (month === undefined) return facturas;
        return facturas.filter(f => new Date(f.fecha_emision).getMonth() === month);
    }, [facturas, month]);

    const costeAnual = useMemo(() => {
        return filteredFacturas.reduce((sum, f) => sum + (f.total || 0), 0);
    }, [filteredFacturas]);

    const costByType = useMemo(() => {
        const totals = new Map<string, number>();
        filteredFacturas.forEach(f => {
            const tipo = f.tipo_factura || 'Otro';
            totals.set(tipo, (totals.get(tipo) || 0) + (f.total || 0));
        });
        const entries = Array.from(totals.entries()).map(([tipo, total]) => ({
            tipo,
            total: Math.round(total * 100) / 100,
        }));
        entries.sort((a, b) => b.total - a.total);
        return entries;
    }, [filteredFacturas]);

    const periodLabel = month !== undefined ? `Mensual (${MONTH_LABELS[month]}) por Tipo` : 'Anual por Tipo';

    const SEGMENT_COLORS = [
        { bg: isDark ? '#60a5fa' : '#3b82f6', label: '#fff' },
        { bg: isDark ? '#f97316' : '#ea580c', label: '#fff' },
        { bg: isDark ? '#a78bfa' : '#7c3aed', label: '#fff' },
        { bg: isDark ? '#34d399' : '#10b981', label: '#fff' },
    ];
    const SEGMENT_ICONS = ['⚡', '🔥', '🔵', '🟢'];

    if (isLoading) return null;

    return (
        <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    Desglose de Coste {periodLabel}
                </h3>
            </div>

            {costeAnual > 0 ? (
                <>
                    <div className="h-10 rounded-xl overflow-hidden flex" style={{ minWidth: 0 }}>
                        {costByType.map((entry, i) => {
                            const pct = (entry.total / costeAnual) * 100;
                            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
                            return (
                                <div
                                    key={entry.tipo}
                                    className="flex items-center justify-center transition-all duration-500"
                                    style={{
                                        width: `${pct}%`,
                                        backgroundColor: color.bg,
                                        minWidth: pct > 3 ? undefined : '24px',
                                    }}
                                    title={`${entry.tipo}: ${entry.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € (${pct.toFixed(1)}%)`}
                                >
                                    {pct > 8 && (
                                        <span className="text-[11px] font-bold truncate px-2" style={{ color: color.label }}>
                                            {pct.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                        {costByType.map((entry, i) => {
                            const pct = (entry.total / costeAnual) * 100;
                            const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
                            const icon = SEGMENT_ICONS[i % SEGMENT_ICONS.length];
                            return (
                                <div key={entry.tipo} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color.bg }} />
                                    <span className="text-xs text-secondary">
                                        {icon} {entry.tipo}: <strong className="text-primary">{entry.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong> ({pct.toFixed(1)}%)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <p className="text-sm text-secondary text-center py-4">Sin datos de facturación</p>
            )}
        </div>
    );
}
