// src/components/actividad/ActividadDetailModal.tsx
// Modal de pantalla completa para ver detalles de un evento de actividad

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, MapPin, FileText, ArrowRight, Calendar, Clock, Building2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { ActividadLogEntry, DetallesJson, MetadatosEntidad } from '@lib/actividadTypes';
import {
    TIPO_EVENTO_LABELS,
    ENTIDAD_TIPO_LABELS,
    ENTIDAD_TIPO_COLORS,
    TIPO_EVENTO_COLORS,
    CAMPOS_OCULTOS_DIFF,
    CAMPO_LABELS,
    CAMPOS_FK_A_RESOLVER,
} from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';

interface ActividadDetailModalProps {
    entry: ActividadLogEntry;
    onClose: () => void;
}

/**
 * Formatea un valor para mostrar de forma legible
 */
function formatValue(
    value: unknown,
    campo: string,
    metadatos?: MetadatosEntidad | null
): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';

    // Resolver FKs usando metadatos
    if (campo in CAMPOS_FK_A_RESOLVER && metadatos) {
        if ((campo === 'comercializadora_id' || campo === 'current_comercializadora_id') && metadatos.comercializadora_nombre) {
            return metadatos.comercializadora_nombre;
        }
        if (campo === 'cliente_id' && metadatos.cliente_nombre) {
            return metadatos.cliente_nombre;
        }
        if (campo === 'punto_id' && metadatos.cups) {
            return metadatos.cups;
        }
    }

    // Truncar UUIDs
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) {
        return `...${value.slice(-8)}`;
    }

    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

/**
 * Formatea fecha completa
 */
function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/**
 * Detecta cambios entre old y new
 */
interface FieldChange {
    field: string;
    label: string;
    oldValue: unknown;
    newValue: unknown;
    type: 'added' | 'removed' | 'modified';
}

function detectChanges(detalles: DetallesJson | null): FieldChange[] {
    if (!detalles) return [];

    const oldObj = detalles.old as Record<string, unknown> | undefined;
    const newObj = detalles.new as Record<string, unknown> | undefined;

    const changes: FieldChange[] = [];
    const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {}),
    ]);

    for (const field of allKeys) {
        if (CAMPOS_OCULTOS_DIFF.includes(field)) continue;

        const oldValue = oldObj?.[field];
        const newValue = newObj?.[field];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            let type: FieldChange['type'] = 'modified';
            if (oldValue === undefined || oldValue === null) {
                type = 'added';
            } else if (newValue === undefined || newValue === null) {
                type = 'removed';
            }

            changes.push({
                field,
                label: CAMPO_LABELS[field] || field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                oldValue,
                newValue,
                type,
            });
        }
    }

    return changes;
}

export default function ActividadDetailModal({ entry, onClose }: ActividadDetailModalProps) {
    const { theme } = useTheme();
    const changes = detectChanges(entry.detalles_json);
    const userName = entry.metadata_usuario
        ? `${entry.metadata_usuario.nombre || ''} ${entry.metadata_usuario.apellidos || ''}`.trim()
        : 'Usuario';
    const meta = entry.metadatos_entidad;

    // Lock body scroll
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className={`
          w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col
          rounded-2xl shadow-2xl
          ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}
        `}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`
          flex items-center justify-between p-6
          border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}
        `}>
                    <div className="flex items-center gap-4">
                        <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${ENTIDAD_TIPO_COLORS[entry.entidad_tipo]}
            `}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`
                  px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider
                  ${ENTIDAD_TIPO_COLORS[entry.entidad_tipo]}
                `}>
                                    {ENTIDAD_TIPO_LABELS[entry.entidad_tipo]}
                                </span>
                                <span className={`text-sm font-medium ${TIPO_EVENTO_COLORS[entry.tipo_evento]}`}>
                                    {TIPO_EVENTO_LABELS[entry.tipo_evento]}
                                </span>
                            </div>
                            {/* Mostrar contexto humano en lugar de ID */}
                            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                {meta?.cups ? `CUPS: ${meta.cups}` : meta?.cliente_nombre || 'Sin contexto'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`
              p-2 rounded-xl transition-colors cursor-pointer
              ${theme === 'dark'
                                ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}
            `}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Contexto jerárquico (datos humanos, sin UUIDs) */}
                    <div className={`
            p-4 rounded-xl space-y-4
            ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}
          `}>
                        <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            Contexto
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cliente */}
                            {meta?.cliente_nombre && (
                                <div className="flex items-start gap-3">
                                    <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    ${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'}
                  `}>
                                        <User size={18} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Cliente
                                        </p>
                                        <p className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {entry.cliente_id ? (
                                                <Link
                                                    to="/app/clientes/$id"
                                                    params={{ id: entry.cliente_id }}
                                                    className="text-fenix-600 dark:text-fenix-400 hover:underline"
                                                >
                                                    {meta.cliente_nombre}
                                                </Link>
                                            ) : meta.cliente_nombre}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* CUPS */}
                            {meta?.cups && (
                                <div className="flex items-start gap-3">
                                    <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'}
                  `}>
                                        <MapPin size={18} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            CUPS
                                        </p>
                                        <p className={`font-mono font-semibold text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {meta.cups}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Dirección */}
                            {meta?.direccion && (
                                <div className="flex items-start gap-3">
                                    <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'}
                  `}>
                                        <MapPin size={18} className="text-purple-500" />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Dirección
                                        </p>
                                        <p className={`font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {meta.direccion}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Comercializadora */}
                            {meta?.comercializadora_nombre && (
                                <div className="flex items-start gap-3">
                                    <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                    ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'}
                  `}>
                                        <Building2 size={18} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Comercializadora
                                        </p>
                                        <p className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {meta.comercializadora_nombre}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className={`
            grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl
            ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}
          `}>
                        {/* Usuario */}
                        <div className="flex items-center gap-3">
                            <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}
              `}>
                                <User size={18} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} />
                            </div>
                            <div>
                                <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Realizado por
                                </p>
                                <p className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {userName}
                                </p>
                            </div>
                        </div>

                        {/* Fecha y Hora */}
                        <div className="flex items-center gap-3">
                            <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}
              `}>
                                <Calendar size={18} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} />
                            </div>
                            <div>
                                <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Fecha
                                </p>
                                <p className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {formatDateTime(entry.creado_en)}{' '}
                                    <span className="font-normal opacity-70">
                                        {new Date(entry.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Contenido de Nota */}
                    {entry.tipo_evento === 'nota_manual' && entry.contenido_nota && (
                        <div className={`
              p-4 rounded-xl
              ${theme === 'dark' ? 'bg-fenix-500/10 border border-fenix-500/20' : 'bg-fenix-50 border border-fenix-200'}
            `}>
                            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-fenix-400' : 'text-fenix-600'}`}>
                                Nota
                            </h3>
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                {entry.contenido_nota}
                            </p>
                        </div>
                    )}

                    {/* Cambios (Diff) con resolución de FKs */}
                    {changes.length > 0 && (
                        <div className={`
              p-4 rounded-xl
              ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}
            `}>
                            <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                Cambios Realizados
                            </h3>
                            <div className="space-y-3">
                                {changes.map((change) => (
                                    <div
                                        key={change.field}
                                        className={`
                      p-3 rounded-xl
                      ${theme === 'dark' ? 'bg-slate-900' : 'bg-white border border-slate-200'}
                    `}
                                    >
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {change.label}
                                        </p>
                                        <div className="flex items-center gap-3 text-sm flex-wrap">
                                            {change.type === 'added' ? (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                    + {formatValue(change.newValue, change.field, meta)}
                                                </span>
                                            ) : change.type === 'removed' ? (
                                                <span className="text-red-600 dark:text-red-400 line-through font-medium">
                                                    - {formatValue(change.oldValue, change.field, meta)}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className={`
                            line-through max-w-[40%] truncate
                            ${theme === 'dark' ? 'text-red-400/70' : 'text-red-600/70'}
                          `}>
                                                        {formatValue(change.oldValue, change.field, meta)}
                                                    </span>
                                                    <ArrowRight size={14} className={theme === 'dark' ? 'text-slate-600' : 'text-slate-400'} />
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium max-w-[40%] truncate">
                                                        {formatValue(change.newValue, change.field, meta)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sin cambios */}
                    {entry.tipo_evento !== 'nota_manual' && changes.length === 0 && (
                        <div className={`
              p-4 rounded-xl text-center
              ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}
            `}>
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                {entry.tipo_evento === 'creacion'
                                    ? 'Registro creado. Los detalles están almacenados en el sistema.'
                                    : entry.tipo_evento === 'eliminacion'
                                        ? 'Registro eliminado del sistema.'
                                        : 'No hay cambios detectados para mostrar.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
