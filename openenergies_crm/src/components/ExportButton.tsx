import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { ExportParams } from '@hooks/useExportData';
import ExportModal from './ExportModal';

interface ExportButtonProps {
    exportParams?: ExportParams;
    entity?: string;
    preFilters?: any;
    label?: string;
    className?: string;
    compact?: boolean;
}

export default function ExportButton({
    exportParams,
    entity,
    preFilters,
    label = 'Exportar',
    className = '',
    compact = false,
}: ExportButtonProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Determine values from either prop structure
    const effectiveEntity = entity || exportParams?.entity;
    const effectiveFilters = preFilters || exportParams?.filters;

    if (!effectiveEntity) {
        console.warn('ExportButton: No entity provided');
        return null;
    }

    const handleClick = () => {
        setIsModalOpen(true);
    };

    return (
        <>
            {compact ? (
                <button
                    onClick={handleClick}
                    title={label}
                    className={`
            p-2 rounded-lg text-secondary hover:text-fenix-600 dark:hover:text-fenix-400 
            hover:bg-fenix-500/10 transition-colors cursor-pointer
            ${className}
          `}
                >
                    <FileSpreadsheet size={16} />
                </button>
            ) : (
                <button
                    onClick={handleClick}
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl 
            bg-fenix-500/10 border border-fenix-500/30 
            hover:bg-fenix-500/20 hover:border-fenix-500/50
            text-fenix-600 dark:text-fenix-400 font-medium 
            transition-all duration-200 cursor-pointer
            ${className}
          `}
                >
                    <FileSpreadsheet size={16} />
                    <span className="hidden sm:inline">{label}</span>
                </button>
            )}

            <ExportModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                entity={effectiveEntity as any} // Cast safely as we checked above
                preFilters={effectiveFilters}
            />
        </>
    );
}
