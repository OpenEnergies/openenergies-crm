import { TrendingUp, TrendingDown, Minus, Clock, Zap, AlertTriangle, Info, Sun } from 'lucide-react';
import type { DailyStats } from '@features/market-data/services/marketData';

interface KPICardProps {
    title: string;
    value: number | string | null;
    unit?: string;
    subtitle?: string;
    trend?: {
        value: number;
        label: string;
    };
    icon?: React.ReactNode;
    tooltip?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Tarjeta KPI individual para métricas del mercado
 */
export function KPICard({
    title,
    value,
    unit = '€/MWh',
    subtitle,
    trend,
    icon,
    tooltip,
    variant = 'default',
    size = 'md'
}: KPICardProps) {
    const variantStyles = {
        default: 'bg-white border-slate-200',
        success: 'bg-emerald-50 border-emerald-200',
        warning: 'bg-amber-50 border-amber-200',
        danger: 'bg-red-50 border-red-200',
    };

    const valueSize = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-3xl',
    };

    const displayValue = value !== null && value !== undefined
        ? typeof value === 'number' ? value.toFixed(2) : value
        : '—';

    return (
        <div
            className={`rounded-xl border p-4 ${variantStyles[variant]} transition-all hover:shadow-md`}
            title={tooltip}
        >
            <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                    {title}
                </p>
                {icon && <span className="text-slate-400">{icon}</span>}
            </div>

            <div className="flex items-baseline gap-2">
                <span className={`${valueSize[size]} font-bold text-slate-900`}>
                    {displayValue}
                </span>
                {unit && <span className="text-xs text-slate-500">{unit}</span>}
            </div>

            {subtitle && (
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}

            {trend && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value > 0 ? 'text-red-600' : trend.value < 0 ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                    {trend.value > 0 ? <TrendingUp className="h-3 w-3" /> :
                        trend.value < 0 ? <TrendingDown className="h-3 w-3" /> :
                            <Minus className="h-3 w-3" />}
                    <span>{Math.abs(trend.value).toFixed(1)}% {trend.label}</span>
                </div>
            )}
        </div>
    );
}

interface KPIGridProps {
    stats: DailyStats | null;
    title: string;
    yesterdayStats?: DailyStats | null;
    showPeriods?: boolean;
}

/**
 * Grid de KPIs para un indicador específico
 */
export function KPIGrid({ stats, title, yesterdayStats, showPeriods = false }: KPIGridProps) {
    if (!stats) {
        return (
            <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-500">
                <p>No hay datos disponibles para este día</p>
            </div>
        );
    }

    const changePct = yesterdayStats?.valor_medio
        ? ((stats.valor_medio - yesterdayStats.valor_medio) / yesterdayStats.valor_medio) * 100
        : undefined;

    const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

    // Para rangos multi-día, formatear fecha + hora
    const formatDateHour = (hour: number, fecha?: string) => {
        const hourStr = formatHour(hour);
        if (fecha) {
            // Extraer día/mes de la fecha (formato YYYY-MM-DD)
            const parts = fecha.split('-');
            if (parts.length === 3) {
                return `${parts[2]}/${parts[1]} ${hourStr}`;
            }
        }
        return hourStr;
    };

    const minSubtitle = stats.fecha_min
        ? formatDateHour(stats.hora_min, stats.fecha_min)
        : `a las ${formatHour(stats.hora_min)}`;

    const maxSubtitle = stats.fecha_max
        ? formatDateHour(stats.hora_max, stats.fecha_max)
        : `a las ${formatHour(stats.hora_max)}`;

    const isMultiDay = !!stats.fecha_min || !!stats.fecha_max;

    return (
        <div className="space-y-3">
            {title && (
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {title}
                </h3>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KPICard
                    title="Precio Medio"
                    value={stats.valor_medio}
                    trend={changePct !== undefined ? { value: changePct, label: 'vs ayer' } : undefined}
                    tooltip="Precio medio del día en €/MWh"
                    size="lg"
                />
                <KPICard
                    title="Mínimo"
                    value={stats.valor_min}
                    subtitle={minSubtitle}
                    icon={<TrendingDown className="h-4 w-4 text-emerald-500" />}
                    variant="success"
                    tooltip={isMultiDay ? "Precio más bajo del período" : "Precio más bajo del día"}
                />
                <KPICard
                    title="Máximo"
                    value={stats.valor_max}
                    subtitle={maxSubtitle}
                    icon={<TrendingUp className="h-4 w-4 text-red-500" />}
                    variant="danger"
                    tooltip={isMultiDay ? "Precio más alto del período" : "Precio más alto del día"}
                />
                <KPICard
                    title="Volatilidad"
                    value={stats.desviacion_std}
                    icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
                    variant={stats.desviacion_std > 20 ? 'warning' : 'default'}
                    tooltip="Desviación estándar: mide la variabilidad de precios durante el día"
                />
                <KPICard
                    title={isMultiDay ? "Día/Hora Mín" : "Hora Mínimo"}
                    value={isMultiDay ? formatDateHour(stats.hora_min, stats.fecha_min) : formatHour(stats.hora_min)}
                    unit=""
                    icon={<Clock className="h-4 w-4 text-slate-400" />}
                    tooltip="Mejor momento para consumir"
                />
                <KPICard
                    title={isMultiDay ? "Día/Hora Máx" : "Hora Máximo"}
                    value={isMultiDay ? formatDateHour(stats.hora_max, stats.fecha_max) : formatHour(stats.hora_max)}
                    unit=""
                    icon={<Clock className="h-4 w-4 text-slate-400" />}
                    tooltip="Peor momento para consumir"
                />
            </div>

            {showPeriods && stats.media_p1 !== undefined && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                    <KPICard
                        title="P1 (Punta)"
                        value={stats.media_p1 ?? null}
                        variant="danger"
                        tooltip="Periodo punta: horas de mayor demanda (mañana y tarde laborables)"
                    />
                    <KPICard
                        title="P2 (Llano)"
                        value={stats.media_p2 ?? null}
                        variant="warning"
                        tooltip="Periodo llano: horas intermedias"
                    />
                    <KPICard
                        title="P3 (Valle)"
                        value={stats.media_p3 ?? null}
                        variant="success"
                        tooltip="Periodo valle: noches, fines de semana y festivos"
                    />
                </div>
            )}
        </div>
    );
}

interface InsightCardProps {
    type: 'bullish' | 'bearish' | 'neutral' | 'volatile' | 'info';
    title: string;
    message: string;
}

/**
 * Tarjeta de insight/recomendación
 */
export function InsightCard({ type, title, message }: InsightCardProps) {
    const styles = {
        bullish: { bg: 'bg-red-50', border: 'border-red-200', icon: <TrendingUp className="h-5 w-5 text-red-600" />, iconBg: 'bg-red-100' },
        bearish: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <TrendingDown className="h-5 w-5 text-emerald-600" />, iconBg: 'bg-emerald-100' },
        neutral: { bg: 'bg-slate-50', border: 'border-slate-200', icon: <Minus className="h-5 w-5 text-slate-600" />, iconBg: 'bg-slate-100' },
        volatile: { bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle className="h-5 w-5 text-amber-600" />, iconBg: 'bg-amber-100' },
        info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: <Info className="h-5 w-5 text-blue-600" />, iconBg: 'bg-blue-100' },
    };

    const style = styles[type];

    return (
        <div className={`rounded-xl border ${style.bg} ${style.border} p-4 flex items-start gap-3`}>
            <div className={`p-2 rounded-lg ${style.iconBg}`}>
                {style.icon}
            </div>
            <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600 mt-1">{message}</p>
            </div>
        </div>
    );
}

interface TopHoursCardProps {
    cheapest: Array<{ hour: number; value: number }>;
    expensive: Array<{ hour: number; value: number }>;
}

/**
 * Tarjeta de Top 3 horas más baratas y caras
 */
export function TopHoursCard({ cheapest, expensive }: TopHoursCardProps) {
    const formatHourRange = (h: number) => `${h.toString().padStart(2, '0')}:00-${(h + 1).toString().padStart(2, '0')}:00`;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 h-full">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Horas Clave del Día
            </h3>

            <div className="grid grid-cols-2 gap-4">
                {/* Más baratas */}
                <div className="space-y-2">
                    <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Más baratas
                    </p>
                    <div className="space-y-2">
                        {cheapest.map((h, i) => (
                            <div key={h.hour} className="bg-emerald-50 rounded-lg px-3 py-2">
                                <p className="text-sm font-medium text-emerald-900 whitespace-nowrap">
                                    {i + 1}. {formatHourRange(h.hour)}
                                </p>
                                <p className="text-xs text-emerald-700 font-semibold">
                                    {h.value.toFixed(2)} €/MWh
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Más caras */}
                <div className="space-y-2">
                    <p className="text-xs text-red-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Más caras
                    </p>
                    <div className="space-y-2">
                        {expensive.map((h, i) => (
                            <div key={h.hour} className="bg-red-50 rounded-lg px-3 py-2">
                                <p className="text-sm font-medium text-red-900 whitespace-nowrap">
                                    {i + 1}. {formatHourRange(h.hour)}
                                </p>
                                <p className="text-xs text-red-700 font-semibold">
                                    {h.value.toFixed(2)} €/MWh
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
                💡 Concentra el consumo en las horas verdes para ahorrar
            </p>
        </div>
    );
}

interface DateSelectorProps {
    isToday: boolean;
    onSelect: (isToday: boolean) => void;
    showTomorrow?: boolean;
    dateLabel?: string;
}

/**
 * Selector de fecha Hoy/Ayer/Mañana
 */
export function DateSelector({ isToday, onSelect, showTomorrow = true, dateLabel }: DateSelectorProps) {
    return (
        <div className="flex items-center gap-2">
            {dateLabel && (
                <span className="text-sm text-slate-500">{dateLabel}</span>
            )}
            <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                    onClick={() => onSelect(true)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isToday
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Hoy
                </button>
                {showTomorrow && (
                    <button
                        onClick={() => onSelect(false)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!isToday
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Mañana
                    </button>
                )}
            </div>
        </div>
    );
}

export type TimeRange = '1D' | '7D' | '1M';

interface TimeRangeSelectorProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
}

/**
 * Selector de rango temporal para gráficos (1D/7D/1M)
 */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    const options: { key: TimeRange; label: string }[] = [
        { key: '1D', label: '1D' },
        { key: '7D', label: '7D' },
        { key: '1M', label: '1M' },
    ];

    return (
        <div className="flex bg-slate-100 rounded-lg p-1">
            {options.map(opt => (
                <button
                    key={opt.key}
                    onClick={() => onChange(opt.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${value === opt.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// Selector específico para Gas (solo 7D y 1M)
export type GasTimeRange = '7D' | '1M';

interface GasTimeRangeSelectorProps {
    value: GasTimeRange;
    onChange: (range: GasTimeRange) => void;
}

/**
 * Selector de rango temporal para gráficos de Gas (7D/1M)
 */
export function GasTimeRangeSelector({ value, onChange }: GasTimeRangeSelectorProps) {
    const options: { key: GasTimeRange; label: string }[] = [
        { key: '7D', label: '7D' },
        { key: '1M', label: '1M' },
    ];

    return (
        <div className="flex bg-slate-100 rounded-lg p-1">
            {options.map(opt => (
                <button
                    key={opt.key}
                    onClick={() => onChange(opt.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${value === opt.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
}

/**
 * Encabezado de sección
 */
export function SectionHeader({ title, subtitle, icon, actions }: SectionHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
                {icon && <span className="text-slate-400">{icon}</span>}
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

/**
 * Loader skeleton para tarjetas
 */
export function KPICardSkeleton() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
            <div className="h-3 w-16 bg-slate-200 rounded mb-3"></div>
            <div className="h-7 w-24 bg-slate-200 rounded mb-2"></div>
            <div className="h-3 w-20 bg-slate-100 rounded"></div>
        </div>
    );
}

/**
 * Estado vacío
 */
export function EmptyState({ message = 'No hay datos disponibles para este día' }: { message?: string }) {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
            <Sun className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{message}</p>
            <p className="text-sm text-slate-400 mt-1">Los datos se actualizan automáticamente</p>
        </div>
    );
}

/**
 * Estado de error
 */
export function ErrorState({ message = 'Error al cargar los datos' }: { message?: string }) {
    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-700">{message}</p>
            <p className="text-sm text-red-500 mt-1">Inténtalo de nuevo más tarde</p>
        </div>
    );
}
