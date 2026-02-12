import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { BarChart3, Plus, Users, Zap, XCircle } from 'lucide-react';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { format, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { useTheme } from '@hooks/ThemeContext';
import MetricCard from './MetricCard';
import {
    MetricConfig, SharedFilters,
    createDefaultMetric, createMetricId,
} from './types';

// ============ COMPONENT ============

export default function AnalyticsPage() {
    const { theme } = useTheme();

    // ─── Filter state ───
    const [selectedClients, setSelectedClients] = useState<string[] | null>(null);
    const [selectedPoints, setSelectedPoints] = useState<string[] | null>(null);
    const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
    const [selectedTariffs, setSelectedTariffs] = useState<string[]>([]);
    const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
    const [invoiceType, setInvoiceType] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
        from: format(subMonths(new Date(), 12), 'yyyy-MM-01'),
        to: format(new Date(), 'yyyy-MM-dd'),
    });

    // ─── Metric configs (each independent) ───
    const [metricConfigs, setMetricConfigs] = useState<MetricConfig[]>([
        createDefaultMetric(),
    ]);

    // ─── Points search ───
    const [pointSearch, setPointSearch] = useState('');

    // ─── Queries: filter options ───
    const { data: filtersData } = useQuery({
        queryKey: ['analytics-filters'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_analytics_filters');
            if (error) throw error;
            return data;
        },
    });

    const { data: searchPointsData, isLoading: isSearchingPoints } = useQuery({
        queryKey: ['analytics-search-points', pointSearch, selectedClients],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('search_puntos_suministro', {
                search_text: pointSearch,
                cliente_ids: selectedClients,
                limit_count: 50,
            });
            if (error) throw error;
            return data;
        },
    });

    // ─── Derived options ───
    const clientOptions = useMemo(
        () =>
            filtersData?.clients.map((c: any) => ({
                value: c.id,
                label: c.name,
                disabled: !c.has_facturas,
            })) || [],
        [filtersData],
    );

    const pointOptions = useMemo(
        () =>
            searchPointsData?.map((p: any) => ({
                value: p.id,
                label: p.cups,
                subtitle: `${p.direccion_sum || ''} - ${p.localidad_sum || ''} (${p.provincia_sum || ''})`,
                disabled: !p.has_facturas,
            })) || [],
        [searchPointsData],
    );

    // ─── Shared filters (passed to every MetricCard) ───
    const sharedFilters: SharedFilters = useMemo(
        () => ({
            cliente_ids: selectedClients,
            punto_ids: selectedPoints,
            comercializadora_ids: selectedRetailers.length > 0 ? selectedRetailers : null,
            tipo_factura_val: invoiceType,
            tarifa_vals: selectedTariffs.length > 0 ? selectedTariffs : null,
            provincia_vals: selectedProvinces.length > 0 ? selectedProvinces : null,
            fecha_desde: dateRange.from,
            fecha_hasta: dateRange.to,
        }),
        [selectedClients, selectedPoints, selectedRetailers, invoiceType, selectedTariffs, selectedProvinces, dateRange],
    );

    // ─── Metric CRUD ───
    const updateMetric = (id: string, updates: Partial<MetricConfig>) => {
        setMetricConfigs((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    };

    const duplicateMetric = (id: string) => {
        setMetricConfigs((prev) => {
            const source = prev.find((m) => m.id === id);
            if (!source) return prev;
            const idx = prev.findIndex((m) => m.id === id);
            const dup: MetricConfig = { ...source, id: createMetricId() };
            const next = [...prev];
            next.splice(idx + 1, 0, dup);
            return next;
        });
    };

    const deleteMetric = (id: string) => {
        setMetricConfigs((prev) => prev.filter((m) => m.id !== id));
    };

    const addMetric = () => {
        setMetricConfigs((prev) => [...prev, createDefaultMetric()]);
    };

    const clearFilters = () => {
        setSelectedClients(null);
        setSelectedPoints(null);
        setSelectedRetailers([]);
        setInvoiceType(null);
        setSelectedTariffs([]);
        setSelectedProvinces([]);
    };

    // ═══════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
            {/* ═══════ Header ═══════ */}
            <header className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Explorador de Datos</h2>
                    <p className="text-secondary opacity-70 text-sm">Analiza consumo y facturación en 3 sencillos pasos.</p>
                </div>
            </header>

            {/* ═══════ PASO 1 — Filtros ═══════ */}
            <section className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-fenix-500/20 text-fenix-500 text-xs font-bold shrink-0">
                        1
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-primary text-sm">Paso 1: Filtra tus datos</h3>
                        <p className="text-[11px] text-secondary opacity-70">
                            Selecciona clientes, puntos de suministro y rango de fechas para acotar el análisis.
                        </p>
                    </div>
                    <button
                        onClick={clearFilters}
                        className={`ml-auto flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer shrink-0 ${
                            theme === 'dark'
                                ? 'text-gray-500 hover:text-gray-300'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <XCircle size={13} /> Limpiar filtros
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Clientes */}
                    <div>
                        <MultiSearchableSelect
                            label="Clientes"
                            icon={<Users size={14} />}
                            options={clientOptions}
                            selectedValues={selectedClients}
                            onChange={setSelectedClients}
                            onDisabledClick={() => toast.error('No hay facturas registradas para este cliente')}
                            placeholder="Todos los clientes"
                        />
                        <p className="text-[9px] text-secondary opacity-50 mt-1 px-1">
                            Selecciona uno o varios para filtrar
                        </p>
                    </div>

                    {/* Puntos de suministro */}
                    <div>
                        <MultiSearchableSelect
                            label="Puntos de Suministro"
                            icon={<Zap size={14} />}
                            options={pointOptions}
                            selectedValues={selectedPoints}
                            onChange={setSelectedPoints}
                            onSearch={setPointSearch}
                            onDisabledClick={() => toast.error('No hay facturas registradas para este punto')}
                            isLoading={isSearchingPoints}
                            placeholder="Buscar CUPS, dirección…"
                        />
                        <p className="text-[9px] text-secondary opacity-50 mt-1 px-1">
                            Filtra por CUPS o dirección
                        </p>
                    </div>

                    {/* Desde */}
                    <div>
                        <label className="block">
                            <span className="text-xs font-semibold text-secondary flex items-center gap-1 mb-1">
                                Desde
                            </span>
                            <input
                                type="date"
                                className="glass-input"
                                value={dateRange.from}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                            />
                        </label>
                        <p className="text-[9px] text-secondary opacity-50 mt-1 px-1">
                            Inicio del periodo de análisis
                        </p>
                    </div>

                    {/* Hasta */}
                    <div>
                        <label className="block">
                            <span className="text-xs font-semibold text-secondary flex items-center gap-1 mb-1">
                                Hasta
                            </span>
                            <input
                                type="date"
                                className="glass-input"
                                value={dateRange.to}
                                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                            />
                        </label>
                        <p className="text-[9px] text-secondary opacity-50 mt-1 px-1">
                            Fin del periodo de análisis
                        </p>
                    </div>
                </div>
            </section>

            {/* ═══════ Metric Cards ═══════ */}
            <div className="space-y-6">
                {metricConfigs.map((config, idx) => (
                    <MetricCard
                        key={config.id}
                        config={config}
                        index={idx}
                        sharedFilters={sharedFilters}
                        onUpdate={updateMetric}
                        onDuplicate={duplicateMetric}
                        onDelete={deleteMetric}
                        canDelete={metricConfigs.length > 1}
                        isFirst={idx === 0}
                    />
                ))}
            </div>

            {/* ═══════ Añadir métrica ═══════ */}
            <button
                onClick={addMetric}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-dashed transition-all group cursor-pointer ${
                    theme === 'dark'
                        ? 'border-white/10 hover:border-fenix-500/40 bg-white/[0.02] hover:bg-fenix-500/5'
                        : 'border-gray-200 hover:border-fenix-500/40 bg-gray-50/50 hover:bg-fenix-50'
                }`}
            >
                <Plus size={20} className="text-fenix-600 dark:text-fenix-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
                    Añadir otra métrica
                </span>
            </button>
        </div>
    );
}
