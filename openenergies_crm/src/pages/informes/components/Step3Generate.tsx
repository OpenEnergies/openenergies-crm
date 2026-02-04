// openenergies_crm/src/pages/informes/components/Step3Generate.tsx
// Paso 3: Revisión y Generación del Informe

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
  Building2
} from 'lucide-react';
import type {
  InformeConfig,
  InformeContent,
  AuditoriaContent,
  GenerateInformeResponse
} from '@lib/informesTypes';
import {
  getTipoInformeLabel,
  GRAFICOS_DISPONIBLES
} from '@lib/informesTypes';

interface Step3GenerateProps {
  config: InformeConfig;
  content: InformeContent;
  auditoriaContent?: AuditoriaContent;
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
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 border-l-4 border-l-${accent}-500`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-${accent}-500`}>{icon}</span>
        <h4 className="font-medium text-slate-700 dark:text-slate-300">{title}</h4>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {children}
      </div>
    </div>
  );
}

export default function Step3Generate({
  config,
  content,
  auditoriaContent,
  onBack,
  onGenerate,
  isGenerating,
  generateResult,
  error
}: Step3GenerateProps) {
  const isAuditoria = config.tipo_informe === 'auditoria' && !!auditoriaContent;
  
  const selectedGraficos = GRAFICOS_DISPONIBLES.filter((g) =>
    content.graficos_seleccionados.includes(g.id)
  );

  const incidenciasActivas = Object.entries(content.incidencias)
    .filter(([_, value]) => value)
    .map(([key]) => {
      const labels: Record<string, string> = {
        excesos_potencia: 'Excesos de potencia',
        energia_reactiva: 'Energía reactiva',
        desviaciones_consumo: 'Desviaciones de consumo',
        penalizaciones: 'Otras penalizaciones',
      };
      return labels[key] || key;
    });

  const totalRecomendaciones =
    content.recomendaciones.sin_inversion.length +
    content.recomendaciones.con_inversion.length;

  // Format date range
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with title */}
      <div className="bg-gradient-to-r from-fenix-500 to-fenix-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{config.titulo || 'Informe de Mercado'}</h2>
            <p className="text-fenix-100 mt-1">
              {getTipoInformeLabel(config.tipo_informe)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alcance */}
        <SummaryCard icon={<Users size={18} />} title="Alcance" accent="blue">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            <span>Cliente seleccionado</span>
          </div>
        </SummaryCard>

        {/* Período */}
        <SummaryCard icon={<Calendar size={18} />} title="Período" accent="emerald">
          <p>
            {formatDate(config.rango_fechas.start)} — {formatDate(config.rango_fechas.end)}
          </p>
        </SummaryCard>

        {/* Contenido - Auditoría o Comparativa */}
        {isAuditoria ? (
          <>
            {/* Tarifas analizadas */}
            <SummaryCard icon={<Zap size={18} />} title="Tarifas Analizadas" accent="fenix">
              <div className="flex flex-wrap gap-1.5">
                {auditoriaContent!.resumen_tarifas.map((t) => (
                  <span
                    key={t.tarifa}
                    className="px-2 py-0.5 bg-fenix-100 dark:bg-fenix-900/30 text-fenix-700 dark:text-fenix-300 rounded text-xs"
                  >
                    {t.tarifa}
                  </span>
                ))}
              </div>
            </SummaryCard>

            {/* Puntos de suministro */}
            <SummaryCard icon={<Building2 size={18} />} title="Suministros" accent="violet">
              <ul className="space-y-1">
                <li>✓ {auditoriaContent!.inventario.length} puntos de suministro</li>
                <li>✓ {auditoriaContent!.analisis_potencias.filter(p => p.recomendacion_potencia !== 'OPTIMA').length} alertas de potencia</li>
                <li>✓ {auditoriaContent!.recomendaciones.length} recomendaciones</li>
              </ul>
            </SummaryCard>
          </>
        ) : (
          <>
            {/* Gráficos */}
            <SummaryCard icon={<BarChart3 size={18} />} title="Gráficos" accent="violet">
              <div className="flex flex-wrap gap-1.5">
                {selectedGraficos.map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-xs"
                  >
                    {g.nombre}
                  </span>
                ))}
              </div>
            </SummaryCard>

            {/* Datos incluidos */}
            <SummaryCard icon={<Zap size={18} />} title="Contenido" accent="amber">
              <ul className="space-y-1">
                {content.resumen_ejecutivo.coste_total && (
                  <li>✓ Resumen ejecutivo</li>
                )}
                {content.analisis_mercado && (
                  <li>✓ Análisis de mercado</li>
                )}
                {incidenciasActivas.length > 0 && (
                  <li>✓ {incidenciasActivas.length} incidencia{incidenciasActivas.length !== 1 ? 's' : ''}</li>
                )}
                {totalRecomendaciones > 0 && (
                  <li>✓ {totalRecomendaciones} recomendación{totalRecomendaciones !== 1 ? 'es' : ''}</li>
                )}
              </ul>
            </SummaryCard>
          </>
        )}
      </div>

      {/* Detailed preview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-4">Vista Previa del Contenido</h3>

        {isAuditoria ? (
          /* Vista previa para Auditoría */
          <div className="space-y-4">
            {/* Resumen de tarifas */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Resumen por Tarifa</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {auditoriaContent!.resumen_tarifas.slice(0, 3).map((t) => (
                  <div key={t.tarifa} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">{t.tarifa}</div>
                    <div className="mt-2 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Consumo:</span>
                        <span className="text-slate-700 dark:text-slate-300">{t.total_consumo.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coste:</span>
                        <span className="text-slate-700 dark:text-slate-300">{t.total_coste.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                      </div>
                    </div>
                  </div>
                ))}
                {auditoriaContent!.resumen_tarifas.length > 3 && (
                  <div className="p-3 flex items-center justify-center text-sm text-slate-500">
                    +{auditoriaContent!.resumen_tarifas.length - 3} tarifas más
                  </div>
                )}
              </div>
            </div>

            {/* Análisis de potencias */}
            {auditoriaContent!.analisis_potencias.filter(p => p.recomendacion_potencia !== 'OPTIMA').length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                  <AlertTriangle size={16} />
                  Alertas de Potencia
                </h4>
                <ul className="text-sm text-amber-600 dark:text-amber-300 space-y-1">
                  {auditoriaContent!.analisis_potencias
                    .filter(p => p.recomendacion_potencia !== 'OPTIMA')
                    .slice(0, 3)
                    .map((p) => (
                      <li key={p.punto_id}>
                        • {p.cups}: {p.recomendacion_potencia === 'SUBIR_POTENCIA' ? 'Subir potencia' : 'Bajar potencia'} ({p.diferencia_pct > 0 ? '+' : ''}{p.diferencia_pct.toFixed(1)}%)
                      </li>
                    ))}
                  {auditoriaContent!.analisis_potencias.filter(p => p.recomendacion_potencia !== 'OPTIMA').length > 3 && (
                    <li className="text-amber-500">+{auditoriaContent!.analisis_potencias.filter(p => p.recomendacion_potencia !== 'OPTIMA').length - 3} alertas más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Recomendaciones */}
            {auditoriaContent!.recomendaciones.length > 0 && (
              <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-400 mb-2">
                  <Lightbulb size={16} />
                  Recomendaciones ({auditoriaContent!.recomendaciones.length})
                </h4>
                <ul className="text-sm text-violet-600 dark:text-violet-300 space-y-1">
                  {auditoriaContent!.recomendaciones.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      • {r.descripcion || 'Sin descripción'}
                      {r.ahorro_estimado && ` (Ahorro: ${r.ahorro_estimado.toLocaleString('es-ES')} €/año)`}
                    </li>
                  ))}
                  {auditoriaContent!.recomendaciones.length > 3 && (
                    <li className="text-violet-500">+{auditoriaContent!.recomendaciones.length - 3} más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Conclusión */}
            {auditoriaContent!.conclusion && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Conclusión</h4>
                <p className="text-sm text-emerald-600 dark:text-emerald-300 line-clamp-2">
                  {auditoriaContent!.conclusion}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Vista previa para Comparativa */
          <div className="space-y-4">
            {/* Resumen */}
            {(content.resumen_ejecutivo.coste_total || content.resumen_ejecutivo.consumo_total) && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Resumen Ejecutivo</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Coste Total:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {content.resumen_ejecutivo.coste_total || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Consumo:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {content.resumen_ejecutivo.consumo_total || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Ahorro Potencial:</span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {content.resumen_ejecutivo.ahorro_potencial || '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Análisis */}
            {content.analisis_mercado && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Análisis de Mercado</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                  {content.analisis_mercado}
                </p>
              </div>
            )}

            {/* Incidencias */}
            {incidenciasActivas.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                  <AlertTriangle size={16} />
                  Incidencias
                </h4>
                <ul className="text-sm text-amber-600 dark:text-amber-300 space-y-1">
                  {incidenciasActivas.map((inc) => (
                    <li key={inc}>• {inc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendaciones */}
            {totalRecomendaciones > 0 && (
              <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                <h4 className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-400 mb-2">
                  <Lightbulb size={16} />
                  Recomendaciones
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {content.recomendaciones.sin_inversion.length > 0 && (
                    <div>
                      <span className="text-slate-500">Sin inversión:</span>
                      <ul className="text-violet-600 dark:text-violet-300">
                        {content.recomendaciones.sin_inversion.slice(0, 3).map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                        {content.recomendaciones.sin_inversion.length > 3 && (
                          <li className="text-slate-400">+{content.recomendaciones.sin_inversion.length - 3} más</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {content.recomendaciones.con_inversion.length > 0 && (
                    <div>
                      <span className="text-slate-500">Con inversión:</span>
                      <ul className="text-violet-600 dark:text-violet-300">
                        {content.recomendaciones.con_inversion.slice(0, 3).map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                        {content.recomendaciones.con_inversion.length > 3 && (
                          <li className="text-slate-400">+{content.recomendaciones.con_inversion.length - 3} más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
