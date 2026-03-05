// src/components/ExportDropdownFacturas.tsx
// Desplegable de exportación para facturas (cliente): CSV, Sage 200, XLSX (deshabilitado)
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, ChevronDown, FileText, Database, Table2 } from 'lucide-react';
import type { ExportParams } from '@hooks/useExportData';
import ExportModal from './ExportModal';
import SageExportModal from './SageExportModal';

interface ExportDropdownFacturasProps {
    exportParams: ExportParams;
}

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) return;
            handler();
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}

export default function ExportDropdownFacturas({ exportParams }: ExportDropdownFacturasProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [showSageModal, setShowSageModal] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(menuRef, () => setIsOpen(false));

    const getMenuPosition = () => {
        if (!buttonRef.current) return {};
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 220;

        let left = rect.left;
        if (rect.left + menuWidth > window.innerWidth) {
            left = window.innerWidth - menuWidth - 16;
        }

        return {
            top: `${rect.bottom + 4}px`,
            left: `${left}px`,
            position: 'fixed' as React.CSSProperties['position'],
        };
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="
                    flex items-center gap-2 px-4 py-2 rounded-xl 
                    bg-fenix-500/10 border border-fenix-500/30 
                    hover:bg-fenix-500/20 hover:border-fenix-500/50
                    text-fenix-600 dark:text-fenix-400 font-medium 
                    transition-all duration-200 cursor-pointer
                "
            >
                <FileSpreadsheet size={16} />
                <span className="hidden sm:inline">Exportar</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    className="glass-modal p-2 min-w-[220px] animate-fade-in shadow-2xl"
                    style={{ ...getMenuPosition(), zIndex: 9999 }}
                >
                    {/* CSV */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowCsvModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <FileText size={16} className="text-emerald-500" />
                        <span>Exportar a CSV</span>
                    </button>

                    {/* Sage 200 */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowSageModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <Database size={16} className="text-blue-500" />
                        <span>Exportar a Sage 200</span>
                    </button>

                    <hr className="my-1 border-primary opacity-20" />

                    {/* XLSX - disabled */}
                    <button
                        disabled
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-secondary/40 rounded-md cursor-not-allowed"
                        title="Próximamente"
                    >
                        <Table2 size={16} className="opacity-40" />
                        <span>Exportar a XLSX</span>
                        <span className="ml-auto text-[10px] uppercase tracking-wider bg-bg-intermediate/50 px-1.5 py-0.5 rounded text-secondary/50">Próx.</span>
                    </button>
                </div>,
                document.body
            )}

            {/* CSV Export Modal (same as before) */}
            <ExportModal
                isOpen={showCsvModal}
                onClose={() => setShowCsvModal(false)}
                entity={exportParams.entity}
                preFilters={exportParams.filters}
            />

            {/* Sage 200 Export Modal */}
            <SageExportModal
                isOpen={showSageModal}
                onClose={() => setShowSageModal(false)}
            />
        </>
    );
}
