import { useState, useEffect, useRef } from 'react';
import { Filter } from 'lucide-react';
import { createPortal } from 'react-dom';

export type DateParts = {
  year: string | null;
  month: string | null;
  day: string | null;
};

type Props = {
  columnName: string;
  options: Date[];
  selectedDate: DateParts;
  onChange: (selected: DateParts) => void;
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

export default function DateFilterDropdown({ columnName, options, selectedDate, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    const uniqueYears = Array.from(new Set(options.map(d => d.getFullYear().toString()))).sort((a, b) => Number(b) - Number(a));
    setYears(uniqueYears);

    const filteredByYear = selectedDate.year ? options.filter(d => d.getFullYear().toString() === selectedDate.year) : options;
    const uniqueMonths = Array.from(new Set(filteredByYear.map(d => (d.getMonth() + 1).toString().padStart(2, '0')))).sort();
    setMonths(uniqueMonths);

    const filteredByMonth = selectedDate.month ? filteredByYear.filter(d => (d.getMonth() + 1).toString().padStart(2, '0') === selectedDate.month) : filteredByYear;
    const uniqueDays = Array.from(new Set(filteredByMonth.map(d => d.getDate().toString().padStart(2, '0')))).sort();
    setDays(uniqueDays);
  }, [options, selectedDate]);

  useOnClickOutside(menuRef, () => setIsOpen(false));

  const handleClear = () => {
    onChange({ year: null, month: null, day: null });
    setIsOpen(false);
  };

  const hasFilter = selectedDate.year || selectedDate.month || selectedDate.day;

  const getMenuPosition = () => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: `${rect.bottom + window.scrollY + 4}px`,
      right: `${window.innerWidth - rect.right - window.scrollX}px`,
      position: 'absolute' as React.CSSProperties['position'],
    };
  };

  return (
    <div className="relative inline-block ml-2">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-8 h-8 rounded-md flex items-center justify-center
          transition-all duration-150
          ${hasFilter
            ? 'bg-fenix-500/20 text-fenix-400'
            : 'text-gray-400 hover:text-white hover:bg-bg-intermediate'}
          cursor-pointer
        `}
        title={`Filtrar por ${columnName}`}
      >
        <Filter size={14} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="glass-card p-4 min-w-[220px] animate-slide-down"
          style={{ ...getMenuPosition(), zIndex: 1050 }}
        >
          <p className="text-sm font-medium text-white mb-3">Filtrar por {columnName}</p>

          <div className="space-y-3">
            {/* Año */}
            <select
              value={selectedDate.year ?? ''}
              onChange={e => onChange({ year: e.target.value || null, month: null, day: null })}
              className="glass-input text-sm"
            >
              <option value="">Cualquier Año</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {/* Mes */}
            <select
              value={selectedDate.month ?? ''}
              onChange={e => onChange({ ...selectedDate, month: e.target.value || null, day: null })}
              disabled={!selectedDate.year}
              className="glass-input text-sm disabled:opacity-50"
            >
              <option value="">Cualquier Mes</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {/* Día */}
            <select
              value={selectedDate.day ?? ''}
              onChange={e => onChange({ ...selectedDate, day: e.target.value || null })}
              disabled={!selectedDate.month}
              className="glass-input text-sm disabled:opacity-50"
            >
              <option value="">Cualquier Día</option>
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <hr className="my-3 border-bg-intermediate" />

          <button
            onClick={handleClear}
            className="btn-secondary w-full text-sm py-2"
            disabled={!hasFilter}
          >
            Limpiar filtro
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}