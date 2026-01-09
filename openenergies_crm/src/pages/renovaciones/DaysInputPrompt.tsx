// src/pages/renovaciones/DaysInputPrompt.tsx
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { CalendarClock, Search } from 'lucide-react';

interface Props {
  onSubmit: (days: number) => void;
}

export default function DaysInputPrompt({ onSubmit }: Props) {
  const [days, setDays] = useState('90');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays <= 0) {
      toast.error('Por favor, introduce un número de días válido.');
      return;
    }
    onSubmit(numDays);
  };

  return (
    <div className="glass-card max-w-md mx-auto mt-12 p-8">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">
          Próximas Renovaciones
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
          ¿Cuántos días hacia adelante quieres consultar?
        </p>

        <div className="mb-6">
          <label htmlFor="days" className="block text-sm font-bold text-slate-600 dark:text-slate-400 text-center mb-2 uppercase tracking-tight">
            Días a consultar
          </label>
          <input
            id="days"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
            min="1"
            className="glass-input w-full text-center text-3xl font-bold py-4"
          />
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer"
          >
            <Search size={18} />
            Consultar Renovaciones
          </button>
        </div>
      </form>
    </div>
  );
}

