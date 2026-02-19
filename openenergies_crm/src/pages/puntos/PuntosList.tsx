// src/pages/puntos/PuntosList.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link, useNavigate } from '@tanstack/react-router';
import type { EstadoPunto, TipoFactura } from '@lib/types';
import { useTheme } from '@hooks/ThemeContext';
import { useSession } from '@hooks/useSession';
import {
  Trash2, MapPinPlus, XCircle, Edit, X, ExternalLink,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, MapPin, Layers, Plus
} from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';
import { clsx } from '@lib/utils';
import ExportButton from '@components/ExportButton';
import AgrupacionesGrid from '@components/agrupaciones/AgrupacionesGrid';
import CrearAgrupacionModal from '@components/agrupaciones/CrearAgrupacionModal';

// ============ TIPOS ============
interface PuntoConCliente {
  id: string;
  cliente_id: string;
  cups: string;
  estado: EstadoPunto;
  tarifa: string | null;
  consumo_anual_kwh: number | null;
  tipo_factura: TipoFactura | null;
  direccion_sum: string;
  localidad_sum: string | null;
  provincia_sum: string | null;
  direccion_fisc: string | null;
  localidad_fisc: string | null;
  provincia_fisc: string | null;
  direccion_post: string | null;
  localidad_post: string | null;
  provincia_post: string | null;
  p1_kw: number | null;
  p2_kw: number | null;
  p3_kw: number | null;
  p4_kw: number | null;
  p5_kw: number | null;
  p6_kw: number | null;
  tiene_fv: boolean | null;
  fv_compensacion: string | null;
  current_comercializadora_id: string | null;
  creado_en: string | null;
  // Relaciones
  clientes: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  comercializadora: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  asignaciones_comercial_punto: Array<{
    comercial_user_id: string;
    usuarios_app: { nombre: string; apellidos: string | null } | { nombre: string; apellidos: string | null }[] | null;
  }>;
}

const ESTADOS_PUNTO: EstadoPunto[] = [
  'Nueva Oportunidad',
  'Solicitar Doc.',
  'Doc. OK',
  'Estudio enviado',
  'Aceptado',
  'Permanencia',
  'Standby',
  'Desiste'
];

const ITEMS_PER_PAGE = 50;

const initialColumnFilters = {
  estado: [] as string[],
  tarifa: [] as string[],
};

// ============ FETCH FUNCTION ============
async function fetchPuntos(filter: string, clienteId?: string, empresaId?: string): Promise<PuntoConCliente[]> {
  let query = supabase
    .from('puntos_suministro')
    .select(`
      id,
      cliente_id,
      current_comercializadora_id,
      cups,
      estado,
      tarifa,
      consumo_anual_kwh,
      tipo_factura,
      direccion_sum,
      localidad_sum,
      provincia_sum,
      direccion_fisc,
      localidad_fisc,
      provincia_fisc,
      direccion_post,
      localidad_post,
      provincia_post,
      p1_kw,
      p2_kw,
      p3_kw,
      p4_kw,
      p5_kw,
      p6_kw,
      tiene_fv,
      fv_compensacion,
      current_comercializadora_id,
      creado_en,
      clientes (id, nombre),
      comercializadora:empresas!current_comercializadora_id (id, nombre),
      asignaciones_comercial_punto (
        comercial_user_id,
        usuarios_app (nombre, apellidos)
      )
    `)
    .is('eliminado_en', null)
    .order('creado_en', { ascending: false });

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }

  if (empresaId) {
    query = query.eq('current_comercializadora_id', empresaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filtro de búsqueda en el cliente (filtra por CUPS, dirección y nombre del cliente)
  if (filter && filter.trim()) {
    const searchTerm = filter.toLowerCase().trim();
    return (data || []).filter((punto: any) => {
      const cups = punto.cups?.toLowerCase() || '';
      const direccion = punto.direccion_sum?.toLowerCase() || '';
      const localidad = punto.localidad_sum?.toLowerCase() || '';
      const provincia = punto.provincia_sum?.toLowerCase() || '';
      const cliente = Array.isArray(punto.clientes)
        ? punto.clientes[0]?.nombre?.toLowerCase() || ''
        : punto.clientes?.nombre?.toLowerCase() || '';
      const comercializadora = Array.isArray(punto.comercializadora)
        ? punto.comercializadora[0]?.nombre?.toLowerCase() || ''
        : punto.comercializadora?.nombre?.toLowerCase() || '';

      return cups.includes(searchTerm) ||
        direccion.includes(searchTerm) ||
        localidad.includes(searchTerm) ||
        provincia.includes(searchTerm) ||
        cliente.includes(searchTerm) ||
        comercializadora.includes(searchTerm);
    }) as PuntoConCliente[];
  }

  return (data || []) as PuntoConCliente[];
}

// ============ HELPER COLOR ESTADO ============
const getEstadoColorClass = (estado: EstadoPunto) => {
  const map: Record<EstadoPunto, string> = {
    'Nueva Oportunidad': 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium',
    'Solicitar Doc.': 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium',
    'Doc. OK': 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium',
    'Estudio enviado': 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-medium',
    'Aceptado': 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 font-medium',
    'Permanencia': 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-medium',
    'Standby': 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 font-medium',
    'Desiste': 'bg-bg-intermediate text-secondary border border-primary font-medium',
  };
  return map[estado] || 'bg-bg-intermediate text-secondary border border-primary';
};

// ============ COMPONENTE MODAL CUPS ============
interface PuntoModalProps {
  punto: PuntoConCliente;
  onClose: () => void;
}

function PuntoDetailModal({ punto, onClose }: PuntoModalProps) {
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

  const potenciaTotal = [punto.p1_kw, punto.p2_kw, punto.p3_kw, punto.p4_kw, punto.p5_kw, punto.p6_kw]
    .filter(p => p != null)
    .reduce((sum, p) => sum + (p || 0), 0);

  const comercialesAsignados = punto.asignaciones_comercial_punto
    ?.map(a => {
      const user = Array.isArray(a.usuarios_app) ? a.usuarios_app[0] : a.usuarios_app;
      return user ? `${user.nombre} ${user.apellidos || ''}`.trim() : null;
    })
    .filter(Boolean)
    .join(', ') || 'Ninguno';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: `2px solid ${sectionBorderColor}` }}>
          <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <MapPin className="text-fenix-500" /> Detalle del Punto de Suministro
          </h3>
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
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Cliente</span>
                {punto.clientes && Array.isArray(punto.clientes) && punto.clientes[0] ? (
                  <span className="text-primary font-bold">
                    {punto.clientes[0].nombre}
                  </span>
                ) : (punto.clientes && !Array.isArray(punto.clientes) && (punto.clientes as any).nombre) ? (
                  <span className="text-primary font-bold">
                    {(punto.clientes as any).nombre}
                  </span>
                ) : <span className="text-secondary opacity-50">—</span>}
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Comercializadora</span>
                {punto.comercializadora && Array.isArray(punto.comercializadora) && punto.comercializadora[0] ? (
                  <span className="text-primary text-sm">
                    {punto.comercializadora[0].nombre}
                  </span>
                ) : (punto.comercializadora && !Array.isArray(punto.comercializadora) && (punto.comercializadora as any).nombre) ? (
                  <span className="text-primary text-sm">
                    {(punto.comercializadora as any).nombre}
                  </span>
                ) : <span className="text-secondary opacity-50">—</span>}
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">CUPS</span>
                <code className="text-sm bg-bg-intermediate px-1.5 py-0.5 rounded text-primary font-mono font-bold">{punto.cups}</code>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Comerciales asignados</span>
                <span className="text-primary text-sm">{comercialesAsignados}</span>
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Tarifa</span>
                <span className="text-primary font-bold">{punto.tarifa || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Potencia Total</span>
                <span className="text-primary font-bold">{potenciaTotal.toFixed(2)} kW</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Consumo Anual</span>
                <span className="text-primary font-bold">{punto.consumo_anual_kwh?.toLocaleString() || '—'} kWh</span>
              </div>
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Fotovoltaica</span>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${punto.tiene_fv ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-bg-intermediate text-secondary opacity-60'}`}>
                    {punto.tiene_fv ? 'Sí' : 'No'}
                  </span>
                  {punto.tiene_fv && <span className="text-xs text-secondary opacity-70">({punto.fv_compensacion || 'Sin compensación'})</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: `2px solid ${sectionBorderColor}` }}>
            <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-4">Direcciones</h4>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Suministro</span>
                <span className="text-primary text-sm">
                  {punto.direccion_sum}{punto.localidad_sum ? `, ${punto.localidad_sum}` : ''}{punto.provincia_sum ? ` (${punto.provincia_sum})` : ''}
                </span>
              </div>
              {punto.direccion_fisc && (
                <div>
                  <span className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1">Fiscal</span>
                  <span className="text-primary text-sm">
                    {punto.direccion_fisc}{punto.localidad_fisc ? `, ${punto.localidad_fisc}` : ''}{punto.provincia_fisc ? ` (${punto.provincia_fisc})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6" style={{ borderTop: `2px solid ${sectionBorderColor}` }}>
            <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-4">Potencias por Periodo (kW)</h4>
            <div className="grid grid-cols-6 gap-2 text-center">
              {[punto.p1_kw, punto.p2_kw, punto.p3_kw, punto.p4_kw, punto.p5_kw, punto.p6_kw].map((val, idx) => (
                <div key={idx} className="bg-bg-intermediate rounded p-2">
                  <span className="block text-[10px] text-fenix-600 dark:text-fenix-400 font-bold uppercase">P{idx + 1}</span>
                  <span className="block text-sm font-bold text-primary">{val ?? '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="p-6 bg-bg-intermediate/30 flex items-center justify-end gap-3 rounded-b-2xl"
          style={{ borderTop: `2px solid ${sectionBorderColor}` }}
        >
          <Link to="/app/puntos/$id" params={{ id: punto.id }}>
            <button className="px-4 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-600 text-white font-medium shadow-lg shadow-fenix-500/25 transition-all cursor-pointer">
              Editar punto
            </button>
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTE ESTADO EDITABLE ============
interface EstadoDropdownProps {
  puntoId: string;
  currentEstado: EstadoPunto;
  onUpdate: () => void;
}

function EstadoDropdown({ puntoId, currentEstado, onUpdate }: EstadoDropdownProps) {
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

  const handleChange = async (nuevoEstado: EstadoPunto) => {
    if (nuevoEstado === currentEstado) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('puntos_suministro')
        .update({
          estado: nuevoEstado,
          modificado_en: new Date().toISOString()
        })
        .eq('id', puntoId);

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
        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity w-fit whitespace-nowrap cursor-pointer ${getEstadoColorClass(currentEstado)}`}
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
            {ESTADOS_PUNTO.map(estado => (
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


// ============ HELPER POTENCIA RANGO ============
function getPotenciaRango(punto: PuntoConCliente): string {
  const potencias = [punto.p1_kw, punto.p2_kw, punto.p3_kw, punto.p4_kw, punto.p5_kw, punto.p6_kw].filter((p): p is number => p != null && p > 0);
  if (potencias.length === 0) return '—';
  const min = Math.min(...potencias);
  const max = Math.max(...potencias);
  if (min === max) return `${min} kW`;
  return `${min}-${max} kW`;
}

function getDireccionCompleta(punto: PuntoConCliente): string {
  const parts = [punto.direccion_sum, punto.localidad_sum, punto.provincia_sum].filter(Boolean);
  return parts.join(', ') || '—';
}

function getComercializadoraNombre(punto: PuntoConCliente): string {
  if (punto.comercializadora && Array.isArray(punto.comercializadora) && punto.comercializadora[0]) {
    return punto.comercializadora[0].nombre;
  }
  if (punto.comercializadora && !Array.isArray(punto.comercializadora) && (punto.comercializadora as any).nombre) {
    return (punto.comercializadora as any).nombre;
  }
  return '—';
}

// ============ COMPONENTE PRINCIPAL ============
export default function PuntosList({ clienteId, empresaId, hideClienteColumn }: { clienteId?: string; empresaId?: string; hideClienteColumn?: boolean }) {
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPunto, setSelectedPunto] = useState<PuntoConCliente | null>(null);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);
  const { theme } = useTheme();
  const { rol } = useSession();
  const navigate = useNavigate();
  const isCliente = rol === 'cliente';
  const [vistaAgrupaciones, setVistaAgrupaciones] = useState(false);
  const [showCrearAgrupacion, setShowCrearAgrupacion] = useState(false);

  // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['puntos', filter, clienteId, empresaId],
    queryFn: () => fetchPuntos(filter, clienteId, empresaId)
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['puntos'] });
  };

  // Opciones de filtro
  const filterOptions = useMemo(() => {
    if (!fetchedData) return initialColumnFilters;
    const getUnique = (key: keyof PuntoConCliente) =>
      Array.from(new Set(fetchedData.map(p => p[key]).filter(Boolean) as string[])).sort();
    return {
      estado: getUnique('estado'),
      tarifa: getUnique('tarifa'),
    };
  }, [fetchedData]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      const estado = item.estado ?? null;
      const tarifaAcceso = item.tarifa ?? null;

      return (
        (columnFilters.estado.length === 0 || (estado && columnFilters.estado.includes(estado))) &&
        (columnFilters.tarifa.length === 0 || (tarifaAcceso && columnFilters.tarifa.includes(tarifaAcceso)))
      );
    });
  }, [fetchedData, columnFilters]);

  // Ordenación
  const {
    sortedData,
    handleSort,
    renderSortIcon
  } = useSortableTable<PuntoConCliente & { cliente_nombre?: string | null }>(filteredData, {
    initialSortKey: 'creado_en',
    initialSortDirection: 'desc',
    sortValueAccessors: {
      cliente_nombre: (item: PuntoConCliente) => {
        const c = item.clientes;
        return Array.isArray(c) ? c[0]?.nombre : (c as any)?.nombre;
      },
      cups: (item: PuntoConCliente) => item.cups,
      estado: (item: PuntoConCliente) => item.estado,
      tarifa: (item: PuntoConCliente) => item.tarifa,
      consumo_anual_kwh: (item: PuntoConCliente) => item.consumo_anual_kwh,
      creado_en: (item: PuntoConCliente) => item.creado_en,
    } as any
  });

  // Paginación
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const displayedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedData, currentPage]);

  // Reset página cuando cambian filtros
  useMemo(() => {
    setCurrentPage(1);
  }, [filter, columnFilters]);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  // Función auxiliar para traducir errores de la RPC a mensajes amigables
  const getDeleteErrorMessage = (error: { message?: string; code?: string }, puntoId: string): string => {
    const shortId = puntoId.substring(0, 8);
    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    // Errores específicos del backend (códigos personalizados)
    if (errorCode === 'AUTHZ' || errorMessage.includes('Acceso denegado') || errorMessage.includes('No autenticado')) {
      return `No tienes permisos para eliminar el punto ${shortId}...`;
    }
    if (errorCode === 'NTFND' || errorMessage.includes('no encontrado')) {
      return `El punto ${shortId}... no existe o ya fue eliminado.`;
    }
    if (errorCode === 'DPNDY' || errorMessage.includes('contratos activos')) {
      // Extraer número de contratos del mensaje si está disponible
      const match = errorMessage.match(/(\d+)\s*contratos?\s*activos/i);
      const numContratos = match ? match[1] : 'varios';
      return `No se puede eliminar el punto ${shortId}...: tiene ${numContratos} contrato(s) activo(s). Primero debes dar de baja o eliminar los contratos.`;
    }
    if (errorMessage.includes('Aún tiene datos asociados')) {
      return `El punto ${shortId}... no se puede eliminar porque tiene datos asociados.`;
    }

    // Error genérico de base de datos
    if (errorMessage.includes('invalid input value') || errorMessage.includes('enum')) {
      return `Error interno al eliminar el punto ${shortId}.... Por favor, contacta con soporte técnico.`;
    }

    // Error de conexión
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return `Error de conexión al intentar eliminar el punto ${shortId}.... Verifica tu conexión a internet.`;
    }

    // Error genérico
    return `No se pudo eliminar el punto ${shortId}.... Por favor, inténtalo de nuevo.`;
  };

  // Mutación para eliminar
  const deletePuntoMutation = useMutation({
    mutationFn: async (puntoIds: string[]) => {
      const results = await Promise.allSettled(puntoIds.map(puntoId =>
        supabase.rpc('delete_punto_suministro', { punto_id_to_delete: puntoId })
      ));

      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)) {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          const puntoId = puntoIds[index] ?? 'desconocido';
          errors.push(getDeleteErrorMessage(error, puntoId));
        }
      });

      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      return puntoIds.length - errors.length;
    },
    onSuccess: (deletedCount) => {
      if (deletedCount > 0) {
        toast.success(`${deletedCount} punto(s) de suministro eliminado(s).`);
      }
      setIdsToDelete([]);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
    onError: (error: Error) => {
      toast.error(error.message, { duration: 6000 });
      setIdsToDelete([]);
    },
  });

  const isFiltered = filter.length > 0 ||
    columnFilters.estado.length > 0 ||
    columnFilters.tarifa.length > 0;

  // Handlers de selección
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



  const isDetailView = !!(clienteId || empresaId);

  return (
    <div className={isDetailView ? "animate-fade-in" : "flex flex-col gap-6 animate-fade-in"}>
      {/* Encabezado GLOBAL - Solo visible si no estamos en vista detalle */}
      {!isDetailView && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
            </div>
            <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Puntos de Suministro</h1>
            {/* Toggle Puntos / Agrupaciones (solo clientes) */}
            {isCliente && (
              <div className="flex items-center bg-bg-intermediate rounded-lg p-0.5 ml-2">
                <button
                  onClick={() => setVistaAgrupaciones(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    !vistaAgrupaciones
                      ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Puntos
                </button>
                <button
                  onClick={() => setVistaAgrupaciones(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    vistaAgrupaciones
                      ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Layers size={12} />
                  Agrupaciones
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isCliente && selectedIds.length > 0 ? (
              /* Selection action bar - hidden for clients */
              <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
                <span className="text-sm text-fenix-400 font-medium">{selectedIds.length} seleccionado(s)</span>
                <div className="flex items-center gap-1 ml-2">
                  {selectedIds.length === 1 && selectedIds[0] && (
                    <Link to="/app/puntos/$id" params={{ id: selectedIds[0] }} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors">
                      <Edit size={16} />
                    </Link>
                  )}
                  <button onClick={handleDeleteSelected} disabled={deletePuntoMutation.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => setSelectedIds([])} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors">
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <Search size={16} />
                    Buscar
                  </label>
                  <input
                    type="text"
                    placeholder="CUPS o dirección..."
                    className="glass-input w-64"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                  />
                </div>
                {!isCliente && (
                  <ExportButton
                    exportParams={{
                      entity: 'puntos_suministro',
                      filters: { search: filter || undefined }
                    }}
                  />
                )}
                {!isCliente && (
                  <Link to="/app/puntos/nuevo">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                      <MapPinPlus size={18} />
                      <span className="hidden sm:inline">Nuevo Punto</span>
                    </button>
                  </Link>
                )}
                {isCliente && (
                  <button
                    onClick={() => setShowCrearAgrupacion(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Nueva agrupación</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Vista Agrupaciones (solo clientes) ═══ */}
      {isCliente && vistaAgrupaciones && !isDetailView && (
        <AgrupacionesGrid />
      )}

      {/* ═══ Vista Puntos (original) ═══ */}
      {(!isCliente || !vistaAgrupaciones) && (
      <>
      {/* Estados de carga / error */}
      {isLoading && !isDetailView && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="animate-spin text-fenix-500"><MapPin size={32} /></div>
          <p className="ml-3 text-secondary font-medium">Cargando puntos de suministro...</p>
        </div>
      )}

      {isError && (
        <div className="glass-card p-6 bg-red-500/10 border-red-500/20 text-red-200">
          <p>Error al cargar puntos. Por favor intenta de nuevo.</p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {/* Integrated Header for Detail View */}
        {isDetailView && (
          <div className="p-6 border-b border-bg-intermediate">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Icon + Title + Counter */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-fenix-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500">Puntos de Suministro</h2>
                  <p className="text-sm text-gray-400">
                    {totalItems} puntos encontrados
                  </p>
                </div>
              </div>

              {/* Right: Search + Export */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 flex-1 md:flex-initial">
                  <label className="flex items-center gap-2 text-sm font-medium text-fenix-600 dark:text-fenix-400 whitespace-nowrap">
                    <Search size={16} />
                    Buscar
                  </label>
                  <input
                    placeholder="CUPS, Dirección..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="glass-input w-full md:w-64"
                  />
                </div>
                <ExportButton
                  entity="puntos_suministro"
                  preFilters={{
                    cliente_id: clienteId,
                    comercializadora_id: empresaId,
                    search: filter
                  }}
                  label="Exportar"
                />
              </div>
            </div>
          </div>
        )}
        {/* Estados vacíos */}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState
            title="Sin puntos de suministro"
            description="Aún no hay puntos de suministro (CUPS) registrados."
            cta={<Link to="/app/puntos/nuevo"><button className="mt-4 px-6 py-2 bg-fenix-500 hover:bg-fenix-400 text-white rounded-lg">Crear el primero</button></Link>}
          />
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
          <div className="p-12 text-center text-gray-400">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-intermediate mx-auto">
              <MapPin size={32} className="opacity-50" />
            </div>
            <p>Este cliente no tiene puntos de suministro asignados.</p>
          </div>
        )}
        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && displayedData.length === 0 && isFiltered && (
          <div className="p-12 text-center text-gray-400">
            <Search size={32} className="mx-auto mb-4 opacity-50" />
            <p>No se encontraron puntos que coincidan con los filtros.</p>
            <button onClick={() => { setFilter(''); setColumnFilters(initialColumnFilters); }} className="mt-2 text-fenix-400 hover:text-fenix-400">Limpiar filtros</button>
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
                  {!isCliente && (
                    <th className="w-10 p-4 text-left">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                        onChange={handleSelectAll}
                        aria-label="Seleccionar todos los puntos"
                        className="w-5 h-5 rounded-full border-2 border-slate-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                      />
                    </th>
                  )}
                  {isCliente ? (
                    /* CLIENT VIEW: Dirección, Comercializadora, CUPS, Tipo (Luz/Gas), Tarifa */
                    <>
                      <th className="p-4 text-left">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Dirección</span>
                      </th>
                      <th className="p-4 text-left">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Comercializadora</span>
                      </th>
                      <th className="p-4 text-left">
                        <button onClick={() => handleSort('cups')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                          CUPS {renderSortIcon('cups')}
                        </button>
                      </th>
                      <th className="p-4 text-left">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Tipo</span>
                      </th>
                      <th className="p-4 text-left">
                        <button onClick={() => handleSort('tarifa')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                          Tarifa {renderSortIcon('tarifa')}
                        </button>
                      </th>
                    </>
                  ) : (
                    /* ADMIN / COMERCIAL VIEW: Original columns */
                    <>
                      {!hideClienteColumn && (
                        <th className="p-4 text-left">
                          <button onClick={() => handleSort('cliente_nombre' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                            Cliente {renderSortIcon('cliente_nombre')}
                          </button>
                        </th>
                      )}
                      <th className="p-4 text-left">
                        <button onClick={() => handleSort('cups')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                          CUPS {renderSortIcon('cups')}
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
                            onChange={(selected) => handleColumnFilterChange('estado', selected)}
                          />
                        </div>
                      </th>
                      <th className="p-4 text-left">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleSort('tarifa')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                            Tarifa {renderSortIcon('tarifa')}
                          </button>
                          <ColumnFilterDropdown
                            columnName="Tarifa"
                            options={filterOptions.tarifa}
                            selectedOptions={columnFilters.tarifa}
                            onChange={(selected) => handleColumnFilterChange('tarifa', selected)}
                          />
                        </div>
                      </th>
                      <th className="p-4 text-right">
                        <button onClick={() => handleSort('consumo_anual_kwh')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors ml-auto cursor-pointer">
                          kWh/año {renderSortIcon('consumo_anual_kwh')}
                        </button>
                      </th>
                      <th className="p-4 text-right">
                        <button onClick={() => handleSort('creado_en')} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors ml-auto cursor-pointer">
                          Creado {renderSortIcon('creado_en')}
                        </button>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map(p => {
                  const isSelected = selectedIds.includes(p.id);

                  if (isCliente) {
                    // CLIENT ROW: Entire row is a link to detail page
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-fenix-500/8 transition-colors cursor-pointer"
                        onClick={() => navigate({ to: '/app/puntos/$id/detalle', params: { id: p.id } })}
                      >
                        <td className="p-4">
                          <span className="text-primary text-sm">{getDireccionCompleta(p)}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-primary text-sm">{getComercializadoraNombre(p)}</span>
                        </td>
                        <td className="p-4">
                          <code className="font-bold text-fenix-600 dark:text-fourth font-mono text-sm">{p.cups}</code>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-secondary text-xs bg-bg-intermediate px-1.5 py-0.5 rounded">
                            {p.tipo_factura || '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-secondary text-xs bg-bg-intermediate px-1.5 py-0.5 rounded">
                            {p.tarifa || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // ADMIN/COMERCIAL ROW: Original behavior
                  return (
                    <tr key={p.id} className={clsx('hover:bg-fenix-500/8 transition-colors', isSelected && 'bg-fenix-500/15 hover:bg-fenix-500/20')}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(p.id)}
                          aria-label={`Seleccionar punto ${p.cups}`}
                          className="w-5 h-5 rounded-full border-2 border-primary bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      {!hideClienteColumn && (
                        <td className="p-4">
                          {p.clientes && Array.isArray(p.clientes) && p.clientes[0] ? (
                            <Link to="/app/clientes/$id" params={{ id: p.clientes[0].id }} className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors cursor-pointer">
                              {p.clientes[0].nombre}
                            </Link>
                          ) : (p.clientes && !Array.isArray(p.clientes) && (p.clientes as any).nombre) ? (
                            <Link to="/app/clientes/$id" params={{ id: (p.clientes as any).id }} className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors cursor-pointer">
                              {(p.clientes as any).nombre}
                            </Link>
                          ) : <span className="text-secondary opacity-60">—</span>}
                        </td>
                      )}
                      <td className="p-4">
                        <button
                          className="font-bold text-fenix-600 dark:text-fourth hover:underline text-left transition-colors cursor-pointer font-mono text-sm"
                          onClick={() => setSelectedPunto(p)}
                          title="Ver detalle del punto"
                        >
                          {p.cups}
                        </button>
                      </td>
                      <td className="p-4">
                        <EstadoDropdown
                          puntoId={p.id}
                          currentEstado={p.estado}
                          onUpdate={handleRefresh}
                        />
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-secondary text-xs bg-bg-intermediate px-1.5 py-0.5 rounded">
                          {p.tarifa || '—'}
                        </span>
                      </td>
                      <td className="p-4 text-right text-secondary font-bold">
                        {p.consumo_anual_kwh?.toLocaleString() || '—'}
                      </td>
                      <td className="p-4 text-right text-sm text-secondary opacity-60 font-medium">
                        {p.creado_en ? new Date(p.creado_en).toLocaleDateString('es-ES') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!isLoading && !isError && totalItems > 0 && (
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t"
            style={{ borderTopColor: tableBorderColor }}
          >
            <div className="text-sm text-secondary">
              Total: <span className="text-primary font-bold">{totalItems}</span> registros • Página <span className="text-primary font-bold">{currentPage}</span> de <span className="text-primary font-bold">{totalPages || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Primera página"
              >
                <ChevronsLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Página siguiente"
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Última página"
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle CUPS - Only for non-client roles */}
      {!isCliente && selectedPunto && (
        <PuntoDetailModal punto={selectedPunto} onClose={() => setSelectedPunto(null)} />
      )}

      {/* Modal confirmación eliminar - Only for non-client roles */}
      {!isCliente && (
        <ConfirmationModal
          isOpen={idsToDelete.length > 0}
          onClose={() => setIdsToDelete([])}
          onConfirm={() => { deletePuntoMutation.mutate(idsToDelete); }}
          title={`Confirmar Eliminación (${idsToDelete.length})`}
          message={
            idsToDelete.length === 1
              ? `¿Estás seguro de que quieres eliminar el punto de suministro seleccionado? Si tiene contratos o datos asociados, no se podrá eliminar.`
              : `¿Estás seguro de que quieres eliminar los ${idsToDelete.length} puntos de suministro seleccionados? Los puntos con contratos o datos asociados no se eliminarán.`
          }
          confirmText={`Sí, Eliminar ${idsToDelete.length}`}
          cancelText="Cancelar"
          confirmButtonClass="danger"
          isConfirming={deletePuntoMutation.isPending}
        />
      )}
      </>
      )}

      {/* Modal crear agrupación - Solo clientes */}
      {isCliente && (
        <CrearAgrupacionModal
          isOpen={showCrearAgrupacion}
          onClose={() => setShowCrearAgrupacion(false)}
        />
      )}
    </div>
  );
}

