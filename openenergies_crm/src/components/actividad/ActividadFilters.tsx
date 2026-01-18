// src/components/actividad/ActividadFilters.tsx
// Componente de filtros avanzados para el log de actividad

import { useMemo } from 'react';
import { Users, MapPin, FileText, UserCircle, X } from 'lucide-react';
import type { ActividadFilters as FiltersType, TipoEventoLog, EntidadTipoLog } from '@lib/actividadTypes';
import { TIPO_EVENTO_LABELS, ENTIDAD_TIPO_LABELS } from '@lib/actividadTypes';
import {
    useUsuariosParaFiltro,
    useClientesParaFiltro,
    usePuntosParaFiltro,
    useContratosParaFiltro,
} from '@hooks/useActividadLog';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { useTheme } from '@hooks/ThemeContext';

interface ActividadFiltersProps {
    filters: FiltersType;
    onChange: (filters: FiltersType) => void;
    showClienteFilter?: boolean;
    clienteId?: string | null; // ID del cliente si estamos en ficha de cliente
}

const TIPOS_EVENTO: TipoEventoLog[] = ['creacion', 'edicion', 'eliminacion', 'nota_manual'];
const TIPOS_ENTIDAD: EntidadTipoLog[] = ['cliente', 'punto', 'contrato', 'documento', 'factura'];

export default function ActividadFilters({
    filters,
    onChange,
    showClienteFilter = false,
    clienteId = null,
}: ActividadFiltersProps) {
    const { theme } = useTheme();

    // Data queries - cuando estamos en ficha de cliente, filtrar puntos/contratos de ese cliente
    const effectiveClienteIds = clienteId ? [clienteId] : filters.cliente_ids;

    const { data: usuarios = [], isLoading: loadingUsuarios } = useUsuariosParaFiltro();
    const { data: clientes = [], isLoading: loadingClientes } = useClientesParaFiltro();
    const { data: puntos = [], isLoading: loadingPuntos } = usePuntosParaFiltro(effectiveClienteIds);
    const { data: contratos = [], isLoading: loadingContratos } = useContratosParaFiltro(filters.punto_ids, effectiveClienteIds);

    // Convert to MultiSearchableSelect format
    const clienteOptions = useMemo(() => clientes.map(c => ({
        value: c.value,
        label: c.label,
    })), [clientes]);

    const puntoOptions = useMemo(() => puntos.map(p => ({
        value: p.value,
        label: p.label,
        subtitle: p.subtitle,
    })), [puntos]);

    const contratoOptions = useMemo(() => contratos.map(c => ({
        value: c.value,
        label: c.label,
        subtitle: c.subtitle,
    })), [contratos]);

    const usuarioOptions = useMemo(() => usuarios.map(u => ({
        value: u.value,
        label: u.label,
    })), [usuarios]);

    // Count active filters
    const activeFiltersCount = [
        filters.cliente_ids?.length,
        filters.punto_ids?.length,
        filters.contrato_ids?.length,
        filters.tipo_evento?.length,
        filters.entidad_tipo?.length,
        filters.user_id,
    ].filter(Boolean).length;

    // Toggle handlers
    const toggleTipoEvento = (tipo: TipoEventoLog) => {
        const current = filters.tipo_evento || [];
        const updated = current.includes(tipo)
            ? current.filter((t) => t !== tipo)
            : [...current, tipo];
        onChange({ ...filters, tipo_evento: updated.length > 0 ? updated : undefined });
    };

    const toggleEntidadTipo = (tipo: EntidadTipoLog) => {
        const current = filters.entidad_tipo || [];
        const updated = current.includes(tipo)
            ? current.filter((t) => t !== tipo)
            : [...current, tipo];
        onChange({ ...filters, entidad_tipo: updated.length > 0 ? updated : undefined });
    };

    const clearFilters = () => {
        onChange({});
    };

    return (
        <div className={`
      p-4 space-y-4
      ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}
    `}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                    Filtrar actividad
                </h3>
                {activeFiltersCount > 0 && (
                    <button
                        onClick={clearFilters}
                        className={`
              flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer
              ${theme === 'dark'
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-red-600 hover:bg-red-50'}
            `}
                    >
                        <X size={12} />
                        Limpiar
                    </button>
                )}
            </div>

            {/* Tipo de Acción - Chips */}
            <div>
                <label className={`
          text-xs font-bold uppercase tracking-wider mb-2 block
          ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}
        `}>
                    Tipo de Acción
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {TIPOS_EVENTO.map((tipo) => {
                        const isSelected = filters.tipo_evento?.includes(tipo);
                        return (
                            <button
                                key={tipo}
                                onClick={() => toggleTipoEvento(tipo)}
                                className={`
                  px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${isSelected
                                        ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400'
                                        : theme === 'dark'
                                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }
                `}
                            >
                                {TIPO_EVENTO_LABELS[tipo]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tipo de Entidad - Chips */}
            <div>
                <label className={`
          text-xs font-bold uppercase tracking-wider mb-2 block
          ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}
        `}>
                    Entidad
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {TIPOS_ENTIDAD.map((tipo) => {
                        const isSelected = filters.entidad_tipo?.includes(tipo);
                        return (
                            <button
                                key={tipo}
                                onClick={() => toggleEntidadTipo(tipo)}
                                className={`
                  px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${isSelected
                                        ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400'
                                        : theme === 'dark'
                                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }
                `}
                            >
                                {ENTIDAD_TIPO_LABELS[tipo]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filtros jerárquicos */}
            <div className="space-y-3">
                {/* Clientes (solo en vista global) */}
                {showClienteFilter && (
                    <MultiSearchableSelect
                        options={clienteOptions}
                        selectedValues={filters.cliente_ids || null}
                        onChange={(values) => {
                            onChange({
                                ...filters,
                                cliente_ids: values || undefined,
                                punto_ids: undefined,
                                contrato_ids: undefined,
                            });
                        }}
                        placeholder="Buscar cliente..."
                        label="Clientes"
                        icon={<Users size={14} />}
                        isLoading={loadingClientes}
                        allLabel="Todos los clientes"
                        showChips={false}
                    />
                )}

                {/* Puntos (siempre visible - filtra por CUPS o dirección) */}
                <MultiSearchableSelect
                    options={puntoOptions}
                    selectedValues={filters.punto_ids || null}
                    onChange={(values) => {
                        onChange({
                            ...filters,
                            punto_ids: values || undefined,
                            contrato_ids: undefined,
                        });
                    }}
                    placeholder="Buscar por CUPS o dirección..."
                    label="Puntos de Suministro"
                    icon={<MapPin size={14} />}
                    isLoading={loadingPuntos}
                    allLabel="Todos los puntos"
                    showChips={false}
                />

                {/* Contratos (siempre visible - filtra por CUPS asociado) */}
                <MultiSearchableSelect
                    options={contratoOptions}
                    selectedValues={filters.contrato_ids || null}
                    onChange={(values) => {
                        onChange({
                            ...filters,
                            contrato_ids: values || undefined,
                        });
                    }}
                    placeholder="Buscar por CUPS asociado..."
                    label="Contratos"
                    icon={<FileText size={14} />}
                    isLoading={loadingContratos}
                    allLabel="Todos los contratos"
                    showChips={false}
                />

                {/* Usuario */}
                <MultiSearchableSelect
                    options={usuarioOptions}
                    selectedValues={filters.user_id ? [filters.user_id] : null}
                    onChange={(values) => {
                        onChange({
                            ...filters,
                            user_id: values && values.length > 0 ? values[0] : undefined,
                        });
                    }}
                    placeholder="Buscar usuario..."
                    label="Usuario"
                    icon={<UserCircle size={14} />}
                    isLoading={loadingUsuarios}
                    allLabel="Todos los usuarios"
                    showChips={false}
                />
            </div>
        </div>
    );
}
