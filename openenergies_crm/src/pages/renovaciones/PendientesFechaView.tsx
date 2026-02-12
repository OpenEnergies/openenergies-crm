// src/pages/renovaciones/PendientesFechaView.tsx
// Vista de contratos pendientes de fecha de renovación
import { useState, useMemo } from 'react';
import { 
  Clock, Folder, FolderOpen, ArrowLeft, Check, X, 
  Calendar, Search, Loader2, ChevronRight 
} from 'lucide-react';
import { useTheme } from '@hooks/ThemeContext';
import { useRenovaciones, type ContratoRenovacion, type CarpetaRenovacion } from '@hooks/useRenovaciones';
import { fmtDate, clsx } from '@lib/utils';
import ConfirmationModal from '@components/ConfirmationModal';

interface Props {
  onBack: () => void;
}

type ViewState = 'carpetas' | 'detalle';

export default function PendientesFechaView({ onBack }: Props) {
  const { theme } = useTheme();
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  // View state
  const [viewState, setViewState] = useState<ViewState>('carpetas');
  const [selectedCarpeta, setSelectedCarpeta] = useState<string | null>(null);

  // Selection state (for carpetas or individual contracts)
  const [selectedCarpetas, setSelectedCarpetas] = useState<Set<string>>(new Set());
  const [selectedContratosIds, setSelectedContratosIds] = useState<Set<string>>(new Set());

  // Form state for completing renovation
  const [fechaActivacion, setFechaActivacion] = useState('');
  const [fechaRenovacion, setFechaRenovacion] = useState('');
  const [showDateForm, setShowDateForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Hook
  const {
    contratosPendientes,
    isLoadingPendientes,
    isErrorPendientes,
    carpetas,
    isLoadingCarpetas,
    completarRenovacion,
    isCompletando,
    refetch,
  } = useRenovaciones(0); // 0 days since we're looking at pending ones

  // Contracts for selected carpeta
  const contratosEnCarpeta = useMemo(() => {
    if (!selectedCarpeta) return [];
    return contratosPendientes.filter(
      c => c.nombre_carpeta_renovacion_pendiente_fecha === selectedCarpeta
    );
  }, [contratosPendientes, selectedCarpeta]);

  // Handlers for carpetas view
  const handleSelectCarpeta = (nombre: string) => {
    const newSet = new Set(selectedCarpetas);
    if (newSet.has(nombre)) {
      newSet.delete(nombre);
    } else {
      newSet.add(nombre);
    }
    setSelectedCarpetas(newSet);
  };

  const handleSelectAllCarpetas = () => {
    if (selectedCarpetas.size === carpetas.length) {
      setSelectedCarpetas(new Set());
    } else {
      setSelectedCarpetas(new Set(carpetas.map(c => c.nombre_carpeta)));
    }
  };

  const handleOpenCarpeta = (nombre: string) => {
    setSelectedCarpeta(nombre);
    setViewState('detalle');
    setSelectedContratosIds(new Set());
  };

  // Handlers for detalle view
  const handleSelectContrato = (id: string) => {
    const newSet = new Set(selectedContratosIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedContratosIds(newSet);
  };

  const handleSelectAllContratos = () => {
    if (selectedContratosIds.size === contratosEnCarpeta.length) {
      setSelectedContratosIds(new Set());
    } else {
      setSelectedContratosIds(new Set(contratosEnCarpeta.map(c => c.id)));
    }
  };

  const handleBackToCarpetas = () => {
    setViewState('carpetas');
    setSelectedCarpeta(null);
    setSelectedContratosIds(new Set());
    setShowDateForm(false);
  };

  // Continue to date form
  const handleContinue = () => {
    setShowDateForm(true);
  };

  const handleCancelDateForm = () => {
    setShowDateForm(false);
    setFechaActivacion('');
    setFechaRenovacion('');
  };

  // Confirm completion
  const handleSubmit = () => {
    setShowConfirmation(true);
  };

  const handleConfirmComplete = async () => {
    setShowConfirmation(false);
    
    try {
      // Get contract IDs to complete
      let contratoIds: string[] = [];
      
      if (viewState === 'detalle') {
        // Complete selected contracts from carpeta
        contratoIds = Array.from(selectedContratosIds);
      } else {
        // Complete all contracts from selected carpetas
        contratoIds = contratosPendientes
          .filter(c => selectedCarpetas.has(c.nombre_carpeta_renovacion_pendiente_fecha!))
          .map(c => c.id);
      }

      await completarRenovacion({
        contratoIds,
        fechaActivacion,
        fechaRenovacion,
      });

      // Reset state
      setShowDateForm(false);
      setFechaActivacion('');
      setFechaRenovacion('');
      setSelectedCarpetas(new Set());
      setSelectedContratosIds(new Set());
      
      // If we completed all in a carpeta, go back to carpetas view
      if (viewState === 'detalle' && contratosEnCarpeta.length === selectedContratosIds.size) {
        handleBackToCarpetas();
      }
      
      refetch();
    } catch (error) {
      console.error('Error al completar renovación:', error);
    }
  };

  // Count selected
  const selectedCount = viewState === 'carpetas' 
    ? contratosPendientes.filter(c => selectedCarpetas.has(c.nombre_carpeta_renovacion_pendiente_fecha!)).length
    : selectedContratosIds.size;

  const hasSelection = viewState === 'carpetas' ? selectedCarpetas.size > 0 : selectedContratosIds.size > 0;
  const canComplete = hasSelection && fechaActivacion && fechaRenovacion;

  // Confirmation message
  const confirmationMessage = `Vas a completar la renovación de ${selectedCount} contrato${selectedCount !== 1 ? 's' : ''} con fecha de activación ${fechaActivacion} y fecha de renovación ${fechaRenovacion}.`;

  // Empty state
  if (!isLoadingCarpetas && !isLoadingPendientes && carpetas.length === 0) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-fenix-600 dark:text-emerald-400 flex items-center gap-2">
              <Clock size={24} className="text-amber-500" />
              Pendientes de Fecha
            </h2>
          </div>
        </div>

        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 bg-bg-intermediate rounded-full flex items-center justify-center mx-auto mb-4">
            <Folder className="w-8 h-8 text-secondary opacity-50" />
          </div>
          <p className="text-lg font-bold text-primary mb-1">No hay contratos pendientes de fecha</p>
          <p className="text-secondary opacity-70">
            Cuando marques contratos como pendientes de fecha, aparecerán aquí organizados por carpeta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={viewState === 'detalle' ? handleBackToCarpetas : onBack}
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-fenix-600 dark:text-emerald-400 flex items-center gap-2">
              <Clock size={24} className="text-amber-500" />
              {viewState === 'carpetas' ? 'Pendientes de Fecha' : selectedCarpeta}
            </h2>
            <p className="text-secondary opacity-70">
              {viewState === 'carpetas' 
                ? `${carpetas.length} carpeta${carpetas.length !== 1 ? 's' : ''} con contratos pendientes`
                : `${contratosEnCarpeta.length} contrato${contratosEnCarpeta.length !== 1 ? 's' : ''} en esta carpeta`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Selection bar or Date form */}
      {showDateForm ? (
        <div className="glass-card p-6 border-2 border-emerald-500/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Fecha de Activación
                </label>
                <input
                  type="date"
                  value={fechaActivacion}
                  onChange={(e) => setFechaActivacion(e.target.value)}
                  className="glass-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Fecha de Renovación
                </label>
                <input
                  type="date"
                  value={fechaRenovacion}
                  onChange={(e) => setFechaRenovacion(e.target.value)}
                  className="glass-input w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelDateForm}
                className="px-4 py-2.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canComplete || isCompletando}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all cursor-pointer',
                  canComplete && !isCompletando
                    ? 'bg-fenix-500 hover:bg-fenix-400 text-white shadow-lg shadow-fenix-500/25'
                    : 'bg-bg-intermediate text-secondary cursor-not-allowed opacity-50'
                )}
              >
                {isCompletando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  `Completar ${selectedCount} contrato${selectedCount !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      ) : hasSelection && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 border-2 border-emerald-500/30">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-emerald-500">
              {selectedCount} contrato{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => viewState === 'carpetas' ? setSelectedCarpetas(new Set()) : setSelectedContratosIds(new Set())}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X size={18} />
              Cancelar selección
            </button>
          </div>
          <button
            onClick={handleContinue}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer"
          >
            Continuar
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="glass-card overflow-hidden">
        {(isLoadingCarpetas || isLoadingPendientes) && (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin text-fenix-500 mr-3"><Clock size={24} /></div>
            <span className="text-secondary font-medium">Cargando...</span>
          </div>
        )}

        {(isErrorPendientes) && (
          <div role="alert" className="p-8 text-center text-red-500">
            Error al cargar datos.
          </div>
        )}

        {/* Carpetas view */}
        {viewState === 'carpetas' && !isLoadingCarpetas && carpetas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead
                className="text-xs text-primary uppercase bg-bg-intermediate border-b-2"
                style={{ borderBottomColor: tableBorderColor }}
              >
                <tr>
                  <th className="px-4 py-3 w-12">
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCarpetas.size === carpetas.length && carpetas.length > 0}
                        onChange={handleSelectAllCarpetas}
                        className="hidden"
                      />
                      <div className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        selectedCarpetas.size === carpetas.length && carpetas.length > 0
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-primary/40 hover:border-emerald-500'
                      )}>
                        {selectedCarpetas.size === carpetas.length && carpetas.length > 0 && <Check size={14} className="text-white" />}
                      </div>
                    </label>
                  </th>
                  <th className="px-6 py-3 font-bold">Carpeta</th>
                  <th className="px-6 py-3 font-bold">Contratos</th>
                  <th className="px-6 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {carpetas.map((carpeta) => (
                  <tr 
                    key={carpeta.nombre_carpeta} 
                    className={clsx(
                      'hover:bg-bg-intermediate transition-colors',
                      selectedCarpetas.has(carpeta.nombre_carpeta) && 'bg-emerald-500/5'
                    )}
                  >
                    <td className="px-4 py-4">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCarpetas.has(carpeta.nombre_carpeta)}
                          onChange={() => handleSelectCarpeta(carpeta.nombre_carpeta)}
                          className="hidden"
                        />
                        <div className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          selectedCarpetas.has(carpeta.nombre_carpeta)
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-primary/40 hover:border-emerald-500'
                        )}>
                          {selectedCarpetas.has(carpeta.nombre_carpeta) && <Check size={14} className="text-white" />}
                        </div>
                      </label>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <Folder size={20} className="text-amber-500" />
                        </div>
                        <span className="font-bold text-primary">{carpeta.nombre_carpeta}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-secondary bg-bg-intermediate px-2 py-1 rounded">
                        {carpeta.cantidad_contratos}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleOpenCarpeta(carpeta.nombre_carpeta)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-fenix-500 hover:bg-fenix-500/10 transition-colors cursor-pointer"
                      >
                        <FolderOpen size={16} />
                        Ver contratos
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalle view (contracts in carpeta) */}
        {viewState === 'detalle' && !isLoadingPendientes && contratosEnCarpeta.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead
                className="text-xs text-primary uppercase bg-bg-intermediate border-b-2"
                style={{ borderBottomColor: tableBorderColor }}
              >
                <tr>
                  <th className="px-4 py-3 w-12">
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContratosIds.size === contratosEnCarpeta.length && contratosEnCarpeta.length > 0}
                        onChange={handleSelectAllContratos}
                        className="hidden"
                      />
                      <div className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        selectedContratosIds.size === contratosEnCarpeta.length && contratosEnCarpeta.length > 0
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-primary/40 hover:border-emerald-500'
                      )}>
                        {selectedContratosIds.size === contratosEnCarpeta.length && contratosEnCarpeta.length > 0 && <Check size={14} className="text-white" />}
                      </div>
                    </label>
                  </th>
                  <th className="px-6 py-3 font-bold">Cliente</th>
                  <th className="px-6 py-3 font-bold">CUPS</th>
                  <th className="px-6 py-3 font-bold">Comercializadora</th>
                  <th className="px-6 py-3 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {contratosEnCarpeta.map((c) => (
                  <tr 
                    key={c.id} 
                    className={clsx(
                      'hover:bg-bg-intermediate transition-colors',
                      selectedContratosIds.has(c.id) && 'bg-emerald-500/5'
                    )}
                  >
                    <td className="px-4 py-4">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedContratosIds.has(c.id)}
                          onChange={() => handleSelectContrato(c.id)}
                          className="hidden"
                        />
                        <div className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          selectedContratosIds.has(c.id)
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-primary/40 hover:border-emerald-500'
                        )}>
                          {selectedContratosIds.has(c.id) && <Check size={14} className="text-white" />}
                        </div>
                      </label>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {c.puntos_suministro?.clientes?.nombre ?? '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-secondary">
                      {c.puntos_suministro?.cups
                        ? <span className="bg-bg-intermediate px-2 py-0.5 rounded text-xs">{c.puntos_suministro.cups}</span>
                        : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {c.comercializadoras?.nombre ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-secondary">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate">
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmComplete}
        title="Confirmar Renovación"
        message={confirmationMessage}
        confirmText="Confirmar"
        cancelText="Cancelar"
        confirmButtonClass="primary"
        isConfirming={isCompletando}
      />
    </div>
  );
}
