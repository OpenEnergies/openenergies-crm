import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
} from 'recharts';
import {
  BarChart3, Loader2, Trash2, Copy, List, Receipt,
  PieChart as PieIcon, LineChart as LineIcon, BarChart2, MousePointer2,
  ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '@hooks/ThemeContext';
import { useNavigate } from '@tanstack/react-router';
import {
  MetricConfig, SharedFilters, AggregateResponseSchema,
  MEASURE_LABELS, AGG_LABELS, GROUP_LABELS, GroupByOption,
  getChartColor, formatValue,
} from './types';

const ALL_CHART_TYPES = ['bar', 'line', 'scatter', 'pie'] as const;
const MONTH_WINDOW_SIZE = 12;

const getAllowedAggregations = (measure: MetricConfig['measure']) =>
  measure === 'precio_eur_kwh' ? (['avg'] as const) : (['sum', 'avg', 'min', 'max'] as const);

const getAllowedChartTypes = (measure: MetricConfig['measure']) =>
  measure === 'precio_eur_kwh' ? (['line', 'scatter'] as const) : ALL_CHART_TYPES;

const getAllowedGroupBy = (measure: MetricConfig['measure']) => {
  const base: GroupByOption[] = ['month', 'client', 'point', 'retailer', 'invoice_type'];
  return measure === 'potencia_kw' ? base.filter((g) => g !== 'invoice_type') : base;
};

// ═══════════════════════════════════════════
// Props
// ═══════════════════════════════════════════

interface MetricCardProps {
  config: MetricConfig;
  index: number;
  sharedFilters: SharedFilters;
  onUpdate: (id: string, updates: Partial<MetricConfig>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  isFirst?: boolean;
  isCliente?: boolean;
  isComercial?: boolean;
}

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function MetricCard({
  config, index, sharedFilters,
  onUpdate, onDuplicate, onDelete, canDelete, isFirst = true, isCliente = false, isComercial = false,
}: MetricCardProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // ─── Debounced query params ───
  const [debouncedParams, setDebouncedParams] = useState<any>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedParams({
        ...sharedFilters,
        group_by_key: config.groupBy,
        metrics: [{ measure: config.measure, aggregation: config.aggregation }],
        top_n: config.topMode === 'bottom' ? 99999 : config.topN,
      });
    }, 500);
    return () => clearTimeout(handler);
  }, [sharedFilters, config.groupBy, config.measure, config.aggregation, config.topN, config.topMode]);

  // ─── Query ───
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['analytics-metric', config.id, debouncedParams],
    queryFn: async () => {
      if (!debouncedParams) return null;
      const { data, error } = await supabase.rpc('facturacion_aggregate', debouncedParams);
      if (error) {
        toast.error('Error al consultar datos');
        throw error;
      }
      return AggregateResponseSchema.parse(data);
    },
    enabled: !!debouncedParams,
  });

  // ─── Derived ───
  const measureKey = `${config.measure}_${config.aggregation}`;
  const chartColor = getChartColor(index);

  const extractYearMonth = useCallback((value: unknown): { year: number; month: number } | null => {
    if (typeof value === 'string') {
      const match = value.match(/(\d{4})-(\d{2})/);
      if (match) {
        return { year: Number(match[1]), month: Number(match[2]) };
      }
    }

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }, []);

  const formatMonthLabel = useCallback((value: unknown): string => {
    const ym = extractYearMonth(value);
    if (!ym) return String(value ?? '');
    return `${String(ym.month).padStart(2, '0')}/${String(ym.year).slice(-2)}`;
  }, [extractYearMonth]);

  const chartData = useMemo(() => {
    if (!rawData?.groups) return [];
    let data = [...rawData.groups];

    if (config.groupBy === 'month') {
      data.sort((a, b) => a.group_key.localeCompare(b.group_key));
    } else {
      if (config.topMode === 'bottom') {
        data.sort((a, b) => (a[measureKey] || 0) - (b[measureKey] || 0));
      } else {
        data.sort((a, b) => (b[measureKey] || 0) - (a[measureKey] || 0));
      }
      data = data.slice(0, config.topN);
    }
    return data;
  }, [rawData, config.topMode, config.topN, config.groupBy, measureKey]);

  const [yearFilterMode, setYearFilterMode] = useState<'all' | 'range'>('all');
  const [selectedYearFrom, setSelectedYearFrom] = useState<number | null>(null);
  const [selectedYearTo, setSelectedYearTo] = useState<number | null>(null);
  const [monthWindowStart, setMonthWindowStart] = useState(0);

  const availableYears = useMemo(() => {
    if (config.groupBy !== 'month') return [] as number[];
    const years = new Set<number>();
    chartData.forEach((row) => {
      const ym = extractYearMonth(row.group_key);
      if (ym) years.add(ym.year);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [chartData, config.groupBy, extractYearMonth]);

  useEffect(() => {
    if (config.groupBy !== 'month') {
      setYearFilterMode('all');
      setSelectedYearFrom(null);
      setSelectedYearTo(null);
      setMonthWindowStart(0);
      return;
    }

    if (availableYears.length === 0) {
      setSelectedYearFrom(null);
      setSelectedYearTo(null);
      setMonthWindowStart(0);
      return;
    }

    const firstYear = availableYears[0] ?? null;
    const lastYear = availableYears[availableYears.length - 1] ?? null;

    setSelectedYearFrom((prev) => (prev != null && availableYears.includes(prev) ? prev : firstYear));
    setSelectedYearTo((prev) => (prev != null && availableYears.includes(prev) ? prev : lastYear));
    setMonthWindowStart(0);
  }, [config.groupBy, availableYears]);

  const yearFilteredData = useMemo(() => {
    if (config.groupBy !== 'month') return chartData;
    if (yearFilterMode === 'all' || selectedYearFrom == null || selectedYearTo == null) return chartData;

    const minYear = Math.min(selectedYearFrom, selectedYearTo);
    const maxYear = Math.max(selectedYearFrom, selectedYearTo);
    return chartData.filter((row) => {
      const ym = extractYearMonth(row.group_key);
      return !!ym && ym.year >= minYear && ym.year <= maxYear;
    });
  }, [chartData, config.groupBy, yearFilterMode, selectedYearFrom, selectedYearTo, extractYearMonth]);

  const maxMonthWindowStart = Math.max(0, yearFilteredData.length - MONTH_WINDOW_SIZE);

  useEffect(() => {
    setMonthWindowStart((prev) => Math.min(prev, maxMonthWindowStart));
  }, [maxMonthWindowStart]);

  const visibleChartData = useMemo(() => {
    if (config.groupBy !== 'month') return chartData;
    return yearFilteredData.slice(monthWindowStart, monthWindowStart + MONTH_WINDOW_SIZE);
  }, [chartData, config.groupBy, yearFilteredData, monthWindowStart]);

  const tableAndChartData = config.groupBy === 'month' ? visibleChartData : chartData;

  const currentChartType = config.chartType;
  const showTopControls = config.groupBy !== 'month';
  const rowCount = rawData?.meta?.row_count;

  const allowedAggregations = useMemo(() => getAllowedAggregations(config.measure), [config.measure]);
  const allowedChartTypes = useMemo<(typeof ALL_CHART_TYPES)[number][]>(
    () => [...getAllowedChartTypes(config.measure)],
    [config.measure],
  );
  const allowedGroupBy = useMemo(() => getAllowedGroupBy(config.measure), [config.measure]);
  const formatGroupLabel = useCallback((row: { group_key?: string; group_label?: string }) => {
    if (config.groupBy === 'month') return formatMonthLabel(row.group_key);
    return row.group_label || row.group_key || '';
  }, [config.groupBy, formatMonthLabel]);

  useEffect(() => {
    const updates: Partial<MetricConfig> = {};
    if (!allowedAggregations.includes(config.aggregation as any)) {
      updates.aggregation = allowedAggregations[0];
    }
    if (!allowedChartTypes.includes(config.chartType as any)) {
      updates.chartType = allowedChartTypes[0];
    }
    if (!allowedGroupBy.includes(config.groupBy)) {
      updates.groupBy = 'month';
    }
    if (Object.keys(updates).length > 0) {
      onUpdate(config.id, updates);
    }
  }, [
    allowedAggregations,
    allowedChartTypes,
    allowedGroupBy,
    config.aggregation,
    config.chartType,
    config.groupBy,
    config.id,
    onUpdate,
  ]);

  // ─── Theme-aware styles ───
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`,
    borderRadius: '8px',
    color: theme === 'dark' ? '#f3f4f6' : '#111827',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    padding: '8px 12px',
  };
  const labelTextStyle: React.CSSProperties = {
    color: theme === 'dark' ? '#e5e7eb' : '#374151',
    fontWeight: 600,
  };
  const itemTextStyle: React.CSSProperties = {
    color: theme === 'dark' ? '#d1d5db' : '#4b5563',
  };
  const axisStroke = theme === 'dark' ? '#6b7280' : '#9ca3af';
  const gridStroke = theme === 'dark' ? '#1f2937' : '#e5e7eb';
  const pieLabelColor = theme === 'dark' ? '#d1d5db' : '#374151';

  // ─── Dynamic label for group_by (rename "Cliente" → "Sociedad" for comercial) ───
  const getGroupLabel = useCallback((key: string) => {
    if (key === 'client' && isComercial) return 'Sociedad';
    return GROUP_LABELS[key as keyof typeof GROUP_LABELS] ?? key;
  }, [isComercial]);

  // ─── Navigate to punto detail when clicking CUPS ───
  const handleCupsClick = useCallback((puntoId: string) => {
    if (config.groupBy === 'point' && puntoId) {
      navigate({ to: '/app/puntos/$id/detalle', params: { id: puntoId } });
    }
  }, [config.groupBy, navigate]);

  // ═══════════════════════════════════════
  // Chart renderer
  // ═══════════════════════════════════════

  const renderChart = () => {
    // "Sin agrupación" → show single summary value
    if (tableAndChartData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <Receipt size={48} className="opacity-20 mb-2" />
          <p className="text-sm">No hay datos suficientes para la visualización</p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        {renderChartByType()}
      </ResponsiveContainer>
    );
  };

  const renderChartByType = (): React.ReactElement => {
    // ── Line ──
    if (currentChartType === 'line') {
      return (
        <LineChart data={tableAndChartData} onClick={(e: any) => {
          if (config.groupBy === 'point' && e?.activePayload?.[0]?.payload?.group_key) {
            handleCupsClick(e.activePayload[0].payload.group_key);
          }
        }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey={config.groupBy === 'month' ? 'group_key' : 'group_label'}
            stroke={axisStroke}
            fontSize={10}
            tickFormatter={(val) =>
              config.groupBy === 'month' ? formatMonthLabel(val) : val
            }
          />
          <YAxis stroke={axisStroke} fontSize={10} tickFormatter={(val) => formatValue(val, config.measure)} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={labelTextStyle}
            itemStyle={itemTextStyle}
            labelFormatter={(val) =>
              config.groupBy === 'month' ? formatMonthLabel(val) : val
            }
            formatter={(val: any) => [formatValue(Number(val) || 0, config.measure), MEASURE_LABELS[config.measure]]}
            wrapperStyle={config.groupBy === 'point' ? { cursor: 'pointer' } : undefined}
          />
          <Line
            type="monotone"
            dataKey={measureKey}
            stroke={chartColor}
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6, cursor: config.groupBy === 'point' ? 'pointer' : 'default' }}
            name={MEASURE_LABELS[config.measure]}
          />
        </LineChart>
      );
    }

    // ── Bar ──
    if (currentChartType === 'bar') {
      const isHorizontal = config.groupBy === 'month' || config.groupBy === 'invoice_type';
      return (
        <BarChart data={tableAndChartData} layout={isHorizontal ? 'horizontal' : 'vertical'}
          onClick={(e: any) => {
            if (config.groupBy === 'point' && e?.activePayload?.[0]?.payload?.group_key) {
              handleCupsClick(e.activePayload[0].payload.group_key);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          {isHorizontal ? (
            <>
              <XAxis
                dataKey={config.groupBy === 'month' ? 'group_key' : 'group_label'}
                stroke={axisStroke}
                fontSize={10}
                tickFormatter={(val) =>
                  config.groupBy === 'month' ? formatMonthLabel(val) : val
                }
              />
              <YAxis stroke={axisStroke} fontSize={10} tickFormatter={(val) => formatValue(val, config.measure)} />
            </>
          ) : (
            <>
              <XAxis type="number" stroke={axisStroke} fontSize={10} tickFormatter={(val) => formatValue(val, config.measure)} />
              <YAxis dataKey="group_label" type="category" stroke={axisStroke} fontSize={10} width={120} />
            </>
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={labelTextStyle}
            itemStyle={itemTextStyle}
            labelFormatter={(val) =>
              config.groupBy === 'month' ? formatMonthLabel(val) : val
            }
            formatter={(val: any) => [formatValue(Number(val) || 0, config.measure), MEASURE_LABELS[config.measure]]}
            wrapperStyle={config.groupBy === 'point' ? { cursor: 'pointer' } : undefined}
          />
          <Bar
            dataKey={measureKey}
            fill={chartColor}
            radius={isHorizontal ? [4, 4, 0, 0] : [0, 4, 4, 0]}
            name={MEASURE_LABELS[config.measure]}
            cursor={config.groupBy === 'point' ? 'pointer' : 'default'}
          />
        </BarChart>
      );
    }

    // ── Scatter (FIXED) ──
    if (currentChartType === 'scatter') {
      const scatterData = tableAndChartData.map((d, i) => ({
        ...d,
        __x: i,
        __y: Number(d[measureKey]) || 0,
        __label: config.groupBy === 'month'
          ? formatMonthLabel(d.group_key)
          : (d.group_label || d.group_key || ''),
      }));

      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="__x"
            type="number"
            stroke={axisStroke}
            fontSize={10}
            domain={[-0.5, Math.max(scatterData.length - 0.5, 0.5)]}
            ticks={scatterData.map((_, i) => i)}
            tickFormatter={(val: number) => {
              const item = scatterData[Math.round(val)];
              if (!item) return '';
              return item.__label.length > 14 ? item.__label.slice(0, 14) + '…' : item.__label;
            }}
            interval={0}
          />
          <YAxis
            dataKey="__y"
            type="number"
            stroke={axisStroke}
            fontSize={10}
            tickFormatter={(val) => formatValue(val, config.measure)}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload;
              return (
                <div style={tooltipStyle}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{point?.__label}</p>
                  <p style={{ color: chartColor }}>
                    {MEASURE_LABELS[config.measure]}: {formatValue(point?.__y || 0, config.measure)}
                  </p>
                </div>
              );
            }}
          />
          <Scatter
            name={MEASURE_LABELS[config.measure]}
            data={scatterData}
            fill={chartColor}
            cursor={config.groupBy === 'point' ? 'pointer' : 'default'}
            onClick={(data: any) => {
              if (config.groupBy === 'point' && data?.group_key) {
                handleCupsClick(data.group_key);
              }
            }}
          />
        </ScatterChart>
      );
    }

    // ── Pie ──
    const pieData = (() => {
      const sorted = [...tableAndChartData].sort((a, b) => (b[measureKey] || 0) - (a[measureKey] || 0));
      const top = sorted.slice(0, 10);
      const rest = sorted.slice(10);
      const withRest = (() => {
        if (rest.length > 0) {
          const restSum = rest.reduce((acc, curr) => acc + (curr[measureKey] || 0), 0);
          return [...top, { group_label: 'Otros', [measureKey]: restSum }];
        }
        return top;
      })();

      return withRest.map((item: any) => ({
        ...item,
        __legendLabel: config.groupBy === 'month'
          ? formatMonthLabel(item.group_key || item.group_label)
          : (item.group_label || item.group_key || ''),
      }));
    })();

    return (
      <PieChart>
        <Pie
          data={pieData}
          dataKey={measureKey}
          nameKey="__legendLabel"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ cx: pcx, cy: pcy, midAngle, outerRadius: oR, group_key, group_label, percent }: any) => {
            const RADIAN = Math.PI / 180;
            const radius = (oR || 100) + 25;
            const x = pcx + radius * Math.cos(-midAngle * RADIAN);
            const y = pcy + radius * Math.sin(-midAngle * RADIAN);
            const segmentLabel = config.groupBy === 'month'
              ? formatMonthLabel(group_key || group_label)
              : (group_label || group_key || '');
            return (
              <text
                x={x} y={y}
                fill={pieLabelColor}
                textAnchor={x > pcx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={10}
                style={config.groupBy === 'point' ? { cursor: 'pointer' } : undefined}
              >
                {`${segmentLabel} (${(percent * 100).toFixed(0)}%)`}
              </text>
            );
          }}
          fontSize={10}
          onClick={(data: any) => {
            if (config.groupBy === 'point' && data?.group_key) {
              handleCupsClick(data.group_key);
            }
          }}
          cursor={config.groupBy === 'point' ? 'pointer' : 'default'}
        >
          {pieData.map((_, i) => (
            <Cell key={`cell-${i}`} fill={getChartColor(i)} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const point = payload[0]?.payload;
            const label = config.groupBy === 'month'
              ? formatMonthLabel(point?.group_key || point?.group_label)
              : (point?.group_label || point?.group_key || '');

            return (
              <div style={tooltipStyle}>
                <p style={{ ...labelTextStyle, marginBottom: 4 }}>{`${getGroupLabel(config.groupBy)}: ${label}`}</p>
                <p style={itemTextStyle}>
                  {MEASURE_LABELS[config.measure]}: {formatValue(Number(point?.[measureKey]) || 0, config.measure)}
                </p>
              </div>
            );
          }}
        />
        <Legend formatter={(value: string) => value} />
      </PieChart>
    );
  };

  // ═══════════════════════════════════════
  // Table renderer
  // ═══════════════════════════════════════

  const renderTable = () => {
    if (tableAndChartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4">
          Sin datos para mostrar
        </div>
      );
    }

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-intermediate text-[10px] uppercase tracking-wider text-primary font-bold border-b-2 border-primary">
              <th className="px-3 py-2">{getGroupLabel(config.groupBy)}</th>
              <th className="px-3 py-2 text-right">
                {MEASURE_LABELS[config.measure]} ({AGG_LABELS[config.aggregation]})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tableAndChartData.map((row, idx) => (
              <tr key={idx} className="hover:bg-bg-intermediate/50 transition-colors">
                <td
                  className={`px-3 py-1.5 text-xs text-primary truncate max-w-[180px] ${config.groupBy === 'point' ? 'cursor-pointer hover:text-fenix-500 hover:underline transition-colors' : ''
                    }`}
                  onClick={() => config.groupBy === 'point' && handleCupsClick(row.group_key)}
                >
                  {formatGroupLabel(row)}
                </td>
                <td className="px-3 py-1.5 text-right text-xs text-secondary font-mono">
                  {formatValue(row[measureKey] || 0, config.measure)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  return (
    <div className="glass-card overflow-hidden">
      {/* ── Config Row ── */}
      <div className="p-5 border-b border-primary/10">
        {isFirst && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-fenix-500/20 text-fenix-500 text-xs font-bold shrink-0">
              {index + 1}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-primary text-sm">Paso 2: Define tu métrica</h3>
              <p className="text-[11px] text-secondary opacity-70">
                Elige qué medir, cómo agregarlo, el tipo de gráfico y cómo agrupar los resultados.
              </p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end ${!isFirst ? 'mt-0' : ''}`}>
          {/* 1 · Métrica */}
          <div className="flex flex-col">
            <select
              className={`glass-input text-xs py-1 px-2 w-full h-10 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
              value={config.measure}
              onChange={(e) => onUpdate(config.id, { measure: e.target.value as any })}
              title="Métrica"
            >
              {(['consumo_kwh', 'precio_eur_kwh', 'total', 'potencia_kw'] as const).map((k) => (
                <option key={k} value={k}>{MEASURE_LABELS[k]}</option>
              ))}
            </select>
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Métrica</p>
          </div>

          {/* 2 · Operación */}
          <div className="flex flex-col">
            <select
              className={`glass-input text-xs py-1 px-2 w-full h-10 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
              value={config.aggregation}
              onChange={(e) => onUpdate(config.id, { aggregation: e.target.value as any })}
              title="Operación"
            >
              {allowedAggregations.map((k) => (
                <option key={k} value={k}>{AGG_LABELS[k]}</option>
              ))}
            </select>
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Operación</p>
          </div>

          {/* 3 · Tipo de gráfico */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border h-10 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
              {ALL_CHART_TYPES.map((type) => {
                const Icon = type === 'bar' ? BarChart2 : type === 'line' ? LineIcon : type === 'scatter' ? MousePointer2 : PieIcon;
                const isSelected = config.chartType === type;
                const isDisabled = !allowedChartTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => !isDisabled && onUpdate(config.id, { chartType: type })}
                    disabled={isDisabled}
                    className={`flex-1 h-full flex items-center justify-center rounded-md transition-all cursor-pointer ${isSelected
                      ? 'bg-fenix-500 text-white shadow-lg'
                      : theme === 'dark'
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                      } ${isDisabled ? 'opacity-35 cursor-not-allowed hover:bg-transparent hover:text-inherit' : ''}`}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  >
                    <Icon size={13} />
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Gráfico</p>
          </div>

          {/* 4 · Agrupar por */}
          <div className="flex flex-col">
            <select
              className={`glass-input text-xs py-1 px-2 w-full h-10 ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
              value={config.groupBy}
              onChange={(e) => onUpdate(config.id, { groupBy: e.target.value as GroupByOption })}
              title="Agrupar por"
            >
              {allowedGroupBy
                .filter((k) => !(isCliente && k === 'client'))
                .map((k) => (
                  <option key={k} value={k}>{getGroupLabel(k)}</option>
                ))}
            </select>
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Agrupar por</p>
          </div>

          {/* 5 · Top N */}
          <div className="flex flex-col">
            <input
              type="number"
              className={`glass-input text-xs py-1 px-2 w-full h-10 ${!showTopControls ? 'opacity-40 cursor-not-allowed' : ''}`}
              value={config.topN}
              min={1}
              max={500}
              onChange={(e) => onUpdate(config.id, { topN: Math.max(1, parseInt(e.target.value) || 20) })}
              disabled={!showTopControls}
              title="Top N"
            />
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Top N</p>
          </div>

          {/* 6 · Top / Bottom */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border h-10 ${!showTopControls ? 'opacity-40' : ''
              } ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
              <button
                onClick={() => showTopControls && onUpdate(config.id, { topMode: 'top' })}
                disabled={!showTopControls}
                className={`flex-1 h-full flex items-center justify-center rounded-md transition-all text-[10px] gap-0.5 cursor-pointer ${config.topMode === 'top'
                  ? 'bg-fenix-500 text-white shadow-lg'
                  : theme === 'dark'
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
                title="Muestra los valores más altos"
              >
                <ArrowUp size={10} /> Top
              </button>
              <button
                onClick={() => showTopControls && onUpdate(config.id, { topMode: 'bottom' })}
                disabled={!showTopControls}
                className={`flex-1 h-full flex items-center justify-center rounded-md transition-all text-[10px] gap-0.5 cursor-pointer ${config.topMode === 'bottom'
                  ? 'bg-fenix-500 text-white shadow-lg'
                  : theme === 'dark'
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
                title="Muestra los valores más bajos"
              >
                <ArrowDown size={10} /> Bot
              </button>
            </div>
            <p className="text-[8px] text-secondary opacity-50 mt-0.5 px-1 leading-tight whitespace-nowrap">Ordenar</p>
          </div>

          {/* 7 · Acciones */}
          <div className="flex items-center gap-1 justify-center h-8">
            <button
              onClick={() => onDuplicate(config.id)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${theme === 'dark'
                ? 'text-gray-500 hover:text-fenix-400 hover:bg-fenix-500/10'
                : 'text-gray-400 hover:text-fenix-600 hover:bg-fenix-50'
                }`}
              title="Duplicar métrica"
            >
              <Copy size={14} />
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(config.id)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${theme === 'dark'
                  ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                title="Eliminar métrica"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Visualization ── */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {isFirst && (
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-fenix-600 dark:text-fenix-400 shrink-0" />
              <h4 className="font-semibold text-primary text-sm">Paso 3: Visualiza</h4>
            </div>
          )}
          <span className="text-secondary font-normal text-xs">
            {MEASURE_LABELS[config.measure]} ({AGG_LABELS[config.aggregation]}) — {getGroupLabel(config.groupBy)} · {currentChartType}
          </span>
          {rowCount != null && (
            <span className="text-[10px] text-secondary opacity-60 ml-auto whitespace-nowrap">
              {rowCount.toLocaleString('es-ES')} facturas analizadas
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="h-[350px] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
            <p className="text-sm text-secondary">Calculando…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Chart */}
            <div className="lg:col-span-3">
              <div className="h-[350px] flex items-stretch gap-2">
                {config.groupBy === 'month' && (
                  <button
                    type="button"
                    onClick={() => setMonthWindowStart((prev) => Math.max(0, prev - 1))}
                    disabled={monthWindowStart <= 0}
                    className={`w-8 h-8 self-center rounded-md border transition-colors ${theme === 'dark'
                      ? 'border-white/10 text-gray-200 hover:bg-white/10 disabled:text-gray-500 disabled:border-white/5 disabled:hover:bg-transparent'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:hover:bg-transparent'
                      }`}
                    title="Meses anteriores"
                  >
                    <ChevronLeft size={16} className="mx-auto" />
                  </button>
                )}

                <div className="flex-1 h-full">
                  {renderChart()}
                </div>

                {config.groupBy === 'month' && (
                  <button
                    type="button"
                    onClick={() => setMonthWindowStart((prev) => Math.min(maxMonthWindowStart, prev + 1))}
                    disabled={monthWindowStart >= maxMonthWindowStart}
                    className={`w-8 h-8 self-center rounded-md border transition-colors ${theme === 'dark'
                      ? 'border-white/10 text-gray-200 hover:bg-white/10 disabled:text-gray-500 disabled:border-white/5 disabled:hover:bg-transparent'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:hover:bg-transparent'
                      }`}
                    title="Meses siguientes"
                  >
                    <ChevronRight size={16} className="mx-auto" />
                  </button>
                )}
              </div>

              {config.groupBy === 'month' && availableYears.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setYearFilterMode('all');
                      setMonthWindowStart(0);
                    }}
                    className={`px-2.5 py-1.5 rounded-md border transition-colors ${yearFilterMode === 'all'
                      ? 'bg-fenix-500 text-white border-fenix-500'
                      : theme === 'dark'
                        ? 'border-white/10 text-gray-200 hover:bg-white/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Todos
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setYearFilterMode('range');
                      setMonthWindowStart(0);
                    }}
                    className={`px-2.5 py-1.5 rounded-md border transition-colors ${yearFilterMode === 'range'
                      ? 'bg-fenix-500 text-white border-fenix-500'
                      : theme === 'dark'
                        ? 'border-white/10 text-gray-200 hover:bg-white/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Rango de años
                  </button>

                  {yearFilterMode === 'range' && (
                    <>
                      <label className="flex flex-col items-center gap-1 text-secondary min-w-[92px]">
                        <span className="leading-none">Desde</span>
                        <select
                          className={`glass-input text-xs px-2 h-10 text-center ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
                          value={selectedYearFrom ?? availableYears[0]}
                          onChange={(e) => {
                            setSelectedYearFrom(Number(e.target.value));
                            setMonthWindowStart(0);
                          }}
                        >
                          {availableYears.map((year) => (
                            <option key={`from-${year}`} value={year}>{year}</option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col items-center gap-1 text-secondary min-w-[92px]">
                        <span className="leading-none">Hasta</span>
                        <select
                          className={`glass-input text-xs px-2 h-10 text-center ${theme === 'dark' ? 'bg-[#141424] text-gray-100' : 'bg-white text-gray-900'}`}
                          value={selectedYearTo ?? availableYears[availableYears.length - 1]}
                          onChange={(e) => {
                            setSelectedYearTo(Number(e.target.value));
                            setMonthWindowStart(0);
                          }}
                        >
                          {availableYears.map((year) => (
                            <option key={`to-${year}`} value={year}>{year}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Table */}
            <div className={`lg:col-span-2 h-[350px] rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
              }`}>
              <div className={`px-3 py-2 border-b shrink-0 ${theme === 'dark' ? 'border-white/5 bg-white/[0.03]' : 'border-gray-200 bg-gray-100/50'
                }`}>
                <h5 className="text-[10px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <List size={11} /> Tabla · {tableAndChartData.length} filas
                </h5>
              </div>
              {renderTable()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
