import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, ChevronDown } from 'lucide-react';
import PuntosExportModal from '@components/PuntosExportModal';
import type { PuntosExportScope } from '@hooks/puntosExportScope';

type ExportFormat = 'csv' | 'xlsx';

interface ExportDropdownPuntosProps {
  scope?: PuntosExportScope;
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

export default function ExportDropdownPuntos({ scope }: ExportDropdownPuntosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
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
        onClick={() => setIsOpen((prev) => !prev)}
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

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="glass-modal p-2 min-w-[220px] animate-fade-in shadow-2xl"
            style={{ ...getMenuPosition(), zIndex: 9999 }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                setActiveFormat('csv');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
            >
              <img src="/logo-csv.png" alt="CSV" className="w-4 h-4 object-contain" />
              <span>CSV</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setActiveFormat('xlsx');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
            >
              <img src="/logo-excel.png" alt="Excel" className="w-4 h-4 object-contain" />
              <span>Excel</span>
            </button>
          </div>,
          document.body
        )}

      <PuntosExportModal
        isOpen={activeFormat === 'csv'}
        onClose={() => setActiveFormat(null)}
        format="csv"
        scope={scope}
      />

      <PuntosExportModal
        isOpen={activeFormat === 'xlsx'}
        onClose={() => setActiveFormat(null)}
        format="xlsx"
        scope={scope}
      />
    </>
  );
}
