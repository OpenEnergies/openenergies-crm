import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import {
    Search, BarChart3, Receipt, Loader2, Calendar,
    Filter, Plus, Trash2, ChevronDown, List, LayoutGrid, Users, Zap,
    Type, MousePointer2, PieChart as PieIcon, LineChart as LineIcon, BarChart2
} from 'lucide-react';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { format, subMonths, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useTheme } from '@hooks/ThemeContext';

// ============ TYPES & SCHEMAS ============

const MetricSchema = z.object({
    measure: z.enum([
        'total', 'consumo_kwh', 'precio_eur_kwh', 'potencia_kw_min',
        'potencia_kw_max', 'importe_impuesto_principal',
        'importe_impuesto_secundario', 'impuesto_total', 'precio_efectivo_kwh'
    ]),
    aggregation: z.enum(['sum', 'avg', 'min', 'max', 'stddev', 'count']),
    chartType: z.enum(['bar', 'line', 'scatter', 'pie']).default('bar')
});

type Metric = z.infer<typeof MetricSchema>;

const AggregateResponseSchema = z.object({
    summary: z.record(z.any()),
    groups: z.array(z.record(z.any())).nullable(),
    meta: z.object({
        group_by: z.string(),
        date_from: z.string(),
        date_to: z.string(),
        row_count: z.number()
    })
});

type AggregateResponse = z.infer<typeof AggregateResponseSchema>;

type GroupByOption = 'none' | 'month' | 'client' | 'point' | 'retailer' | 'tariff' | 'province' | 'invoice_type';

// ============ CONSTANTS ============

const MEASURE_LABELS: Record<string, string> = {
    total: 'Total (€)',
    consumo_kwh: 'Consumo (kWh)',
    precio_eur_kwh: 'PVP Medio (€/kWh)',
    potencia_kw_min: 'Potencia Mín (kW)',
    potencia_kw_max: 'Potencia Máx (kW)',
    importe_impuesto_principal: 'Impuesto Princ. (€)',
    importe_impuesto_secundario: 'Impuesto Sec. (€)',
    impuesto_total: 'Impuestos Totales (€)',
    precio_efectivo_kwh: 'Precio Efectivo (€/kWh)'
};

const AGG_LABELS: Record<string, string> = {
    sum: 'Suma',
    avg: 'Media',
    min: 'Mínimo',
    max: 'Máximo',
    stddev: 'Desv. Estándar',
    count: 'Recuento'
};

const GROUP_LABELS: Record<GroupByOption, string> = {
    none: 'Sin agrupación',
    month: 'Mes',
    client: 'Cliente',
    point: 'CUPS',
    retailer: 'Comercializadora',
    tariff: 'Tarifa',
    province: 'Provincia',
    invoice_type: 'Tipo Factura'
};

// ============ COMPONENTS ============

export default function AnalyticsPage() {
    const { theme } = useTheme();
    // --- State: Filters ---
    const [selectedClients, setSelectedClients] = useState<string[] | null>(null); // null = "Todos"
    const [selectedPoints, setSelectedPoints] = useState<string[] | null>(null);   // null = "Todos"
    const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
    const [selectedTariffs, setSelectedTariffs] = useState<string[]>([]);
    const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
    const [invoiceType, setInvoiceType] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{ from: string, to: string }>({
        from: format(subMonths(new Date(), 12), 'yyyy-MM-01'),
        to: format(new Date(), 'yyyy-MM-dd')
    });

    // --- State: Builder ---
    const [metrics, setMetrics] = useState<Metric[]>([
        { measure: 'total', aggregation: 'sum', chartType: 'bar' }
    ]);
    const [groupBy, setGroupBy] = useState<GroupByOption>('month');
    const [topN, setTopN] = useState(20);

    // --- State: UI ---
    const [debouncedParams, setDebouncedParams] = useState<any>(null);

    // --- Fetch: Filter Options (Static) ---
    const { data: filtersData } = useQuery({
        queryKey: ['analytics-filters'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_analytics_filters');
            if (error) throw error;
            return data;
        }
    });

    // --- Fetch: Search Points (Dynamic) ---
    const [pointSearch, setPointSearch] = useState('');
    const { data: searchPointsData, isLoading: isSearchingPoints } = useQuery({
        queryKey: ['analytics-search-points', pointSearch, selectedClients],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('search_puntos_suministro', {
                search_text: pointSearch,
                cliente_ids: selectedClients,
                limit_count: 50
            });
            if (error) throw error;
            return data;
        }
    });

    // --- Debounce Logic ---
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedParams({
                cliente_ids: selectedClients,
                punto_ids: selectedPoints,
                comercializadora_ids: selectedRetailers.length > 0 ? selectedRetailers : null,
                tipo_factura_val: invoiceType,
                tarifa_vals: selectedTariffs.length > 0 ? selectedTariffs : null,
                provincia_vals: selectedProvinces.length > 0 ? selectedProvinces : null,
                fecha_desde: dateRange.from,
                fecha_hasta: dateRange.to,
                group_by_key: groupBy,
                metrics: metrics.map(({ measure, aggregation }) => ({ measure, aggregation })),
                top_n: topN
            });
        }, 500);
        return () => clearTimeout(handler);
    }, [selectedClients, selectedPoints, selectedRetailers, invoiceType, selectedTariffs, selectedProvinces, dateRange, groupBy, metrics, topN]);

    // --- Fetch: Aggregated Data ---
    const { data: analytics, isLoading, isError } = useQuery({
        queryKey: ['analytics-data', debouncedParams],
        queryFn: async () => {
            if (!debouncedParams) return null;
            const { data, error } = await supabase.rpc('facturacion_aggregate', debouncedParams);
            if (error) {
                toast.error('Error al consultar datos');
                throw error;
            }
            return AggregateResponseSchema.parse(data);
        },
        enabled: !!debouncedParams
    });

    // --- Derived: Options for Selectors ---
    const clientOptions = useMemo(() =>
        filtersData?.clients.map((c: any) => ({
            value: c.id,
            label: c.name,
            disabled: !c.has_facturas
        })) || [],
        [filtersData]);

    const pointOptions = useMemo(() =>
        searchPointsData?.map((p: any) => ({
            value: p.id,
            label: p.cups,
            subtitle: `${p.direccion_sum || ''} - ${p.localidad_sum || ''} (${p.provincia_sum || ''})`,
            disabled: !p.has_facturas
        })) || [],
        [searchPointsData]);

    // --- Utilities ---
    const formatValue = (val: number, measure: string) => {
        if (measure.includes('total') || measure.includes('importe') || measure.includes('total')) {
            return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        }
        if (measure.includes('kwh')) {
            if (measure.includes('precio') || measure.includes('pvp')) {
                return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 4 });
            }
            return val.toLocaleString('es-ES') + ' kWh';
        }
        if (measure.includes('potencia')) return val.toLocaleString('es-ES') + ' kW';
        return val.toLocaleString('es-ES');
    };

    const getChartColor = (index: number) => {
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        return colors[index % colors.length];
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-12">
            <header className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Explorador de Datos</h2>
                    <p className="text-secondary opacity-70 text-sm">Analiza el consumo y facturación de forma dinámica.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Sidebar: Filters & Builder */}
                <aside className="xl:col-span-1 space-y-6">
                    {/* Filters Card */}
                    <div className="glass-card p-5 space-y-4">
                        <h3 className="text-sm font-bold text-fenix-400 uppercase tracking-wider flex items-center gap-2">
                            <Filter size={14} /> Filtros
                        </h3>

                        <div className="space-y-3">
                            <MultiSearchableSelect
                                label="Clientes"
                                icon={<Users size={14} />}
                                options={clientOptions}
                                selectedValues={selectedClients}
                                onChange={setSelectedClients}
                                onDisabledClick={() => toast.error('No hay facturas registradas para este cliente')}
                                placeholder="Seleccionar clientes..."
                            />

                            <MultiSearchableSelect
                                label="Puntos de Suministro"
                                icon={<Zap size={14} />}
                                options={pointOptions}
                                selectedValues={selectedPoints}
                                onChange={setSelectedPoints}
                                onSearch={setPointSearch}
                                onDisabledClick={() => toast.error('No hay facturas registradas para este punto')}
                                isLoading={isSearchingPoints}
                                placeholder="Buscar CUPS, dirección..."
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="text-xs text-gray-400">Desde</span>
                                    <input
                                        type="date"
                                        className="glass-input mt-1"
                                        value={dateRange.from}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-gray-400">Hasta</span>
                                    <input
                                        type="date"
                                        className="glass-input mt-1"
                                        value={dateRange.to}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedClients(null);
                                        setSelectedPoints(null);
                                        setSelectedRetailers([]);
                                        setInvoiceType(null);
                                        setSelectedTariffs([]);
                                        setSelectedProvinces([]);
                                    }}
                                    className="text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                                >
                                    Limpiar filtros
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Builder Card */}
                    <div className="glass-card p-5 space-y-4">
                        <h3 className="text-sm font-bold text-fenix-400 uppercase tracking-wider flex items-center gap-2">
                            <Plus size={14} /> Métricas y Agrupación
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <span className="text-xs font-bold text-secondary uppercase tracking-tight px-1">Métricas</span>
                                {metrics.map((m, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-1.5 p-2 bg-white/[0.03] rounded-xl border border-white/5 items-center">
                                        {/* Measure Selector */}
                                        <div className="col-span-12 sm:col-span-6">
                                            <select
                                                className={`glass-input text-[11px] py-1.5 w-full h-9 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
                                                value={m.measure}
                                                onChange={(e) => {
                                                    const val = e.target.value as Metric['measure'];
                                                    setMetrics(prev => prev.map((m, i) => i === idx ? { ...m, measure: val } : m));
                                                }}
                                            >
                                                {Object.entries(MEASURE_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k} className={theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}>{v}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Aggregation Selector */}
                                        <div className="col-span-6 sm:col-span-3">
                                            <select
                                                className={`glass-input text-[11px] py-1.5 w-full h-9 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
                                                value={m.aggregation}
                                                onChange={(e) => {
                                                    const val = e.target.value as Metric['aggregation'];
                                                    setMetrics(prev => prev.map((m, i) => i === idx ? { ...m, aggregation: val } : m));
                                                }}
                                            >
                                                {Object.entries(AGG_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k} className={theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}>{v}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Chart Type Selector */}
                                        <div className="col-span-5 sm:col-span-2 flex items-center gap-0.5 bg-black/20 p-0.5 rounded-lg border border-white/5 h-9">
                                            {(['bar', 'line', 'scatter', 'pie'] as const).map(type => {
                                                const Icon = type === 'bar' ? BarChart2 : type === 'line' ? LineIcon : type === 'scatter' ? MousePointer2 : PieIcon;
                                                const isSelected = m.chartType === type;
                                                return (
                                                    <button
                                                        key={type}
                                                        onClick={() => setMetrics(prev => prev.map((pm, pi) => pi === idx ? { ...pm, chartType: type } : pm))}
                                                        className={`flex-1 h-full flex items-center justify-center rounded-md transition-all ${isSelected
                                                            ? 'bg-fenix-500 text-white shadow-lg'
                                                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                            }`}
                                                        title={type.charAt(0).toUpperCase() + type.slice(1)}
                                                    >
                                                        <Icon size={14} />
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Delete Button */}
                                        <div className="col-span-1 flex justify-end">
                                            {metrics.length > 1 && (
                                                <button
                                                    onClick={() => setMetrics(metrics.filter((_, i) => i !== idx))}
                                                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Eliminar métrica"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setMetrics([...metrics, { measure: 'total', aggregation: 'sum', chartType: 'bar' }])}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-bg-intermediate hover:bg-bg-secondary border border-primary rounded-xl text-xs text-secondary font-medium transition-all shadow-lg hover:shadow-fenix-500/5 group cursor-pointer"
                                >
                                    <Plus size={14} className="text-fenix-600 dark:text-fenix-400 group-hover:scale-110 transition-transform" />
                                    Añadir métrica
                                </button>
                            </div>

                            <label className="block">
                                <span className="text-xs text-gray-400">Agrupar por</span>
                                <select
                                    className={`glass-input mt-1 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
                                >
                                    {Object.entries(GROUP_LABELS).map(([k, v]) => (
                                        <option key={k} value={k} className={theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}>{v}</option>
                                    ))}
                                </select>
                            </label>

                            {groupBy !== 'month' && groupBy !== 'none' && (
                                <label className="block">
                                    <span className="text-xs text-gray-400">Top N</span>
                                    <input
                                        type="number"
                                        className="glass-input mt-1"
                                        value={topN}
                                        onChange={(e) => setTopN(parseInt(e.target.value))}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Area: Summary, Charts, Table */}
                <main className="xl:col-span-3 space-y-6">
                    {isLoading ? (
                        <div className="glass-card p-20 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-10 h-10 text-fenix-500 animate-spin" />
                            <p className="text-secondary font-medium">Calculando análisis...</p>
                        </div>
                    ) : analytics ? (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {isLoading ? (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="glass-card p-4 animate-pulse h-[88px] flex flex-col justify-center">
                                            <div className="h-2.5 w-24 bg-white/5 rounded mx-1 mb-2" />
                                            <div className="h-6 w-32 bg-white/10 rounded mx-1" />
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <div className="glass-card p-4 border-l-4 border-fenix-500">
                                            <p className="text-xs text-secondary uppercase tracking-wider font-bold">Facturas Analizadas</p>
                                            <p className="text-2xl font-bold text-primary mt-1">{analytics.summary.row_count}</p>
                                        </div>
                                        {metrics.slice(0, 3).map((m, idx) => {
                                            const key = `${m.measure}_${m.aggregation}`;
                                            return (
                                                <div key={idx} className="glass-card p-4 border-l-4" style={{ borderLeftColor: getChartColor(idx) }}>
                                                    <p className="text-xs text-secondary uppercase tracking-wider font-bold">
                                                        {AGG_LABELS[m.aggregation]} {MEASURE_LABELS[m.measure]}
                                                    </p>
                                                    <p className="text-2xl font-bold text-primary mt-1">
                                                        {formatValue(analytics.summary[key] || 0, m.measure)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>

                            {/* Loading State */}
                            {isLoading && (
                                <div className="space-y-6">
                                    {[1, 2].map(i => (
                                        <div key={i} className="glass-card p-6 h-[320px] animate-pulse flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="animate-spin text-fenix-400" size={32} />
                                                <p className="text-gray-500">Cargando visualización...</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Charts Section */}
                            {!isLoading && (
                                <div className="space-y-6">
                                    {metrics.map((m, mIdx) => {
                                        const measureKey = `${m.measure}_${m.aggregation}`;
                                        const chartColor = getChartColor(mIdx);

                                        // Prepare data for this specific chart
                                        let chartData = [...(analytics.groups || [])];
                                        if (groupBy === 'month') {
                                            chartData.sort((a, b) => a.group_key.localeCompare(b.group_key));
                                        }

                                        const currentChartType = (m.chartType === 'pie' && groupBy === 'month') ? 'bar' : m.chartType;
                                        const isPieFallback = m.chartType === 'pie' && groupBy === 'month';

                                        return (
                                            <div key={mIdx} className="glass-card p-6">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div>
                                                        <h3 className="font-bold text-primary flex items-center gap-2">
                                                            <BarChart3 size={18} className="text-fenix-600 dark:text-fenix-400" />
                                                            {MEASURE_LABELS[m.measure]} ({AGG_LABELS[m.aggregation]})
                                                        </h3>
                                                        <p className="text-[10px] text-secondary opacity-70 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                                            {GROUP_LABELS[groupBy]} • {currentChartType}
                                                            {isPieFallback && (
                                                                <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                                                    Tarta no disp con Mes. Usando barras.
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="h-[320px] w-full min-h-[320px]">
                                                    {chartData.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            {currentChartType === 'line' ? (
                                                                <LineChart data={chartData}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                                                    <XAxis
                                                                        dataKey={groupBy === 'month' ? 'group_key' : 'group_label'}
                                                                        stroke="#9ca3af"
                                                                        fontSize={10}
                                                                        tickFormatter={(val) => groupBy === 'month' ? format(new Date(val), 'MMM yy', { locale: es }) : val}
                                                                    />
                                                                    <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(val) => formatValue(val, m.measure)} />
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#141424', border: '1px solid #1f2937' }}
                                                                        labelFormatter={(val) => groupBy === 'month' ? format(new Date(val), 'MMMM yyyy', { locale: es }) : val}
                                                                        formatter={(val: any) => [formatValue(Number(val) || 0, m.measure), MEASURE_LABELS[m.measure]]}
                                                                    />
                                                                    <Line
                                                                        type="monotone"
                                                                        dataKey={measureKey}
                                                                        stroke={chartColor}
                                                                        strokeWidth={3}
                                                                        dot={{ r: 4, strokeWidth: 2 }}
                                                                        activeDot={{ r: 6 }}
                                                                        name={MEASURE_LABELS[m.measure]}
                                                                    />
                                                                </LineChart>
                                                            ) : currentChartType === 'bar' ? (
                                                                <BarChart data={chartData} layout={groupBy !== 'month' && groupBy !== 'invoice_type' && groupBy !== 'tariff' ? 'vertical' : 'horizontal'}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                                                    {groupBy !== 'month' && groupBy !== 'invoice_type' && groupBy !== 'tariff' ? (
                                                                        <>
                                                                            <XAxis type="number" stroke="#9ca3af" fontSize={10} tickFormatter={(val) => formatValue(val, m.measure)} />
                                                                            <YAxis dataKey="group_label" type="category" stroke="#9ca3af" fontSize={10} width={100} />
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <XAxis
                                                                                dataKey={groupBy === 'month' ? 'group_key' : 'group_label'}
                                                                                stroke="#9ca3af"
                                                                                fontSize={10}
                                                                                tickFormatter={(val) => groupBy === 'month' ? format(new Date(val), 'MMM yy', { locale: es }) : val}
                                                                            />
                                                                            <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(val) => formatValue(val, m.measure)} />
                                                                        </>
                                                                    )}
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#141424', border: '1px solid #1f2937' }}
                                                                        formatter={(val: any) => [formatValue(Number(val) || 0, m.measure), MEASURE_LABELS[m.measure]]}
                                                                    />
                                                                    <Bar
                                                                        dataKey={measureKey}
                                                                        fill={chartColor}
                                                                        radius={groupBy !== 'month' && groupBy !== 'invoice_type' && groupBy !== 'tariff' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                                                                        name={MEASURE_LABELS[m.measure]}
                                                                    />
                                                                </BarChart>
                                                            ) : currentChartType === 'scatter' ? (
                                                                <ScatterChart>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                                                    <XAxis
                                                                        dataKey={groupBy === 'month' ? 'group_key' : 'group_label'}
                                                                        type={groupBy === 'month' ? 'category' : 'category'}
                                                                        stroke="#9ca3af"
                                                                        fontSize={10}
                                                                        tickFormatter={(val) => groupBy === 'month' ? format(new Date(val), 'MMM yy', { locale: es }) : val}
                                                                    />
                                                                    <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(val) => formatValue(val, m.measure)} />
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#141424', border: '1px solid #1f2937' }}
                                                                        formatter={(val: any) => [formatValue(Number(val) || 0, m.measure), MEASURE_LABELS[m.measure]]}
                                                                    />
                                                                    <Scatter name={MEASURE_LABELS[m.measure]} data={chartData} fill={chartColor} />
                                                                </ScatterChart>
                                                            ) : (
                                                                <PieChart>
                                                                    <Pie
                                                                        data={(() => {
                                                                            const sorted = [...chartData].sort((a, b) => (b[measureKey] || 0) - (a[measureKey] || 0));
                                                                            const top = sorted.slice(0, 10);
                                                                            const rest = sorted.slice(10);
                                                                            if (rest.length > 0) {
                                                                                const restSum = rest.reduce((acc, curr) => acc + (curr[measureKey] || 0), 0);
                                                                                return [...top, { group_label: 'Otros', [measureKey]: restSum }];
                                                                            }
                                                                            return top;
                                                                        })()}
                                                                        dataKey={measureKey}
                                                                        nameKey="group_label"
                                                                        cx="50%"
                                                                        cy="50%"
                                                                        outerRadius={100}
                                                                        label={(props: any) => `${props.group_label} (${(props.percent * 100).toFixed(0)}%)`}
                                                                        fontSize={10}
                                                                    >
                                                                        {chartData.map((_, index) => (
                                                                            <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                                                                        ))}
                                                                    </Pie>
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#141424', border: '1px solid #1f2937' }}
                                                                        formatter={(val: any) => [formatValue(Number(val) || 0, m.measure), MEASURE_LABELS[m.measure]]}
                                                                    />
                                                                    <Legend />
                                                                </PieChart>
                                                            )}
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                            <Receipt size={48} className="opacity-20 mb-2" />
                                                            <p>No hay datos suficientes para la visualización</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Table Section */}
                            <div className="glass-card overflow-hidden">
                                <div className="p-4 border-b border-primary flex items-center justify-between">
                                    <h3 className="font-bold text-primary flex items-center gap-2">
                                        <List size={18} className="text-fenix-600 dark:text-fenix-400" />
                                        Tabla de Resultados
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-bg-intermediate text-[10px] uppercase tracking-wider text-primary font-bold border-b-2 border-primary">
                                                <th className="px-6 py-3">{GROUP_LABELS[groupBy]}</th>
                                                {metrics.map((m, idx) => (
                                                    <th key={idx} className="px-6 py-3 text-right">
                                                        {MEASURE_LABELS[m.measure]} ({AGG_LABELS[m.aggregation]})
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(() => {
                                                const sorted = [...(analytics.groups || [])];
                                                if (groupBy === 'month') sorted.sort((a, b) => a.group_key.localeCompare(b.group_key));
                                                return sorted;
                                            })().map((row, idx) => (
                                                <tr key={idx} className="hover:bg-bg-intermediate/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-bold text-primary truncate max-w-[200px]">
                                                        {groupBy === 'month' ? format(new Date(row.group_key), 'MMMM yyyy', { locale: es }) : row.group_label}
                                                    </td>
                                                    {metrics.map((m, mIdx) => {
                                                        const key = `${m.measure}_${m.aggregation}`;
                                                        const val = row[key];
                                                        return (
                                                            <td key={mIdx} className="px-6 py-4 text-right text-sm text-secondary font-mono">
                                                                {formatValue(val || 0, m.measure)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {(!analytics.groups || analytics.groups.length === 0) && (
                                        <div className="p-12 text-center text-gray-500">
                                            Sin datos para mostrar en la tabla
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="glass-card p-20 flex flex-col items-center justify-center text-secondary">
                            <BarChart3 size={64} className="opacity-10 mb-4" />
                            <p className="text-xl font-bold">Define tu análisis para comenzar</p>
                            <p className="text-sm mt-1 opacity-70">Selecciona filtros y métricas en el panel lateral.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
