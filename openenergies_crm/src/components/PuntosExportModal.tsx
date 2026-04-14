import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, Loader2, X, Check, Building2, MapPin, BriefcaseBusiness } from 'lucide-react';
import MultiSearchableSelect from '@components/MultiSearchableSelect';
import { usePuntosExportFilters } from '@hooks/usePuntosExportFilters';
import { useExportPuntos, type PuntosExportFormat } from '@hooks/useExportPuntos';
import type { PuntosExportScope } from '@hooks/puntosExportScope';

interface PuntosExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: PuntosExportFormat;
  scope?: PuntosExportScope;
}

const TARGET_PROGRESS_MS = 10000;

function normalizeForSearch(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s\W_]+/g, '');
}

export default function PuntosExportModal({ isOpen, onClose, format, scope }: PuntosExportModalProps) {
  const { exportPuntos, isExporting } = useExportPuntos();
  const {
    rol,
    canSelectClientes,
    selectedCarteraIds,
    setSelectedCarteraIds,
    carteraOptions,
    selectedClienteIds,
    setSelectedClienteIds,
    clienteOptions,
    selectedPuntoIds,
    setSelectedPuntoIds,
    puntoOptions,
    selectedPuntos,
    isInitializingFilters,
  } = usePuntosExportFilters(isOpen, scope);

  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [carteraSearchTerm, setCarteraSearchTerm] = useState('');
  const [puntoSearchTerm, setPuntoSearchTerm] = useState('');
  const [exportPhase, setExportPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CIRCUMFERENCE = 2 * Math.PI * 40;

  useEffect(() => {
    if (isOpen) {
      setExportPhase('idle');
      setProgress(0);
      setCarteraSearchTerm('');
      setClienteSearchTerm('');
      setPuntoSearchTerm('');
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (exportPhase !== 'loading') return;

    const startedAt = Date.now();
    progressRef.current = 0;
    setProgress(0);

    const step = () => {
      const elapsed = Date.now() - startedAt;

      if (elapsed >= TARGET_PROGRESS_MS) {
        progressRef.current = 97;
        setProgress(97);
        return;
      }

      const remainingTime = Math.max(200, TARGET_PROGRESS_MS - elapsed);
      const remainingProgress = Math.max(1, 97 - progressRef.current);

      // Keep the previous visual style: irregular, random jumps.
      const roughStepsLeft = Math.max(4, Math.round(remainingTime / 240));
      const baseJump = remainingProgress / roughStepsLeft;
      const jitter = 0.6 + Math.random() * 0.9;
      const increment = Math.max(2, Math.round(baseJump * jitter));

      const next = Math.min(97, progressRef.current + increment);
      progressRef.current = next;
      setProgress(next);

      if (next < 97) {
        const baseDelay = Math.max(90, Math.min(420, remainingTime / roughStepsLeft));
        const delay = Math.max(80, Math.round(baseDelay + (Math.random() - 0.5) * 120));
        timerRef.current = setTimeout(step, delay);
      }
    };

    timerRef.current = setTimeout(step, 120);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [exportPhase]);

  const filteredClienteOptions = useMemo(() => {
    const normalizedTerm = normalizeForSearch(clienteSearchTerm);
    if (!normalizedTerm) return [];

    return clienteOptions
      .filter((option) => normalizeForSearch(option.label).includes(normalizedTerm))
      .map((option) => ({
        value: option.id,
        label: option.label,
      }));
  }, [clienteOptions, clienteSearchTerm]);

  const filteredCarteraOptions = useMemo(() => {
    const normalizedTerm = normalizeForSearch(carteraSearchTerm);
    if (!normalizedTerm) return [];

    return carteraOptions
      .filter((option) => normalizeForSearch(option.label).includes(normalizedTerm))
      .map((option) => ({
        value: option.id,
        label: option.label,
      }));
  }, [carteraOptions, carteraSearchTerm]);

  const filteredPuntoOptions = useMemo(() => {
    const normalizedTerm = normalizeForSearch(puntoSearchTerm);
    if (!normalizedTerm) return [];

    return puntoOptions
      .filter((option) => {
        const haystack = [option.label, option.subtitle].filter(Boolean).join(' ');
        return normalizeForSearch(haystack).includes(normalizedTerm);
      })
      .map((option) => ({
        value: option.id,
        label: option.label,
        subtitle: option.subtitle,
      }));
  }, [puntoOptions, puntoSearchTerm]);

  const formatLabel = format === 'xlsx' ? 'Excel' : 'CSV';

  const handleExport = async () => {
    setExportPhase('loading');

    const success = await exportPuntos({
      format,
      rol,
      puntos: selectedPuntos,
    });

    if (timerRef.current) clearTimeout(timerRef.current);

    if (success) {
      setProgress(100);
      setExportPhase('done');
      setTimeout(() => onClose(), 1800);
    } else {
      setProgress(0);
      setExportPhase('idle');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={exportPhase === 'idle' ? onClose : undefined}
    >
      <div
        className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20 bg-bg-primary/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center text-fenix-500">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400">Exportar {formatLabel}</h3>
              <p className="text-xs text-secondary font-medium uppercase tracking-wider">Puntos de suministro</p>
            </div>
          </div>
          {exportPhase === 'idle' && (
            <button
              onClick={onClose}
              className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {exportPhase !== 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6 bg-bg-primary/30">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-bg-intermediate" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="stroke-fenix-500"
                  style={{
                    strokeDasharray: CIRCUMFERENCE,
                    strokeDashoffset: CIRCUMFERENCE * (1 - progress / 100),
                    transition: exportPhase === 'done' ? 'stroke-dashoffset 0.7s ease-out' : 'stroke-dashoffset 0.5s ease-out',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {exportPhase === 'done' ? (
                  <Check size={36} className="text-fenix-500" strokeWidth={3} />
                ) : (
                  <span className="text-2xl font-bold text-fenix-500">{progress}%</span>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-primary">
                {exportPhase === 'done' ? 'Archivo descargado' : `Generando archivo ${formatLabel}...`}
              </p>
              {exportPhase === 'loading' && <p className="text-xs text-secondary mt-1">Esto puede tardar unos segundos</p>}
            </div>
          </div>
        )}

        {exportPhase === 'idle' && (
          <div className="relative p-6 overflow-y-auto custom-scrollbar bg-bg-primary/30 space-y-5">
            {isInitializingFilters && (
              <div className="absolute inset-0 z-10 bg-bg-primary/70 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                  <Loader2 size={14} className="animate-spin" />
                  Cargando filtros...
                </div>
              </div>
            )}

            <fieldset disabled={isInitializingFilters || isExporting} className={isInitializingFilters ? 'opacity-60' : ''}>
              <div className="space-y-4">
                {canSelectClientes && (
                  <div className="space-y-1">
                    <MultiSearchableSelect
                      label="Carteras de clientes"
                      icon={<BriefcaseBusiness size={14} />}
                      options={filteredCarteraOptions}
                      selectedValues={selectedCarteraIds}
                      onChange={(values) => setSelectedCarteraIds(values || [])}
                      onSearch={setCarteraSearchTerm}
                      allLabel="Seleccionar todas"
                      placeholder="Escribe para buscar carteras..."
                      showChips={false}
                      clearBehavior="search"
                    />
                    <p className="text-xs text-secondary">
                      {selectedCarteraIds.length === 0
                        ? 'Sin selección manual: se tendrán en cuenta todas las carteras disponibles.'
                        : `Carteras seleccionadas: ${selectedCarteraIds.length}`}
                    </p>
                    {carteraSearchTerm.trim().length === 0 && (
                      <p className="text-xs text-secondary/70">Escribe al menos 1 caracter para activar la búsqueda.</p>
                    )}
                  </div>
                )}

                {canSelectClientes && (
                  <div className="space-y-1">
                    <MultiSearchableSelect
                      label="Sociedades"
                      icon={<Building2 size={14} />}
                      options={filteredClienteOptions}
                      selectedValues={selectedClienteIds}
                      onChange={(values) => setSelectedClienteIds(values || [])}
                      onSearch={setClienteSearchTerm}
                      allLabel="Seleccionar todas"
                      placeholder="Escribe para buscar sociedades..."
                      showChips={false}
                      clearBehavior="search"
                    />
                    <p className="text-xs text-secondary">
                      {selectedClienteIds.length === 0
                        ? 'Sin selección manual: se exportarán todas las sociedades disponibles.'
                        : `Sociedades seleccionadas: ${selectedClienteIds.length}`}
                    </p>
                    {clienteSearchTerm.trim().length === 0 && (
                      <p className="text-xs text-secondary/70">Escribe al menos 1 caracter para activar la búsqueda.</p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <MultiSearchableSelect
                    label="Puntos de suministro"
                    icon={<MapPin size={14} />}
                    options={filteredPuntoOptions}
                    selectedValues={selectedPuntoIds}
                    onChange={(values) => setSelectedPuntoIds(values || [])}
                    onSearch={setPuntoSearchTerm}
                    allLabel="Seleccionar todos"
                    placeholder="Escribe CUPS, direccion, provincia o localidad..."
                    showChips={false}
                    clearBehavior="search"
                  />
                  <p className="text-xs text-secondary">
                    {selectedPuntoIds.length === 0
                      ? 'Sin selección manual: se exportarán todos los puntos del alcance actual.'
                      : `Puntos seleccionados: ${selectedPuntoIds.length}`}
                  </p>
                  {puntoSearchTerm.trim().length === 0 && (
                    <p className="text-xs text-secondary/70">Escribe al menos 1 caracter para activar la búsqueda.</p>
                  )}
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {exportPhase === 'idle' && (
          <div className="p-5 border-t border-fenix-500/20 flex items-center justify-end gap-3 bg-bg-intermediate/30">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
            >
              Cancelar
            </button>
            <button
              onClick={handleExport}
              disabled={isInitializingFilters || isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-400 disabled:bg-fenix-500/50 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer"
            >
              <Download size={18} />
              Exportar
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
