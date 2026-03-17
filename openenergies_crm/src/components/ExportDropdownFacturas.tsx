// src/components/ExportDropdownFacturas.tsx
// Desplegable de exportación para facturas: CSV, XLSX y opcionalmente Sage 200
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, ChevronDown } from 'lucide-react';
import type { ExportParams } from '@hooks/useExportData';
import type { FacturaExportScope } from '@hooks/facturaExportScope';
import CsvExportModal from './CsvExportModal';
import SageExportModal from './SageExportModal';
import XlsxExportModal from './XlsxExportModal';

interface ExportDropdownFacturasProps {
    exportParams: ExportParams;
    showSage?: boolean;
    scope?: FacturaExportScope;
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

export default function ExportDropdownFacturas({ exportParams: _exportParams, showSage = true, scope }: ExportDropdownFacturasProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [showSageModal, setShowSageModal] = useState(false);
    const [showXlsxModal, setShowXlsxModal] = useState(false);
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
                        <img src="/logo-csv.png" alt="CSV" className="w-4 h-4 object-contain" />
                        <span>CSV</span>
                    </button>

                    {showSage && (
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setShowSageModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                        >
                            <img src="/logo-sage200.png" alt="Sage 200" className="w-4 h-4 object-contain" />
                            <span>Exportar a Sage 200</span>
                        </button>
                    )}

                    {/* XLSX */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowXlsxModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <img src="/logo-excel.png" alt="Excel" className="w-4 h-4 object-contain" />
                        <span>Excel</span>
                    </button>
                </div>,
                document.body
            )}

            {/* CSV Export Modal (webhook n8n) */}
            <CsvExportModal
                isOpen={showCsvModal}
                onClose={() => setShowCsvModal(false)}
                scope={scope}
            />

            {/* Sage 200 Export Modal */}
            {showSage && (
                <SageExportModal
                    isOpen={showSageModal}
                    onClose={() => setShowSageModal(false)}
                    scope={scope}
                />
            )}

            {/* XLSX Export Modal */}
            <XlsxExportModal
                isOpen={showXlsxModal}
                onClose={() => setShowXlsxModal(false)}
                scope={scope}
            />
        </>
    );
}
