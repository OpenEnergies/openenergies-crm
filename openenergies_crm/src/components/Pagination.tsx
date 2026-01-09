import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
}

export function Pagination({ page, totalPages, totalItems, onPageChange, isLoading = false }: PaginationProps) {
    const goToPage = (newPage: number) => {
        onPageChange(Math.max(1, Math.min(newPage, totalPages)));
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-primary">
            <div className="text-sm text-secondary">
                Total: <span className="text-primary font-medium">{totalItems}</span> registros •
                Página <span className="text-primary font-medium">{page}</span> de <span className="text-primary font-medium">{totalPages || 1}</span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => goToPage(1)}
                    disabled={page === 1 || isLoading}
                    title="Primera página"
                >
                    <ChevronsLeft size={18} />
                </button>
                <button
                    className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1 || isLoading}
                    title="Página anterior"
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    title="Página siguiente"
                >
                    <ChevronRight size={18} />
                </button>
                <button
                    className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    onClick={() => goToPage(totalPages)}
                    disabled={page >= totalPages || isLoading}
                    title="Última página"
                >
                    <ChevronsRight size={18} />
                </button>
            </div>
        </div>
    );
}
