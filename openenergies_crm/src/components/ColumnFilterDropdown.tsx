import { useState, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import { createPortal } from 'react-dom';

type Props = {
  columnName: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
};

function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasOptions = options.length > 0;

  useOnClickOutside(menuRef, () => setIsOpen(false));

  const handleOptionToggle = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter(item => item !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOptions.length === options.length) {
      onChange([]);
    } else {
      onChange(options);
    }
    setIsOpen(false);
  };

  const getMenuPosition = () => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 200;

    // Check if menu would go off-screen on the right
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
    <div className="relative inline-block ml-2">
      <button
        ref={buttonRef}
        onClick={() => {
          if (hasOptions) setIsOpen(!isOpen);
        }}
        className={`
          w-8 h-8 rounded-md flex items-center justify-center
          transition-all duration-150
          ${selectedOptions.length > 0
            ? 'bg-fenix-500/20 text-fenix-400'
            : 'text-gray-400 hover:text-white hover:bg-bg-intermediate'}
          disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
        `}
        title={hasOptions ? `Filtrar por ${columnName}` : 'No hay opciones para filtrar'}
        disabled={!hasOptions}
      >
        <Filter size={14} />
      </button>

      {isOpen && hasOptions && createPortal(
        <div
          ref={menuRef}
          className="glass-modal p-2 min-w-[200px] max-w-[280px] animate-fade-in shadow-2xl"
          style={{ ...getMenuPosition(), zIndex: 9999 }}
        >
          {/* Seleccionar todo */}
          <button
            onClick={handleSelectAll}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-bg-intermediate rounded-md transition-colors cursor-pointer"
          >
            {selectedOptions.length === options.length ? 'Limpiar selección' : 'Seleccionar todo'}
          </button>

          <hr className="my-2 border-bg-intermediate" />

          {/* Opciones */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {options.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-bg-intermediate rounded-md cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => handleOptionToggle(option)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-fenix-500 focus:ring-fenix-500 focus:ring-offset-0"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}