// src/components/XlsxExportModal.tsx
// Modal de exportación XLSX con filtros: fecha inicio/fin, comercializadora, tipo factura, agrupación
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileSpreadsheet, Check } from 'lucide-react';
import { useExportXlsx } from '@hooks/useExportXlsx';
import { useFacturaExportFilters } from '@hooks/useFacturaExportFilters';

interface XlsxExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function XlsxExportModal({ isOpen, onClose }: XlsxExportModalProps) {
    const { exportXlsx } = useExportXlsx();
    const {
        isComercial,
        clienteId,
        fechaDesde,
        setFechaDesde,
        fechaHasta,
        setFechaHasta,
        minFecha,
        maxFecha,
        comercializadoraOptions,
        selectedComercializadoras,
        setSelectedComercializadoras,
        tipoOptions,
        selectedTipos,
        setSelectedTipos,
        sociedadOptions,
        selectedSociedades,
        setSelectedSociedades,
        agrupaciones,
        selectedAgrupaciones,
        setSelectedAgrupaciones,
        isInitializingFilters,
    } = useFacturaExportFilters(isOpen);

    const CIRCUMFERENCE = 2 * Math.PI * 40;
    const [exportPhase, setExportPhase] = useState<'idle' | 'loading' | 'done'>('idle');
    const [progress, setProgress] = useState(0);
    const progressRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFiltersLoading = exportPhase === 'idle' && isInitializingFilters;

    // Reset filters and export phase when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setExportPhase('idle');
            setProgress(0);
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
        }
    }, [isOpen]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Progress simulation: irregular random increments from 0 → 90% over ~5s
    useEffect(() => {
        if (exportPhase !== 'loading') return;
        progressRef.current = 0;
        setProgress(0);
        const step = () => {
            if (progressRef.current >= 90) return;
            const increment = Math.floor(Math.random() * 12) + 3;
            const next = Math.min(progressRef.current + increment, 90);
            progressRef.current = next;
            setProgress(next);
            const base = 150 + (next / 90) * 400;
            const jitter = (Math.random() - 0.5) * 150;
            timerRef.current = setTimeout(step, Math.max(80, base + jitter));
        };
        timerRef.current = setTimeout(step, 150);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [exportPhase]);

    const toggleComercializadora = (id: string) => {
        setSelectedComercializadoras(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleTipo = (tipo: string) => {
        setSelectedTipos(prev =>
            prev.includes(tipo) ? prev.filter(x => x !== tipo) : [...prev, tipo]
        );
    };

    const toggleAgrupacion = (id: string) => {
        setSelectedAgrupaciones(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleExport = async () => {
        setExportPhase('loading');
        const success = await exportXlsx({
            cliente_id: isComercial ? null : (clienteId ?? null),
            cliente_ids: isComercial ? selectedSociedades : undefined,
            fecha_desde: fechaDesde || undefined,
            fecha_hasta: fechaHasta || undefined,
            comercializadoras: selectedComercializadoras.length > 0 ? selectedComercializadoras : undefined,
            tipos_suministro: selectedTipos.length > 0 ? selectedTipos : undefined,
            agrupaciones: selectedAgrupaciones.length > 0 ? selectedAgrupaciones : undefined,
        });
        if (timerRef.current) clearTimeout(timerRef.current);
        if (success) {
            setProgress(100);
            setExportPhase('done');
            setTimeout(() => onClose(), 1800);
        } else {
            setExportPhase('idle');
            setProgress(0);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
            onClick={exportPhase === 'idle' ? onClose : undefined}
        >
            <div
                className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-fenix-500/20 bg-bg-primary/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center text-fenix-500">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400">Exportar XLSX</h3>
                            <p className="text-xs text-secondary font-medium uppercase tracking-wider">
                                Facturas
                            </p>
                        </div>
                    </div>
                    {exportPhase === 'idle' && (
                        <button
                            onClick={onClose}
                            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Progress Overlay */}
                {exportPhase !== 'idle' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6 bg-bg-primary/30">
                        <div className="relative w-36 h-36">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-bg-intermediate" />
                                <circle
                                    cx="50" cy="50" r="40" fill="none" strokeWidth="8"
                                    strokeLinecap="round"
                                    className="stroke-fenix-500"
                                    style={{
                                        strokeDasharray: CIRCUMFERENCE,
                                        strokeDashoffset: CIRCUMFERENCE * (1 - progress / 100),
                                        transition: exportPhase === 'done'
                                            ? 'stroke-dashoffset 0.7s ease-out'
                                            : 'stroke-dashoffset 0.5s ease-out',
                                    }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                {exportPhase === 'done' ? (
                                    <Check size={36} className="text-fenix-500" strokeWidth={3} />
                                ) : (
                                    <span className="text-2xl font-bold text-fenix-500">{progress}%</span>
                                )}
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-base font-semibold text-primary">
                                {exportPhase === 'done' ? '¡Archivo descargado!' : 'Generando archivo XLSX...'}
                            </p>
                            {exportPhase === 'loading' && (
                                <p className="text-xs text-secondary mt-1">Esto puede tardar unos segundos</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Body */}
                {exportPhase === 'idle' && (
                <div className="relative p-6 overflow-y-auto custom-scrollbar bg-bg-primary/30">
                    {isFiltersLoading && (
                        <div className="absolute inset-0 z-10 bg-bg-primary/70 backdrop-blur-[1px] flex items-center justify-center">
                            <p className="text-sm font-semibold text-primary">Cargando filtros...</p>
                        </div>
                    )}

                    <fieldset disabled={isFiltersLoading} className={isFiltersLoading ? 'opacity-60' : ''}>
                    <div className="space-y-6">
                        {/* Date range */}
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1 block">Fecha inicio</span>
                                <input
                                    type="date"
                                    className="glass-input mt-1 w-full"
                                    value={fechaDesde}
                                    min={minFecha || undefined}
                                    max={fechaHasta || maxFecha || undefined}
                                    onChange={e => setFechaDesde(e.target.value)}
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1 block">Fecha fin</span>
                                <input
                                    type="date"
                                    className="glass-input mt-1 w-full"
                                    value={fechaHasta}
                                    min={fechaDesde || minFecha || undefined}
                                    max={maxFecha || undefined}
                                    onChange={e => setFechaHasta(e.target.value)}
                                />
                            </label>
                        </div>

                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Comercializadora */}
                            <div className="space-y-1">
                                <label className="text-xs text-secondary font-medium uppercase tracking-wider">Comercializadora</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                    {comercializadoraOptions.map(c => (
                                        <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedComercializadoras.includes(c.id)}
                                                onChange={() => toggleComercializadora(c.id)}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">{c.nombre}</span>
                                        </label>
                                    ))}
                                    {comercializadoraOptions.length === 0 && (
                                        <p className="text-xs text-secondary/50 py-1">Sin comercializadoras</p>
                                    )}
                                </div>
                            </div>

                            {/* Tipo de factura */}
                            <div className="space-y-1">
                                <label className="text-xs text-secondary font-medium uppercase tracking-wider">Tipo de factura</label>
                                <div className="space-y-2 p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                    {tipoOptions.map(tipo => (
                                        <label key={tipo} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedTipos.includes(tipo)}
                                                onChange={() => toggleTipo(tipo)}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">{tipo}</span>
                                        </label>
                                    ))}
                                    {tipoOptions.length === 0 && (
                                        <p className="text-xs text-secondary/50 py-1">Sin tipos de factura</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isComercial && (
                            <div className="space-y-1">
                                <label className="text-xs text-secondary font-medium uppercase tracking-wider">Sociedades</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                    {sociedadOptions.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedSociedades.includes(s.id)}
                                                onChange={() => setSelectedSociedades(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">{s.nombre}</span>
                                        </label>
                                    ))}
                                    {sociedadOptions.length === 0 && (
                                        <p className="text-xs text-secondary/50 py-1">Sin sociedades con facturas en el periodo</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Agrupación */}
                        {agrupaciones.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-xs text-secondary font-medium uppercase tracking-wider">Agrupación</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                    {agrupaciones.map(a => (
                                        <label key={a.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedAgrupaciones.includes(a.id)}
                                                onChange={() => toggleAgrupacion(a.id)}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">{a.nombre}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    </fieldset>
                </div>
                )}

                {/* Footer */}
                {exportPhase === 'idle' && (
                <div className="p-5 border-t border-fenix-500/20 flex items-center justify-end gap-3 bg-bg-intermediate/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isFiltersLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-400 disabled:bg-fenix-500/50 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer"
                    >
                        <Download size={18} />
                        Exportar
                    </button>
                </div>
                )}
            </div>
        </div>,
        document.body
    );
}
