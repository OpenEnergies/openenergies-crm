import { useState, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';

type Props = {
  columnName: string;
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
};

export default function ColumnFilterDropdown({ columnName, options, selectedOptions, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasOptions = options.length > 0;

  // Cierra el dropdown si se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);
  
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
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
      <button 
        onClick={() => {
            // Solo abre el menú si hay opciones
            if (hasOptions) setIsOpen(!isOpen);
        }} 
        className={`icon-button secondary small ${selectedOptions.length > 0 ? 'active' : ''}`}
        title={hasOptions ? `Filtrar por ${columnName}` : 'No hay opciones para filtrar'}
        disabled={!hasOptions} // El botón está deshabilitado si no hay opciones
      >
        <Filter size={14} />
      </button>

      {/* El menú solo se renderiza si está abierto y hay opciones */}
      {isOpen && hasOptions && (
        <div className="dropdown-menu card">
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
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}