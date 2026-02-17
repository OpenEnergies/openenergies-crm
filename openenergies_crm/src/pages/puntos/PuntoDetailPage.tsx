// src/pages/puntos/PuntoDetailPage.tsx
import { useState, useMemo } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useTheme } from '@hooks/ThemeContext';
import {
    MapPin, Zap, Receipt, ArrowLeft, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Flame
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import EmpresaLogo from '@components/EmpresaLogo';

// ─── Types ───
interface PuntoInfo {
    id: string;
    cups: string;
    tarifa: string | null;
    tipo_factura: string | null;
    direccion_sum: string;
    localidad_sum: string | null;
    provincia_sum: string | null;
    p1_kw: number | null;
    p2_kw: number | null;
    p3_kw: number | null;
    p4_kw: number | null;
    p5_kw: number | null;
    p6_kw: number | null;
    comercializadora: { nombre: string; logo_url: string | null } | { nombre: string; logo_url: string | null }[] | null;
}

interface FacturaRow {
    fecha_emision: string;
    consumo_kwh: number | null;
    total: number;
    precio_eur_kwh: number | null;
}

// ─── Month labels ───
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ─── Data Hooks ───
function usePuntoInfo(puntoId: string | undefined) {
    return useQuery({
        queryKey: ['punto-detail-info', puntoId],
        queryFn: async () => {
            if (!puntoId) throw new Error('No punto ID');
            const { data, error } = await supabase
                .from('puntos_suministro')
                .select(`
          id, cups, tarifa, tipo_factura, direccion_sum, localidad_sum, provincia_sum,
          p1_kw, p2_kw, p3_kw, p4_kw, p5_kw, p6_kw,
          comercializadora:empresas!current_comercializadora_id (nombre, logo_url)
        `)
                .eq('id', puntoId)
                .single();
            if (error) throw error;
            return data as PuntoInfo;
        },
        enabled: !!puntoId,
    });
}

function useFacturacionPuntoByYear(puntoId: string | undefined, year: number) {
    return useQuery({
        queryKey: ['punto-detail-facturas', puntoId, year],
        queryFn: async () => {
            if (!puntoId) throw new Error('No punto ID');
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            const { data, error } = await supabase
                .from('facturacion_clientes')
                .select('fecha_emision, consumo_kwh, total, precio_eur_kwh')
                .eq('punto_id', puntoId)
                .gte('fecha_emision', startDate)
                .lte('fecha_emision', endDate)
                .is('eliminado_en', null)
                .order('fecha_emision', { ascending: true });
            if (error) throw error;
            return (data || []) as FacturaRow[];
        },
        enabled: !!puntoId,
    });
}

// ─── Main Component ───
export default function PuntoDetailPage() {
    const { id } = useParams({ strict: false }) as { id: string };
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const { data: punto, isLoading: loadingPunto } = usePuntoInfo(id);
    const { data: facturas, isLoading: loadingFacturas } = useFacturacionPuntoByYear(id, selectedYear);

    // ─── Derived Data ───
    const consumoAnual = useMemo(() => {
        if (!facturas) return 0;
        return facturas.reduce((sum, f) => sum + (f.consumo_kwh || 0), 0);
    }, [facturas]);

    const costeAnual = useMemo(() => {
        if (!facturas) return 0;
        return facturas.reduce((sum, f) => sum + (f.total || 0), 0);
    }, [facturas]);

    // Monthly data: always 12 months (Jan–Dec), fill with 0/null if no data
    const monthlyData = useMemo(() => {
        // Initialize all 12 months
        const months = MONTH_LABELS.map((label, i) => ({
            mes: label,
            monthIdx: i,
            consumo: 0,
            coste: 0,
            precio: null as number | null,
            _precioSum: 0,
            _precioCount: 0,
        }));

        if (facturas) {
            facturas.forEach(f => {
                const d = new Date(f.fecha_emision);
                const mIdx = d.getMonth();
                if (months[mIdx]) {
                    months[mIdx].consumo += f.consumo_kwh || 0;
                    months[mIdx].coste += f.total || 0;
                    if (f.precio_eur_kwh) {
                        months[mIdx]._precioSum += f.precio_eur_kwh;
                        months[mIdx]._precioCount += 1;
                    }
                }
            });
        }

        return months.map(m => ({
            mes: m.mes,
            consumo: Math.round(m.consumo),
            coste: Math.round(m.coste * 100) / 100,
            precio: m._precioCount > 0 ? Math.round((m._precioSum / m._precioCount) * 10000) / 10000 : null,
        }));
    }, [facturas]);

    const potencias = useMemo(() => {
        if (!punto) return [];
        return [
            { label: 'P1', value: punto.p1_kw },
            { label: 'P2', value: punto.p2_kw },
            { label: 'P3', value: punto.p3_kw },
            { label: 'P4', value: punto.p4_kw },
            { label: 'P5', value: punto.p5_kw },
            { label: 'P6', value: punto.p6_kw },
        ];
    }, [punto]);

    const comercializadoraNombre = useMemo(() => {
        if (!punto?.comercializadora) return '—';
        if (Array.isArray(punto.comercializadora) && punto.comercializadora[0]) return punto.comercializadora[0].nombre;
        if (!Array.isArray(punto.comercializadora) && (punto.comercializadora as any).nombre) return (punto.comercializadora as any).nombre;
        return '—';
    }, [punto]);

    const comercializadoraLogoUrl = useMemo(() => {
        if (!punto?.comercializadora) return null;
        if (Array.isArray(punto.comercializadora) && punto.comercializadora[0]) return punto.comercializadora[0].logo_url;
        if (!Array.isArray(punto.comercializadora) && (punto.comercializadora as any).logo_url) return (punto.comercializadora as any).logo_url;
        return null;
    }, [punto]);

    const isLuz = punto?.tipo_factura === 'Luz';

    // ─── Chart Colors ───
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

    // ─── Loading State ───
    if (loadingPunto) {
        return (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="glass-card p-12 flex items-center justify-center">
                    <div className="animate-spin text-fenix-500"><MapPin size={32} /></div>
                    <p className="ml-3 text-secondary font-medium">Cargando datos del punto...</p>
                </div>
            </div>
        );
    }

    if (!punto) {
        return (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="glass-card p-12 text-center text-secondary">
                    <p>No se encontró el punto de suministro.</p>
                    <Link to="/app/puntos" className="text-fenix-500 hover:underline mt-2 inline-block">
                        Volver a Puntos de Suministro
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 animate-fade-in">
            {/* ─── Header ─── */}
            <div className="flex items-center gap-4">
                <Link to="/app/puntos" className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Detalle del Punto</h1>
                </div>
            </div>

            {/* ═══ ROW 1: Tarifa+Tipo | Potencias (only Luz) | Consumo+Coste ═══ */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isLuz ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4`}>
                {/* Tarifa + Tipo (stacked) */}
                <div className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-fenix-500/15 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-fenix-500" />
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Tarifa</p>
                            <p className="text-base font-bold text-primary">{punto.tarifa || '—'}</p>
                        </div>
                    </div>
                    <div className="border-t border-fenix-500/10 pt-2 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                            <Flame className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Tipo</p>
                            <p className="text-base font-bold text-primary">{punto.tipo_factura || '—'}</p>
                        </div>
                    </div>
                </div>

                {/* Potencias Contratadas - Only shown for Luz */}
                {isLuz && (
                    <div className="glass-card p-4 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-fenix-500/15 flex items-center justify-center">
                                <Zap className="w-3.5 h-3.5 text-fenix-500" />
                            </div>
                            <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Potencias contratadas (kW)</p>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {potencias.map(p => (
                                <div key={p.label} className="bg-bg-intermediate rounded-lg p-2 text-center">
                                    <span className="block text-[10px] text-fenix-600 dark:text-fenix-400 font-bold uppercase">{p.label}</span>
                                    <span className="block text-base font-bold text-primary mt-0.5">
                                        {p.value != null && p.value > 0 ? p.value : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Consumo Anual + Coste Anual (stacked) */}
                <div className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Consumo Anual</p>
                            <p className="text-lg font-bold text-primary">{consumoAnual.toLocaleString('es-ES')} kWh</p>
                        </div>
                    </div>
                    <div className="border-t border-fenix-500/10 pt-2 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Coste Anual</p>
                            <p className="text-lg font-bold text-primary">{costeAnual.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ ROW 2: Dirección + Info Adicional ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Dirección de Suministro */}
                <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-fenix-500/15 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-fenix-500" />
                        </div>
                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Dirección de Suministro</p>
                    </div>
                    <p className="text-primary font-bold text-base leading-relaxed break-words">
                        {punto.direccion_sum || '—'}
                    </p>
                    <p className="text-secondary font-medium text-sm mt-1">
                        {[punto.localidad_sum, punto.provincia_sum].filter(Boolean).join(', ') || '—'}
                    </p>
                </div>

                {/* Información Adicional */}
                <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                            <Receipt className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Información adicional</p>
                    </div>
                    <div className="flex items-stretch gap-4">
                        {/* Left: Comercializadora + CUPS */}
                        <div className="flex-1 space-y-3">
                            <div>
                                <span className="block text-[11px] text-secondary font-medium uppercase tracking-wider mb-0.5">Comercializadora</span>
                                <span className="text-primary font-bold">{comercializadoraNombre}</span>
                            </div>
                            <div>
                                <span className="block text-[11px] text-secondary font-medium uppercase tracking-wider mb-0.5">CUPS</span>
                                <code className="text-primary font-bold font-mono text-sm">{punto.cups}</code>
                            </div>
                        </div>
                        {/* Right: Logo large, vertically centered */}
                        <div className="flex-1 flex items-center justify-center">
                            <EmpresaLogo
                                logoUrl={comercializadoraLogoUrl}
                                nombre={comercializadoraNombre}
                                size="lg"
                                className="!w-24 !h-24 !rounded-2xl"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ YEAR SELECTOR ═══ */}
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-lg font-bold text-primary min-w-[60px] text-center">{selectedYear}</span>
                <button
                    onClick={() => setSelectedYear(y => y + 1)}
                    disabled={selectedYear >= currentYear}
                    className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* ═══ ROW 3: Charts (3 in a row, line charts) ═══ */}
            {loadingFacturas ? (
                <div className="glass-card p-12 flex items-center justify-center">
                    <div className="animate-spin text-fenix-500"><BarChart3 size={24} /></div>
                    <p className="ml-3 text-secondary font-medium text-sm">Cargando gráficos de {selectedYear}...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Consumo Mensual */}
                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Consumo Mensual (kWh)</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="consumoGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColors.consumo} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={chartColors.consumo} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES')} kWh`, 'Consumo']} />
                                <Area type="monotone" dataKey="consumo" stroke={chartColors.consumo} strokeWidth={2.5} fill="url(#consumoGrad)" dot={{ fill: chartColors.consumo, r: 3 }} activeDot={{ r: 5 }} connectNulls />
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
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="costeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColors.coste} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={chartColors.coste} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste']} />
                                <Area type="monotone" dataKey="coste" stroke={chartColors.coste} strokeWidth={2.5} fill="url(#costeGrad)" dot={{ fill: chartColors.coste, r: 3 }} activeDot={{ r: 5 }} connectNulls />
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
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="precioGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColors.precio} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={chartColors.precio} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} domain={['auto', 'auto']} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [value != null ? `${Number(value).toFixed(4)} €/kWh` : 'N/D', 'Precio']} />
                                <Area type="monotone" dataKey="precio" stroke={chartColors.precio} strokeWidth={2.5} fill="url(#precioGrad)" dot={{ fill: chartColors.precio, r: 3 }} activeDot={{ r: 5 }} connectNulls />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
