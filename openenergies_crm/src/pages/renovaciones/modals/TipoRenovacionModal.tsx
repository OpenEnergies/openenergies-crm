// src/pages/renovaciones/modals/TipoRenovacionModal.tsx
// Modal Paso 2: Tipo de renovación (con fechas o pendiente de fecha)
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from '@lib/utils';
import ConfirmationModal from '@components/ConfirmationModal';
import type { ContratoRenovacion } from '@hooks/useRenovaciones';

interface ComercializadoraOption {
  id: string;
  nombre: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (type: 'fechas' | 'pendiente', data: {
    fechaActivacion?: string;
    fechaRenovacion?: string;
    nombreCarpeta?: string;
  }) => Promise<void>;
  selectedContratos: ContratoRenovacion[];
  comercializadoraId: string | null;
  keepSameComercializadora: boolean;
  comercializadoras: ComercializadoraOption[];
  isProcessing: boolean;
}

export default function TipoRenovacionModal({
  isOpen,
  onClose,
  onBack,
  onConfirm,
  selectedContratos,
  comercializadoraId,
  keepSameComercializadora,
  comercializadoras,
  isProcessing,
}: Props) {
  // Tipo de renovación: 'fechas' o 'pendiente'
  const [tipoRenovacion, setTipoRenovacion] = useState<'fechas' | 'pendiente'>('fechas');

  // Campos para fechas
  const [fechaActivacion, setFechaActivacion] = useState('');
  const [fechaRenovacion, setFechaRenovacion] = useState('');

  // Campos para pendiente
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [nombreCarpetaError, setNombreCarpetaError] = useState('');

  // Confirmación
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Obtener nombre de comercializadora
  const comercializadoraNombre = useMemo(() => {
    if (keepSameComercializadora) {
      // Mostrar "múltiples" o el nombre si solo hay una comercializadora única
      const uniqueComercializadoras = new Set(
        selectedContratos.map(c => c.comercializadoras?.nombre).filter(Boolean)
      );
      if (uniqueComercializadoras.size === 1) {
        return Array.from(uniqueComercializadoras)[0];
      }
      return 'comercializadora actual de cada contrato';
    }
    const comercializadora = comercializadoras.find(c => c.id === comercializadoraId);
    return comercializadora?.nombre || 'Desconocida';
  }, [keepSameComercializadora, comercializadoraId, comercializadoras, selectedContratos]);

  // Validaciones
  const canFinishFechas = fechaActivacion && fechaRenovacion;
  const canFinishPendiente = nombreCarpeta.trim().length > 0 && !nombreCarpetaError;

  const handleNombreCarpetaChange = (value: string) => {
    setNombreCarpeta(value);
    // Validación básica de caracteres
    if (value.trim() && !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s_-]+$/.test(value.trim())) {
      setNombreCarpetaError('Solo letras, números, espacios, guiones y guiones bajos');
    } else {
      setNombreCarpetaError('');
    }
  };

  const handleSubmit = () => {
    setShowConfirmation(true);
  };

  const handleConfirmAction = async () => {
    setShowConfirmation(false);
    if (tipoRenovacion === 'fechas') {
      await onConfirm('fechas', { fechaActivacion, fechaRenovacion });
    } else {
      await onConfirm('pendiente', { nombreCarpeta: nombreCarpeta.trim() });
    }
  };

  // Mensaje de confirmación
  const confirmationMessage = useMemo(() => {
    const count = selectedContratos.length;
    if (tipoRenovacion === 'fechas') {
      return `Vas a renovar ${count} contrato${count !== 1 ? 's' : ''} a ${comercializadoraNombre} con fecha de activación ${fechaActivacion} y fecha de renovación ${fechaRenovacion}.`;
    } else {
      return `Vas a renovar ${count} contrato${count !== 1 ? 's' : ''} a ${comercializadoraNombre} pendientes de fecha, almacenados como "${nombreCarpeta.trim()}".`;
    }
  }, [tipoRenovacion, selectedContratos.length, comercializadoraNombre, fechaActivacion, fechaRenovacion, nombreCarpeta]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-modal w-full max-w-lg p-0 animate-slide-up shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary/10">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
              title="Volver"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h3 className="text-lg font-bold text-primary">Tipo de Renovación</h3>
              <p className="text-sm text-secondary">{selectedContratos.length} contrato{selectedContratos.length !== 1 ? 's' : ''} • {comercializadoraNombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Option 1: Agregar fechas ahora */}
          <div
            className={clsx(
              'rounded-xl border-2 transition-all',
              tipoRenovacion === 'fechas'
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-primary/20'
            )}
          >
            <label
              className="flex items-start gap-4 p-4 cursor-pointer"
            >
              <input
                type="radio"
                name="tipo-renovacion"
                checked={tipoRenovacion === 'fechas'}
                onChange={() => setTipoRenovacion('fechas')}
                className="hidden"
              />
              <div className={clsx(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5',
                tipoRenovacion === 'fechas'
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-primary/40'
              )}>
                {tipoRenovacion === 'fechas' && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={18} className="text-emerald-500" />
                  <p className="font-bold text-primary">Agregar fechas ahora</p>
                </div>
                <p className="text-sm text-secondary opacity-70 mb-3">
                  Completa la renovación asignando las fechas de activación y renovación
                </p>
              </div>
            </label>

            {tipoRenovacion === 'fechas' && (
              <div className="px-4 pb-4 pt-0 pl-14 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
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
            )}
          </div>

          {/* Option 2: Agregar fechas más tarde */}
          <div
            className={clsx(
              'rounded-xl border-2 transition-all',
              tipoRenovacion === 'pendiente'
                ? 'border-amber-500 bg-amber-500/5'
                : 'border-primary/20'
            )}
          >
            <label
              className="flex items-start gap-4 p-4 cursor-pointer"
            >
              <input
                type="radio"
                name="tipo-renovacion"
                checked={tipoRenovacion === 'pendiente'}
                onChange={() => setTipoRenovacion('pendiente')}
                className="hidden"
              />
              <div className={clsx(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5',
                tipoRenovacion === 'pendiente'
                  ? 'border-amber-500 bg-amber-500'
                  : 'border-primary/40'
              )}>
                {tipoRenovacion === 'pendiente' && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={18} className="text-amber-500" />
                  <p className="font-bold text-primary">Agregar fechas más tarde</p>
                </div>
                <p className="text-sm text-secondary opacity-70 mb-3">
                  Los contratos quedarán pendientes de fecha en una carpeta para completar después
                </p>
              </div>
            </label>

            {tipoRenovacion === 'pendiente' && (
              <div className="px-4 pb-4 pt-0 pl-14 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Nombre de la carpeta
                  </label>
                  <input
                    type="text"
                    value={nombreCarpeta}
                    onChange={(e) => handleNombreCarpetaChange(e.target.value)}
                    placeholder="Ej: Renovaciones Febrero 2026"
                    className={clsx(
                      'glass-input w-full',
                      nombreCarpetaError && 'border-red-500 focus:border-red-500'
                    )}
                  />
                  {nombreCarpetaError && (
                    <p className="flex items-center gap-1 mt-1 text-xs text-red-500">
                      <AlertCircle size={12} />
                      {nombreCarpetaError}
                    </p>
                  )}
                  <p className="text-xs text-secondary opacity-70 mt-1">
                    Este nombre debe ser único. Podrás encontrar estos contratos en "Pendientes de fecha".
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 bg-bg-intermediate/30 border-t border-primary/10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isProcessing ||
              (tipoRenovacion === 'fechas' && !canFinishFechas) ||
              (tipoRenovacion === 'pendiente' && !canFinishPendiente)
            }
            className={clsx(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all cursor-pointer',
              (tipoRenovacion === 'fechas' ? canFinishFechas : canFinishPendiente) && !isProcessing
                ? 'bg-fenix-500 hover:bg-fenix-400 text-white shadow-lg shadow-fenix-500/25'
                : 'bg-bg-intermediate text-secondary cursor-not-allowed opacity-50'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Procesando...
              </>
            ) : (
              tipoRenovacion === 'fechas' ? 'Finalizar' : 'Terminar'
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmAction}
        title="Confirmar Renovación"
        message={confirmationMessage}
        confirmText="Confirmar"
        cancelText="Cancelar"
        confirmButtonClass="primary"
        isConfirming={isProcessing}
      />
    </div>,
    document.body
  );
}
