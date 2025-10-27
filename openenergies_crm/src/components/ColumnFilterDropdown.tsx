import { useState, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import { createPortal } from 'react-dom';

type Props = {
  columnName: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
};

// Hook auxiliar para detectar clics fuera
function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // No hacer nada si se hace clic en el ref o en sus descendientes
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export default function ColumnFilterDropdown({ columnName, options, selectedOptions, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  // Ref para el botón, para posicionar el menú
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Ref para el menú, para detectar clics fuera
  const menuRef = useRef<HTMLDivElement>(null);
  const hasOptions = options.length > 0;
  // Usa el hook para cerrar al hacer clic fuera del menú
  useOnClickOutside(menuRef, () => setIsOpen(false));

  const handleOptionToggle = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOptions.length === options.length) {
      onChange([]); // Deseleccionar todo
    } else {
      onChange(options); // Seleccionar todo
    }
    // Opcional: cerrar el menú después de seleccionar/limpiar todo
    setIsOpen(false);
  };

  // Calcula la posición del menú relativo al botón
  const getMenuPosition = () => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      // Posiciona el menú debajo del botón
      top: `${rect.bottom + window.scrollY + 4}px`, // +4px de margen
      // Intenta alinear a la derecha del botón
      right: `${window.innerWidth - rect.right - window.scrollX}px`,
      // Asegúrate de que no se salga por la izquierda (si es necesario)
      // left: `${rect.left + window.scrollX}px`, // Descomentar si prefieres alinear a la izquierda
      position: 'absolute' as React.CSSProperties['position'], // Necesario para posicionamiento absoluto
    };
  };

  return (
    // Contenedor relativo solo para el botón
    <div style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
      <button
        ref={buttonRef} // Asigna la ref al botón
        onClick={() => {
            if (hasOptions) setIsOpen(!isOpen);
        }}
        className={`icon-button secondary small ${selectedOptions.length > 0 ? 'active' : ''}`}
        title={hasOptions ? `Filtrar por ${columnName}` : 'No hay opciones para filtrar'}
        disabled={!hasOptions}
      >
        <Filter size={14} />
      </button>

      {/* 2. Usa createPortal para renderizar el menú */}
      {isOpen && hasOptions && createPortal(
        <div
          ref={menuRef} // Asigna ref al menú
          className="dropdown-menu card" // Tus clases existentes
          // 3. Aplica estilos de posicionamiento calculados y z-index alto
          style={{ ...getMenuPosition(), zIndex: 1050 /* Asegura que esté por encima de otros elementos */ }}
        >
          {/* Contenido del menú sin cambios */}
          <div className="dropdown-item">
            <button onClick={handleSelectAll} style={{ width: '100%', textAlign: 'left' }}>
              {selectedOptions.length === options.length ? 'Limpiar selección' : 'Seleccionar todo'}
            </button>
          </div>
          <hr style={{ margin: '4px 0'}} />
          {options.map(option => (
            <label key={option} className="dropdown-item checkbox-label">
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => handleOptionToggle(option)}
              />
              {/* Añade un span para asegurar que el texto se alinea correctamente */}
              <span>{option}</span>
            </label>
          ))}
        </div>,
        // 4. Renderiza el portal directamente en el body
        document.body
      )}
    </div>
  );
}