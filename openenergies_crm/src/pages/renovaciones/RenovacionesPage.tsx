// src/pages/renovaciones/RenovacionesPage.tsx
import { useState, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import DaysInputPrompt from './DaysInputPrompt';
import RenovacionesList from './RenovacionesList';

export default function RenovacionesPage() {
  const [daysToQuery, setDaysToQuery] = useState<number | null>(null);

  const locationKey = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setDaysToQuery(null);
  }, [locationKey]);

  const handleModalSubmit = (days: number) => {
    setDaysToQuery(days);
  };

  const handleResetQuery = () => {
    setDaysToQuery(null);
  };

  return (
    <div className="space-y-6">
      {!daysToQuery && <DaysInputPrompt onSubmit={handleModalSubmit} />}
      {daysToQuery && (
        <RenovacionesList
          daysToExpiry={daysToQuery}
          onReset={handleResetQuery}
        />
      )}
    </div>
  );
}

