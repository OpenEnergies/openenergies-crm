// src/pages/contratos/ContratosList.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react'; // Added React import for standard practice
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import {
  Trash2, BadgePlus, XCircle, Edit, X, ExternalLink,
  Calendar, Sun, CheckCircle, Circle, AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, FileText
} from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { Pagination } from '@components/Pagination';
import { toast } from 'react-hot-toast';
import { fmtDate, clsx } from '@lib/utils';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { useSortableTable } from '@hooks/useSortableTable';
import { useTheme } from '@hooks/ThemeContext';
import ExportButton from '@components/ExportButton';

// ============ TIPOS Y CONSTANTES ============
type EstadoContrato =
  | 'Aceptado' | 'En curso' | 'Bloqueado' | 'Pendiente Doc.'
  | 'Pendiente firma' | 'Firmado' | 'Contratado'
  | 'Pendiente renovacion' | 'Baja' | 'Standby' | 'Desiste';

type EstadoFotovoltaica =
  | 'Pendiente de instalar' | 'Activa' | 'Pendiente de activar' | 'Duda' | 'No';

const ESTADOS_CONTRATO: EstadoContrato[] = [
  'Aceptado', 'En curso', 'Bloqueado', 'Pendiente Doc.',
  'Pendiente firma', 'Firmado', 'Contratado',
  'Pendiente renovacion', 'Baja', 'Standby', 'Desiste'
];

const ESTADOS_FOTOVOLTAICA: EstadoFotovoltaica[] = [
  'Pendiente de instalar', 'Activa', 'Pendiente de activar', 'Duda', 'No'
];

interface ContratoExtendido {
  id: string;
  punto_id: string;
  comercializadora_id: string;
  canal_id: string | null;
  estado: EstadoContrato;
  numero_cuenta: string | null;
  fotovoltaica: EstadoFotovoltaica | null;
  cobrado: boolean;
  permanencia: boolean;
  fecha_permanencia: string | null;
  fecha_aceptacion: string | null;
  fecha_firma: string | null;
  fecha_activacion: string | null;
  fecha_renovacion: string | null;
  fecha_baja: string | null;
  aviso_renovacion: boolean;
  fecha_aviso: string | null;
  creado_en: string | null;
  puntos_suministro: {
    id: string;
    cups: string;
    direccion_sum: string | null;
    tarifa: string | null;
    consumo_anual_kwh: number | null;
    clientes: { id: string; nombre: string; } | null;
  } | null;
  comercializadoras: { id: string; nombre: string; } | null;
  canales: { id: string; nombre: string; } | null;
}

const ITEMS_PER_PAGE = 50;

const initialColumnFilters = {
  estado: [] as string[],
  fotovoltaica: [] as string[],
  cobrado: [] as string[],
  fecha_renovacion: { year: null, month: null, day: null } as DateParts,
};

// ============ FETCH ============
async function fetchContratos(filter: string, clienteId?: string, empresaId?: string): Promise<ContratoExtendido[]> {
  let query = supabase
    .from('contratos')
    .select(`
      *,
      puntos_suministro!inner (
        id,
        cups,
        direccion_sum,
        tarifa,
        consumo_anual_kwh,
        clientes ( id, nombre )
      ),
      comercializadoras:empresas!contratos_comercializadora_id_fkey ( id, nombre ),
      canales ( id, nombre )
    `)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });


  if (clienteId) {
    query = query.eq('puntos_suministro.cliente_id', clienteId);
  }

  if (empresaId) {
    query = query.eq('comercializadora_id', empresaId); // Filter by comercializadora (empresa)
  }

  query = query.range(0, 99999);
  const { data, error } = await query;
  if (error) throw error;

  // Filtro de búsqueda en el cliente (filtra por CUPS, nombre cliente y comercializadora)
  if (filter && filter.trim()) {
    const searchTerm = filter.toLowerCase().trim();
    return (data as ContratoExtendido[] || []).filter(contrato => {
      const cups = contrato.puntos_suministro?.cups?.toLowerCase() || '';
      const clienteNombre = contrato.puntos_suministro?.clientes?.nombre?.toLowerCase() || '';
      const comercializadoraNombre = contrato.comercializadoras?.nombre?.toLowerCase() || '';
      const direccion = contrato.puntos_suministro?.direccion_sum?.toLowerCase() || '';

      return cups.includes(searchTerm) ||
        clienteNombre.includes(searchTerm) ||
        comercializadoraNombre.includes(searchTerm) ||
        direccion.includes(searchTerm);
    });
  }

  return (data as ContratoExtendido[]) || [];
}

// ============ HELPERS DE COLOR ============
const getEstadoColorClass = (estado: EstadoContrato) => {
  const map: Record<EstadoContrato, string> = {
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

const getFVColorClass = (estado: string) => {
  const map: Record<string, string> = {
    'Pendiente de instalar': 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    'Activa': 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    'Pendiente de activar': 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30',
    'Duda': 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30',
    'No': 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20',
  };
  return map[estado] || 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20';
};

// ============ MODAL DETALLE CONTRATO ============
interface ContratoModalProps {
  contrato: ContratoExtendido;
  onClose: () => void;
}

function ContratoDetailModal({ contrato, onClose }: ContratoModalProps) {
  const { theme } = useTheme();

  // Border color for section separators: green in dark mode, gray in light mode
  const sectionBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const cliente = contrato.puntos_suministro?.clientes;
  const punto = contrato.puntos_suministro;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: `2px solid ${sectionBorderColor}` }}>
          <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400">Detalle del Contrato</h3>
          <button
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            onClick={onClose}
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

            {/* Columna Izquierda - Info Principal */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-2">Información General</h4>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Cliente</span>
                {cliente ? (
                  <span className="text-primary font-bold">
                    {cliente.nombre}
                  </span>
                ) : <span className="text-secondary opacity-50">—</span>}
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">CUPS</span>
                {punto ? (
                  <code className="text-sm bg-bg-intermediate px-1.5 py-0.5 rounded text-primary font-mono font-bold w-fit border border-primary/20">
                    {punto.cups}
                  </code>
                ) : <span className="text-secondary opacity-50">—</span>}
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Dirección</span>
                <span className="text-primary font-bold">{punto?.direccion_sum || '—'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Comercializadora</span>
                {contrato.comercializadoras ? (
                  <span className="text-primary font-bold">
                    {contrato.comercializadoras.nombre}
                  </span>
                ) : <span className="text-secondary opacity-50">—</span>}
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Canal</span>
                <span className="text-primary font-bold">{contrato.canales?.nombre || '—'}</span>
              </div>
            </div>

            {/* Columna Derecha - Estado y Detalles */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-2">Estado y Servicios</h4>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Estado</span>
                <div>
                  <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${getEstadoColorClass(contrato.estado)}`}>
                    {contrato.estado}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Fotovoltaica</span>
                <div>
                  <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${getFVColorClass(contrato.fotovoltaica || 'No')}`}>
                    {contrato.fotovoltaica || '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Cobrado</span>
                <div>
                  {contrato.cobrado ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle size={12} /> Sí
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-bg-intermediate text-secondary border border-primary/20">
                      <Circle size={12} /> No
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Tarifa</span>
                <span className="font-mono text-primary font-bold bg-bg-intermediate px-2 py-0.5 rounded w-fit border border-primary/20">{punto?.tarifa || '—'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1">Consumo anual</span>
                <span className="text-primary font-bold">{punto?.consumo_anual_kwh?.toLocaleString() || '—'} kWh</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: `2px solid ${sectionBorderColor}` }}>
            <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar size={16} /> Fechas Importantes
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Aceptación</span>
                <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_aceptacion)}</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Firma</span>
                <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_firma)}</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Activación</span>
                <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_activacion)}</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Renovación</span>
                <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_renovacion)}</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Baja</span>
                <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_baja)}</span>
              </div>
            </div>

            {(contrato.permanencia || contrato.aviso_renovacion) && (
              <div className="mt-4 pt-4 grid grid-cols-2 gap-4" style={{ borderTop: `1px solid ${sectionBorderColor}` }}>
                {contrato.permanencia && (
                  <div>
                    <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Permanencia hasta</span>
                    <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_permanencia)}</span>
                  </div>
                )}
                {contrato.aviso_renovacion && (
                  <div>
                    <span className="block text-xs text-secondary font-medium uppercase tracking-wider flex items-center gap-1 mb-1">
                      <AlertCircle size={10} className="text-amber-500" /> Aviso renovación
                    </span>
                    <span className="text-sm text-primary font-bold">{fmtDate(contrato.fecha_aviso)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${sectionBorderColor}` }}>
              <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Creado el</span>
              <span className="text-sm text-primary font-bold opacity-70">{fmtDate(contrato.creado_en)}</span>
            </div>
          </div>
        </div>

        <div
          className="p-6 bg-bg-intermediate/30 flex items-center justify-end gap-3 rounded-b-2xl"
          style={{ borderTop: `2px solid ${sectionBorderColor}` }}
        >
          <Link to="/app/contratos/$id" params={{ id: contrato.id }}>
            <button className="px-6 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer">
              Editar contrato
            </button>
          </Link>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ DROPDOWN ESTADO INLINE ============
interface EstadoDropdownProps {
  contratoId: string;
  currentEstado: EstadoContrato;
  onUpdate: () => void;
}

function EstadoDropdown({ contratoId, currentEstado, onUpdate }: EstadoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Lock body scroll when dropdown is open
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
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleChange = async (nuevoEstado: EstadoContrato) => {
    if (nuevoEstado === currentEstado) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('contratos')
        .update({ estado: nuevoEstado })
        .eq('id', contratoId);

      if (error) throw error;
      toast.success('Estado actualizado');
      onUpdate();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
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
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        title="Click para cambiar estado"
      >
        {isUpdating ? '...' : currentEstado}
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

// ============ DROPDOWN FOTOVOLTAICA INLINE ============
interface FVDropdownProps {
  contratoId: string;
  currentFV: EstadoFotovoltaica | null;
  onUpdate: () => void;
}

function FVDropdown({ contratoId, currentFV, onUpdate }: FVDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Lock body scroll when dropdown is open
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
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleChange = async (nuevoFV: EstadoFotovoltaica) => {
    if (nuevoFV === currentFV) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('contratos')
        .update({ fotovoltaica: nuevoFV })
        .eq('id', contratoId);

      if (error) throw error;
      toast.success('FV actualizado');
      onUpdate();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity w-fit cursor-pointer ${getFVColorClass(currentFV || 'No')}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        title="Click para cambiar FV"
      >
        <Sun size={12} />
        {isUpdating ? '...' : (currentFV || 'No')}
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] w-52 bg-bg-primary border border-fenix-500/20 rounded-xl py-2 shadow-2xl animate-fade-in"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {ESTADOS_FOTOVOLTAICA.map(fv => (
              <button
                key={fv}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 cursor-pointer',
                  'hover:bg-bg-intermediate text-secondary hover:text-primary',
                  fv === currentFV ? 'font-bold bg-bg-intermediate/50 text-fenix-600 dark:text-fenix-400' : ''
                )}
                onClick={() => handleChange(fv)}
              >
                <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', getFVColorClass(fv).split(' ')[0])} />
                {fv}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ============ CHECKBOX COBRADO INLINE ============
interface CobradoCheckboxProps {
  contratoId: string;
  checked: boolean;
  onUpdate: () => void;
}

function CobradoCheckbox({ contratoId, checked, onUpdate }: CobradoCheckboxProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('contratos')
        .update({ cobrado: !checked })
        .eq('id', contratoId);

      if (error) throw error;
      toast.success(checked ? 'Marcado como no cobrado' : 'Marcado como cobrado');
      onUpdate();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <label className="cursor-pointer inline-flex items-center justify-center p-1 rounded hover:bg-bg-intermediate transition-colors" title={checked ? 'Cobrado' : 'No cobrado'}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={isUpdating}
        className="hidden"
      />
      {checked ? <CheckCircle size={18} className="text-emerald-500" /> : <Circle size={18} className="text-secondary opacity-40" />}
    </label>
  );
}

// ============ COMPONENTE PRINCIPAL ============
export default function ContratosList({ clienteId, empresaId, hideClienteColumn }: { clienteId?: string; empresaId?: string; hideClienteColumn?: boolean }) {
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContrato, setSelectedContrato] = useState<ContratoExtendido | null>(null);
  const queryClient = useQueryClient();
  const { rol } = useSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);
  const { theme } = useTheme();

  // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  const { data: fetchedData, isLoading, isError, refetch } = useQuery({
    queryKey: ['contratos', filter, clienteId, empresaId],
    queryFn: () => fetchContratos(filter, clienteId, empresaId),
  });

  const handleInlineUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['contratos'] });
  };

  // Opciones de filtro
  const filterOptions = useMemo(() => {
    if (!fetchedData) return initialColumnFilters;
    const getUnique = (key: keyof ContratoExtendido) =>
      Array.from(new Set(fetchedData.map(c => c[key]).filter(Boolean) as string[])).sort();
    const getUniqueDates = (key: keyof ContratoExtendido) =>
      fetchedData.map(c => c[key] ? new Date(c[key] as string) : null).filter(Boolean) as Date[];
    return {
      estado: getUnique('estado'),
      fotovoltaica: Array.from(new Set(fetchedData.map(c => c.fotovoltaica || 'No'))).sort(),
      cobrado: ['Sí', 'No'],
      fecha_renovacion: getUniqueDates('fecha_renovacion'),
    };
  }, [fetchedData]);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[] | DateParts) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
    setCurrentPage(1);
  };

  // Datos filtrados
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      const estado = item.estado ?? null;
      const fotovoltaica = item.fotovoltaica ?? 'No';
      const cobrado = item.cobrado ? 'Sí' : 'No';
      const renovacion = item.fecha_renovacion ? new Date(item.fecha_renovacion) : null;

      const checkDate = (date: Date | null, filter: DateParts) => {
        if (!date && (filter.year || filter.month || filter.day)) return false;
        if (!date) return true;
        if (filter.year && date.getFullYear().toString() !== filter.year) return false;
        if (filter.month && (date.getMonth() + 1).toString().padStart(2, '0') !== filter.month) return false;
        if (filter.day && date.getDate().toString().padStart(2, '0') !== filter.day) return false;
        return true;
      };

      return (
        (columnFilters.estado.length === 0 || columnFilters.estado.includes(estado)) &&
        (columnFilters.fotovoltaica.length === 0 || columnFilters.fotovoltaica.includes(fotovoltaica)) &&
        (columnFilters.cobrado.length === 0 || columnFilters.cobrado.includes(cobrado)) &&
        checkDate(renovacion, columnFilters.fecha_renovacion)
      );
    });
  }, [fetchedData, columnFilters]);

  // Paginación
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Ordenamiento
  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
  } = useSortableTable<ContratoExtendido>(paginatedData, {
    initialSortKey: 'creado_en',
    initialSortDirection: 'desc',
    sortValueAccessors: {
      punto_id: (item: ContratoExtendido) => item.puntos_suministro?.clientes?.nombre,
      estado: (item: ContratoExtendido) => item.estado,
      comercializadora_id: (item: ContratoExtendido) => item.comercializadoras?.nombre,
      fotovoltaica: (item: ContratoExtendido) => item.fotovoltaica,
      cobrado: (item: ContratoExtendido) => item.cobrado ? 1 : 0,
      fecha_renovacion: (item: ContratoExtendido) => item.fecha_renovacion ? new Date(item.fecha_renovacion) : null,
    }
  });

  // Mutación eliminar (soft delete)
  const deleteContratoMutation = useMutation({
    mutationFn: async (contratoIds: string[]) => {
      const { error } = await supabase
        .from('contratos')
        .update({ eliminado_en: new Date().toISOString() })
        .in('id', contratoIds);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.length} contrato(s) eliminado(s).`);
      setIdsToDelete([]);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
      setIdsToDelete([]);
    },
  });

  const isFiltered = filter.length > 0 ||
    columnFilters.estado.length > 0 ||
    columnFilters.fotovoltaica.length > 0 ||
    columnFilters.cobrado.length > 0 ||
    columnFilters.fecha_renovacion.year !== null;

  const canCreate = rol === 'administrador' || rol === 'comercial';
  const canEdit = rol === 'administrador' || rol === 'comercial';
  const canDelete = rol === 'administrador';

  // Selección
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const isAllSelected = displayedData.length > 0 && selectedIds.length === displayedData.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedData.length;

  const handleDeleteSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToDelete([...selectedIds]);
    }
  };

  const totalItems = filteredData.length;

  const isDetailView = !!(clienteId || empresaId);

  return (
    <div className={isDetailView ? "animate-fade-in" : "flex flex-col gap-6 animate-fade-in"}>
      {/* Encabezado GLOBAL */}
      {!isDetailView && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {!clienteId && !empresaId ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Contratos</h1>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-3">
                <FileText className="text-fenix-500" />
                Contratos
                <span className="text-sm font-normal text-secondary bg-bg-intermediate px-2 py-0.5 rounded-full border border-primary/20">
                  {filteredData.length}
                </span>
              </h2>
              <ExportButton
                entity="contratos"
                preFilters={{
                  cliente_id: clienteId,
                  comercializadora_id: empresaId,
                  search: filter
                }}
                label="Exportar"
              />
            </div>
          )}

          <div className={`flex items-center gap-3 ${clienteId ? 'w-full justify-between' : 'w-full sm:w-auto'}`}>
            {selectedIds.length > 0 ? (
              /* Selection action bar - compact inline style */
              <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
                <span className="text-sm text-fenix-400 font-medium">
                  {selectedIds.length} seleccionado(s)
                </span>
                <div className="flex items-center gap-1 ml-2">
                  {selectedIds.length === 1 && canEdit && selectedIds[0] && (
                    <Link
                      to="/app/contratos/$id"
                      params={{ id: selectedIds[0] }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                      title="Editar Contrato"
                    >
                      <Edit size={16} />
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title={`Eliminar ${selectedIds.length} contrato(s)`}
                      onClick={handleDeleteSelected}
                      disabled={deleteContratoMutation.isPending}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                    title="Cancelar selección"
                    onClick={() => setSelectedIds([])}
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!clienteId && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <Search size={16} />
                        Buscar
                      </label>
                      <input
                        type="text"
                        placeholder="CUPS o comercializadora..."
                        className="glass-input w-64"
                        value={filter}
                        onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
                      />
                    </div>
                    <ExportButton
                      exportParams={{
                        entity: 'contratos',
                        filters: {
                          search: filter || undefined,
                          cliente_id: clienteId,
                          estado: columnFilters.estado.length > 0 ? columnFilters.estado : undefined,
                          fotovoltaica: columnFilters.fotovoltaica.length > 0 ? columnFilters.fotovoltaica : undefined,
                          cobrado: columnFilters.cobrado.length > 0 ? columnFilters.cobrado.map(v => v === 'Sí' ? 'true' : 'false') : undefined,
                        },
                      }}
                    />
                    {canCreate && (
                      <Link to="/app/contratos/nuevo">
                        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                          <BadgePlus size={18} />
                          <span className="hidden sm:inline">Nuevo Contrato</span>
                        </button>
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Estados de carga / error */}
      {isLoading && !isDetailView && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="animate-spin text-fenix-500"><Sun size={32} /></div>
          <p className="ml-3 text-gray-400 font-medium">Cargando contratos...</p>
        </div>
      )}

      {isError && (
        <div className="glass-card p-6 bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400 font-medium">
          <p>Error al cargar contratos. Por favor intenta de nuevo.</p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {/* Integrated Header for Detail View */}
        {isDetailView && (
          <div className="p-6 border-b border-bg-intermediate">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-fenix-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500">Contratos</h2>
                  <p className="text-sm text-gray-400">
                    {totalItems} contratos encontrados
                  </p>
                </div>
              </div>

              {/* Right: Search + Export */}
              <div className={`flex items-center gap-3 ${selectedIds.length > 0 ? 'w-full justify-between md:justify-end md:w-auto' : 'w-full md:w-auto'}`}>
                {selectedIds.length > 0 ? (
                  /* Selection action bar - compact inline style */
                  <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2 w-full md:w-auto justify-between md:justify-start">
                    <span className="text-sm text-fenix-400 font-medium">
                      {selectedIds.length} seleccionado(s)
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      {selectedIds.length === 1 && canEdit && selectedIds[0] && (
                        <Link
                          to="/app/contratos/$id"
                          params={{ id: selectedIds[0] }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                          title="Editar Contrato"
                        >
                          <Edit size={16} />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title={`Eliminar ${selectedIds.length} contrato(s)`}
                          onClick={handleDeleteSelected}
                          disabled={deleteContratoMutation.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                        title="Cancelar selección"
                        onClick={() => setSelectedIds([])}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-1 md:flex-initial">
                      <label className="flex items-center gap-2 text-sm font-medium text-fenix-600 dark:text-fenix-400 whitespace-nowrap">
                        <Search size={16} />
                        Buscar
                      </label>
                      <input
                        placeholder="Nº Contrato, CUPS..."
                        value={filter}
                        onChange={e => { setFilter(e.target.value); setCurrentPage(1); }}
                        className="glass-input w-full md:w-64"
                      />
                    </div>
                    <ExportButton
                      entity="contratos"
                      preFilters={{
                        cliente_id: clienteId,
                        comercializadora_id: empresaId,
                        search: filter
                      }}
                      label="Exportar"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Estados vacíos */}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState
            title="Sin contratos"
            description="Aún no hay contratos registrados."
            cta={canCreate ? (
              <Link to="/app/contratos/nuevo">
                <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all duration-200 cursor-pointer">
                  <BadgePlus size={18} />
                  Crear el primero
                </button>
              </Link>
            ) : null}
          />
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
          <div className="p-12 text-center text-secondary">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-intermediate mx-auto border border-primary/20">
              <ExternalLink size={32} className="opacity-40" />
            </div>
            <p className="font-medium">Este cliente no tiene contratos asignados.</p>
          </div>
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && displayedData.length === 0 && isFiltered && (
          <div className="p-12 text-center text-secondary">
            <Search size={32} className="mx-auto mb-4 opacity-40" />
            <p className="font-medium">No se encontraron contratos que coincidan con los filtros.</p>
            <button onClick={() => { setFilter(''); setColumnFilters(initialColumnFilters); }} className="mt-4 text-fenix-600 dark:text-fourth font-bold hover:underline cursor-pointer">
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Tabla */}
        {!isLoading && !isError && displayedData && displayedData.length > 0 && (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                  style={{ borderBottomColor: tableBorderColor }}
                >
                  <th className="p-4 w-10 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                      aria-label="Seleccionar todos"
                      className="w-5 h-5 rounded-full border-2 border-slate-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                    />
                  </th>
                  {!hideClienteColumn && (
                    <th className="p-4 text-left">
                      <button onClick={() => handleSort('cliente' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                        Cliente {renderSortIcon('cliente' as any)}
                      </button>
                    </th>
                  )}
                  <th className="p-4 text-left">
                    <button onClick={() => handleSort('cups' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                      CUPS {renderSortIcon('cups' as any)}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('estado')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                        Estado {renderSortIcon('estado')}
                      </button>
                      <ColumnFilterDropdown
                        columnName="Estado"
                        options={filterOptions.estado}
                        selectedOptions={columnFilters.estado}
                        onChange={(selected) => handleColumnFilterChange('estado', selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="p-4 text-left">
                    <button onClick={() => handleSort('comercializadoras' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                      Comercializadora {renderSortIcon('comercializadoras' as any)}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('fotovoltaica')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                        FV {renderSortIcon('fotovoltaica')}
                      </button>
                      <ColumnFilterDropdown
                        columnName="Fotovoltaica"
                        options={filterOptions.fotovoltaica}
                        selectedOptions={columnFilters.fotovoltaica}
                        onChange={(selected) => handleColumnFilterChange('fotovoltaica', selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleSort('cobrado')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                        Cobrado {renderSortIcon('cobrado')}
                      </button>
                      <ColumnFilterDropdown
                        columnName="Cobrado"
                        options={filterOptions.cobrado}
                        selectedOptions={columnFilters.cobrado}
                        onChange={(selected) => handleColumnFilterChange('cobrado', selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="p-4 text-left">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('fecha_renovacion')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                        Renovación {renderSortIcon('fecha_renovacion')}
                      </button>
                      <DateFilterDropdown
                        columnName="Renovación"
                        options={filterOptions.fecha_renovacion as Date[]}
                        selectedDate={columnFilters.fecha_renovacion}
                        onChange={(selected) => handleColumnFilterChange('fecha_renovacion', selected)}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map(c => {
                  const isSelected = selectedIds.includes(c.id);
                  return (
                    <tr key={c.id} className={clsx('hover:bg-fenix-500/8 transition-colors', isSelected && 'bg-fenix-500/15 hover:bg-fenix-500/20')}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(c.id)}
                          aria-label={`Seleccionar contrato ${c.id}`}
                          className="w-5 h-5 rounded-full border-2 border-primary bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      {!hideClienteColumn && (
                        <td className="p-4">
                          {c.puntos_suministro?.clientes ? (
                            <Link
                              to="/app/clientes/$id"
                              params={{ id: c.puntos_suministro.clientes.id }}
                              className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors"
                              title={c.puntos_suministro.clientes.nombre}
                            >
                              {c.puntos_suministro.clientes.nombre}
                            </Link>
                          ) : (
                            <span className="text-secondary opacity-60">—</span>
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        <Link
                          to="/app/puntos/$id"
                          params={{ id: c.punto_id }}
                          className="font-bold text-fenix-600 dark:text-fourth hover:underline text-left transition-colors font-mono text-sm"
                          title="Ver detalle del punto"
                        >
                          {c.puntos_suministro?.cups ?? '—'}
                        </Link>
                      </td>
                      <td className="p-4">
                        <EstadoDropdown
                          contratoId={c.id}
                          currentEstado={c.estado}
                          onUpdate={handleInlineUpdate}
                        />
                      </td>
                      <td className="p-4">
                        <span className="text-secondary font-medium text-sm truncate max-w-[150px] inline-block" title={c.comercializadoras?.nombre}>
                          {c.comercializadoras?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="p-4">
                        <FVDropdown
                          contratoId={c.id}
                          currentFV={c.fotovoltaica}
                          onUpdate={handleInlineUpdate}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <CobradoCheckbox
                          contratoId={c.id}
                          checked={c.cobrado}
                          onUpdate={handleInlineUpdate}
                        />
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {c.fecha_renovacion ? (
                          <span className={clsx(
                            'text-sm font-bold',
                            new Date(c.fecha_renovacion) < new Date() ? 'text-red-500' : 'text-secondary',
                          )}>
                            {fmtDate(c.fecha_renovacion)}
                            {c.aviso_renovacion && <span className="ml-1 text-xs text-amber-500 inline-block font-normal animate-pulse" title="Aviso activo">⚠️</span>}
                          </span>
                        ) : <span className="text-secondary opacity-40">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!isLoading && !isError && totalPages > 1 && (
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4"
            style={{ borderTop: `2px solid ${tableBorderColor}` }}
          >
            <div className="text-sm text-secondary">
              Total: <span className="text-primary font-medium">{filteredData.length}</span> registros •
              Página <span className="text-primary font-medium">{currentPage}</span> de <span className="text-primary font-medium">{totalPages || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || isLoading}
                title="Primera página"
              >
                <ChevronsLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                title="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
                title="Página siguiente"
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages || isLoading}
                title="Última página"
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {selectedContrato && (
        <ContratoDetailModal
          contrato={selectedContrato}
          onClose={() => setSelectedContrato(null)}
        />
      )}

      {/* Modal confirmación eliminar */}
      <ConfirmationModal
        isOpen={idsToDelete.length > 0}
        onClose={() => setIdsToDelete([])}
        onConfirm={() => { deleteContratoMutation.mutate(idsToDelete); }}
        title={`Confirmar Eliminación (${idsToDelete.length})`}
        message={
          idsToDelete.length === 1
            ? '¿Estás seguro de que quieres eliminar el contrato seleccionado?'
            : `¿Estás seguro de que quieres eliminar los ${idsToDelete.length} contratos seleccionados?`
        }
        confirmText={`Sí, Eliminar ${idsToDelete.length}`}
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={deleteContratoMutation.isPending}
      />
    </div>
  );
}

