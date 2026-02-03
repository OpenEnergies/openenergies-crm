// openenergies_crm/src/pages/informes/components/Step2Content.tsx
// Paso 2: Edición y Previsualización de Datos

import React, { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Euro,
  Loader2,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useDatosCalculados } from '@hooks/useInformesMercado';
import type {
  InformeConfig,
  InformeContent,
  GraficoDisponible,
  DatosCalculados,
  ConclusionTipo
} from '@lib/informesTypes';
import { GRAFICOS_DISPONIBLES } from '@lib/informesTypes';

interface Step2ContentProps {
  config: InformeConfig;
  content: InformeContent;
  onChange: (content: InformeContent) => void;
  onBack: () => void;
  onNext: () => void;
}

// Collapsible section component
function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  accentColor = 'fenix'
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between p-4 
          hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors
          border-l-4 border-${accentColor}-500
        `}
      >
        <div className="flex items-center gap-3">
          <span className={`text-${accentColor}-500`}>{icon}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{title}</span>
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

// Dynamic list input component
function DynamicListInput({
  items,
  onChange,
  placeholder,
  maxItems = 10
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  maxItems?: number;
}) {
  const [newItem, setNewItem] = React.useState('');

  const addItem = () => {
    if (newItem.trim() && items.length < maxItems) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
          <span className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-slate-700 dark:text-slate-300">
            {item}
          </span>
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {items.length < maxItems && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                       bg-white dark:bg-slate-900 text-sm
                       focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!newItem.trim()}
            className="p-2 rounded-lg bg-fenix-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Step2Content({ config, content, onChange, onBack, onNext }: Step2ContentProps) {
  // Fetch calculated data
  const { data: datosCalculados, isLoading: loadingDatos } = useDatosCalculados(
    config.cliente_ids,
    config.punto_ids,
    config.rango_fechas,
    true
  );

  // Pre-fill data when calculated data is loaded
  useEffect(() => {
    if (datosCalculados && !content.resumen_ejecutivo.coste_total) {
      const facturacion = datosCalculados.facturacion.resumen;
      const mercado = datosCalculados.mercado.resumen_periodo?.[0];

      onChange({
        ...content,
        resumen_ejecutivo: {
          coste_total: facturacion.importe_total
            ? `${facturacion.importe_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
            : '',
          consumo_total: facturacion.consumo_total_kwh
            ? `${facturacion.consumo_total_kwh.toLocaleString('es-ES', { minimumFractionDigits: 0 })} kWh`
            : '',
          ahorro_potencial: '',
        },
        precio_medio_pagado: facturacion.precio_medio_kwh || undefined,
        precio_medio_mercado: mercado?.media_periodo ? mercado.media_periodo / 1000 : undefined, // Convert from €/MWh to €/kWh
        analisis_mercado: mercado
          ? `Durante el período analizado, el precio medio del mercado eléctrico ha sido de ${mercado.media_periodo?.toFixed(2)} €/MWh, con un mínimo de ${mercado.minimo_periodo?.toFixed(2)} €/MWh y un máximo de ${mercado.maximo_periodo?.toFixed(2)} €/MWh. La volatilidad media del período ha sido de ${mercado.volatilidad?.toFixed(2)} €/MWh.`
          : '',
      });
    }
  }, [datosCalculados]);

  // Handlers
  const handleResumenChange = (field: keyof typeof content.resumen_ejecutivo, value: string) => {
    onChange({
      ...content,
      resumen_ejecutivo: { ...content.resumen_ejecutivo, [field]: value },
    });
  };

  const handleIncidenciaChange = (field: keyof typeof content.incidencias, value: boolean) => {
    onChange({
      ...content,
      incidencias: { ...content.incidencias, [field]: value },
    });
  };

  const toggleGrafico = (graficoId: GraficoDisponible) => {
    const isSelected = content.graficos_seleccionados.includes(graficoId);
    onChange({
      ...content,
      graficos_seleccionados: isSelected
        ? content.graficos_seleccionados.filter((g) => g !== graficoId)
        : [...content.graficos_seleccionados, graficoId],
    });
  };

  const handleRecomendacionesChange = (tipo: 'sin_inversion' | 'con_inversion', items: string[]) => {
    onChange({
      ...content,
      recomendaciones: { ...content.recomendaciones, [tipo]: items },
    });
  };

  const handleConclusionChange = (tipo: ConclusionTipo) => {
    onChange({ ...content, conclusion_tipo: tipo });
  };

  // Validation
  const canProceed = content.graficos_seleccionados.length > 0;

  return (
    <div className="space-y-6">
      {/* Loading state for calculated data */}
      {loadingDatos && (
        <div className="flex items-center justify-center gap-3 py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <Loader2 className="animate-spin text-fenix-500" size={24} />
          <span className="text-slate-600 dark:text-slate-400">Cargando datos calculados...</span>
        </div>
      )}

      {/* Resumen Ejecutivo */}
      <CollapsibleSection
        title="Resumen Ejecutivo"
        icon={<FileText size={20} />}
        accentColor="emerald"
      >
        <div className="space-y-4 mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Estos campos se pre-rellenan con datos calculados. Puedes editarlos según tus necesidades.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Coste Total
              </label>
              <input
                type="text"
                value={content.resumen_ejecutivo.coste_total}
                onChange={(e) => handleResumenChange('coste_total', e.target.value)}
                placeholder="Ej: 125.430,50 €"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Consumo Total
              </label>
              <input
                type="text"
                value={content.resumen_ejecutivo.consumo_total}
                onChange={(e) => handleResumenChange('consumo_total', e.target.value)}
                placeholder="Ej: 1.250.000 kWh"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Ahorro Potencial Estimado
              </label>
              <input
                type="text"
                value={content.resumen_ejecutivo.ahorro_potencial}
                onChange={(e) => handleResumenChange('ahorro_potencial', e.target.value)}
                placeholder="Ej: 8.500 €/año"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Precios comparativos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Precio Medio Pagado (€/kWh)
              </label>
              <input
                type="number"
                step="0.0001"
                value={content.precio_medio_pagado || ''}
                onChange={(e) => onChange({ ...content, precio_medio_pagado: parseFloat(e.target.value) || undefined })}
                placeholder="Ej: 0.1250"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Precio Medio Mercado (€/kWh)
              </label>
              <input
                type="number"
                step="0.0001"
                value={content.precio_medio_mercado || ''}
                onChange={(e) => onChange({ ...content, precio_medio_mercado: parseFloat(e.target.value) || undefined })}
                placeholder="Ej: 0.0980"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                           bg-white dark:bg-slate-900 text-sm
                           focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Análisis de Mercado */}
      <CollapsibleSection
        title="Análisis de Mercado"
        icon={<TrendingUp size={20} />}
        accentColor="blue"
      >
        <div className="mt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Describe la situación del mercado durante el período analizado.
          </p>
          <textarea
            value={content.analisis_mercado}
            onChange={(e) => onChange({ ...content, analisis_mercado: e.target.value })}
            placeholder="El precio medio del mercado eléctrico durante el período ha sido..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 
                       bg-white dark:bg-slate-900 text-sm
                       focus:ring-2 focus:ring-fenix-500 focus:border-transparent resize-none"
          />
        </div>
      </CollapsibleSection>

      {/* Incidencias */}
      <CollapsibleSection
        title="Incidencias Detectadas"
        icon={<AlertTriangle size={20} />}
        accentColor="amber"
        defaultOpen={false}
      >
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Selecciona las incidencias que deseas destacar en el informe.
          </p>
          {[
            { key: 'excesos_potencia', label: 'Excesos de potencia contratada' },
            { key: 'energia_reactiva', label: 'Penalizaciones por energía reactiva' },
            { key: 'desviaciones_consumo', label: 'Desviaciones significativas de consumo' },
            { key: 'penalizaciones', label: 'Otras penalizaciones' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                  ${content.incidencias[key as keyof typeof content.incidencias]
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 group-hover:border-amber-400'
                  }
                `}
                onClick={() => handleIncidenciaChange(key as keyof typeof content.incidencias, !content.incidencias[key as keyof typeof content.incidencias])}
              >
                {content.incidencias[key as keyof typeof content.incidencias] && <Check size={14} />}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Recomendaciones */}
      <CollapsibleSection
        title="Recomendaciones"
        icon={<Lightbulb size={20} />}
        accentColor="violet"
        defaultOpen={false}
      >
        <div className="mt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Medidas sin inversión
            </h4>
            <DynamicListInput
              items={content.recomendaciones.sin_inversion}
              onChange={(items) => handleRecomendacionesChange('sin_inversion', items)}
              placeholder="Añadir medida sin inversión..."
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Medidas con inversión
            </h4>
            <DynamicListInput
              items={content.recomendaciones.con_inversion}
              onChange={(items) => handleRecomendacionesChange('con_inversion', items)}
              placeholder="Añadir medida con inversión..."
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Tipo de Conclusión */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <Euro size={18} className="text-fenix-500" />
          Tipo de Conclusión
        </h3>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleConclusionChange('favorable')}
            className={`
              flex-1 p-4 rounded-lg border-2 text-left transition-all
              ${content.conclusion_tipo === 'favorable'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
              }
            `}
          >
            <p className={`font-medium ${content.conclusion_tipo === 'favorable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
              Favorable
            </p>
            <p className="text-xs text-slate-500 mt-1">Destacar ahorros conseguidos</p>
          </button>
          <button
            type="button"
            onClick={() => handleConclusionChange('informativa')}
            className={`
              flex-1 p-4 rounded-lg border-2 text-left transition-all
              ${content.conclusion_tipo === 'informativa'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
              }
            `}
          >
            <p className={`font-medium ${content.conclusion_tipo === 'informativa' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
              Informativa
            </p>
            <p className="text-xs text-slate-500 mt-1">Destacar estabilidad y seguimiento</p>
          </button>
        </div>
      </div>

      {/* Selector de Gráficos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <BarChart3 size={18} className="text-fenix-500" />
          Gráficos a Incluir
          <span className="ml-auto text-xs text-slate-500">
            {content.graficos_seleccionados.length} seleccionados
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GRAFICOS_DISPONIBLES.map((grafico) => {
            const isSelected = content.graficos_seleccionados.includes(grafico.id);
            return (
              <button
                key={grafico.id}
                type="button"
                onClick={() => toggleGrafico(grafico.id)}
                className={`
                  relative p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected
                    ? 'border-fenix-500 bg-fenix-50 dark:bg-fenix-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }
                `}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-fenix-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <p className={`text-sm font-medium ${isSelected ? 'text-fenix-600 dark:text-fenix-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {grafico.nombre}
                </p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{grafico.descripcion}</p>
              </button>
            );
          })}
        </div>
      </div>

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

      {!canProceed && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Selecciona al menos un gráfico para incluir en el informe.
        </p>
      )}
    </div>
  );
}
