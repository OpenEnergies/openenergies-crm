// src/pages/renovaciones/modals/ComercializadoraModal.tsx
// Modal Paso 1: Selección de comercializadora
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2, Search, Check, ArrowRight } from 'lucide-react';
import { clsx } from '@lib/utils';

interface ComercializadoraOption {
  id: string;
  nombre: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comercializadoraId: string | null, keepSame: boolean) => void;
  comercializadoras: ComercializadoraOption[];
  selectedCount: number;
}

export default function ComercializadoraModal({
  isOpen,
  onClose,
  onConfirm,
  comercializadoras,
  selectedCount,
}: Props) {
  const [option, setOption] = useState<'mantener' | 'cambiar'>('mantener');
  const [selectedComercializadoraId, setSelectedComercializadoraId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar comercializadoras por búsqueda
  const filteredComercializadoras = useMemo(() => {
    if (!searchTerm.trim()) return comercializadoras;
    const term = searchTerm.toLowerCase().trim();
    return comercializadoras.filter(c => c.nombre.toLowerCase().includes(term));
  }, [comercializadoras, searchTerm]);

  const canContinue = option === 'mantener' || (option === 'cambiar' && selectedComercializadoraId);

  const handleConfirm = () => {
    if (option === 'mantener') {
      onConfirm(null, true);
    } else {
      onConfirm(selectedComercializadoraId, false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-modal w-full max-w-lg p-0 animate-slide-up shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-fenix-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">Comercializadora</h3>
              <p className="text-sm text-secondary">{selectedCount} contrato{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}</p>
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
        <div className="p-6 space-y-4">
          {/* Option: Mantener */}
          <label
            className={clsx(
              'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
              option === 'mantener'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-primary/20 hover:border-primary/40'
            )}
          >
            <input
              type="radio"
              name="comercializadora-option"
              checked={option === 'mantener'}
              onChange={() => setOption('mantener')}
              className="hidden"
            />
            <div className={clsx(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
              option === 'mantener'
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-primary/40'
            )}>
              {option === 'mantener' && <Check size={12} className="text-white" />}
            </div>
            <div>
              <p className="font-bold text-primary">Mantener la misma comercializadora</p>
              <p className="text-sm text-secondary opacity-70">
                Cada contrato mantendrá su comercializadora actual
              </p>
            </div>
          </label>

          {/* Option: Cambiar */}
          <label
            className={clsx(
              'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
              option === 'cambiar'
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-primary/20 hover:border-primary/40'
            )}
          >
            <input
              type="radio"
              name="comercializadora-option"
              checked={option === 'cambiar'}
              onChange={() => setOption('cambiar')}
              className="hidden"
            />
            <div className={clsx(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5',
              option === 'cambiar'
                ? 'border-amber-500 bg-amber-500'
                : 'border-primary/40'
            )}>
              {option === 'cambiar' && <Check size={12} className="text-white" />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-primary">Cambiar de comercializadora</p>
              <p className="text-sm text-secondary opacity-70 mb-3">
                Todos los contratos pasarán a la nueva comercializadora
              </p>

              {/* Buscador */}
              {option === 'cambiar' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                    <input
                      type="text"
                      placeholder="Buscar comercializadora..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="glass-input w-full pl-10"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Lista de comercializadoras */}
                  <div className="max-h-48 overflow-y-auto custom-scrollbar border border-primary/10 rounded-lg">
                    {filteredComercializadoras.length === 0 ? (
                      <p className="p-4 text-center text-secondary opacity-70">
                        No se encontraron comercializadoras
                      </p>
                    ) : (
                      filteredComercializadoras.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedComercializadoraId(c.id);
                          }}
                          className={clsx(
                            'w-full text-left px-4 py-3 transition-colors flex items-center justify-between cursor-pointer',
                            'hover:bg-bg-intermediate border-b border-primary/5 last:border-0',
                            selectedComercializadoraId === c.id && 'bg-fenix-500/10'
                          )}
                        >
                          <span className={clsx(
                            'font-medium',
                            selectedComercializadoraId === c.id ? 'text-fenix-500' : 'text-primary'
                          )}>
                            {c.nombre}
                          </span>
                          {selectedComercializadoraId === c.id && (
                            <Check size={16} className="text-fenix-500" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 bg-bg-intermediate/30 border-t border-primary/10">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canContinue}
            className={clsx(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all cursor-pointer',
              canContinue
                ? 'bg-fenix-500 hover:bg-fenix-400 text-white shadow-lg shadow-fenix-500/25'
                : 'bg-bg-intermediate text-secondary cursor-not-allowed opacity-50'
            )}
          >
            Continuar
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
