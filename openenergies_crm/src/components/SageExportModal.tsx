// src/components/SageExportModal.tsx
// Modal de exportación Sage 200 con filtros: fecha inicio/fin, comercializadora, tipo factura, agrupación
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useExportSage } from '@hooks/useExportSage';
import { useClienteId } from '@hooks/useClienteId';
import toast from 'react-hot-toast';

interface SageExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SageExportModal({ isOpen, onClose }: SageExportModalProps) {
    const { exportSage, isExporting } = useExportSage();
    const { clienteId } = useClienteId();

    // Filter states
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [selectedComercializadoras, setSelectedComercializadoras] = useState<string[]>([]);
    const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
    const [selectedAgrupaciones, setSelectedAgrupaciones] = useState<string[]>([]);

    // Reset filters when modal opens
    useEffect(() => {
        if (isOpen) {
            setFechaDesde('');
            setFechaHasta('');
            setSelectedComercializadoras([]);
            setSelectedTipos([]);
            setSelectedAgrupaciones([]);
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

    // Fetch comercializadoras
    const { data: comercializadoras = [] } = useQuery({
        queryKey: ['sage-comercializadoras'],
        queryFn: async () => {
            const { data } = await supabase
                .from('empresas')
                .select('id, nombre')
                .eq('tipo', 'comercializadora')
                .is('eliminado_en', null)
                .order('nombre');
            return data || [];
        },
        enabled: isOpen,
    });

    // Fetch agrupaciones del cliente
    const { data: agrupaciones = [] } = useQuery({
        queryKey: ['sage-agrupaciones', clienteId],
        queryFn: async () => {
            if (!clienteId) return [];
            const { data } = await supabase
                .from('agrupaciones_puntos')
                .select('id, nombre')
                .eq('cliente_id', clienteId)
                .is('eliminado_en', null)
                .order('nombre');
            return data || [];
        },
        enabled: isOpen && !!clienteId,
    });

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
        if (!clienteId) {
            toast.error('No se pudo determinar el cliente');
            return;
        }
        await exportSage({
            cliente_id: clienteId,
            fecha_desde: fechaDesde || undefined,
            fecha_hasta: fechaHasta || undefined,
            comercializadoras: selectedComercializadoras.length > 0 ? selectedComercializadoras : undefined,
            tipos_suministro: selectedTipos.length > 0 ? selectedTipos : undefined,
            agrupaciones: selectedAgrupaciones.length > 0 ? selectedAgrupaciones : undefined,
        });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
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
                            <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400">Exportar Sage 200</h3>
                            <p className="text-xs text-secondary font-medium uppercase tracking-wider">
                                Facturas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-bg-primary/30">
                    <div className="space-y-6">
                        {/* Date range */}
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1 block">Fecha inicio</span>
                                <input
                                    type="date"
                                    className="glass-input mt-1 w-full"
                                    value={fechaDesde}
                                    onChange={e => setFechaDesde(e.target.value)}
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1 block">Fecha fin</span>
                                <input
                                    type="date"
                                    className="glass-input mt-1 w-full"
                                    value={fechaHasta}
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
                                    {comercializadoras.map(c => (
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
                                    {comercializadoras.length === 0 && (
                                        <p className="text-xs text-secondary/50 py-1">Sin comercializadoras</p>
                                    )}
                                </div>
                            </div>

                            {/* Tipo de factura */}
                            <div className="space-y-1">
                                <label className="text-xs text-secondary font-medium uppercase tracking-wider">Tipo de factura</label>
                                <div className="space-y-2 p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                    {['Luz', 'Gas'].map(tipo => (
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
                                </div>
                            </div>
                        </div>

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
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-fenix-500/20 flex items-center justify-end gap-3 bg-bg-intermediate/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-400 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        Exportar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
