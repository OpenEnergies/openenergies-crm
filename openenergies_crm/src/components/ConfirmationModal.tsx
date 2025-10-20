import React from 'react';

// --- Props que aceptará el Modal ---
interface ConfirmationModalProps {
  isOpen: boolean; // Controla si el modal está visible
  onClose: () => void; // Función para cerrar el modal (al cancelar o hacer clic fuera)
  onConfirm: () => void; // Función a ejecutar si el usuario confirma
  title: string; // Título del modal (ej: "Confirmar Eliminación")
  message: string; // El mensaje de confirmación (ej: "¿Estás seguro...?")
  confirmText?: string; // Texto del botón de confirmación (defecto: "Confirmar")
  cancelText?: string; // Texto del botón de cancelar (defecto: "Cancelar")
  confirmButtonClass?: string; // Clase CSS para el botón de confirmar (ej: 'danger' para borrar)
  isConfirming?: boolean; // Para mostrar un estado de carga en el botón de confirmar
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonClass = '', // Por defecto no tiene clase extra
  isConfirming = false,
}) => {
  // Si no está abierto, no renderizamos nada
  if (!isOpen) {
    return null;
  }

  // Previene que el clic dentro del modal lo cierre
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    // Overlay oscuro semitransparente que cubre toda la pantalla
    <div
      className="modal-overlay"
      onClick={onClose} // Cierra el modal si se hace clic fuera del contenido
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      {/* Contenedor del contenido del modal */}
      <div className="modal-content card" onClick={handleContentClick}>
        {/* Título */}
        <h3 id="confirmation-modal-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
          {title}
        </h3>

        {/* Mensaje */}
        <p style={{ marginBottom: '1.5rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          {message}
        </p>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          {/* Botón Cancelar */}
          <button
            type="button"
            className="secondary" // Asume que tienes una clase .secondary para botones
            onClick={onClose}
            disabled={isConfirming} // Deshabilita si se está confirmando
          >
            {cancelText}
          </button>

          {/* Botón Confirmar */}
          <button
            type="button"
            className={confirmButtonClass} // Aplica la clase pasada (ej: 'danger')
            onClick={onConfirm}
            disabled={isConfirming} // Deshabilita mientras se confirma
          >
            {isConfirming ? 'Procesando...' : confirmText} {/* Muestra texto de carga */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;