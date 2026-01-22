import { useState, useMemo } from 'react';
import { Zap, Sun, Activity, BarChart3, ChevronDown, ChevronUp, MapPin, AlertCircle } from 'lucide-react';

// Hooks
import {
    useMarketSummary,
    useMarketComparison,
    useSpainPortugalChart,
    usePVPCChart,
    useTopHours,
    useSurplusComparison,
    useIntradayComparison,
    useMarketInsights,
    useAggregatedStats,
    useMultiDayChart,
} from '@features/market-data/hooks/useMarketData';

// Componentes
import {
    KPIGrid,
    InsightCard,
    TopHoursCard,
    DateSelector,
    SectionHeader,
    KPICardSkeleton,
    EmptyState,
    ErrorState,
    TimeRangeSelector,
    type TimeRange,
} from './MarketComponents';

import { SpainPortugalChart, PVPCChart, SimpleLineChart } from './MarketCharts';

import { GEO_ZONES, formatDateStr } from '@features/market-data/services/marketData';
import type { MarketInsight } from '@features/market-data/services/marketData';

// =============================================================================
// COMPONENTE PRINCIPAL - Dashboard Mercado Estilo OMIE
// =============================================================================

export default function MercadoDashboard() {
    // Estado de fecha
    const [isToday, setIsToday] = useState(true);
    const [selectedGeoId, setSelectedGeoId] = useState(8741); // Península por defecto

    // Estado de rango temporal para gráficos
    const [omieTimeRange, setOmieTimeRange] = useState<TimeRange>('1D');
    const [pvpcTimeRange, setPvpcTimeRange] = useState<TimeRange>('1D');

    // Estados de secciones colapsables
    const [showPVPC, setShowPVPC] = useState(true);
    const [showAutoconsumo, setShowAutoconsumo] = useState(true);
    const [showIntradiario, setShowIntradiario] = useState(true);

    const selectedDate = useMemo(() => {
        const date = new Date();
        if (!isToday) date.setDate(date.getDate() + 1);
        return date;
    }, [isToday]);

    // ==========================================================================
    // QUERIES
    // ==========================================================================

    // Resumen del día (para 1D)
    const { data: summary, isLoading: summaryLoading, isError: summaryError } = useMarketSummary(selectedDate);

    // Comparación (para cambios vs ayer)
    const { data: comparison } = useMarketComparison(selectedDate);

    // Gráfico España vs Portugal - 1D
    const { data: spainPortugalData1D, isLoading: chart1DLoading } = useSpainPortugalChart(selectedDate);

    // Gráfico España vs Portugal - Multi-día
    const { data: spainPortugalDataMulti } = useMultiDayChart(selectedDate, omieTimeRange, 600, 3);

    // Stats agregados para OMIE (7D, 30D)
    const { data: omieAggregatedStats } = useAggregatedStats(selectedDate, omieTimeRange, 600, 3);

    // Top horas (OMIE España) - solo para 1D
    const { data: topHours } = useTopHours(selectedDate, 600, 3);

    // PVPC - 1D
    const { data: pvpcChartData1D } = usePVPCChart(selectedDate, selectedGeoId);

    // PVPC - Multi-día
    const { data: pvpcChartDataMulti } = useMultiDayChart(selectedDate, pvpcTimeRange, 1001, selectedGeoId);

    // Stats agregados para PVPC (7D, 30D)
    const { data: pvpcAggregatedStats } = useAggregatedStats(selectedDate, pvpcTimeRange, 1001, selectedGeoId);

    // Autoconsumo
    const { data: surplusData } = useSurplusComparison(selectedDate);

    // Intradiario
    const { data: intradayData } = useIntradayComparison(selectedDate);

    // Insights
    const { data: insights } = useMarketInsights(selectedDate);

    // ==========================================================================
    // DERIVED DATA
    // ==========================================================================

    // Seleccionar datos según el rango de tiempo
    const spainPortugalChartData = omieTimeRange === '1D' ? spainPortugalData1D : spainPortugalDataMulti;
    const omieDisplayStats = omieTimeRange === '1D' ? summary?.omie_spain : omieAggregatedStats;

    const pvpcChartData = pvpcTimeRange === '1D' ? pvpcChartData1D : pvpcChartDataMulti;
    const pvpcDisplayStats = pvpcTimeRange === '1D' ? summary?.pvpc : pvpcAggregatedStats;

    // ==========================================================================
    // RENDER
    // ==========================================================================

    const formatDate = (d: Date) => {
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const getRangeLabel = (range: TimeRange) => {
        switch (range) {
            case '1D': return 'hoy';
            case '7D': return 'últimos 7 días';
            case '1M': return 'últimos 30 días';
        }
    };

    if (summaryError) {
        return <ErrorState message="Error al cargar los datos del mercado" />;
    }

    return (
        <div className="space-y-6">
            {/* ================================================================
                SECCIÓN A: MERCADO DIARIO (OMIE)
            ================================================================ */}
            <section className="space-y-4">
                <SectionHeader
                    title="Mercado Diario"
                    subtitle={`Precios del mercado mayorista ibérico (OMIE) • ${formatDate(selectedDate)}`}
                    icon={<Zap className="h-5 w-5 text-amber-500" />}
                    actions={
                        <DateSelector
                            isToday={isToday}
                            onSelect={setIsToday}
                            showTomorrow={true}
                        />
                    }
                />

                {/* INSIGHTS - Directamente después del header, sin título */}
                {insights && insights.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {insights.map((insight: MarketInsight, i: number) => (
                            <InsightCard
                                key={i}
                                type={insight.type}
                                title={insight.title}
                                message={insight.message}
                            />
                        ))}
                    </div>
                )}

                {summaryLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[...Array(6)].map((_, i) => <KPICardSkeleton key={i} />)}
                    </div>
                ) : !omieDisplayStats ? (
                    <EmptyState message={`Aún no hay datos de mercado para el ${formatDate(selectedDate)}`} />
                ) : (
                    <>
                        {/* KPIs del mercado - cambian según el rango temporal */}
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">
                                Precios España {omieTimeRange !== '1D' && `(${getRangeLabel(omieTimeRange)})`}
                            </h3>
                            <TimeRangeSelector value={omieTimeRange} onChange={setOmieTimeRange} />
                        </div>

                        <KPIGrid
                            stats={omieDisplayStats}
                            title=""
                            yesterdayStats={omieTimeRange === '1D' ? comparison?.yesterday.omie_spain : undefined}
                        />

                        {/* Gráfico principal + Top Horas */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-3">
                                {chart1DLoading && omieTimeRange === '1D' ? (
                                    <div className="h-[360px] bg-white border border-slate-200 rounded-xl animate-pulse" />
                                ) : spainPortugalChartData && spainPortugalChartData.length > 0 ? (
                                    <SpainPortugalChart data={spainPortugalChartData} height={320} />
                                ) : (
                                    <EmptyState />
                                )}
                            </div>

                            {/* Top Horas solo se muestra en 1D */}
                            {omieTimeRange === '1D' && (
                                <div className="lg:col-span-1">
                                    {topHours ? (
                                        <TopHoursCard
                                            cheapest={topHours.cheapest}
                                            expensive={topHours.expensive}
                                        />
                                    ) : (
                                        <div className="h-full bg-white border border-slate-200 rounded-xl animate-pulse" />
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* ================================================================
                SECCIÓN B: PVPC (Precio Voluntario para el Pequeño Consumidor)
            ================================================================ */}
            <section className="space-y-4">
                <div
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => setShowPVPC(!showPVPC)}
                >
                    <SectionHeader
                        title="Precio Voluntario para el Pequeño Consumidor (PVPC)"
                        subtitle="Tarifa regulada para consumidores domésticos con discriminación horaria"
                        icon={<BarChart3 className="h-5 w-5 text-indigo-500" />}
                    />
                    <button className="p-2 text-slate-400 hover:text-slate-600">
                        {showPVPC ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>

                {showPVPC && (
                    <>
                        {/* Selector de zona + TimeRange */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                                    {GEO_ZONES.map(zone => (
                                        <button
                                            key={zone.id}
                                            onClick={() => setSelectedGeoId(zone.id)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedGeoId === zone.id
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            title={zone.name}
                                        >
                                            {zone.short}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-sm text-slate-500">
                                    {GEO_ZONES.find(z => z.id === selectedGeoId)?.name}
                                </span>
                            </div>
                            <TimeRangeSelector value={pvpcTimeRange} onChange={setPvpcTimeRange} />
                        </div>

                        {!pvpcDisplayStats ? (
                            <EmptyState message="No hay datos PVPC disponibles" />
                        ) : (
                            <>
                                <KPIGrid
                                    stats={pvpcDisplayStats}
                                    title={`Precios PVPC 2.0TD ${pvpcTimeRange !== '1D' ? `(${getRangeLabel(pvpcTimeRange)})` : ''}`}
                                    yesterdayStats={pvpcTimeRange === '1D' ? comparison?.yesterday.pvpc : undefined}
                                    showPeriods={true}
                                />

                                {pvpcChartData && pvpcChartData.length > 0 && (
                                    <PVPCChart data={pvpcChartData} height={280} />
                                )}

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                                    <p className="font-medium mb-1">💡 ¿Qué es el PVPC?</p>
                                    <p className="text-blue-700">
                                        El Precio Voluntario para el Pequeño Consumidor es la tarifa regulada para usuarios con potencia contratada
                                        hasta 10 kW. Los precios varían cada hora según el mercado mayorista y se dividen en tres periodos:
                                        <strong> Punta (P1)</strong> con precios más altos, <strong>Llano (P2)</strong> con precios intermedios,
                                        y <strong>Valle (P3)</strong> con los precios más bajos (noches, fines de semana y festivos).
                                    </p>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>

            {/* ================================================================
                SECCIÓN C: AUTOCONSUMO
            ================================================================ */}
            <section className="space-y-4">
                <div
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => setShowAutoconsumo(!showAutoconsumo)}
                >
                    <SectionHeader
                        title="Compensación de Excedentes de Autoconsumo"
                        subtitle="Precio de compensación para energía fotovoltaica excedentaria"
                        icon={<Sun className="h-5 w-5 text-emerald-500" />}
                    />
                    <button className="p-2 text-slate-400 hover:text-slate-600">
                        {showAutoconsumo ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>

                {showAutoconsumo && (
                    <>
                        {!summary?.surplus && !surplusData ? (
                            <EmptyState message="No hay datos de excedentes disponibles" />
                        ) : (
                            <>
                                {summary?.surplus && (
                                    <KPIGrid
                                        stats={summary.surplus}
                                        title="Precio Excedentes FV"
                                        yesterdayStats={comparison?.yesterday.surplus}
                                    />
                                )}

                                {surplusData && (
                                    <div className="space-y-4">
                                        {surplusData.dataDate !== formatDateStr(selectedDate) && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                                <div className="text-sm text-amber-800">
                                                    <p className="font-medium">
                                                        Mostrando datos del {new Date(surplusData.dataDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                                    </p>
                                                    <p>No hay datos disponibles para la fecha seleccionada. Se muestran los últimos datos disponibles.</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <SimpleLineChart
                                                data={surplusData.surplus}
                                                dataKey="surplus"
                                                title="Evolución del Precio de Excedentes"
                                                subtitle="Indicador 1739 - €/MWh"
                                                color="#10b981"
                                                height={200}
                                                differential={surplusData.differentialVsMarket}
                                                differentialLabel="vs Mercado"
                                            />

                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                                                <h4 className="font-semibold text-emerald-900">Análisis de Rentabilidad</h4>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-white rounded-lg p-3">
                                                        <p className="text-xs text-slate-500">vs Mercado Diario</p>
                                                        <p className={`text-lg font-bold ${surplusData.differentialVsMarket >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {surplusData.differentialVsMarket >= 0 ? '+' : ''}{surplusData.differentialVsMarket.toFixed(2)} €/MWh
                                                        </p>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-3">
                                                        <p className="text-xs text-slate-500">vs PVPC</p>
                                                        <p className={`text-lg font-bold ${surplusData.differentialVsPVPC >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {surplusData.differentialVsPVPC >= 0 ? '+' : ''}{surplusData.differentialVsPVPC.toFixed(2)} €/MWh
                                                        </p>
                                                    </div>
                                                </div>

                                                <p className="text-sm text-emerald-700">
                                                    {surplusData.differentialVsPVPC < 0
                                                        ? '✅ Hoy es rentable maximizar el autoconsumo: el precio de compra (PVPC) es mayor que el de venta (excedentes).'
                                                        : '⚠️ Hoy la compensación de excedentes está por encima del PVPC, situación poco habitual.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </section>

            {/* ================================================================
                SECCIÓN D: INTRADIARIO CONTINUO
            ================================================================ */}
            <section className="space-y-4">
                <div
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors"
                    onClick={() => setShowIntradiario(!showIntradiario)}
                >
                    <SectionHeader
                        title="Mercado Intradiario Continuo"
                        subtitle="Precio medio de las transacciones intradiarias (MIC)"
                        icon={<Activity className="h-5 w-5 text-purple-500" />}
                    />
                    <button className="p-2 text-slate-400 hover:text-slate-600">
                        {showIntradiario ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>

                {showIntradiario && (
                    <>
                        {!summary?.intraday && !intradayData ? (
                            <EmptyState message="No hay datos del mercado intradiario disponibles" />
                        ) : (
                            <>
                                {summary?.intraday && (
                                    <KPIGrid
                                        stats={summary.intraday}
                                        title="Precio Intradiario"
                                        yesterdayStats={comparison?.yesterday.intraday}
                                    />
                                )}

                                {intradayData && (
                                    <div className="space-y-4">
                                        {intradayData.dataDate !== formatDateStr(selectedDate) && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-3">
                                                <AlertCircle className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                                                <div className="text-sm text-purple-800">
                                                    <p className="font-medium">
                                                        Mostrando datos del {new Date(intradayData.dataDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                                    </p>
                                                    <p>No hay datos disponibles para la fecha seleccionada. Se muestran los últimos datos disponibles.</p>
                                                </div>
                                            </div>
                                        )}

                                        <SimpleLineChart
                                            data={intradayData.intraday}
                                            dataKey="intraday"
                                            title="Evolución del Mercado Intradiario"
                                            subtitle="Indicador 1727 - €/MWh"
                                            color="#8b5cf6"
                                            height={200}
                                            differential={intradayData.differential}
                                            differentialLabel="vs Mercado Diario"
                                        />
                                    </div>
                                )}

                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
                                    <p className="font-medium mb-1">💡 ¿Qué es el Mercado Intradiario Continuo?</p>
                                    <p className="text-purple-700">
                                        Es un mercado que permite ajustar la compra/venta de energía después de cerrar el mercado diario,
                                        hasta poco antes del tiempo real. Permite a los participantes corregir desviaciones entre la
                                        previsión y el consumo/producción real.
                                    </p>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
