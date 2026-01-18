// src/components/actividad/ActividadChat.tsx
// Componente principal de chat para mostrar el log de actividad

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, RefreshCw, Calendar, ChevronDown, Filter } from 'lucide-react';
import type { ActividadLogEntry, ActividadFilters as FiltersType } from '@lib/actividadTypes';
import { useSession } from '@hooks/useSession';
import { useTheme } from '@hooks/ThemeContext';
import ActividadMessage from './ActividadMessage';
import ActividadFilters from './ActividadFilters';
import ActividadNoteInput from './ActividadNoteInput';
import ActividadDetailModal from './ActividadDetailModal';

interface ActividadChatProps {
    entries: ActividadLogEntry[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    filters: FiltersType;
    onFiltersChange: (filters: FiltersType) => void;
    clienteId: string | null;
    showClienteFilter?: boolean;
    onRefresh?: () => void;
}

/**
 * Agrupa entradas por fecha
 */
function groupByDate(entries: ActividadLogEntry[]): Map<string, ActividadLogEntry[]> {
    const groups = new Map<string, ActividadLogEntry[]>();

    for (const entry of entries) {
        const date = new Date(entry.creado_en);
        const dateKey = date.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(entry);
    }

    return groups;
}

/**
 * Formatea la fecha para el divisor
 */
function formatDateLabel(dateStr: string): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateParts = dateStr.toLowerCase();
    const todayParts = today.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).toLowerCase();
    const yesterdayParts = yesterday.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).toLowerCase();

    if (dateParts === todayParts) return 'Hoy';
    if (dateParts === yesterdayParts) return 'Ayer';

    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

export default function ActividadChat({
    entries,
    isLoading,
    hasMore,
    onLoadMore,
    filters,
    onFiltersChange,
    clienteId,
    showClienteFilter = false,
    onRefresh,
}: ActividadChatProps) {
    const { userId } = useSession();
    const { theme } = useTheme();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const filterContainerRef = useRef<HTMLDivElement>(null);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ActividadLogEntry | null>(null);

    // Agrupar por fecha
    const groupedEntries = groupByDate(entries);

    // Cerrar filtros al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
                setShowFilters(false);
            }
        };
        if (showFilters) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showFilters]);

    // Scroll al fondo cuando hay nuevos mensajes
    useEffect(() => {
        if (shouldScrollToBottom && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [entries.length, shouldScrollToBottom]);

    // Detectar scroll
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShouldScrollToBottom(isAtBottom);
    }, []);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            onLoadMore();
        }
    }, [hasMore, isLoading, onLoadMore]);

    // Count active filters
    const activeFiltersCount = [
        filters.cliente_ids?.length,
        filters.punto_ids?.length,
        filters.contrato_ids?.length,
        filters.tipo_evento?.length,
        filters.entidad_tipo?.length,
        filters.user_id,
    ].filter(Boolean).length;

    return (
        <div className={`
      flex flex-col h-[calc(100vh-280px)] min-h-[500px] rounded-xl overflow-hidden relative
      ${theme === 'dark'
                ? 'bg-slate-900 border border-slate-800'
                : 'bg-white border border-slate-200 shadow-sm'}
    `}>
            {/* Header con toggle de filtros */}
            <div className={`
        flex items-center justify-between p-4 border-b relative z-20
        ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}
      `}>
                <div className="relative" ref={filterContainerRef}>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer
              ${activeFiltersCount > 0
                                ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400'
                                : theme === 'dark'
                                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }
            `}
                    >
                        <Filter size={16} />
                        Filtros
                        {activeFiltersCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-fenix-500 text-white text-xs flex items-center justify-center font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                        <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Panel de Filtros (OVERLAY absoluto) */}
                    {showFilters && (
                        <div className={`
              absolute top-full left-0 mt-2 z-50 w-[400px] max-w-[90vw]
              rounded-xl shadow-2xl overflow-hidden
              ${theme === 'dark'
                                ? 'bg-slate-900 border border-slate-800'
                                : 'bg-white border border-slate-200'}
            `}>
                            <ActividadFilters
                                filters={filters}
                                onChange={(newFilters) => {
                                    onFiltersChange(newFilters);
                                }}
                                showClienteFilter={showClienteFilter}
                                clienteId={clienteId}
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={isLoading}
                            className={`
                p-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer
                ${theme === 'dark'
                                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}
              `}
                            title="Actualizar"
                        >
                            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* Área de mensajes */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className={`
          flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar
          ${theme === 'dark' ? 'bg-slate-950/30' : 'bg-slate-50/50'}
        `}
            >
                {/* Botón cargar más */}
                {hasMore && (
                    <div className="flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={isLoading}
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer
                ${theme === 'dark'
                                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
              `}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                'Cargar más antiguos'
                            )}
                        </button>
                    </div>
                )}

                {/* Mensajes agrupados por fecha */}
                {Array.from(groupedEntries.entries()).map(([dateLabel, dateEntries]) => (
                    <div key={dateLabel}>
                        {/* Divisor de fecha */}
                        <div className="flex items-center gap-3 my-4">
                            <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                            <div className={`
                flex items-center gap-2 px-3 py-1 rounded-full text-xs
                ${theme === 'dark'
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-slate-200 text-slate-500'}
              `}>
                                <Calendar size={12} />
                                {formatDateLabel(dateLabel)}
                            </div>
                            <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        </div>

                        {/* Mensajes del día */}
                        <div className="space-y-4 flex flex-col">
                            {dateEntries.map((entry) => (
                                <ActividadMessage
                                    key={entry.id}
                                    entry={entry}
                                    isOwnMessage={entry.user_id === userId}
                                    onViewDetails={setSelectedEntry}
                                />
                            ))}
                        </div>
                    </div>
                ))}

                {/* Estado vacío */}
                {!isLoading && entries.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className={`
              w-16 h-16 rounded-2xl flex items-center justify-center mb-4
              ${theme === 'dark' ? 'bg-fenix-500/10' : 'bg-fenix-50'}
            `}>
                            <Calendar className={`w-8 h-8 ${theme === 'dark' ? 'text-fenix-500/50' : 'text-fenix-400'}`} />
                        </div>
                        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                            No hay actividad registrada
                        </p>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Los eventos aparecerán aquí cuando se realicen cambios.
                        </p>
                    </div>
                )}

                {/* Loading inicial */}
                {isLoading && entries.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
                    </div>
                )}
            </div>

            {/* Input de notas */}
            <ActividadNoteInput
                clienteId={clienteId}
                onSuccess={() => {
                    setShouldScrollToBottom(true);
                    onRefresh?.();
                }}
            />

            {/* Modal de detalles */}
            {selectedEntry && (
                <ActividadDetailModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    );
}
