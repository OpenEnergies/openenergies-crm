// openenergies_crm/src/pages/informes/components/Step3Generate.tsx
// Paso 3: Revisión y Generación del Informe - Usa ReportDraft

import React from 'react';
import {
  ChevronLeft,
  FileText,
  Users,
  Calendar,
  Zap,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  FileDown,
  TrendingUp,
  DollarSign,
  Gauge
} from 'lucide-react';
import type {
  InformeConfig,
  GenerateInformeResponse
} from '@lib/informesTypes';
import { getTipoInformeLabel } from '@lib/informesTypes';
import type { ReportDraft } from '@lib/reportDraftTypes';
import { getFinalText } from '@lib/reportDraftTypes';

interface Step3GenerateProps {
  config: InformeConfig;
  draft: ReportDraft | null;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generateResult: GenerateInformeResponse | null;
  error: string | null;
}

// Summary card component
function SummaryCard({
  icon,
  title,
  children,
  accent = 'slate'
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const accentClasses: Record<string, { border: string; text: string }> = {
    slate: { border: 'border-l-slate-500', text: 'text-slate-500' },
    blue: { border: 'border-l-blue-500', text: 'text-blue-500' },
    emerald: { border: 'border-l-emerald-500', text: 'text-emerald-500' },
    fenix: { border: 'border-l-fenix-500', text: 'text-fenix-500' },
    violet: { border: 'border-l-violet-500', text: 'text-violet-500' },
    amber: { border: 'border-l-amber-500', text: 'text-amber-500' },
  };

  const classes = accentClasses[accent] ?? accentClasses.slate!;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 border-l-4 ${classes!.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={classes!.text}>{icon}</span>
        <h4 className="font-medium text-slate-700 dark:text-slate-300">{title}</h4>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {children}
      </div>
    </div>
  );
}

// KPI mini card
function KPIMiniCard({
  icon,
  label,
  value,
  unit
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
      <div className="p-2 bg-fenix-100 dark:bg-fenix-900/30 rounded-lg text-fenix-600 dark:text-fenix-400">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          {typeof value === 'number' ? value.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : value}
          {unit && <span className="text-xs text-slate-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

export default function Step3Generate({
  config,
  draft,
  onBack,
  onGenerate,
  isGenerating,
  generateResult,
  error
}: Step3GenerateProps) {

  // Format date range
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Si no hay draft, mostrar mensaje de error
  if (!draft) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-4">
            <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Sin datos del informe</h4>
              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">
                No se encontró el borrador del informe. Por favor, regrese al Paso 2 para configurar el contenido.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-start pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium
                       bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300
                       hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
          >
            <ChevronLeft size={18} />
            Volver al Paso 2
          </button>
        </div>
      </div>
    );
  }

  const { kpis_globales, por_tarifa, narrativa, recomendaciones_enabled } = draft;
  const tarifasCount = por_tarifa.length;
  const mesesAnalizados = por_tarifa.length > 0 && por_tarifa[0]?.datos_mensuales ? por_tarifa[0].datos_mensuales.length : 0;
  const clienteNombre = kpis_globales.cliente_nombre;

  return (
    <div className="space-y-6">
      {/* Header with title */}
      <div className="bg-gradient-to-r from-fenix-500 to-fenix-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{config.titulo || 'Informe de Mercado'}</h2>
            <p className="text-fenix-100 mt-1">
              {getTipoInformeLabel(config.tipo_informe)} • {clienteNombre}
            </p>
          </div>
          <div className="text-right text-sm text-fenix-100">
            <p>Generado: {new Date().toLocaleDateString('es-ES')}</p>
            <p>{tarifasCount} tarifa{tarifasCount !== 1 ? 's' : ''} analizadas</p>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPIMiniCard
          icon={<Zap size={16} />}
          label="Consumo Total"
          value={kpis_globales.consumo_total_kwh}
          unit="kWh"
        />
        <KPIMiniCard
          icon={<DollarSign size={16} />}
          label="Coste Total"
          value={kpis_globales.coste_total_eur}
          unit="€"
        />
        <KPIMiniCard
          icon={<TrendingUp size={16} />}
          label="Precio Medio"
          value={kpis_globales.precio_medio_eur_kwh.toFixed(4)}
          unit="€/kWh"
        />
        <KPIMiniCard
          icon={<Gauge size={16} />}
          label="Nº Puntos"
          value={kpis_globales.puntos_n}
          unit=""
        />
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cliente */}
        <SummaryCard icon={<Users size={18} />} title="Cliente" accent="blue">
          <div className="space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300">{clienteNombre}</p>
            <p className="text-xs text-slate-500">{tarifasCount} tarifa{tarifasCount !== 1 ? 's' : ''} • {mesesAnalizados} mes{mesesAnalizados !== 1 ? 'es' : ''}</p>
          </div>
        </SummaryCard>

        {/* Período */}
        <SummaryCard icon={<Calendar size={18} />} title="Período" accent="emerald">
          <p>
            {formatDate(config.fecha_inicio)} — {formatDate(config.fecha_fin)}
          </p>
        </SummaryCard>

        {/* Tarifas */}
        <SummaryCard icon={<Zap size={18} />} title="Tarifas Analizadas" accent="fenix">
          <div className="flex flex-wrap gap-1.5">
            {por_tarifa.map((t) => (
              <span
                key={t.tarifa_nombre}
                className="px-2 py-0.5 bg-fenix-100 dark:bg-fenix-900/30 text-fenix-700 dark:text-fenix-300 rounded text-xs"
              >
                {t.tarifa_nombre}
              </span>
            ))}
          </div>
        </SummaryCard>

        {/* Contenido del informe */}
        <SummaryCard icon={<BarChart3 size={18} />} title="Secciones Incluidas" accent="violet">
          <ul className="space-y-1">
            <li>✓ Portada personalizada</li>
            <li>✓ Alcance y metodología</li>
            <li>✓ Resumen ejecutivo</li>
            <li>✓ Análisis por tarifa ({tarifasCount})</li>
            <li>✓ Evolución mensual</li>
            <li>✓ Análisis de potencias</li>
            {narrativa.extremos && <li>✓ Valores extremos</li>}
            {narrativa.desviaciones && <li>✓ Análisis de desviaciones</li>}
            {recomendaciones_enabled && <li>✓ Recomendaciones</li>}
            <li>✓ Conclusión</li>
          </ul>
        </SummaryCard>
      </div>

      {/* Detailed preview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-4">Vista Previa del Contenido</h3>

        <div className="space-y-4">
          {/* Resumen por tarifas */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Resumen por Tarifa</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {por_tarifa.slice(0, 3).map((t) => (
                <div key={t.tarifa_nombre} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{t.tarifa_nombre}</span>
                    <span className="text-xs text-slate-400">{t.puntos_n} punto{t.puntos_n !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consumo:</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {t.consumo_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coste:</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {t.coste_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Precio medio:</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {t.precio_eur_kwh.toFixed(4)} €/kWh
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {por_tarifa.length > 3 && (
                <div className="p-3 flex items-center justify-center text-sm text-slate-500 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                  +{por_tarifa.length - 3} tarifas más
                </div>
              )}
            </div>
          </div>

          {/* Alertas de potencia */}
          {por_tarifa.some(t => {
            const p = t.potencias;
            return p && (p.p1_kw || p.p2_kw || p.p3_kw || p.p4_kw || p.p5_kw || p.p6_kw);
          }) && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                <AlertTriangle size={16} />
                Análisis de Potencias
              </h4>
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Se han analizado las potencias contratadas vs máximas registradas para todas las tarifas.
                El informe incluirá recomendaciones de ajuste donde corresponda.
              </p>
            </div>
          )}

          {/* Recomendaciones */}
          {recomendaciones_enabled && draft.recomendaciones_text && (
            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
              <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-400 mb-2">
                <Lightbulb size={16} />
                Recomendaciones
              </h4>
              <p className="text-sm text-violet-600 dark:text-violet-300 line-clamp-3">
                {draft.recomendaciones_text.substring(0, 200)}...
              </p>
            </div>
          )}

          {/* Conclusión */}
          {narrativa.conclusion && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Conclusión</h4>
              <p className="text-sm text-emerald-600 dark:text-emerald-300 line-clamp-3">
                {getFinalText(narrativa.conclusion).substring(0, 200)}...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generation Result */}
      {generateResult && (
        <div className={`
          rounded-xl p-6 border-2
          ${generateResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }
        `}>
          <div className="flex items-start gap-4">
            {generateResult.success ? (
              <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={24} />
            ) : (
              <XCircle className="text-red-500 flex-shrink-0" size={24} />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${generateResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {generateResult.success ? '¡Informe generado correctamente!' : 'Error al generar el informe'}
              </h4>
              {generateResult.success && generateResult.download_url && (
                <a
                  href={generateResult.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Download size={18} />
                  Descargar PDF
                </a>
              )}
              {generateResult.success && generateResult.message && (
                <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-2">
                  {generateResult.message}
                </p>
              )}
              {!generateResult.success && generateResult.error && (
                <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                  {generateResult.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !generateResult && (
        <div className="rounded-xl p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-4">
            <XCircle className="text-red-500 flex-shrink-0" size={24} />
            <div>
              <h4 className="font-medium text-red-700 dark:text-red-400">Error</h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium
                     bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300
                     hover:bg-slate-200 dark:hover:bg-slate-600 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || (generateResult?.success === true)}
          className={`
            flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all
            ${isGenerating
              ? 'bg-fenix-400 text-white cursor-wait'
              : generateResult?.success
                ? 'bg-emerald-500 text-white cursor-default'
                : 'bg-fenix-500 text-white hover:bg-fenix-600 shadow-lg shadow-fenix-500/25'
            }
            disabled:opacity-75
          `}
        >
          {isGenerating ? (
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
              <FileDown size={18} />
              Generar Informe Oficial
            </>
          )}
        </button>
      </div>
    </div>
  );
}
