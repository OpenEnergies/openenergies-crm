// openenergies_crm/src/pages/informes/components/Step1Config.tsx
// Paso 1: Configuración del Alcance del Informe

import React from 'react';
import {
  Calendar,
  Users,
  FileText,
  ChevronRight,
  Zap
} from 'lucide-react';
import SearchableSelect from '@components/SearchableSelect';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { useClientesForSelect, usePuntosForSelect } from '@hooks/useInformesMercado';
import type {
  InformeConfig,
  TipoInformeMercado,
  RangoPreset,
  RangoFechas
} from '@lib/informesTypes';
import { getRangoFromPreset, getTipoInformeLabel } from '@lib/informesTypes';

interface Step1ConfigProps {
  config: InformeConfig;
  onChange: (config: InformeConfig) => void;
  onNext: () => void;
}

const TIPO_INFORME_OPTIONS: { value: TipoInformeMercado; label: string; description: string }[] = [
  { value: 'auditoria', label: 'Auditoría Energética', description: 'Análisis completo de consumos y costes del cliente' },
  { value: 'comparativa', label: 'Auditoría Comparativa con el Mercado', description: 'Comparación del cliente con el mercado eléctrico' },
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

  const { data: clientesOptions = [], isLoading: loadingClientes } = useClientesForSelect(
    clienteSearch,
    config.fecha_inicio,
    config.fecha_fin
  );

  const { data: puntosOptions = [], isLoading: loadingPuntos } = usePuntosForSelect(
    config.cliente_id ? [config.cliente_id] : [],
    puntoSearch,
    config.fecha_inicio,
    config.fecha_fin,
    'ambos'
  );

  // Handlers
  const handleTipoInformeChange = (tipo: TipoInformeMercado) => {
    onChange({ ...config, tipo_informe: tipo });
  };

  const handleRangoPresetChange = (preset: RangoPreset) => {
    const rango = getRangoFromPreset(preset);
    onChange({
      ...config,
      rango_preset: preset,
      fecha_inicio: rango.start,
      fecha_fin: rango.end,
    });
  };

  const handleRangoChange = (field: 'start' | 'end', value: string) => {
    onChange({
      ...config,
      rango_preset: 'personalizado',
      fecha_inicio: field === 'start' ? value : config.fecha_inicio,
      fecha_fin: field === 'end' ? value : config.fecha_fin,
    });
  };

  const handleClienteChange = (value: string) => {
    // Set cliente_id and cliente_nombre; do NOT auto-advance.
    const selectedOption = clientesOptions.find(opt => opt.value === value);
    onChange({
      ...config,
      cliente_id: value || null,
      cliente_nombre: selectedOption?.label || '',
      punto_ids: [],
    });
  };

  // NOTE: Do NOT auto-advance when cliente is selected. The user must
  // click "Siguiente" to proceed to Paso 2. We still clear punto_ids when
  // cliente changes so the draft generation in Paso 2 will recompute puntos.

  const handlePuntosChange = (values: string[] | null) => {
    onChange({ ...config, punto_ids: values || [] });
  };

  // Validation: se puede continuar si hay título y cliente (los puntos se calculan en Paso 2)
  const canProceed = config.titulo.trim() !== '' && config.cliente_id !== null;

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              value={config.fecha_inicio}
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
              value={config.fecha_fin}
              onChange={(e) => handleRangoChange('end', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 
                         bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                         focus:ring-2 focus:ring-fenix-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Selección de Cliente */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
          <Users size={18} className="text-fenix-500" />
          Cliente
        </h3>
        <SearchableSelect
          options={clientesOptions}
          value={config.cliente_id || ''}
          onChange={handleClienteChange}
          onSearch={setClienteSearch}
          placeholder="Escribe para buscar un cliente..."
          allowEmpty={true}
          emptyLabel="Sin seleccionar"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {!clienteSearch || clienteSearch.trim().length === 0 ? (
            'Escribe el nombre o email del cliente para buscar'
          ) : loadingClientes ? (
            'Buscando clientes...'
          ) : clientesOptions.length === 0 ? (
            'No se encontraron clientes con facturas en el periodo seleccionado'
          ) : config.cliente_id ? (
            'Cliente seleccionado correctamente'
          ) : (
            `${clientesOptions.length} cliente${clientesOptions.length !== 1 ? 's' : ''} encontrado${clientesOptions.length !== 1 ? 's' : ''}`
          )}
        </p>
      </div>

      {/* Puntos no se muestran en este paso: se procesan en Paso 2 tras avanzar */}

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
          Completa el título y selecciona un cliente para continuar.
        </p>
      )}
    </div>
  );
}
