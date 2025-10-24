// src/pages/renovaciones/DaysInputPrompt.tsx
import { useState } from 'react';
import { toast } from 'react-hot-toast';

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
    // Se renderiza como una tarjeta normal, centrada en el área de contenido
    <div className="card" style={{ maxWidth: '500px', margin: '2rem auto 0' }}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ marginTop: 0 }}>Consultar Próximas Renovaciones</h3>
        <p style={{ color: 'var(--muted)' }}>
          Introduce el número de días en el futuro para consultar los contratos
          que vencen en ese periodo.
        </p>
        
        <div style={{ margin: '1.5rem 0' }}>
          <label htmlFor="days">Próximos (días)</label>
          <input
            id="days"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
            style={{ textAlign: 'center', fontSize: '1.2rem' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="submit">
            Consultar
          </button>
        </div>
      </form>
    </div>
  );
}