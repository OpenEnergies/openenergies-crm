// src/pages/renovaciones/DaysInputPrompt.tsx
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { CalendarClock } from 'lucide-react';

interface Props {
  onSubmit: (days: number) => void;
}

// Este componente reemplaza al antiguo DaysInputModal
// No tiene 'modal-overlay', por lo que no bloqueará la página.
export default function DaysInputPrompt({ onSubmit }: Props) {
  const [days, setDays] = useState('90'); // Valor por defecto

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
    // Se renderiza como una tarjeta normal, centrada
    <div className="card renovation-prompt-card" style={{ maxWidth: '450px', margin: '3rem auto 0' }}> {/* Clase específica y más margen superior */}
      <form onSubmit={handleSubmit}>
        {/* --- 👇 2. Título con icono --- */}
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
          <CalendarClock size={24} style={{ color: 'var(--primary)' }} />
          Próximas Renovaciones
        </h3>
        {/* --------------------------- */}
        <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: '2rem' }}> {/* Texto centrado y más margen inferior */}
          ¿Cuántos días hacia adelante quieres consultar?
        </p>

        {/* --- 👇 3. Input destacado --- */}
        <div style={{ margin: '1rem 0 2rem' }}> {/* Ajuste de márgenes */}
          <label htmlFor="days" style={{ textAlign: 'center', display: 'block', marginBottom: '0.5rem', color: 'var(--muted)'}}>Días a consultar</label>
          <input
            id="days"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
            min="1" // Añadimos mínimo
            // Estilos para hacerlo más prominente
            style={{
                textAlign: 'center',
                fontSize: '2rem', // Más grande
                fontWeight: 'bold',
                padding: '0.8rem', // Más padding
                borderWidth: '2px', // Borde más grueso
                borderColor: 'var(--border-color)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)', // Sombra interior
             }}
          />
        </div>
        {/* ------------------------- */}

        {/* --- 👇 4. Botón principal y centrado --- */}
        <div style={{ display: 'flex', justifyContent: 'center' }}> {/* Botón centrado */}
          <button type="submit" className="renovation-submit-button" style={{ padding: '0.8rem 1.5rem', fontSize: '1rem' }}> {/* Clase y estilo */}
            Consultar Renovaciones
          </button>
        </div>
        {/* ------------------------------------ */}
      </form>
    </div>
  );
}
