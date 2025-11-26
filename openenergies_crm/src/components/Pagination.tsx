import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Pagination({ page, totalPages, totalItems, onPageChange, isLoading }: Props) {
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoading) {
      onPageChange(newPage);
    }
  };

  return (
    <div className="pagination-container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '1rem', 
      borderTop: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-card)'
    }}>
      <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
        Total: <strong>{totalItems}</strong> registros • Página <strong>{page}</strong> de <strong>{totalPages || 1}</strong>
      </span>
      
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="icon-button secondary"
          onClick={() => handlePageChange(1)}
          disabled={page === 1 || isLoading}
          title="Primera página"
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          className="icon-button secondary"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1 || isLoading}
          title="Anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button secondary"
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0 || isLoading}
          title="Siguiente"
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="icon-button secondary"
          onClick={() => handlePageChange(totalPages)}
          disabled={page === totalPages || totalPages === 0 || isLoading}
          title="Última página"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
}