// src/components/ExportDropdownFacturas.tsx
// Desplegable de exportación para facturas (cliente): CSV, Excel (XLSX), Sage200
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, ChevronDown } from 'lucide-react';
import type { ExportParams } from '@hooks/useExportData';
import CsvExportModal from './CsvExportModal';
import SageExportModal from './SageExportModal';
import XlsxExportModal from './XlsxExportModal';

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
    const [showXlsxModal, setShowXlsxModal] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

    useOnClickOutside(menuRef, () => setIsOpen(false));

    // Recalculate position whenever dropdown opens or window scrolls/resizes
    useEffect(() => {
        if (!isOpen || !buttonRef.current) return;

        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen]);

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
                    className="glass-modal p-1.5 min-w-[180px] animate-fade-in shadow-2xl"
                    style={{
                        position: 'fixed',
                        top: `${menuPos.top}px`,
                        right: `${menuPos.right}px`,
                        zIndex: 9999,
                    }}
                >
                    {/* Excel (XLSX) */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowXlsxModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <img src="/logo-excel.png" alt="Excel" className="w-5 h-5 object-contain" />
                        <span className="font-medium">Excel</span>
                    </button>

                    {/* CSV */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowCsvModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <img src="/logo-csv.png" alt="CSV" className="w-5 h-5 object-contain" />
                        <span className="font-medium">CSV</span>
                    </button>

                    {/* Sage200 */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowSageModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
                    >
                        <img src="/logo-sage200.png" alt="Sage200" className="w-5 h-5 object-contain" />
                        <span className="font-medium">Sage200</span>
                    </button>
                </div>,
                document.body
            )}

            {/* CSV Export Modal */}
            <CsvExportModal
                isOpen={showCsvModal}
                onClose={() => setShowCsvModal(false)}
            />

            {/* Sage 200 Export Modal */}
            <SageExportModal
                isOpen={showSageModal}
                onClose={() => setShowSageModal(false)}
            />

            {/* XLSX Export Modal */}
            <XlsxExportModal
                isOpen={showXlsxModal}
                onClose={() => setShowXlsxModal(false)}
            />
        </>
    );
}
