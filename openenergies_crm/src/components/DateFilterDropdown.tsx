import { useState, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';

// Tipo para definir las partes de la fecha seleccionada
export type DateParts = {
  year: string | null;
  month: string | null;
  day: string | null;
};

type Props = {
  columnName: string;
  // Recibe un array de todas las fechas disponibles para generar las opciones
  options: Date[]; 
  // El estado actual de la selección
  selectedDate: DateParts;
  // Callback para notificar cambios
  onChange: (selected: DateParts) => void;
};

export default function DateFilterDropdown({ columnName, options, selectedDate, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Estados para las opciones de los 3 selectores
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);

  // Lógica para poblar dinámicamente las opciones de los filtros
  useEffect(() => {
    // Años: se extraen de todas las fechas
    const uniqueYears = Array.from(new Set(options.map(d => d.getFullYear().toString()))).sort((a, b) => Number(b) - Number(a));
    setYears(uniqueYears);

    // Meses: se filtran por el año seleccionado
    const filteredByYear = selectedDate.year ? options.filter(d => d.getFullYear().toString() === selectedDate.year) : options;
    const uniqueMonths = Array.from(new Set(filteredByYear.map(d => (d.getMonth() + 1).toString().padStart(2, '0')))).sort();
    setMonths(uniqueMonths);

    // Días: se filtran por el año y mes seleccionados
    const filteredByMonth = selectedDate.month ? filteredByYear.filter(d => (d.getMonth() + 1).toString().padStart(2, '0') === selectedDate.month) : filteredByYear;
    const uniqueDays = Array.from(new Set(filteredByMonth.map(d => d.getDate().toString().padStart(2, '0')))).sort();
    setDays(uniqueDays);

  }, [options, selectedDate]);


  // Cierra el menú si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Limpia toda la selección de fecha
  const handleClear = () => {
    onChange({ year: null, month: null, day: null });
    setIsOpen(false);
  };

  const hasFilter = selectedDate.year || selectedDate.month || selectedDate.day;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`icon-button secondary small ${hasFilter ? 'active' : ''}`}
        title={`Filtrar por ${columnName}`}
      >
        <Filter size={14} />
      </button>

      {isOpen && (
        <div className="dropdown-menu card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem', minWidth: '250px' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Filtrar por {columnName}</p>
          <select
            value={selectedDate.year ?? ''}
            onChange={e => onChange({ year: e.target.value || null, month: null, day: null })}
          >
            <option value="">Cualquier Año</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={selectedDate.month ?? ''}
            onChange={e => onChange({ ...selectedDate, month: e.target.value || null, day: null })}
            disabled={!selectedDate.year} // Se activa solo si se ha seleccionado un año
          >
            <option value="">Cualquier Mes</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={selectedDate.day ?? ''}
            onChange={e => onChange({ ...selectedDate, day: e.target.value || null })}
            disabled={!selectedDate.month} // Se activa solo si se ha seleccionado un mes
          >
            <option value="">Cualquier Día</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <hr style={{ margin: '4px 0'}} />
          <button onClick={handleClear} className="secondary small" disabled={!hasFilter}>
            Limpiar filtro
          </button>
        </div>
      )}
    </div>
  );
}