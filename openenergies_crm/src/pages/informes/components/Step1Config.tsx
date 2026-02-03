// openenergies_crm/src/pages/informes/components/Step1Config.tsx
// Paso 1: Configuración del Alcance del Informe

import React from 'react';
import {
  Calendar,
  Users,
  MapPin,
  Zap,
  Flame,
  FileText,
  ChevronRight
} from 'lucide-react';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { useClientesForSelect, usePuntosForSelect } from '@hooks/useInformesMercado';
import type {
  InformeConfig,
  TipoInformeMercado,
  TipoEnergiaInforme,
  RangoPreset,
  RangoFechas
} from '@lib/informesTypes';
import { getRangoFromPreset, getTipoInformeLabel, getTipoEnergiaLabel } from '@lib/informesTypes';

interface Step1ConfigProps {
  config: InformeConfig;
  onChange: (config: InformeConfig) => void;
  onNext: () => void;
}

const TIPO_INFORME_OPTIONS: { value: TipoInformeMercado; label: string; description: string }[] = [
  { value: 'auditoria', label: 'Auditoría Energética', description: 'Análisis completo de consumos y costes' },
  { value: 'mercado', label: 'Situación de Mercado', description: 'Estado actual del mercado eléctrico' },
  { value: 'seguimiento', label: 'Seguimiento Periódico', description: 'Evolución mensual de indicadores' },
];

const TIPO_ENERGIA_OPTIONS: { value: TipoEnergiaInforme; icon: React.ReactNode; label: string }[] = [
  { value: 'electricidad', icon: <Zap size={18} />, label: 'Electricidad' },
  { value: 'gas', icon: <Flame size={18} />, label: 'Gas Natural' },
  { value: 'ambos', icon: <><Zap size={14} /><Flame size={14} /></>, label: 'Ambos' },
];

const RANGO_PRESETS: { value: RangoPreset; label: string }[] = [
  { value: 'ultimo_mes', label: 'Último mes' },
  { value: 'ultimo_trimestre', label: 'Último trimestre' },
  { value: 'ultimo_semestre', label: 'Último semestre' },
  { value: 'ultimo_año', label: 'Último año' },
  { value: 'personalizado', label: 'Personalizado' },
];

export default function Step1Config({ config, onChange, onNext }: Step1ConfigProps) {
  const [clienteSearch, setClienteSearch] = React.useState('');
  const [puntoSearch, setPuntoSearch] = React.useState('');

  const { data: clientesOptions = [], isLoading: loadingClientes } = useClientesForSelect(clienteSearch);
  const { data: puntosOptions = [], isLoading: loadingPuntos } = usePuntosForSelect(config.cliente_ids, puntoSearch);

  // Handlers
  const handleTipoInformeChange = (tipo: TipoInformeMercado) => {
    onChange({ ...config, tipo_informe: tipo });
  };

  const handleTipoEnergiaChange = (tipo: TipoEnergiaInforme) => {
    onChange({ ...config, tipo_energia: tipo });
  };

  const handleRangoPresetChange = (preset: RangoPreset) => {
    const newRango = preset === 'personalizado' ? config.rango_fechas : getRangoFromPreset(preset);
    onChange({
      ...config,
      rango_preset: preset,
      rango_fechas: newRango,
    });
  };

  const handleRangoChange = (field: keyof RangoFechas, value: string) => {
    onChange({
      ...config,
      rango_preset: 'personalizado',
      rango_fechas: { ...config.rango_fechas, [field]: value },
    });
  };

  const handleClientesChange = (values: string[] | null) => {
    const newClienteIds = values || [];
    // Reset puntos if clientes change
    onChange({
      ...config,
      cliente_ids: newClienteIds,
      punto_ids: newClienteIds.length === 0 ? [] : config.punto_ids,
    });
  };

  const handlePuntosChange = (values: string[] | null) => {
    onChange({ ...config, punto_ids: values || [] });
  };

  // Validation
  const canProceed = config.titulo.trim() !== '' && (config.cliente_ids.length > 0 || config.punto_ids.length > 0);

  return (
    <div className="space-y-8">
      {/* Título del Informe */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          <FileText size={18} className="text-fenix-500" />
          Título del Informe
        </label>
        <input
          type="text"
          value={config.titulo}
          onChange={(e) => onChange({ ...config, titulo: e.target.value })}
          placeholder="Ej: Informe de Mercado Q1 2026 - Grupo Industrial"
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 
                     bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                     focus:ring-2 focus:ring-fenix-500 focus:border-transparent
                     placeholder:text-slate-400"
        />
      </div>

      {/* Tipo de Informe */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <FileText size={18} className="text-fenix-500" />
          Tipo de Informe
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIPO_INFORME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTipoInformeChange(option.value)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${config.tipo_informe === option.value
                  ? 'border-fenix-500 bg-fenix-50 dark:bg-fenix-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }
              `}
            >
              <p className={`font-medium ${config.tipo_informe === option.value ? 'text-fenix-600 dark:text-fenix-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {option.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de Energía */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <Zap size={18} className="text-fenix-500" />
          Tipo de Energía
        </h3>
        <div className="flex flex-wrap gap-3">
          {TIPO_ENERGIA_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTipoEnergiaChange(option.value)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full border-2 transition-all
                ${config.tipo_energia === option.value
                  ? 'border-fenix-500 bg-fenix-500 text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }
              `}
            >
              {option.icon}
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rango de Fechas */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <Calendar size={18} className="text-fenix-500" />
          Rango de Fechas
        </h3>
        
        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {RANGO_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleRangoPresetChange(preset.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${config.rango_preset === preset.value
                  ? 'bg-fenix-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Date inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Desde</label>
            <input
              type="date"
              value={config.rango_fechas.start}
              onChange={(e) => handleRangoChange('start', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 
                         bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                         focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Hasta</label>
            <input
              type="date"
              value={config.rango_fechas.end}
              onChange={(e) => handleRangoChange('end', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 
                         bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                         focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Selección de Clientes */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <Users size={18} className="text-fenix-500" />
          Clientes
        </h3>
        <MultiSearchableSelect
          options={clientesOptions}
          selectedValues={config.cliente_ids.length > 0 ? config.cliente_ids : null}
          onChange={handleClientesChange}
          onSearch={setClienteSearch}
          placeholder="Buscar clientes..."
          allLabel="Todos los clientes"
          isLoading={loadingClientes}
          showChips
        />
        {config.cliente_ids.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {config.cliente_ids.length} cliente{config.cliente_ids.length !== 1 ? 's' : ''} seleccionado{config.cliente_ids.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Selección de Puntos de Suministro */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <MapPin size={18} className="text-fenix-500" />
          Puntos de Suministro
        </h3>
        <MultiSearchableSelect
          options={puntosOptions}
          selectedValues={config.punto_ids.length > 0 ? config.punto_ids : null}
          onChange={handlePuntosChange}
          onSearch={setPuntoSearch}
          placeholder="Buscar por CUPS o dirección..."
          allLabel="Todos los puntos"
          isLoading={loadingPuntos}
          showChips
        />
        {config.punto_ids.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {config.punto_ids.length} punto{config.punto_ids.length !== 1 ? 's' : ''} seleccionado{config.punto_ids.length !== 1 ? 's' : ''}
          </p>
        )}
        {config.cliente_ids.length > 0 && puntosOptions.length === 0 && !loadingPuntos && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Los clientes seleccionados no tienen puntos de suministro registrados.
          </p>
        )}
      </div>

      {/* Botón Siguiente */}
      <div className="flex justify-end pt-4">
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
          Siguiente: Contenido
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Validation message */}
      {!canProceed && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Completa el título y selecciona al menos un cliente o punto de suministro para continuar.
        </p>
      )}
    </div>
  );
}
