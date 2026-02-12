// openenergies_crm/src/pages/informes/components/Step2Comparativa.tsx
// Paso 2 para Auditoría Comparativa con el Mercado
// Muestra todos los campos editables EXCEPTO consumo/potencia/precio por CUPS

import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
  BarChart3,
  Euro,
  Loader2,
  RefreshCw,
  Zap,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Info,
  ToggleLeft,
  ToggleRight,
  Target,
  BookOpen,
  MessageSquare,
  Search,
} from 'lucide-react';
import { useGenerateComparativeReport, type ComparativeReportResponse } from '@hooks/useInformesMercado';
import { useComparativaDraft } from '@hooks/useComparativaDraft';
import type { InformeConfig, GenerateInformeResponse } from '@lib/informesTypes';
import type { ComparativaDraft, NarrativeSection, EnergiaComparativa, DatosTarifaComparativa, DatoMensualComparativo } from '@lib/comparativaDraftTypes';
import { getFinalText } from '@lib/comparativaDraftTypes';
import { supabase } from '@lib/supabase';

// ============================================================================
// PROPS
// ============================================================================

interface Step2ComparativaProps {
  config: InformeConfig;
  onBack: () => void;
  onGenerate: (result: GenerateInformeResponse) => void;
  isSubmitting: boolean;
  generateResult: GenerateInformeResponse | null;
  submitError: string | null;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  accentColor = 'fenix',
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorClasses: Record<string, string> = {
    fenix: 'border-l-fenix-500 text-fenix-500',
    emerald: 'border-l-emerald-500 text-emerald-500',
    amber: 'border-l-amber-500 text-amber-500',
    blue: 'border-l-blue-500 text-blue-500',
    purple: 'border-l-purple-500 text-purple-500',
    slate: 'border-l-slate-500 text-slate-500',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${colorClasses[accentColor] || colorClasses.fenix}`}
      >
        <div className="flex items-center gap-3">
          <span className={colorClasses[accentColor]?.split(' ')[1] || 'text-fenix-500'}>{icon}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
          {badge}
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

function NarrativeEditor({
  section,
  label,
  onChange,
  rows = 4,
  helperText,
}: {
  section: NarrativeSection;
  label: string;
  onChange: (texto: string) => void;
  rows?: number;
  helperText?: string;
}) {
  const currentText = getFinalText(section);
  const isEdited = section.estado === 'edited';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {isEdited && (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <CheckCircle2 size={12} />
            Editado
          </span>
        )}
      </div>
      <textarea
        value={currentText}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                   bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300
                   focus:ring-2 focus:ring-fenix-500 focus:border-transparent resize-y"
      />
      {helperText && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
    </div>
  );
}

function KPICard({
  label,
  value,
  subvalue,
  icon,
  color = 'slate',
}: {
  label: string;
  value: string;
  subvalue?: string;
  icon?: React.ReactNode;
  color?: 'slate' | 'fenix' | 'emerald' | 'amber' | 'red';
}) {
  const colorClasses: Record<string, string> = {
    slate: 'text-slate-800 dark:text-white',
    fenix: 'text-fenix-600 dark:text-fenix-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subvalue && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subvalue}</div>}
    </div>
  );
}

// ============================================================================
// COMPARATIVA TABLE PER TARIFA
// ============================================================================

function ComparativaTable({
  mensual,
  energiaIdx,
  tarifaIdx,
  onPriceChange,
}: {
  mensual: DatoMensualComparativo[];
  energiaIdx: number;
  tarifaIdx: number;
  onPriceChange: (energiaIdx: number, tarifaIdx: number, mesIdx: number, price: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Mes</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Consumo (kWh)</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Coste (€)</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Precio Cliente</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center justify-end gap-1">
                Precio Mercado
                <span className="text-xs text-fenix-500">(editable)</span>
              </span>
            </th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Δ (€/kWh)</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Δ (%)</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Impacto (€)</th>
          </tr>
        </thead>
        <tbody>
          {mensual.map((mes, mesIdx) => {
            const deltaColor = (mes.delta_abs_eur_kwh ?? 0) > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-600 dark:text-emerald-400';

            return (
              <tr key={mes.mes} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {mes.mes}
                </td>
                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                  {mes.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                  {mes.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                  {mes.precio_cliente_eur_kwh != null ? mes.precio_cliente_eur_kwh.toFixed(4) : '—'}
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={mes.precio_mercado_eur_kwh ?? ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        onPriceChange(energiaIdx, tarifaIdx, mesIdx, val);
                      }
                    }}
                    className="w-24 px-2 py-1 text-right text-sm rounded border border-fenix-300 dark:border-fenix-700 
                               bg-fenix-50 dark:bg-fenix-900/20 text-fenix-700 dark:text-fenix-300
                               focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
                  />
                </td>
                <td className={`py-2 px-2 text-right font-medium ${deltaColor}`}>
                  {mes.delta_abs_eur_kwh != null ? mes.delta_abs_eur_kwh.toFixed(4) : '—'}
                </td>
                <td className={`py-2 px-2 text-right font-medium ${deltaColor}`}>
                  {mes.delta_pct != null
                    ? `${mes.delta_pct > 0 ? '+' : ''}${mes.delta_pct.toFixed(1)}%`
                    : '—'}
                </td>
                <td className={`py-2 px-2 text-right font-medium ${deltaColor}`}>
                  {mes.impacto_eur != null
                    ? mes.impacto_eur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// TARIFA CARD COMPARATIVA
// ============================================================================

function TarifaComparativaCard({
  tarifa,
  energiaIdx,
  tarifaIdx,
  isExpanded,
  onToggle,
  onPriceChange,
}: {
  tarifa: DatosTarifaComparativa;
  energiaIdx: number;
  tarifaIdx: number;
  isExpanded: boolean;
  onToggle: () => void;
  onPriceChange: (energiaIdx: number, tarifaIdx: number, mesIdx: number, price: number) => void;
}) {
  const comp = tarifa.comparativa;
  const deltaColor = (comp.delta_abs_eur_kwh ?? 0) > 0
    ? 'text-red-600 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-fenix-100 dark:bg-fenix-900/30 flex items-center justify-center">
            <Zap size={20} className="text-fenix-600 dark:text-fenix-400" />
          </div>
          <div className="text-left">
            <div className="font-medium text-slate-800 dark:text-white">{tarifa.tarifa}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tarifa.kpis.num_puntos} puntos · {tarifa.kpis.num_facturas} facturas
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">
              {tarifa.kpis.coste_total_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tarifa.kpis.consumo_total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
            </div>
          </div>
          {comp.delta_pct != null && (
            <div className={`text-right ${deltaColor}`}>
              <div className="text-sm font-bold">
                {comp.delta_pct > 0 ? '+' : ''}{comp.delta_pct.toFixed(1)}%
              </div>
              <div className="text-xs">vs mercado</div>
            </div>
          )}
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-700">
          {/* Comparative summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400">Precio cliente</div>
              <div className="font-semibold text-slate-800 dark:text-white">
                {comp.precio_cliente_eur_kwh != null ? `${comp.precio_cliente_eur_kwh.toFixed(4)} €/kWh` : '—'}
              </div>
            </div>
            <div className="text-center p-3 bg-fenix-50 dark:bg-fenix-900/20 rounded-lg">
              <div className="text-xs text-fenix-600 dark:text-fenix-400">Precio mercado</div>
              <div className="font-semibold text-fenix-700 dark:text-fenix-300">
                {comp.precio_mercado_eur_kwh != null ? `${comp.precio_mercado_eur_kwh.toFixed(4)} €/kWh` : '—'}
              </div>
            </div>
            <div className={`text-center p-3 rounded-lg ${(comp.delta_abs_eur_kwh ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
              <div className="text-xs text-slate-500 dark:text-slate-400">Δ Absoluto</div>
              <div className={`font-semibold ${deltaColor}`}>
                {comp.delta_abs_eur_kwh != null ? `${comp.delta_abs_eur_kwh.toFixed(4)} €/kWh` : '—'}
              </div>
            </div>
            <div className={`text-center p-3 rounded-lg ${(comp.delta_pct ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
              <div className="text-xs text-slate-500 dark:text-slate-400">Δ Porcentual</div>
              <div className={`font-semibold ${deltaColor}`}>
                {comp.delta_pct != null ? `${comp.delta_pct > 0 ? '+' : ''}${comp.delta_pct.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className={`text-center p-3 rounded-lg ${(comp.impacto_eur ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
              <div className="text-xs text-slate-500 dark:text-slate-400">Impacto €</div>
              <div className={`font-semibold ${deltaColor}`}>
                {comp.impacto_eur != null ? `${comp.impacto_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
              </div>
            </div>
          </div>

          {/* Monthly comparison table (editable market prices) */}
          <ComparativaTable
            mensual={tarifa.mensual}
            energiaIdx={energiaIdx}
            tarifaIdx={tarifaIdx}
            onPriceChange={onPriceChange}
          />

          {/* Extremos por tarifa */}
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
              <BarChart3 size={16} />
              Extremos por punto de suministro
            </div>

            {/* Si no hay extremos */}
            {(!tarifa.extremos ||
              (!tarifa.extremos.top_consumo?.length &&
                !tarifa.extremos.bottom_consumo?.length &&
                !tarifa.extremos.top_coste?.length &&
                !tarifa.extremos.bottom_coste?.length)) && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500 dark:text-slate-400 italic flex items-start gap-2">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>No hay datos de extremos disponibles para esta tarifa.</span>
                </div>
              )}

            {/* TOP 3 Mayor Consumo */}
            {tarifa.extremos?.top_consumo && tarifa.extremos.top_consumo.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                  🔺 TOP 3 Mayor Consumo
                </div>
                <div className="space-y-1">
                  {tarifa.extremos.top_consumo.map((punto, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded text-xs"
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {punto.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh != null ? `${punto.precio_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOTTOM 3 Menor Consumo */}
            {tarifa.extremos?.bottom_consumo && tarifa.extremos.bottom_consumo.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                  🔻 BOTTOM 3 Menor Consumo
                </div>
                <div className="space-y-1">
                  {tarifa.extremos.bottom_consumo.map((punto, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs"
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {punto.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh != null ? `${punto.precio_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOP 3 Mayor Coste */}
            {tarifa.extremos?.top_coste && tarifa.extremos.top_coste.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                  🔺 TOP 3 Mayor Coste
                </div>
                <div className="space-y-1">
                  {tarifa.extremos.top_coste.map((punto, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs"
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {punto.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh != null ? `${punto.precio_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOTTOM 3 Menor Coste */}
            {tarifa.extremos?.bottom_coste && tarifa.extremos.bottom_coste.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                  🔻 BOTTOM 3 Menor Coste
                </div>
                <div className="space-y-1">
                  {tarifa.extremos.bottom_coste.map((punto, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs"
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {punto.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh != null ? `${punto.precio_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Step2Comparativa({
  config,
  onBack,
  onGenerate,
  isSubmitting,
  generateResult,
  submitError,
}: Step2ComparativaProps) {
  // State: precalculated data from Edge Function (draft mode)
  const [calculatedData, setCalculatedData] = useState<Record<string, unknown> | null>(null);
  const [prefetchLoading, setPrefetchLoading] = useState(false);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);

  const comparativeMutation = useGenerateComparativeReport();

  // ─── Prefetch: call Edge Function without Cloud Run to get calculated data ───
  useEffect(() => {
    if (!config.cliente_id || calculatedData) return;

    const fetchData = async () => {
      setPrefetchLoading(true);
      setPrefetchError(null);

      try {
        // Call the Edge Function. If CLOUD_RUN_COMPARATIVA_URL is not set,
        // it returns calculated_data in the response as a draft.
        // If it IS set, it still returns calculated_data alongside the DOCX.
        const response = await supabase.functions.invoke('generate-comparative-audit-report', {
          body: {
            mode: 'preview',
            metadata: {
              titulo: config.titulo || 'Informe Comparativo',
              cliente_id: config.cliente_id,
              punto_ids: config.punto_ids,
              fecha_inicio: config.fecha_inicio,
              fecha_fin: config.fecha_fin,
            },
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Error obteniendo datos');
        }

        const data = response.data as any;
        
        if (data.calculated_data) {
          setCalculatedData(data.calculated_data);
        } else if (data.success && data.informe) {
          // Full generation happened — set the result but also try to build from parametros_config
          setCalculatedData(data.informe.parametros_config || data);
          onGenerate(data);
        } else {
          throw new Error(data.error || 'Respuesta inesperada del servidor');
        }
      } catch (err) {
        console.error('[Step2Comparativa] Prefetch error:', err);
        setPrefetchError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setPrefetchLoading(false);
      }
    };

    fetchData();
  }, [config.cliente_id, config.punto_ids, config.fecha_inicio, config.fecha_fin]);

  // ─── Draft hook ───
  const {
    draft,
    isLoading: draftLoading,
    error: draftError,
    updateTexto,
    toggleRecomendaciones,
    updateRecomendacionesText,
    updateMarketPrice,
    getPayload,
    regenerate,
  } = useComparativaDraft({
    clienteId: config.cliente_id || '',
    clienteNombre: config.cliente_nombre,
    puntoIds: config.punto_ids,
    fechaInicio: config.fecha_inicio,
    fechaFin: config.fecha_fin,
    titulo: config.titulo,
    calculatedData,
    enabled: !!calculatedData,
  });

  // Expanded tarifa states
  const [expandedTarifas, setExpandedTarifas] = useState<Record<string, boolean>>({});
  const toggleTarifa = useCallback((key: string) => {
    setExpandedTarifas((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Generate handler ───
  const handleGenerate = useCallback(async () => {
    const payload = getPayload();
    if (!payload) return;

    try {
      const result = await comparativeMutation.mutateAsync(payload);
      onGenerate(result);
    } catch {}
  }, [getPayload, comparativeMutation, onGenerate]);

  // ─── Loading state ───
  if (prefetchLoading || draftLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 size={40} className="text-fenix-500 animate-spin" />
        <div className="text-center">
          <p className="text-slate-700 dark:text-slate-200 font-medium">
            {prefetchLoading ? 'Calculando datos comparativos...' : 'Preparando borrador...'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Obteniendo precios de mercado y facturas del cliente
          </p>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (prefetchError || draftError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle size={40} className="text-red-500" />
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">
            Error cargando datos
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {prefetchError || draftError?.message}
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={16} />
          Volver al paso 1
        </button>
      </div>
    );
  }

  if (!draft) return null;

  const { kpis_globales: kpis, comparativa_global: comp } = draft;
  const isGenerating = isSubmitting || comparativeMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
          <span className="text-sm">Volver</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={regenerate}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Regenerar draft desde datos originales"
          >
            <RefreshCw size={16} />
            Regenerar
          </button>
        </div>
      </div>

      {/* KPIs Globales */}
      <CollapsibleSection
        title="KPIs Globales"
        icon={<Target size={20} />}
        accentColor="fenix"
        defaultOpen={true}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <KPICard
            label="Consumo total"
            value={`${kpis.consumo_total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh`}
            icon={<Zap size={14} />}
          />
          <KPICard
            label="Coste total"
            value={`${kpis.coste_total_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
            icon={<Euro size={14} />}
            color="amber"
          />
          <KPICard
            label="Precio medio"
            value={kpis.precio_medio_eur_kwh != null ? `${kpis.precio_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
            icon={<BarChart3 size={14} />}
          />
          <KPICard
            label="Precio mercado"
            value={comp.precio_mercado_medio_eur_kwh != null ? `${comp.precio_mercado_medio_eur_kwh.toFixed(4)} €/kWh` : '—'}
            icon={<TrendingUp size={14} />}
            color="fenix"
          />
          <KPICard
            label="Δ vs mercado"
            value={comp.delta_pct != null ? `${comp.delta_pct > 0 ? '+' : ''}${comp.delta_pct.toFixed(1)}%` : '—'}
            icon={<Target size={14} />}
            color={(comp.delta_pct ?? 0) > 0 ? 'red' : 'emerald'}
          />
          <KPICard
            label="Impacto económico"
            value={comp.impacto_economico_eur != null ? `${comp.impacto_economico_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
            icon={<Euro size={14} />}
            color={(comp.impacto_economico_eur ?? 0) > 0 ? 'red' : 'emerald'}
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Info size={12} />
          {kpis.num_puntos} puntos · {kpis.num_tarifas} tarifas · {kpis.num_facturas} facturas
        </div>
      </CollapsibleSection>

      {/* Portada */}
      <CollapsibleSection
        title="Portada"
        icon={<FileText size={20} />}
        accentColor="purple"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <NarrativeEditor
            section={draft.textos.titulo_portada}
            label="Título del informe"
            onChange={(t) => updateTexto('titulo_portada', t)}
            rows={2}
          />
          <NarrativeEditor
            section={draft.textos.subtitulo_portada}
            label="Subtítulo"
            onChange={(t) => updateTexto('subtitulo_portada', t)}
            rows={2}
          />
        </div>
      </CollapsibleSection>

      {/* Resumen Ejecutivo */}
      <CollapsibleSection
        title="Resumen Ejecutivo"
        icon={<BookOpen size={20} />}
        accentColor="emerald"
      >
        <NarrativeEditor
          section={draft.textos.resumen_ejecutivo}
          label="Resumen ejecutivo"
          onChange={(t) => updateTexto('resumen_ejecutivo', t)}
          rows={6}
          helperText="Describe el contexto, alcance y resultados generales del análisis."
        />
      </CollapsibleSection>

      {/* Comparativa Global */}
      <CollapsibleSection
        title="Comparativa Global"
        icon={<TrendingUp size={20} />}
        accentColor="fenix"
      >
        <NarrativeEditor
          section={draft.textos.texto_comparativa_global}
          label="Texto comparativa global"
          onChange={(t) => updateTexto('texto_comparativa_global', t)}
          rows={4}
          helperText="Resumen de la comparación precio cliente vs mercado a nivel global."
        />
      </CollapsibleSection>

      {/* Energías + Tarifas */}
      {draft.energias.map((energia, energiaIdx) => (
        <CollapsibleSection
          key={energia.energia}
          title={energia.energia === 'electricidad' ? 'Electricidad' : 'Gas Natural'}
          icon={energia.energia === 'electricidad' ? <Zap size={20} /> : <Flame size={20} />}
          accentColor={energia.energia === 'electricidad' ? 'amber' : 'blue'}
          badge={
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {energia.tarifas.length} tarifa{energia.tarifas.length !== 1 ? 's' : ''}
            </span>
          }
        >
          <div className="space-y-4">
            {/* Intro per energy type */}
            <NarrativeEditor
              section={
                energia.energia === 'electricidad'
                  ? draft.textos.texto_intro_electricidad
                  : draft.textos.texto_intro_gas
              }
              label={`Introducción ${energia.energia === 'electricidad' ? 'Electricidad' : 'Gas'}`}
              onChange={(t) =>
                updateTexto(
                  energia.energia === 'electricidad' ? 'texto_intro_electricidad' : 'texto_intro_gas',
                  t
                )
              }
              rows={3}
            />

            {/* Market data info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Info size={14} />
                Fuente de mercado: <strong>{energia.mercado.fuente}</strong>
              </div>
            </div>

            {/* Tarifa cards */}
            <div className="space-y-3">
              {energia.tarifas.map((tarifa, tarifaIdx) => {
                const key = `${energiaIdx}-${tarifaIdx}`;
                return (
                  <TarifaComparativaCard
                    key={key}
                    tarifa={tarifa}
                    energiaIdx={energiaIdx}
                    tarifaIdx={tarifaIdx}
                    isExpanded={!!expandedTarifas[key]}
                    onToggle={() => toggleTarifa(key)}
                    onPriceChange={updateMarketPrice}
                  />
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      ))}

      {/* Metodología */}
      <CollapsibleSection
        title="Metodología"
        icon={<Search size={20} />}
        accentColor="slate"
        defaultOpen={false}
      >
        <NarrativeEditor
          section={draft.textos.texto_metodologia}
          label="Metodología aplicada"
          onChange={(t) => updateTexto('texto_metodologia', t)}
          rows={5}
        />
      </CollapsibleSection>

      {/* Fuentes y Notas */}
      <CollapsibleSection
        title="Fuentes y Notas"
        icon={<BookOpen size={20} />}
        accentColor="slate"
        defaultOpen={false}
      >
        <NarrativeEditor
          section={draft.textos.texto_fuentes_notas}
          label="Fuentes y notas"
          onChange={(t) => updateTexto('texto_fuentes_notas', t)}
          rows={4}
        />
      </CollapsibleSection>

      {/* Extremos */}
      <CollapsibleSection
        title="Extremos"
        icon={<BarChart3 size={20} />}
        accentColor="amber"
        defaultOpen={false}
      >
        <NarrativeEditor
          section={draft.textos.texto_extremos}
          label="Texto extremos"
          onChange={(t) => updateTexto('texto_extremos', t)}
          rows={3}
        />
      </CollapsibleSection>

      {/* Conclusión */}
      <CollapsibleSection
        title="Conclusión"
        icon={<MessageSquare size={20} />}
        accentColor="emerald"
      >
        <NarrativeEditor
          section={draft.textos.conclusion_final}
          label="Conclusión final"
          onChange={(t) => updateTexto('conclusion_final', t)}
          rows={4}
          helperText="Conclusión principal del informe."
        />
      </CollapsibleSection>

      {/* Recomendaciones */}
      <CollapsibleSection
        title="Recomendaciones"
        icon={<Target size={20} />}
        accentColor="purple"
        defaultOpen={false}
        badge={
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              draft.recomendaciones_enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {draft.recomendaciones_enabled ? 'Activo' : 'Desactivado'}
          </span>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleRecomendaciones(!draft.recomendaciones_enabled)}
              className="flex items-center gap-2 text-sm"
            >
              {draft.recomendaciones_enabled ? (
                <ToggleRight size={24} className="text-emerald-500" />
              ) : (
                <ToggleLeft size={24} className="text-slate-400" />
              )}
              <span className="text-slate-700 dark:text-slate-300">
                {draft.recomendaciones_enabled ? 'Incluir recomendaciones' : 'Sin recomendaciones'}
              </span>
            </button>
          </div>
          {draft.recomendaciones_enabled && (
            <textarea
              value={draft.recomendaciones_text}
              onChange={(e) => updateRecomendacionesText(e.target.value)}
              rows={5}
              placeholder="Escribe las recomendaciones que aparecerán en el informe..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                         bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300
                         focus:ring-2 focus:ring-fenix-500 focus:border-transparent resize-y"
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Error display */}
      {(submitError || comparativeMutation.error) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error al generar</p>
            <p className="text-sm text-red-600 dark:text-red-400">
              {submitError || comparativeMutation.error?.message}
            </p>
          </div>
        </div>
      )}

      {/* Success display */}
      {generateResult?.success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Informe generado correctamente
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              El documento DOCX se ha descargado automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-fenix-500 text-white rounded-lg hover:bg-fenix-600 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fenix-500/25 font-medium"
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Generando informe...
            </>
          ) : (
            <>
              <FileText size={20} />
              Generar Informe Comparativo
            </>
          )}
        </button>
      </div>
    </div>
  );
}
