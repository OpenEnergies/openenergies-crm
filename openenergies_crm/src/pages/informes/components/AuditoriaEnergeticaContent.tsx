// openenergies_crm/src/pages/informes/components/AuditoriaEnergeticaContent.tsx
// Paso 2: Contenido específico para Auditoría Energética

import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Zap,
  Building2,
  Lightbulb,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText
} from 'lucide-react';
import { useAuditoriaEnergeticaData } from '@hooks/useInformesMercado';
import type {
  InformeConfig,
  AuditoriaContent,
  AuditoriaEnergeticaData,
  ResumenTarifaEditable,
  InventarioSuministro,
  AnalisisPotencia,
  RecomendacionAuditoria,
  DatoMensualEditable
} from '@lib/informesTypes';
import { DEFAULT_AUDITORIA_CONTENT } from '@lib/informesTypes';

interface AuditoriaEnergeticaContentProps {
  config: InformeConfig;
  content: AuditoriaContent;
  onChange: (content: AuditoriaContent) => void;
  onBack: () => void;
  onNext: () => void;
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

/** Sección colapsable con icono y título */
function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  badge,
  accentColor = 'fenix'
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  accentColor?: 'fenix' | 'emerald' | 'blue' | 'amber' | 'violet' | 'red';
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorMap = {
    fenix: 'border-fenix-500 text-fenix-500',
    emerald: 'border-emerald-500 text-emerald-500',
    blue: 'border-blue-500 text-blue-500',
    amber: 'border-amber-500 text-amber-500',
    violet: 'border-violet-500 text-violet-500',
    red: 'border-red-500 text-red-500',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-l-4 ${colorMap[accentColor]}`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

/** Tarjeta de resumen por tarifa */
function TarifaCard({
  tarifa,
  onUpdate
}: {
  tarifa: ResumenTarifaEditable;
  onUpdate: (updated: ResumenTarifaEditable) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const formatNumber = (num: number, decimals = 2) => 
    num.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const handleMensualChange = (mesIndex: number, field: keyof DatoMensualEditable, value: string | number) => {
    const newDatos = [...tarifa.datos_mensuales];
    const currentDato = newDatos[mesIndex];
    if (currentDato) {
      newDatos[mesIndex] = { ...currentDato, [field]: value } as DatoMensualEditable;
      onUpdate({ ...tarifa, datos_mensuales: newDatos });
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
      {/* Header de la tarifa */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-fenix-500 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white">Tarifa {tarifa.tarifa}</h4>
              <p className="text-xs text-slate-500">{tarifa.datos_mensuales.length} meses de datos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 text-sm font-medium text-fenix-600 dark:text-fenix-400 hover:bg-fenix-50 dark:hover:bg-fenix-900/20 rounded-lg transition-colors"
          >
            {expanded ? 'Colapsar' : 'Ver detalles'}
          </button>
        </div>

        {/* Métricas resumen */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Consumo Total</p>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">
              {formatNumber(tarifa.total_consumo, 0)} <span className="text-xs font-normal">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Coste Total</p>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">
              {formatNumber(tarifa.total_coste)} <span className="text-xs font-normal">€</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Precio Medio</p>
            <p className="text-lg font-semibold text-fenix-600 dark:text-fenix-400">
              {formatNumber(tarifa.precio_medio * 1000, 2)} <span className="text-xs font-normal">€/MWh</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de datos mensuales (expandible) */}
      {expanded && (
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Mes</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Consumo (kWh)</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Coste (€)</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">€/kWh</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Puntos</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {tarifa.datos_mensuales.map((mes, idx) => (
                  <tr key={mes.mes} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{mes.mes_nombre}</td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatNumber(mes.consumo_total, 0)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatNumber(mes.coste_total)}
                    </td>
                    <td className="py-2 px-3 text-right text-fenix-600 dark:text-fenix-400 font-medium">
                      {formatNumber(mes.precio_medio_kwh, 4)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{mes.puntos_activos}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={mes.observaciones || ''}
                        onChange={(e) => handleMensualChange(idx, 'observaciones', e.target.value)}
                        placeholder="Añadir nota..."
                        className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-fenix-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comentario general de la tarifa */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Comentario sobre esta tarifa
            </label>
            <textarea
              value={tarifa.comentario_tarifa || ''}
              onChange={(e) => onUpdate({ ...tarifa, comentario_tarifa: e.target.value })}
              placeholder="Añade un comentario o análisis específico para esta tarifa..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Icono de recomendación de potencia */
function PotenciaIcon({ recomendacion }: { recomendacion: string }) {
  if (recomendacion === 'SUBIR_POTENCIA') {
    return <TrendingUp size={16} className="text-red-500" />;
  }
  if (recomendacion === 'BAJAR_POTENCIA') {
    return <TrendingDown size={16} className="text-emerald-500" />;
  }
  return <Minus size={16} className="text-slate-400" />;
}

/** Badge de prioridad */
function PrioridadBadge({ prioridad }: { prioridad: 'alta' | 'media' | 'baja' }) {
  const colors = {
    alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[prioridad]}`}>
      {prioridad.charAt(0).toUpperCase() + prioridad.slice(1)}
    </span>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AuditoriaEnergeticaContent({
  config,
  content,
  onChange,
  onBack,
  onNext
}: AuditoriaEnergeticaContentProps) {
  // Fetch data from RPC
  const { data: auditoriaData, isLoading, error } = useAuditoriaEnergeticaData(
    config.cliente_id,
    config.rango_fechas,
    !!config.cliente_id
  );

  // Initialize content when data loads
  useEffect(() => {
    if (auditoriaData && content.resumen_tarifas.length === 0) {
      // Convert API data to editable format
      const resumenTarifas: ResumenTarifaEditable[] = auditoriaData.resumen_por_tarifa.map(t => ({
        ...t,
        datos_mensuales: t.datos_mensuales.map(m => ({ ...m })),
      }));

      onChange({
        ...DEFAULT_AUDITORIA_CONTENT,
        resumen_tarifas: resumenTarifas,
        inventario: auditoriaData.inventario_suministros,
        analisis_potencias: auditoriaData.analisis_potencias,
      });
    }
  }, [auditoriaData]);

  // Handlers
  const handleTarifaUpdate = useCallback((index: number, updated: ResumenTarifaEditable) => {
    const newTarifas = [...content.resumen_tarifas];
    newTarifas[index] = updated;
    onChange({ ...content, resumen_tarifas: newTarifas });
  }, [content, onChange]);

  const addRecomendacion = useCallback(() => {
    const newRec: RecomendacionAuditoria = {
      id: crypto.randomUUID(),
      descripcion: '',
      ahorro_estimado: null,
      prioridad: 'media',
      tipo: 'sin_inversion',
    };
    onChange({ ...content, recomendaciones: [...content.recomendaciones, newRec] });
  }, [content, onChange]);

  const updateRecomendacion = useCallback((id: string, updates: Partial<RecomendacionAuditoria>) => {
    const newRecs = content.recomendaciones.map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    onChange({ ...content, recomendaciones: newRecs });
  }, [content, onChange]);

  const deleteRecomendacion = useCallback((id: string) => {
    onChange({ ...content, recomendaciones: content.recomendaciones.filter(r => r.id !== id) });
  }, [content, onChange]);

  // Validation
  const canProceed = content.resumen_tarifas.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="animate-spin text-fenix-500" size={32} />
        <p className="text-slate-600 dark:text-slate-400">Cargando datos de auditoría...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertTriangle className="text-red-500" size={32} />
        <p className="text-red-600 dark:text-red-400">Error al cargar datos: {(error as Error).message}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        >
          Volver a configuración
        </button>
      </div>
    );
  }

  // No data state
  if (!auditoriaData || auditoriaData.resumen_por_tarifa.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <FileSpreadsheet className="text-slate-400" size={48} />
        <div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No se encontraron datos</p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            No hay facturas para el cliente y período seleccionados.
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm font-medium text-fenix-600 hover:bg-fenix-50 dark:hover:bg-fenix-900/20 rounded-lg"
        >
          Cambiar configuración
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <div className="bg-gradient-to-br from-fenix-50 to-fenix-100 dark:from-slate-800 dark:to-slate-750 rounded-xl border-2 border-fenix-200 dark:border-fenix-900/50 p-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
          Resumen General del Período
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tarifas Analizadas</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{content.resumen_tarifas.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Puntos de Suministro</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{content.inventario.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Consumo Total</p>
            <p className="text-2xl font-bold text-fenix-600 dark:text-fenix-400">
              {content.resumen_tarifas.reduce((acc, t) => acc + t.total_consumo, 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal ml-1">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Coste Total</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {content.resumen_tarifas.reduce((acc, t) => acc + t.total_coste, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              <span className="text-sm font-normal ml-1">€</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bloque A: Resumen Ejecutivo por Tarifa */}
      <CollapsibleSection
        title="Resumen Ejecutivo por Tarifa"
        icon={<Zap size={20} className="text-fenix-500" />}
        badge={content.resumen_tarifas.length}
        accentColor="fenix"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Datos de consumo y coste agrupados por tarifa y mes. Puedes añadir observaciones y comentarios.
          </p>
          {content.resumen_tarifas.map((tarifa, idx) => (
            <TarifaCard
              key={tarifa.tarifa}
              tarifa={tarifa}
              onUpdate={(updated) => handleTarifaUpdate(idx, updated)}
            />
          ))}
        </div>
      </CollapsibleSection>

      {/* Bloque B: Inventario de Suministros */}
      <CollapsibleSection
        title="Inventario de Suministros"
        icon={<Building2 size={20} className="text-blue-500" />}
        badge={content.inventario.length}
        accentColor="blue"
        defaultOpen={false}
      >
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lista de todos los puntos de suministro del cliente con sus características.
          </p>
          
          {/* Tabla de inventario */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">CUPS</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Dirección</th>
                  <th className="text-center py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Tarifa</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Comercializadora</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">P1 (kW)</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">P2 (kW)</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">P3 (kW)</th>
                </tr>
              </thead>
              <tbody>
                {content.inventario.map((punto) => (
                  <tr key={punto.punto_id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">{punto.cups}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{punto.direccion}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 text-xs font-medium bg-fenix-100 text-fenix-700 dark:bg-fenix-900/30 dark:text-fenix-400 rounded">
                        {punto.tarifa}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{punto.comercializadora}</td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {punto.potencias_contratadas.p1 || '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {punto.potencias_contratadas.p2 || '-'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {punto.potencias_contratadas.p3 || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Textareas para limitaciones y desviaciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Limitaciones Detectadas
              </label>
              <textarea
                value={content.inventario_limitaciones}
                onChange={(e) => onChange({ ...content, inventario_limitaciones: e.target.value })}
                placeholder="Describe las limitaciones encontradas en el inventario..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Desviaciones Observadas
              </label>
              <textarea
                value={content.inventario_desviaciones}
                onChange={(e) => onChange({ ...content, inventario_desviaciones: e.target.value })}
                placeholder="Describe las desviaciones respecto a contratos o esperado..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Bloque C: Análisis de Potencias */}
      <CollapsibleSection
        title="Análisis de Potencias"
        icon={<Zap size={20} className="text-amber-500" />}
        badge={content.analisis_potencias.filter(p => p.recomendacion_potencia !== 'OPTIMA').length + ' alertas'}
        accentColor="amber"
        defaultOpen={false}
      >
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Comparativa entre potencia contratada y potencia máxima registrada. Se destacan los puntos con oportunidades de optimización.
          </p>

          {/* Tabla de análisis */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 dark:text-slate-400">CUPS</th>
                  <th className="text-center py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Tarifa</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">P. Contratada</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">P. Máx. Registrada</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Diferencia</th>
                  <th className="text-center py-2 px-3 font-medium text-slate-600 dark:text-slate-400">Recomendación</th>
                </tr>
              </thead>
              <tbody>
                {content.analisis_potencias.map((punto) => (
                  <tr 
                    key={punto.punto_id} 
                    className={`border-b border-slate-100 dark:border-slate-700 ${
                      punto.recomendacion_potencia !== 'OPTIMA' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">{punto.cups}</td>
                    <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">{punto.tarifa}</td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {punto.potencia_contratada_total.toLocaleString('es-ES')} kW
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                      {punto.potencia_max_registrada.toLocaleString('es-ES')} kW
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${
                      punto.diferencia_pct > 0 ? 'text-red-600' : punto.diferencia_pct < -10 ? 'text-emerald-600' : 'text-slate-600'
                    }`}>
                      {punto.diferencia_pct > 0 ? '+' : ''}{punto.diferencia_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <PotenciaIcon recomendacion={punto.recomendacion_potencia} />
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {punto.recomendacion_potencia === 'SUBIR_POTENCIA' && 'Subir'}
                          {punto.recomendacion_potencia === 'BAJAR_POTENCIA' && 'Bajar'}
                          {punto.recomendacion_potencia === 'OPTIMA' && 'Óptima'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comentario de potencias */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Comentario sobre análisis de potencias
            </label>
            <textarea
              value={content.potencias_comentario}
              onChange={(e) => onChange({ ...content, potencias_comentario: e.target.value })}
              placeholder="Añade conclusiones o recomendaciones sobre la optimización de potencias..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Bloque D: Recomendaciones */}
      <CollapsibleSection
        title="Recomendaciones"
        icon={<Lightbulb size={20} className="text-violet-500" />}
        badge={content.recomendaciones.length}
        accentColor="violet"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Añade recomendaciones personalizadas para el cliente con estimación de ahorro y prioridad.
          </p>

          {/* Lista de recomendaciones */}
          <div className="space-y-3">
            {content.recomendaciones.map((rec) => (
              <div 
                key={rec.id}
                className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-3">
                    <textarea
                      value={rec.descripcion}
                      onChange={(e) => updateRecomendacion(rec.id, { descripcion: e.target.value })}
                      placeholder="Descripción de la recomendación..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Ahorro estimado:</label>
                        <input
                          type="number"
                          value={rec.ahorro_estimado || ''}
                          onChange={(e) => updateRecomendacion(rec.id, { ahorro_estimado: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="€/año"
                          className="w-24 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                        <span className="text-xs text-slate-500">€/año</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Prioridad:</label>
                        <select
                          value={rec.prioridad}
                          onChange={(e) => updateRecomendacion(rec.id, { prioridad: e.target.value as 'alta' | 'media' | 'baja' })}
                          className="px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                        >
                          <option value="alta">Alta</option>
                          <option value="media">Media</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Tipo:</label>
                        <select
                          value={rec.tipo}
                          onChange={(e) => updateRecomendacion(rec.id, { tipo: e.target.value as 'sin_inversion' | 'con_inversion' })}
                          className="px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                        >
                          <option value="sin_inversion">Sin inversión</option>
                          <option value="con_inversion">Con inversión</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRecomendacion(rec.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Botón añadir recomendación */}
          <button
            type="button"
            onClick={addRecomendacion}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Añadir recomendación
          </button>
        </div>
      </CollapsibleSection>

      {/* Resumen General y Conclusión */}
      <CollapsibleSection
        title="Resumen General y Conclusión"
        icon={<FileText size={20} className="text-emerald-500" />}
        accentColor="emerald"
        defaultOpen={true}
      >
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Resumen General del Análisis
            </label>
            <textarea
              value={content.resumen_general}
              onChange={(e) => onChange({ ...content, resumen_general: e.target.value })}
              placeholder="Describe los hallazgos principales del análisis energético..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Conclusión
            </label>
            <textarea
              value={content.conclusion}
              onChange={(e) => onChange({ ...content, conclusion: e.target.value })}
              placeholder="Conclusión final y próximos pasos recomendados..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fenix-500 resize-none"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium
                     bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300
                     hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
            ${canProceed
              ? 'bg-fenix-500 text-white hover:bg-fenix-600 shadow-lg shadow-fenix-500/25'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          Siguiente: Generar
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
