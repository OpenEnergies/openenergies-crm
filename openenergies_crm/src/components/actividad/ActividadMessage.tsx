// src/components/actividad/ActividadMessage.tsx
// Componente de mensaje individual en el chat de actividad

import { useState } from 'react';
import { Plus, Pencil, Trash2, MessageSquare, ChevronDown, ChevronUp, ExternalLink, User, MapPin } from 'lucide-react';
import type { ActividadLogEntry, TipoEventoLog } from '@lib/actividadTypes';
import {
    TIPO_EVENTO_LABELS,
    ENTIDAD_TIPO_LABELS,
    ENTIDAD_TIPO_COLORS,
    TIPO_EVENTO_COLORS,
} from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';
import ActividadDiffViewer from './ActividadDiffViewer';

interface ActividadMessageProps {
    entry: ActividadLogEntry;
    isOwnMessage: boolean;
    onViewDetails?: (entry: ActividadLogEntry) => void;
}

const ICONS: Record<TipoEventoLog, React.ReactNode> = {
    creacion: <Plus size={14} />,
    edicion: <Pencil size={14} />,
    eliminacion: <Trash2 size={14} />,
    nota_manual: <MessageSquare size={14} />,
};

/**
 * Formatea la hora en formato HH:mm
 */
function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Genera el texto descriptivo del evento usando metadatos humanos
 */
function generateEventText(entry: ActividadLogEntry): string {
    const entidadLabel = ENTIDAD_TIPO_LABELS[entry.entidad_tipo].toLowerCase();

    switch (entry.tipo_evento) {
        case 'creacion':
            return `Creó un nuevo ${entidadLabel}`;
        case 'edicion':
            return `Editó el ${entidadLabel}`;
        case 'eliminacion':
            return `Eliminó el ${entidadLabel}`;
        case 'nota_manual':
            return entry.contenido_nota || '';
        default:
            return `Acción en ${entidadLabel}`;
    }
}

/**
 * Obtiene el contexto humano para mostrar en la cabecera
 */
function getContextoHumano(entry: ActividadLogEntry): { icon: React.ReactNode; text: string } | null {
    const meta = entry.metadatos_entidad;

    // Para cliente, mostrar nombre del cliente
    if (entry.entidad_tipo === 'cliente' && meta?.cliente_nombre) {
        return {
            icon: <User size={12} />,
            text: `Cliente: ${meta.cliente_nombre}`,
        };
    }

    // Para punto, contrato, factura: mostrar CUPS
    if (['punto', 'contrato', 'factura', 'factura_cliente'].includes(entry.entidad_tipo) && meta?.cups) {
        return {
            icon: <MapPin size={12} />,
            text: `CUPS: ${meta.cups}`,
        };
    }

    // Fallback a nombre de cliente si existe
    if (meta?.cliente_nombre) {
        return {
            icon: <User size={12} />,
            text: `Cliente: ${meta.cliente_nombre}`,
        };
    }

    return null;
}

export default function ActividadMessage({
    entry,
    isOwnMessage,
    onViewDetails,
}: ActividadMessageProps) {
    const { theme } = useTheme();
    const [showDiff, setShowDiff] = useState(false);

    const isNota = entry.tipo_evento === 'nota_manual';
    const hasChanges = entry.tipo_evento === 'edicion' && entry.detalles_json;
    const userName = entry.metadata_usuario
        ? `${entry.metadata_usuario.nombre || ''} ${entry.metadata_usuario.apellidos || ''}`.trim()
        : 'Usuario';
    const contexto = !isNota ? getContextoHumano(entry) : null;

    return (
        <div
            className={`flex flex-col gap-1 max-w-[85%] ${isOwnMessage && isNota ? 'self-end items-end' : 'self-start items-start'
                }`}
        >
            {/* Header: Usuario, contexto y tiempo */}
            <div className={`flex items-center gap-2 text-xs px-1 flex-wrap ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                <span className="font-semibold">{userName}</span>
                {contexto && (
                    <>
                        <span className="opacity-50">•</span>
                        <span className={`flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {contexto.icon}
                            {contexto.text}
                        </span>
                    </>
                )}
                <span className="opacity-50">•</span>
                <span className="opacity-70">{formatTime(entry.creado_en)}</span>
            </div>

            {/* Mensaje principal */}
            <div
                className={`
          relative rounded-2xl px-4 py-3
          ${isOwnMessage && isNota
                        ? theme === 'dark'
                            ? 'bg-fenix-500/15 border border-fenix-500/20 rounded-br-md'
                            : 'bg-fenix-50 border border-fenix-200 rounded-br-md'
                        : theme === 'dark'
                            ? 'bg-slate-800 border border-slate-700 rounded-bl-md'
                            : 'bg-white border border-slate-200 rounded-bl-md shadow-sm'
                    }
        `}
            >
                {/* Badge de entidad y tipo de acción */}
                {!isNota && (
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                ${ENTIDAD_TIPO_COLORS[entry.entidad_tipo]}
              `}
                        >
                            {ENTIDAD_TIPO_LABELS[entry.entidad_tipo]}
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium ${TIPO_EVENTO_COLORS[entry.tipo_evento]}`}>
                            {ICONS[entry.tipo_evento]}
                            {TIPO_EVENTO_LABELS[entry.tipo_evento]}
                        </span>
                    </div>
                )}

                {/* Contenido del mensaje */}
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                    {generateEventText(entry)}
                </p>

                {/* Enlaces de acción */}
                {!isNota && (
                    <div className="flex items-center gap-3 mt-3">
                        {onViewDetails && (
                            <button
                                onClick={() => onViewDetails(entry)}
                                className={`
                  flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer
                  ${theme === 'dark'
                                        ? 'text-fenix-400 hover:text-fenix-300'
                                        : 'text-fenix-600 hover:text-fenix-700'}
                `}
                            >
                                <ExternalLink size={12} />
                                Ver detalles
                            </button>
                        )}

                        {hasChanges && (
                            <button
                                onClick={() => setShowDiff(!showDiff)}
                                className={`
                  flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer
                  ${theme === 'dark'
                                        ? 'text-slate-400 hover:text-slate-300'
                                        : 'text-slate-500 hover:text-slate-600'}
                `}
                            >
                                {showDiff ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {showDiff ? 'Ocultar cambios' : 'Ver cambios'}
                            </button>
                        )}
                    </div>
                )}

                {/* Diff viewer inline */}
                {showDiff && hasChanges && entry.detalles_json && (
                    <div className={`
            mt-3 pt-3 border-t
            ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}
          `}>
                        <ActividadDiffViewer
                            detalles={entry.detalles_json}
                            metadatosEntidad={entry.metadatos_entidad}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
