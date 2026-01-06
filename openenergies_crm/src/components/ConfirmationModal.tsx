import React from 'react';
import { createPortal } from 'react-dom';

// --- Props que aceptará el Modal ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: 'danger' | 'warning' | 'primary' | 'secondary' | '';
  isConfirming?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonClass = '',
  isConfirming = false,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Clases base para el botón de confirmar
  const baseButtonClasses = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  // Estilos específicos según el tipo
  const getConfirmButtonClasses = () => {
    switch (confirmButtonClass) {
      case 'danger':
        return `${baseButtonClasses} bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20`;
      case 'warning':
        return `${baseButtonClasses} bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/20`;
      case 'secondary':
        return `${baseButtonClasses} bg-transparent border border-fenix-500 text-fenix-500 hover:bg-fenix-500/10`;
      default:
        return `${baseButtonClasses} bg-fenix-500 hover:bg-fenix-400 text-white shadow-lg shadow-fenix-500/20`;
    }
  };

  return createPortal(
    // Overlay con blur
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      {/* Modal content con glassmorphism */}
      <div
        className="bg-gray-900 border border-bg-intermediate rounded-2xl w-full max-w-md p-6 animate-slide-up shadow-2xl"
        onClick={handleContentClick}
      >
        {/* Título */}
        <h3
          id="confirmation-modal-title"
          className="text-xl font-semibold text-white mb-4"
        >
          {title}
        </h3>

        {/* Mensaje */}
        <p className="text-gray-400 leading-relaxed mb-6">
          {message}
        </p>

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3">
          {/* Botón Cancelar */}
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isConfirming}
          >
            {cancelText}
          </button>

          {/* Botón Confirmar */}
          <button
            type="button"
            className={getConfirmButtonClasses()}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;