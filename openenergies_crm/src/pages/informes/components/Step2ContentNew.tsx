// openenergies_crm/src/pages/informes/components/Step2Content.tsx
// Paso 2: Contenido del Informe - Edición de narrativa por tarifa y mes

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingUp,
  BarChart3,
  Euro,
  Loader2,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Search,
  Target,
  BookOpen,
  FileWarning,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import { useAuditoriaEnergeticaData } from '@hooks/useInformesMercado';
import { useReportDraft } from '@hooks/useReportDraft';
import type { InformeConfig } from '@lib/informesTypes';
import type { ReportDraft, NarrativeSection, DatosTarifaDraft, PuntoExtremo } from '@lib/reportDraftTypes';
import { getFinalText } from '@lib/reportDraftTypes';
import { maskCUPS } from '@lib/reportTemplates';

// ============================================================================
// TIPOS
// ============================================================================

interface Step2ContentProps {
  config: InformeConfig;
  onBack: () => void;
  onGenerate: (draft: ReportDraft) => void;
  isSubmitting: boolean;
  generateResult: { success: boolean; url?: string; informe_id?: string } | null;
  submitError: string | null;
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

/** Sección colapsable */
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

/** Editor de texto narrativo */
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
      {helperText && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
}

/** Tarjeta de KPI */
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
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      {subvalue && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {subvalue}
        </div>
      )}
    </div>
  );
}

/** Tarjeta de tarifa */
function TarifaCard({
  tarifa,
  isExpanded,
  onToggle,
}: {
  tarifa: DatosTarifaDraft;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
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
            <div className="font-medium text-slate-800 dark:text-white">{tarifa.tarifa_nombre}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tarifa.puntos_n} puntos · {tarifa.facturas_n} facturas
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">
              {tarifa.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tarifa.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
            </div>
          </div>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Contenido expandido */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-700">
          {/* Resumen de tarifa */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400">Precio medio</div>
              <div className="font-semibold text-slate-800 dark:text-white">
                {tarifa.precio_eur_kwh.toFixed(4)} €/kWh
              </div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400">Mes max coste</div>
              <div className="font-semibold text-slate-800 dark:text-white">
                {tarifa.mes_coste_max_nombre || '—'}
              </div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400">Mes max consumo</div>
              <div className="font-semibold text-slate-800 dark:text-white">
                {tarifa.mes_consumo_max_nombre || '—'}
              </div>
            </div>
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-500 dark:text-slate-400">Potencias</div>
              <div className="font-semibold text-slate-800 dark:text-white">
                {tarifa.potencias.periodos_disponibles}/{tarifa.potencias.periodos_totales} periodos
              </div>
            </div>
          </div>

          {/* Tabla mensual */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Mes</th>
                  <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Consumo (kWh)</th>
                  <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Coste (€)</th>
                  <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Precio (€/kWh)</th>
                </tr>
              </thead>
              <tbody>
                {tarifa.datos_mensuales.map((mes) => (
                  <tr key={mes.mes} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{mes.mes_nombre}</td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {mes.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {mes.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {mes.precio_eur_kwh.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Potencias con cobertura */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Potencias contratadas agregadas (suma de puntos con datos)
              </div>
              {tarifa.potencias.cobertura_pct !== undefined && tarifa.potencias.puntos_con_potencia !== undefined && tarifa.potencias.puntos_totales !== undefined && (
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  Cobertura: {tarifa.potencias.cobertura_pct.toFixed(0)}% ({tarifa.potencias.puntos_con_potencia}/{tarifa.potencias.puntos_totales} puntos)
                </div>
              )}
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded text-xs text-blue-900 dark:text-blue-200 italic">
              Las potencias mostradas corresponden a la suma de las potencias contratadas de los puntos de suministro con informaci\u00f3n disponible para esta tarifa. No representan un valor individual ni una recomendaci\u00f3n de dimensionamiento.
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p) => {
                const value = tarifa.potencias[`${p}_kw` as keyof typeof tarifa.potencias];
                return value !== null ? (
                  <span key={p} className="px-2 py-1 bg-white dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
                    {p.toUpperCase()}: {Number(value).toLocaleString('es-ES')} kW
                  </span>
                ) : null;
              })}
            </div>
            {tarifa.potencias.alerta_resumen && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                {tarifa.potencias.alerta_resumen}
              </div>
            )}
          </div>

          {/* Extremos */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Extremos por punto de suministro
            </div>

            {/* Mensaje si no hay extremos */}
            {/* Mensaje si no hay extremos */}
            {(!tarifa.extremos ||
              (!tarifa.extremos.top_consumo?.length &&
                !tarifa.extremos.bottom_consumo?.length &&
                !tarifa.extremos.top_coste?.length &&
                !tarifa.extremos.bottom_coste?.length)) && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-500 dark:text-slate-400 italic flex items-start gap-2">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {tarifa.extremos?.error_motivo ||
                      "No hay datos de extremos disponibles. Regenera el informe para calcularlos automáticamente."}
                  </span>
                </div>
              )}

            {/* Top 3 Mayor Consumo */}
            {tarifa.extremos && tarifa.extremos.top_consumo && tarifa.extremos.top_consumo.length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                  Top 3 Mayor Consumo
                </div>
                <div className="space-y-1 text-xs">
                  {tarifa.extremos.top_consumo.map((punto, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {punto.valor.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh.toFixed(4)} €/kWh
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom 3 Menor Consumo */}
            {tarifa.extremos && tarifa.extremos.bottom_consumo && tarifa.extremos.bottom_consumo.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  Bottom 3 Menor Consumo
                </div>
                <div className="space-y-1 text-xs">
                  {tarifa.extremos.bottom_consumo.map((punto, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {punto.valor.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh.toFixed(4)} €/kWh
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 3 Mayor Coste */}
            {tarifa.extremos && tarifa.extremos.top_coste && tarifa.extremos.top_coste.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-xs font-semibold text-red-800 dark:text-red-300 mb-2">
                  Top 3 Mayor Coste
                </div>
                <div className="space-y-1 text-xs">
                  {tarifa.extremos.top_coste.map((punto, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {punto.valor.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh.toFixed(4)} €/kWh
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom 3 Menor Coste */}
            {tarifa.extremos && tarifa.extremos.bottom_coste && tarifa.extremos.bottom_coste.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                  Bottom 3 Menor Coste
                </div>
                <div className="space-y-1 text-xs">
                  {tarifa.extremos.bottom_coste.map((punto, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {punto.cups}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {punto.valor.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {punto.precio_medio_eur_kwh.toFixed(4)} €/kWh
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
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Step2Content({ config, onBack, onGenerate, isSubmitting, generateResult, submitError }: Step2ContentProps) {
  // Estado local
  const [expandedTarifas, setExpandedTarifas] = useState<Set<string>>(new Set());
  const [tarifaSearch, setTarifaSearch] = useState('');
  const navigate = useNavigate();

  // Use client name from config (set in Step1Config)
  const clienteNombre = config.cliente_nombre || '';

  // Cargar datos de auditoría
  const { data: auditoriaData, isLoading: loadingAuditoria } = useAuditoriaEnergeticaData(
    config.cliente_id,
    config.fecha_inicio,
    config.fecha_fin,
    !!config.cliente_id
  );

  // Hook del draft
  const {
    draft,
    isLoading: loadingDraft,
    isGenerating,
    isSaving,
    error,
    updateNarrativeSection,
    toggleRecomendaciones,
    updateRecomendacionesText,
    saveDraft,
    regenerateDraft,
    getFinalPayload,
  } = useReportDraft({
    clienteId: config.cliente_id || '',
    clienteNombre,
    puntoIds: config.punto_ids,
    fechaInicio: config.fecha_inicio,
    fechaFin: config.fecha_fin,
    titulo: config.titulo,
    auditoriaData: auditoriaData || null,
    enabled: !!auditoriaData && !!config.cliente_id,
  });

  // Filtrar tarifas por búsqueda
  const tarifasFiltradas = useMemo(() => {
    if (!draft) return [];
    if (!tarifaSearch.trim()) return draft.por_tarifa;
    const search = tarifaSearch.toLowerCase();
    return draft.por_tarifa.filter(t =>
      t.tarifa_nombre.toLowerCase().includes(search)
    );
  }, [draft, tarifaSearch]);

  // Handlers
  const toggleTarifa = useCallback((tarifaNombre: string) => {
    setExpandedTarifas(prev => {
      const next = new Set(prev);
      if (next.has(tarifaNombre)) {
        next.delete(tarifaNombre);
      } else {
        next.add(tarifaNombre);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    if (!draft) return;
    onGenerate(draft);
  }, [draft, onGenerate]);

  // Redirect on success
  useEffect(() => {
    if (generateResult?.success) {
      // Auto-trigger download if URL is available
      if (generateResult.url) {
        const link = document.createElement('a');
        link.href = generateResult.url;
        link.target = '_blank';
        link.download = `informe-${config.cliente_nombre}-${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Force reload to reset wizard
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000); // 2 seconds delay to allow download to start
      return () => clearTimeout(timer);
    }
  }, [generateResult, config.cliente_nombre]);

  // Loading state
  if (loadingAuditoria || loadingDraft) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="animate-spin text-fenix-500" size={32} />
        <span className="text-slate-600 dark:text-slate-400">
          {loadingAuditoria ? 'Cargando datos de facturación...' : 'Generando contenido del informe...'}
        </span>
      </div>
    );
  }

  // Error state
  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertTriangle className="text-red-500" size={32} />
        <span className="text-slate-600 dark:text-slate-400">
          {error?.message || 'No se pudo generar el contenido del informe'}
        </span>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  const kpis = draft.kpis_globales;

  // Asegurar que desviaciones_sugeridas exista (compatibilidad con drafts antiguos)
  if (!kpis.desviaciones_sugeridas) {
    kpis.desviaciones_sugeridas = [];
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Contenido del Informe
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Revisa y edita el contenido antes de generar el PDF
          </p>
        </div>
      </div>

      {/* KPIs Globales - Prioridad a TARIFAS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Consumo Total"
          value={`${kpis.consumo_total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh`}
          icon={<Zap size={14} />}
          color="fenix"
        />
        <KPICard
          label="Coste Total"
          value={`${kpis.coste_total_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
          icon={<Euro size={14} />}
          color="emerald"
        />
        <KPICard
          label="Precio Medio"
          value={`${kpis.precio_medio_eur_kwh.toFixed(4)} €/kWh`}
          icon={<TrendingUp size={14} />}
        />
        <KPICard
          label="Tarifas Analizadas"
          value={`${kpis.tarifas_n}`}
          subvalue={`con facturación`}
          icon={<BarChart3 size={14} />}
          color="fenix"
        />
        <KPICard
          label="Puntos con Facturación"
          value={`${kpis.puntos_n}`}
          subvalue={`${kpis.facturas_n} facturas`}
          icon={<Target size={14} />}
        />
      </div>

      {/* Sección: Portada y Alcance */}
      <CollapsibleSection
        title="Portada y Alcance"
        icon={<BookOpen size={20} />}
        accentColor="blue"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.portada}
            label="Título de Portada"
            onChange={(texto) => updateNarrativeSection('portada', texto)}
            rows={2}
          />
          <NarrativeEditor
            section={draft.narrativa.portada_sublinea}
            label="Sublínea de Portada"
            onChange={(texto) => updateNarrativeSection('portada_sublinea', texto)}
            rows={2}
          />
          <NarrativeEditor
            section={draft.narrativa.alcance}
            label="Alcance del Estudio"
            onChange={(texto) => updateNarrativeSection('alcance', texto)}
            rows={4}
          />
          <NarrativeEditor
            section={draft.narrativa.metodologia}
            label="Metodología"
            onChange={(texto) => updateNarrativeSection('metodologia', texto)}
            rows={6}
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Resumen Ejecutivo */}
      <CollapsibleSection
        title="Resumen Ejecutivo"
        icon={<FileText size={20} />}
        accentColor="emerald"
      >
        <div className="space-y-4 mt-2">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Este texto resume los principales hallazgos del periodo analizado. Se genera automáticamente pero puedes editarlo.
              </p>
            </div>
          </div>
          <NarrativeEditor
            section={draft.narrativa.resumen_ejecutivo}
            label="Texto del Resumen Ejecutivo"
            onChange={(texto) => updateNarrativeSection('resumen_ejecutivo', texto)}
            rows={8}
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Análisis por Tarifas */}
      <CollapsibleSection
        title="Análisis por Tarifas"
        icon={<BarChart3 size={20} />}
        accentColor="fenix"
        badge={
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-fenix-100 dark:bg-fenix-900/30 text-fenix-700 dark:text-fenix-300">
            {draft.por_tarifa.length} tarifas
          </span>
        }
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.analisis_tarifas}
            label="Texto de Análisis de Tarifas"
            onChange={(texto) => updateNarrativeSection('analisis_tarifas', texto)}
            rows={4}
          />

          {/* Buscador de tarifas (solo si hay muchas) */}
          {draft.por_tarifa.length > 5 && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tarifaSearch}
                onChange={(e) => setTarifaSearch(e.target.value)}
                placeholder="Buscar tarifa..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Lista de tarifas */}
          <div className="space-y-3">
            {tarifasFiltradas.map((tarifa) => (
              <TarifaCard
                key={tarifa.tarifa_nombre}
                tarifa={tarifa}
                isExpanded={expandedTarifas.has(tarifa.tarifa_nombre)}
                onToggle={() => toggleTarifa(tarifa.tarifa_nombre)}
              />
            ))}
          </div>

          {tarifasFiltradas.length === 0 && tarifaSearch && (
            <p className="text-center py-4 text-slate-500 dark:text-slate-400">
              No se encontraron tarifas con "{tarifaSearch}"
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Sección: Evolución Mensual */}
      <CollapsibleSection
        title="Evolución Mensual"
        icon={<TrendingUp size={20} />}
        accentColor="purple"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.evolucion_mensual}
            label="Análisis de Evolución Mensual"
            onChange={(texto) => updateNarrativeSection('evolucion_mensual', texto)}
            rows={4}
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Análisis de Potencias */}
      <CollapsibleSection
        title="Análisis de Potencias"
        icon={<Zap size={20} />}
        accentColor="amber"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.potencias}
            label="Análisis de Potencias por Tarifa"
            onChange={(texto) => updateNarrativeSection('potencias', texto)}
            rows={4}
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Extremos por Tarifa */}
      <CollapsibleSection
        title="Extremos por Tarifa"
        icon={<Target size={20} />}
        accentColor="slate"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.extremos}
            label="Análisis de Extremos"
            onChange={(texto) => updateNarrativeSection('extremos', texto)}
            rows={4}
            helperText="Los extremos muestran los puntos con mayor y menor consumo/coste por tarifa. Los CUPS se muestran parcialmente enmascarados."
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Limitaciones y Desviaciones */}
      <CollapsibleSection
        title="Limitaciones y Desviaciones"
        icon={<FileWarning size={20} />}
        accentColor="amber"
        defaultOpen={true}
        badge={
          kpis.desviaciones_sugeridas && kpis.desviaciones_sugeridas.length > 0 ? (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              {kpis.desviaciones_sugeridas.length} autogeneradas
            </span>
          ) : undefined
        }
      >
        <div className="space-y-4 mt-2">
          {/* Desviaciones autogeneradas */}
          {kpis.desviaciones_sugeridas && kpis.desviaciones_sugeridas.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} />
                Desviaciones detectadas automáticamente
              </div>
              <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                {kpis.desviaciones_sugeridas.map((desv, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-amber-600 dark:text-amber-400">•</span>
                    <span>{desv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <NarrativeEditor
            section={draft.narrativa.limitaciones}
            label="Limitaciones del Análisis"
            onChange={(texto) => updateNarrativeSection('limitaciones', texto)}
            rows={4}
          />
          <NarrativeEditor
            section={draft.narrativa.desviaciones}
            label="Texto de Desviaciones (Editable)"
            onChange={(texto) => updateNarrativeSection('desviaciones', texto)}
            rows={6}
            helperText="El texto generado incluye las desviaciones automáticas. Puedes editarlo libremente para añadir o modificar observaciones."
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Conclusión */}
      <CollapsibleSection
        title="Conclusión Final"
        icon={<CheckCircle2 size={20} />}
        accentColor="emerald"
      >
        <div className="space-y-4 mt-2">
          <NarrativeEditor
            section={draft.narrativa.conclusion}
            label="Conclusión del Informe"
            onChange={(texto) => updateNarrativeSection('conclusion', texto)}
            rows={6}
          />
        </div>
      </CollapsibleSection>

      {/* Sección: Recomendaciones (Toggle) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-blue-500" />
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">Recomendaciones</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sección opcional. Si está desactivada, no se incluirá en el PDF.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleRecomendaciones(!draft.recomendaciones_enabled)}
            className="flex items-center gap-2"
          >
            {draft.recomendaciones_enabled ? (
              <ToggleRight size={32} className="text-blue-500" />
            ) : (
              <ToggleLeft size={32} className="text-slate-400" />
            )}
          </button>
        </div>

        {draft.recomendaciones_enabled && (
          <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Texto de Recomendaciones
              </label>
              <textarea
                value={draft.recomendaciones_text}
                onChange={(e) => updateRecomendacionesText(e.target.value)}
                rows={6}
                placeholder="Escribe aquí las recomendaciones para el cliente..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent resize-y"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Este texto libre se incluirá como sección de recomendaciones en el informe final.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Resultado de generación */}
      {generateResult?.success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={24} />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                ¡Informe generado correctamente!
              </p>
              {generateResult.url && (
                <a
                  href={generateResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-1"
                >
                  <FileText size={14} />
                  Descargar documento
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error de generación */}
      {submitError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={24} />
            <p className="text-red-700 dark:text-red-300">Error: Vuelve a intentarlo más tarde</p>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                     text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} />
          Atrás
        </button>
        <button
          onClick={handleGenerate}
          disabled={isSaving || isSubmitting || generateResult?.success}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-fenix-500 text-white 
                     hover:bg-fenix-600 transition-colors disabled:opacity-50 shadow-lg shadow-fenix-500/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando...
            </>
          ) : generateResult?.success ? (
            <>
              <CheckCircle2 size={18} />
              Completado
            </>
          ) : (
            <>
              <FileText size={18} />
              Generar Informe
            </>
          )}
        </button>
      </div>
    </div>
  );
}
