// src/pages/renovaciones/RenovacionesSelectionView.tsx
// Vista de selección de contratos para renovación
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CalendarClock, Search, CalendarCheck, RefreshCw, Clock, 
  ChevronDown, Check, X, ArrowRight 
} from 'lucide-react';
import { useTheme } from '@hooks/ThemeContext';
import { useRenovaciones, type ContratoRenovacion } from '@hooks/useRenovaciones';
import { fmtDate, clsx } from '@lib/utils';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import ComercializadoraModal from './modals/ComercializadoraModal';
import TipoRenovacionModal from './modals/TipoRenovacionModal';

// Estados de contrato
type EstadoContrato = 'Aceptado' | 'En curso' | 'Bloqueado' | 'Pendiente Doc.' | 'Pendiente firma' | 'Firmado' | 'Contratado' | 'Pendiente renovacion' | 'Baja' | 'Standby' | 'Desiste';

const ESTADOS_CONTRATO: EstadoContrato[] = [
  'Aceptado', 'En curso', 'Bloqueado', 'Pendiente Doc.',
  'Pendiente firma', 'Firmado', 'Contratado',
  'Pendiente renovacion', 'Baja', 'Standby', 'Desiste'
];

const getEstadoColorClass = (estado: string) => {
  const map: Record<string, string> = {
    'Aceptado': 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    'En curso': 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30',
    'Bloqueado': 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30',
    'Pendiente Doc.': 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    'Pendiente firma': 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    'Firmado': 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    'Contratado': 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30',
    'Pendiente renovacion': 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/30',
    'Baja': 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20',
    'Standby': 'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 dark:border-yellow-500/30',
    'Desiste': 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30',
  };
  return map[estado] || 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20';
};

interface Props {
  daysToExpiry: number;
  onReset: () => void;
  onShowPendientes: () => void;
}

export default function RenovacionesSelectionView({ daysToExpiry, onReset, onShowPendientes }: Props) {
  const { theme } = useTheme();
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  // Filters
  const [searchCups, setSearchCups] = useState('');
  const [filterCliente, setFilterCliente] = useState<string[]>([]);
  const [filterComercializadora, setFilterComercializadora] = useState<string[]>([]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showComercializadoraModal, setShowComercializadoraModal] = useState(false);
  const [showTipoRenovacionModal, setShowTipoRenovacionModal] = useState(false);
  const [selectedComercializadoraId, setSelectedComercializadoraId] = useState<string | null>(null);
  const [keepSameComercializadora, setKeepSameComercializadora] = useState(true);

  // Hook
  const {
    contratos,
    isLoadingContratos,
    isErrorContratos,
    comercializadoras,
    renovarConFechas,
    renovarPendienteFecha,
    isRenovando,
    isPendienteando,
    actualizarEstadoContrato,
    refetch,
  } = useRenovaciones(daysToExpiry);

  // Filter options
  const filterOptions = useMemo(() => {
    const clientes = Array.from(new Set(
      contratos.map(c => c.puntos_suministro?.clientes?.nombre).filter(Boolean)
    )) as string[];
    const comercializadorasNombres = Array.from(new Set(
      contratos.map(c => c.comercializadoras?.nombre).filter(Boolean)
    )) as string[];
    return { clientes, comercializadoras: comercializadorasNombres };
  }, [contratos]);

  // Filtered data
  const filteredData = useMemo(() => {
    return contratos.filter(c => {
      // Search by CUPS
      if (searchCups.trim()) {
        const cups = c.puntos_suministro?.cups?.toLowerCase() || '';
        if (!cups.includes(searchCups.toLowerCase().trim())) return false;
      }
      // Filter by cliente
      if (filterCliente.length > 0) {
        const clienteNombre = c.puntos_suministro?.clientes?.nombre || '';
        if (!filterCliente.includes(clienteNombre)) return false;
      }
      // Filter by comercializadora
      if (filterComercializadora.length > 0) {
        const comercializadoraNombre = c.comercializadoras?.nombre || '';
        if (!filterComercializadora.includes(comercializadoraNombre)) return false;
      }
      return true;
    });
  }, [contratos, searchCups, filterCliente, filterComercializadora]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
  };

  // Modal handlers
  const handleContinueClick = () => {
    setShowComercializadoraModal(true);
  };

  const handleComercializadoraConfirm = (comercializadoraId: string | null, keepSame: boolean) => {
    setSelectedComercializadoraId(comercializadoraId);
    setKeepSameComercializadora(keepSame);
    setShowComercializadoraModal(false);
    setShowTipoRenovacionModal(true);
  };

  const handleTipoRenovacionBack = () => {
    setShowTipoRenovacionModal(false);
    setShowComercializadoraModal(true);
  };

  const handleRenovacionComplete = async (type: 'fechas' | 'pendiente', data: {
    fechaActivacion?: string;
    fechaRenovacion?: string;
    nombreCarpeta?: string;
  }) => {
    const contratoIds = Array.from(selectedIds);
    
    // Determinar comercializadora para cada contrato
    // Si keepSameComercializadora, usamos la original de cada contrato
    // Si no, usamos selectedComercializadoraId para todos
    
    try {
      if (type === 'fechas' && data.fechaActivacion && data.fechaRenovacion) {
        // Si mantiene la misma comercializadora, renovamos cada contrato con su propia comercializadora
        if (keepSameComercializadora) {
          // Actualizar cada contrato individualmente manteniendo su comercializadora
          for (const id of contratoIds) {
            const contrato = contratos.find(c => c.id === id);
            if (contrato) {
              await renovarConFechas({
                contratoIds: [id],
                comercializadoraId: contrato.comercializadora_id,
                fechaActivacion: data.fechaActivacion!,
                fechaRenovacion: data.fechaRenovacion!,
              });
            }
          }
        } else {
          // Renovar todos con la nueva comercializadora
          await renovarConFechas({
            contratoIds,
            comercializadoraId: selectedComercializadoraId!,
            fechaActivacion: data.fechaActivacion,
            fechaRenovacion: data.fechaRenovacion,
          });
        }
      } else if (type === 'pendiente' && data.nombreCarpeta) {
        // Similar lógica para pendientes
        if (keepSameComercializadora) {
          // Agrupar por comercializadora
          const byComercializadora = new Map<string, string[]>();
          for (const id of contratoIds) {
            const contrato = contratos.find(c => c.id === id);
            if (contrato) {
              const existing = byComercializadora.get(contrato.comercializadora_id) || [];
              existing.push(id);
              byComercializadora.set(contrato.comercializadora_id, existing);
            }
          }
          // Crear carpeta para cada grupo (con sufijo si hay múltiples)
          let idx = 0;
          for (const [comercializadoraId, ids] of byComercializadora) {
            const suffix = byComercializadora.size > 1 ? `_${idx + 1}` : '';
            await renovarPendienteFecha({
              contratoIds: ids,
              comercializadoraId,
              nombreCarpeta: `${data.nombreCarpeta}${suffix}`,
            });
            idx++;
          }
        } else {
          await renovarPendienteFecha({
            contratoIds,
            comercializadoraId: selectedComercializadoraId!,
            nombreCarpeta: data.nombreCarpeta,
          });
        }
      }

      // Reset state
      setShowTipoRenovacionModal(false);
      setSelectedIds(new Set());
      setSelectedComercializadoraId(null);
      setKeepSameComercializadora(true);
      refetch();
    } catch (error) {
      console.error('Error en renovación:', error);
    }
  };

  const selectedContratos = useMemo(() => {
    return contratos.filter(c => selectedIds.has(c.id));
  }, [contratos, selectedIds]);

  const isAllSelected = filteredData.length > 0 && selectedIds.size === filteredData.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-fenix-600 dark:text-emerald-400 flex items-center gap-2">
            <RefreshCw size={24} className="text-fenix-600 dark:text-emerald-400" />
            Renovar Contratos
          </h2>
          <p className="text-secondary opacity-70">
            Contratos que vencen en los próximos <span className="font-bold text-fenix-600 dark:text-fenix-400">{daysToExpiry} días</span>.
            {hasSelection && (
              <span className="ml-2 text-emerald-500 font-bold">
                ({selectedIds.size} seleccionados)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search CUPS */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 whitespace-nowrap">
              <Search size={16} />
              CUPS
            </label>
            <input
              placeholder="Buscar CUPS..."
              value={searchCups}
              onChange={e => setSearchCups(e.target.value)}
              className="glass-input w-full sm:w-48"
            />
          </div>

          {/* Pendientes de fecha button */}
          <button
            onClick={onShowPendientes}
            className="p-2.5 rounded-lg text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors border border-amber-500/30 cursor-pointer flex items-center gap-2"
            title="Ver pendientes de fecha"
          >
            <Clock size={20} />
            <span className="hidden sm:inline text-sm font-medium">Pendientes</span>
          </button>

          {/* Reset days button */}
          <button
            onClick={onReset}
            className="p-2.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors border border-primary glass shadow-sm cursor-pointer"
            title="Cambiar filtro de días"
          >
            <CalendarCheck size={20} />
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {hasSelection && (
        <div className="glass-card p-4 flex items-center justify-between gap-4 border-2 border-emerald-500/30">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-emerald-500">
              {selectedIds.size} contrato{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleCancelSelection}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X size={18} />
              Cancelar selección
            </button>
          </div>
          <button
            onClick={handleContinueClick}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer"
          >
            Continuar
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoadingContratos && (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin text-fenix-500 mr-3"><CalendarClock size={24} /></div>
            <span className="text-secondary font-medium">Cargando contratos...</span>
          </div>
        )}

        {isErrorContratos && (
          <div role="alert" className="p-8 text-center text-red-500">
            Error al cargar contratos.
          </div>
        )}

        {!isLoadingContratos && !isErrorContratos && contratos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead
                className="text-xs text-primary uppercase bg-bg-intermediate border-b-2"
                style={{ borderBottomColor: tableBorderColor }}
              >
                <tr>
                  {/* Checkbox column */}
                  <th className="px-4 py-3 w-12">
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="hidden"
                      />
                      <div className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        isAllSelected 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-primary/40 hover:border-emerald-500'
                      )}>
                        {isAllSelected && <Check size={14} className="text-white" />}
                      </div>
                    </label>
                  </th>
                  <th className="px-6 py-3 font-bold">
                    <div className="flex items-center gap-2">
                      Cliente
                      <ColumnFilterDropdown
                        columnName="Cliente"
                        options={filterOptions.clientes}
                        selectedOptions={filterCliente}
                        onChange={(selected) => setFilterCliente(selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-bold">CUPS</th>
                  <th className="px-6 py-3 font-bold">
                    <div className="flex items-center gap-2">
                      Comercializadora
                      <ColumnFilterDropdown
                        columnName="Comercializadora"
                        options={filterOptions.comercializadoras}
                        selectedOptions={filterComercializadora}
                        onChange={(selected) => setFilterComercializadora(selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-bold">Estado</th>
                  <th className="px-6 py-3 font-bold">Fecha Renovación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {filteredData.map(c => (
                  <tr 
                    key={c.id} 
                    className={clsx(
                      'hover:bg-bg-intermediate transition-colors',
                      selectedIds.has(c.id) && 'bg-emerald-500/5'
                    )}
                  >
                    <td className="px-4 py-4">
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => handleSelectOne(c.id)}
                          className="hidden"
                        />
                        <div className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          selectedIds.has(c.id) 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-primary/40 hover:border-emerald-500'
                        )}>
                          {selectedIds.has(c.id) && <Check size={14} className="text-white" />}
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
                    <td className="px-6 py-4">
                      <EstadoDropdownInline
                        contratoId={c.id}
                        currentEstado={c.estado}
                        onUpdate={() => refetch()}
                        actualizarEstadoContrato={actualizarEstadoContrato}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {fmtDate(c.fecha_renovacion)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoadingContratos && filteredData.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-bg-intermediate rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-lg font-bold text-primary mb-1">No se encontraron contratos</p>
            <p className="text-secondary">
              No hay contratos que venzan en los próximos {daysToExpiry} días con los filtros actuales.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showComercializadoraModal && (
        <ComercializadoraModal
          isOpen={showComercializadoraModal}
          onClose={() => setShowComercializadoraModal(false)}
          onConfirm={handleComercializadoraConfirm}
          comercializadoras={comercializadoras}
          selectedCount={selectedIds.size}
        />
      )}

      {showTipoRenovacionModal && (
        <TipoRenovacionModal
          isOpen={showTipoRenovacionModal}
          onClose={() => {
            setShowTipoRenovacionModal(false);
            setSelectedComercializadoraId(null);
            setKeepSameComercializadora(true);
          }}
          onBack={handleTipoRenovacionBack}
          onConfirm={handleRenovacionComplete}
          selectedContratos={selectedContratos}
          comercializadoraId={selectedComercializadoraId}
          keepSameComercializadora={keepSameComercializadora}
          comercializadoras={comercializadoras}
          isProcessing={isRenovando || isPendienteando}
        />
      )}
    </div>
  );
}

// Inline Estado Dropdown Component
interface EstadoDropdownProps {
  contratoId: string;
  currentEstado: string;
  onUpdate: () => void;
  actualizarEstadoContrato: (contratoId: string, estado: string) => Promise<void>;
}

function EstadoDropdownInline({ contratoId, currentEstado, onUpdate, actualizarEstadoContrato }: EstadoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleChange = async (nuevoEstado: string) => {
    if (nuevoEstado === currentEstado) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await actualizarEstadoContrato(contratoId, nuevoEstado);
      onUpdate();
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity w-fit cursor-pointer ${getEstadoColorClass(currentEstado)}`}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        disabled={isUpdating}
        title="Click para cambiar estado"
      >
        {isUpdating ? '...' : currentEstado}
        <ChevronDown size={12} />
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] w-52 bg-bg-primary border border-fenix-500/20 rounded-xl py-2 shadow-2xl animate-fade-in max-h-60 overflow-y-auto custom-scrollbar"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {ESTADOS_CONTRATO.map(estado => (
              <button
                key={estado}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 cursor-pointer',
                  'hover:bg-bg-intermediate text-secondary hover:text-primary',
                  estado === currentEstado ? 'font-bold bg-bg-intermediate/50 text-fenix-600 dark:text-fenix-400' : ''
                )}
                onClick={() => handleChange(estado)}
              >
                <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', getEstadoColorClass(estado).split(' ')[0])} />
                {estado}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
