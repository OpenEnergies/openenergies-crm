// src/pages/renovaciones/RenovacionesPage.tsx
// Página principal de renovaciones con flujo completo
import { useState, useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import DaysInputPrompt from './DaysInputPrompt';
import RenovacionesSelectionView from './RenovacionesSelectionView';
import PendientesFechaView from './PendientesFechaView';
import { Clock } from 'lucide-react';

type ViewMode = 'prompt' | 'renovaciones' | 'pendientes';

export default function RenovacionesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('prompt');
  const [daysToQuery, setDaysToQuery] = useState<number | null>(null);

  const locationKey = useRouterState({ select: (s) => s.location.pathname });

  // Reset cuando cambiamos de ruta
  useEffect(() => {
    setViewMode('prompt');
    setDaysToQuery(null);
  }, [locationKey]);

  const handleDaysSubmit = (days: number) => {
    setDaysToQuery(days);
    setViewMode('renovaciones');
  };

  const handleReset = () => {
    setViewMode('prompt');
    setDaysToQuery(null);
  };

  const handleShowPendientes = () => {
    setViewMode('pendientes');
  };

  const handleBackFromPendientes = () => {
    if (daysToQuery) {
      setViewMode('renovaciones');
    } else {
      setViewMode('prompt');
    }
  };

  return (
    <div className="space-y-6">
      {viewMode === 'prompt' && (
        <div className="space-y-6">
          <DaysInputPrompt onSubmit={handleDaysSubmit} />
          
          {/* Botón para acceder a Pendientes de Fecha */}
          <div className="max-w-md mx-auto">
            <button
              onClick={handleShowPendientes}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl glass-card hover:bg-bg-intermediate transition-all cursor-pointer border-2 border-dashed border-amber-500/30 hover:border-amber-500/50"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-primary">Pendientes de fecha</p>
                <p className="text-sm text-secondary opacity-70">Ver contratos con renovación pendiente de fecha</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'renovaciones' && daysToQuery && (
        <RenovacionesSelectionView
          daysToExpiry={daysToQuery}
          onReset={handleReset}
          onShowPendientes={handleShowPendientes}
        />
      )}

      {viewMode === 'pendientes' && (
        <PendientesFechaView onBack={handleBackFromPendientes} />
      )}
    </div>
  );
}

