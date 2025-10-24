// src/pages/renovaciones/RenovacionesPage.tsx
import { useState, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
// --- ¡CAMBIO AQUÍ! ---
import DaysInputPrompt from './DaysInputPrompt'; // Importa el nuevo componente 'Prompt'
// --------------------
import RenovacionesList from './RenovacionesList';

export default function RenovacionesPage() {
  const [daysToQuery, setDaysToQuery] = useState<number | null>(null);
  
  const locationKey = useRouterState({ select: (s) => s.location.key });

  useEffect(() => {
    setDaysToQuery(null);
  }, [locationKey]);

  const handleModalSubmit = (days: number) => {
    setDaysToQuery(days);
  };
  
  const handleResetQuery = () => {
    setDaysToQuery(null);
  };

  // Añadimos un div wrapper (como en ClientesList) para que el contenido
  // se posicione correctamente.
  return (
    <div className="grid">
      {/* Si no hay días seleccionados, muestra el prompt */}
      {!daysToQuery && (
        // --- ¡CAMBIO AQUÍ! ---
        <DaysInputPrompt onSubmit={handleModalSubmit} /> // Usa el nuevo componente
        // --------------------
      )}

      {/* Si hay días seleccionados, muestra la lista */}
      {daysToQuery && (
        <RenovacionesList 
          daysToExpiry={daysToQuery}
          onReset={handleResetQuery} 
        />
      )}
    </div>
  );
}