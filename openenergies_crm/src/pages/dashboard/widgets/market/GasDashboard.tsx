import { useState } from 'react';
import { Flame, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useGasChartData, useGasIndicators, useGasSummary, useGasAggregatedStats } from '@features/market-data/hooks/useGasMarketData';
import {
    SectionHeader,
    KPICardSkeleton,
    EmptyState,
    ErrorState,
    GasTimeRangeSelector,
    type GasTimeRange
} from './MarketComponents';
import { SimpleLineChart } from './MarketCharts';

// =============================================================================
// GasDashboard - Vista de Mercado de Gas Natural (MIBGAS)
// =============================================================================

interface IndicatorCardProps {
    title: string;
    subtitle: string;
    countryCode: 'ES' | 'PT';
    price: number | null;
    changePct: number | null;
    referencePrice: number | null;
    tradeDate: string;
    color: string;
    borderColor: string;
}

function IndicatorCard({
    title,
    subtitle,
    countryCode,
    price,
    changePct,
    referencePrice,
    tradeDate,
    color,
    borderColor
}: IndicatorCardProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    };

    const hasChange = changePct !== null && changePct !== undefined;
    const changeValue = hasChange ? Math.abs(changePct) : 0;
    const isNegative = hasChange && changePct < 0;

    // Calcular el cambio en €/MWh si tenemos precio de referencia
    const changeEur = referencePrice && price ? Math.abs(price - referencePrice) : null;

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${borderColor} p-5 relative overflow-hidden`}>
            {/* Círculo decorativo de fondo */}
            <div
                className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-10"
                style={{ backgroundColor: color }}
            />

            {/* Header */}
            <div className="text-center mb-4">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Precio</p>
                <p className="text-xs text-slate-500 dark:text-slate-500">{title} - {formatDate(tradeDate)}</p>
            </div>

            {/* Indicador circular con bandera */}
            <div className="relative flex justify-center mb-4">
                <div
                    className="w-28 h-28 rounded-full flex items-center justify-center"
                    style={{
                        background: `conic-gradient(${color} 0deg, ${color} 360deg)`,
                        padding: '4px'
                    }}
                >
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center">
                        <img
                            src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
                            alt={countryCode}
                            className="w-5 h-4 object-cover rounded-sm mb-0.5"
                        />
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                            {price?.toFixed(2) || '-'}
                        </span>
                        <span className="text-xs text-slate-500">€/MWh</span>
                    </div>
                </div>
            </div>

            {/* Cambios */}
            <div className="flex justify-center gap-4 text-xs">
                {changeEur !== null && (
                    <div className={`flex items-center gap-1 ${isNegative ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        <span>{isNegative ? '▼' : '▲'} {changeEur.toFixed(2)} €/MWh</span>
                    </div>
                )}
                {hasChange && (
                    <div className={`flex items-center gap-1 ${isNegative ? 'text-emerald-600' : 'text-red-600'}`}>
                        <span>{isNegative ? '▼' : '▲'} {changeValue.toFixed(1)}%</span>
                    </div>
                )}
                {!hasChange && !changeEur && (
                    <span className="text-slate-400">Sin cambios registrados</span>
                )}
            </div>

            {/* Subtítulo */}
            <p className="text-center text-xs text-slate-400 mt-2">{subtitle}</p>
        </div>
    );
}

export default function GasDashboard() {
    const [timeRange, setTimeRange] = useState<GasTimeRange>('7D');

    // Días según el rango seleccionado
    const getDays = (range: GasTimeRange) => {
        switch (range) {
            case '7D': return 7;
            case '1M': return 30;
        }
    };

    // Queries
    const { data: indicators, isLoading, isError } = useGasIndicators();
    const { data: summary } = useGasSummary();
    const { data: chartData } = useGasChartData(getDays(timeRange));
    const { data: aggregatedStats } = useGasAggregatedStats(getDays(timeRange));

    if (isError) {
        return <ErrorState message="Error al cargar los datos de gas" />;
    }

    const formatShortDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
        });
    };

    // Mapear indicadores
    const dayAheadES = indicators?.find(i => i.indicator_code === 'GDAES_D+1');
    const monthAheadES = indicators?.find(i => i.indicator_code === 'GMAES');
    const dayAheadPT = indicators?.find(i => i.indicator_code === 'GDAPT_D+1');

    const latestDate = dayAheadES?.trade_date
        ? new Date(dayAheadES.trade_date).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        })
        : 'Cargando...';

    return (
        <div className="space-y-6">
            {/* Header */}
            <SectionHeader
                title="Mercado de Gas Natural"
                subtitle={`Precios MIBGAS • ${latestDate}`}
                icon={<Flame className="h-5 w-5 text-orange-500" />}
            />

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <KPICardSkeleton key={i} />)}
                </div>
            ) : !indicators || indicators.length === 0 ? (
                <EmptyState message="No hay datos de gas disponibles" />
            ) : (
                <>
                    {/* 3 Indicadores principales */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Day Ahead ES */}
                        <IndicatorCard
                            title="Day Ahead ES"
                            subtitle="Mercado diario España (PVB)"
                            countryCode="ES"
                            price={dayAheadES?.price_eur_mwh ?? null}
                            changePct={dayAheadES?.change_pct ?? null}
                            referencePrice={dayAheadES?.reference_price ?? null}
                            tradeDate={dayAheadES?.trade_date || new Date().toISOString()}
                            color="#0ea5e9"
                            borderColor="border-sky-200 dark:border-sky-800"
                        />

                        {/* Month Ahead ES */}
                        <IndicatorCard
                            title="Month Ahead ES"
                            subtitle="Mercado mensual España (PVB)"
                            countryCode="ES"
                            price={monthAheadES?.price_eur_mwh ?? null}
                            changePct={monthAheadES?.change_pct ?? null}
                            referencePrice={monthAheadES?.reference_price ?? null}
                            tradeDate={monthAheadES?.trade_date || new Date().toISOString()}
                            color="#0ea5e9"
                            borderColor="border-sky-200 dark:border-sky-800"
                        />

                        {/* Day Ahead PT */}
                        <IndicatorCard
                            title="Day Ahead PT"
                            subtitle="Mercado diario Portugal (VTP)"
                            countryCode="PT"
                            price={dayAheadPT?.price_eur_mwh ?? null}
                            changePct={dayAheadPT?.change_pct ?? null}
                            referencePrice={dayAheadPT?.reference_price ?? null}
                            tradeDate={dayAheadPT?.trade_date || new Date().toISOString()}
                            color="#14b8a6"
                            borderColor="border-teal-200 dark:border-teal-800"
                        />
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex justify-end">
                        <GasTimeRangeSelector value={timeRange} onChange={setTimeRange} />
                    </div>

                    {/* Insights: Precio de hoy, cambio vs ayer, min/max del periodo */}
                    {summary && aggregatedStats && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Precio índice hoy (PVB) */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Flame className="h-4 w-4 text-orange-500" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Índice PVB Hoy
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {summary.pvb_price?.toFixed(2) || '-'} €
                                </p>
                                <p className="text-xs text-slate-400 mt-1">por MWh</p>
                            </div>

                            {/* Cambio vs ayer */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    {(summary.pvb_change_pct ?? 0) >= 0
                                        ? <TrendingUp className="h-4 w-4 text-red-500" />
                                        : <TrendingDown className="h-4 w-4 text-green-500" />
                                    }
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        vs Ayer
                                    </span>
                                </div>
                                <p className={`text-2xl font-bold ${(summary.pvb_change_pct ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {(summary.pvb_change_pct ?? 0) >= 0 ? '+' : ''}{summary.pvb_change_pct?.toFixed(2) || '0'}%
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Ayer: {summary.pvb_yesterday?.toFixed(2) || '-'} €
                                </p>
                            </div>

                            {/* Mínimo del periodo */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingDown className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Mínimo {timeRange}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">
                                    {aggregatedStats.pvb_min?.toFixed(2) || '-'} €
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {aggregatedStats.fecha_min ? formatShortDate(aggregatedStats.fecha_min) : 'MWh'}
                                </p>
                            </div>

                            {/* Máximo del periodo */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-4 w-4 text-red-500" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Máximo {timeRange}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-red-600">
                                    {aggregatedStats.pvb_max?.toFixed(2) || '-'} €
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {aggregatedStats.fecha_max ? formatShortDate(aggregatedStats.fecha_max) : 'MWh'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Gráfico de evolución */}
                    {chartData && chartData.length > 0 && (
                        <SimpleLineChart
                            data={chartData.map(d => ({
                                hour: formatShortDate(d.fecha),
                                datetime_local: d.fecha,
                                gas: Number(d.pvb_price),
                            }))}
                            dataKey="gas"
                            title="Evolución del Precio PVB (Índice Diario)"
                            subtitle="Precio de cierre diario en €/MWh - España"
                            color="#f97316"
                            height={280}
                        />
                    )}

                    {/* Nota explicativa */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 text-sm text-orange-800 dark:text-orange-200">
                        <p className="font-medium mb-1">💡 Mercados de Gas Natural Ibérico</p>
                        <p className="text-orange-700 dark:text-orange-300">
                            <strong>PVB (Punto Virtual de Balance)</strong> es el hub español gestionado por MIBGAS.
                            <strong> VTP (Ponto Virtual de Transação)</strong> es el equivalente portugués.
                            El "Day Ahead" es el precio para entrega al día siguiente, mientras que "Month Ahead"
                            refleja las expectativas para el mes siguiente.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
