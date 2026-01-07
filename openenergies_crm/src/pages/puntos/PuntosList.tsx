// src/pages/puntos/PuntosList.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { EstadoPunto, TipoFactura } from '@lib/types';
import {
  Trash2, MapPinPlus, XCircle, Edit, X, ExternalLink,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, MapPin
} from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { toast } from 'react-hot-toast';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';
import { clsx } from '@lib/utils';

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
async function fetchPuntos(filter: string, clienteId?: string): Promise<PuntoConCliente[]> {
  let query = supabase
    .from('puntos_suministro')
    .select(`
      id,
      cliente_id,
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

  if (filter) {
    query = query.or(`cups.ilike.%${filter}%,direccion_sum.ilike.%${filter}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PuntoConCliente[];
}

// ============ HELPER COLOR ESTADO ============
const getEstadoColorClass = (estado: EstadoPunto) => {
  const map: Record<EstadoPunto, string> = {
    'Nueva Oportunidad': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    'Solicitar Doc.': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    'Doc. OK': 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    'Estudio enviado': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    'Aceptado': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'Permanencia': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'Standby': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'Desiste': 'bg-bg-intermediate text-gray-400 border border-gray-500/30',
  };
  return map[estado] || 'bg-bg-intermediate text-gray-400 border border-gray-500/30';
};

// ============ COMPONENTE MODAL CUPS ============
interface PuntoModalProps {
  punto: PuntoConCliente;
  onClose: () => void;
}

function PuntoDetailModal({ punto, onClose }: PuntoModalProps) {
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
        <div className="flex items-center justify-between p-6 border-b border-bg-intermediate">
          <h3 className="text-xl font-bold text-fenix-400 flex items-center gap-2">
            <MapPin className="text-fenix-500" /> Detalle del Punto de Suministro
          </h3>
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
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
                <span className="block text-xs text-white mb-1">Cliente</span>
                {punto.clientes && Array.isArray(punto.clientes) && punto.clientes[0] ? (
                  <span className="text-gray-300 font-medium">
                    {punto.clientes[0].nombre}
                  </span>
                ) : (punto.clientes && !Array.isArray(punto.clientes) && (punto.clientes as any).nombre) ? (
                  <span className="text-gray-300 font-medium">
                    {(punto.clientes as any).nombre}
                  </span>
                ) : <span className="text-gray-400">—</span>}
              </div>
              <div>
                <span className="block text-xs text-white mb-1">Comercializadora</span>
                {punto.comercializadora && Array.isArray(punto.comercializadora) && punto.comercializadora[0] ? (
                  <span className="text-gray-300">
                    {punto.comercializadora[0].nombre}
                  </span>
                ) : (punto.comercializadora && !Array.isArray(punto.comercializadora) && (punto.comercializadora as any).nombre) ? (
                  <span className="text-gray-300">
                    {(punto.comercializadora as any).nombre}
                  </span>
                ) : <span className="text-gray-400">—</span>}
              </div>
              <div>
                <span className="block text-xs text-white mb-1">CUPS</span>
                <code className="text-sm bg-bg-intermediate px-1.5 py-0.5 rounded text-gray-300 font-mono">{punto.cups}</code>
              </div>
              <div>
                <span className="block text-xs text-white mb-1">Comerciales asignados</span>
                <span className="text-gray-300 text-sm">{comercialesAsignados}</span>
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-white mb-1">Tarifa</span>
                <span className="text-gray-300 font-medium">{punto.tarifa || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-white mb-1">Potencia Total</span>
                <span className="text-gray-300 font-medium">{potenciaTotal.toFixed(2)} kW</span>
              </div>
              <div>
                <span className="block text-xs text-white mb-1">Consumo Anual</span>
                <span className="text-gray-300 font-medium">{punto.consumo_anual_kwh?.toLocaleString() || '—'} kWh</span>
              </div>
              <div>
                <span className="block text-xs text-white mb-1">Fotovoltaica</span>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${punto.tiene_fv ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {punto.tiene_fv ? 'Sí' : 'No'}
                  </span>
                  {punto.tiene_fv && <span className="text-xs text-gray-400">({punto.fv_compensacion || 'Sin compensación'})</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-bg-intermediate">
            <h4 className="text-sm font-semibold text-fenix-400 uppercase tracking-wider mb-4">Direcciones</h4>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-white mb-1">Suministro</span>
                <span className="text-gray-300 text-sm">
                  {punto.direccion_sum}{punto.localidad_sum ? `, ${punto.localidad_sum}` : ''}{punto.provincia_sum ? ` (${punto.provincia_sum})` : ''}
                </span>
              </div>
              {punto.direccion_fisc && (
                <div>
                  <span className="block text-xs text-white mb-1">Fiscal</span>
                  <span className="text-gray-300 text-sm">
                    {punto.direccion_fisc}{punto.localidad_fisc ? `, ${punto.localidad_fisc}` : ''}{punto.provincia_fisc ? ` (${punto.provincia_fisc})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-bg-intermediate">
            <h4 className="text-sm font-semibold text-fenix-400 uppercase tracking-wider mb-4">Potencias por Periodo (kW)</h4>
            <div className="grid grid-cols-6 gap-2 text-center">
              {[punto.p1_kw, punto.p2_kw, punto.p3_kw, punto.p4_kw, punto.p5_kw, punto.p6_kw].map((val, idx) => (
                <div key={idx} className="bg-bg-intermediate rounded p-2">
                  <span className="block text-[10px] text-white uppercase">P{idx + 1}</span>
                  <span className="block text-sm font-medium text-gray-300">{val ?? '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-bg-intermediate bg-black/20 flex items-center justify-end gap-3 rounded-b-2xl">
          <Link to="/app/puntos/$id" params={{ id: punto.id }}>
            <button className="px-4 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-600 text-white font-medium shadow-lg shadow-fenix-500/25 transition-all cursor-pointer">
              Editar punto
            </button>
          </Link>
          <button
            onClick={onClose}
            className="btn-secondary cursor-pointer"
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
          <div className="fixed inset-0 z-9998" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-9999 w-52 bg-bg-primary border border-fenix-500/20 rounded-xl py-2 shadow-2xl animate-fade-in max-h-60 overflow-y-auto"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {ESTADOS_PUNTO.map(estado => (
              <button
                key={estado}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 cursor-pointer',
                  'hover:bg-fenix-500/15 text-gray-300',
                  estado === currentEstado ? 'font-medium bg-fenix-500/15 text-fenix-400' : ''
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


// ============ COMPONENTE PRINCIPAL ============
export default function PuntosList({ clienteId }: { clienteId?: string }) {
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPunto, setSelectedPunto] = useState<PuntoConCliente | null>(null);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['puntos', filter, clienteId],
    queryFn: () => fetchPuntos(filter, clienteId)
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
          const message = error.message.includes('Aún tiene datos asociados')
            ? `Punto ${puntoId.substring(0, 8)}... no borrado: Aún tiene datos asociados.`
            : `Error al eliminar ${puntoId.substring(0, 8)}...: ${error.message}`;
          errors.push(message);
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {!clienteId && (
          <div>
            <h2 className="text-2xl font-bold text-fenix-500 flex items-center gap-2">
              <MapPin className="text-fenix-500" size={24} />
              Puntos de Suministro
            </h2>
            <p className="text-gray-400">Gestiona todos los puntos de suministro (CUPS).</p>
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
                {selectedIds.length === 1 && selectedIds[0] && (
                  <Link
                    to="/app/puntos/$id"
                    params={{ id: selectedIds[0] }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                    title="Editar Punto"
                  >
                    <Edit size={16} />
                  </Link>
                )}
                <button
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title={`Eliminar ${selectedIds.length} punto(s)`}
                  onClick={handleDeleteSelected}
                  disabled={deletePuntoMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
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
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar por CUPS o dirección"
                      className="glass-input w-full pl-10"
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                    />
                  </div>
                  <Link to="/app/puntos/nuevo">
                    <button className="flex items-center gap-2 px-4 py-2 bg-fenix-500 hover:bg-fenix-400 text-white rounded-lg transition-colors shadow-lg shadow-fenix-500/20 whitespace-nowrap cursor-pointer">
                      <MapPinPlus size={18} /> <span className="hidden sm:inline">Nuevo Punto</span>
                    </button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Estados de carga / error */}
      {isLoading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="animate-spin text-fenix-500"><MapPin size={32} /></div>
          <p className="ml-3 text-gray-400 font-medium">Cargando puntos de suministro...</p>
        </div>
      )}

      {isError && (
        <div className="glass-card p-6 bg-red-500/10 border-red-500/20 text-red-200">
          <p>Error al cargar puntos. Por favor intenta de nuevo.</p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
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
                <tr className="border-b-2 border-bg-intermediate bg-bg-intermediate text-xs text-gray-200 uppercase tracking-wider font-semibold">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                      onChange={handleSelectAll}
                      aria-label="Seleccionar todos los puntos"
                      className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                    />
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort('cliente_nombre' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">
                      Cliente {renderSortIcon('cliente_nombre')}
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort('cups')} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">
                      CUPS {renderSortIcon('cups')}
                    </button>
                  </th>

                  <th className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('estado')} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">
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
                  <th className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('tarifa')} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">
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
                    <button onClick={() => handleSort('consumo_anual_kwh')} className="flex items-center gap-1 hover:text-fenix-400 transition-colors ml-auto cursor-pointer">
                      kWh/año {renderSortIcon('consumo_anual_kwh')}
                    </button>
                  </th>
                  <th className="p-4 text-right">
                    <button onClick={() => handleSort('creado_en')} className="flex items-center gap-1 hover:text-fenix-400 transition-colors ml-auto cursor-pointer">
                      Creado {renderSortIcon('creado_en')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map(p => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <tr key={p.id} className={clsx('hover:bg-fenix-500/8 transition-colors', isSelected && 'bg-fenix-500/15 hover:bg-fenix-500/20')}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(p.id)}
                          aria-label={`Seleccionar punto ${p.cups}`}
                          className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      <td className="p-4">
                        {p.clientes && Array.isArray(p.clientes) && p.clientes[0] ? (
                          <Link to="/app/clientes/$id" params={{ id: p.clientes[0].id }} className="font-medium text-white hover:text-fenix-400 transition-colors cursor-pointer">
                            {p.clientes[0].nombre}
                          </Link>
                        ) : (p.clientes && !Array.isArray(p.clientes) && (p.clientes as any).nombre) ? (
                          <Link to="/app/clientes/$id" params={{ id: (p.clientes as any).id }} className="font-medium text-white hover:text-fenix-400 transition-colors cursor-pointer">
                            {(p.clientes as any).nombre}
                          </Link>
                        ) : <span className="text-gray-500">—</span>}
                      </td>
                      <td className="p-4">
                        <button
                          className="font-mono text-sm text-fenix-400 hover:text-fenix-300 text-left transition-colors cursor-pointer"
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
                        <span className="font-mono text-xs bg-bg-intermediate px-1.5 py-0.5 rounded text-gray-300">
                          {p.tarifa || '—'}
                        </span>
                      </td>
                      <td className="p-4 text-right text-gray-300">
                        {p.consumo_anual_kwh?.toLocaleString() || '—'}
                      </td>
                      <td className="p-4 text-right text-sm text-gray-500">
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
          <div className="p-4 border-t border-bg-intermediate flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-gray-400">
              Total: <span className="text-white font-medium">{totalItems}</span> registros • Página <span className="text-white font-medium">{currentPage}</span> de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Primera página"
              >
                <ChevronsLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
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

      {/* Modal detalle CUPS */}
      {selectedPunto && (
        <PuntoDetailModal punto={selectedPunto} onClose={() => setSelectedPunto(null)} />
      )}

      {/* Modal confirmación eliminar */}
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
    </div>
  );
}

