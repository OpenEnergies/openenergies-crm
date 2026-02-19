// src/pages/agrupaciones/AgrupacionDetailPage.tsx
import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { useTheme } from '@hooks/ThemeContext';
import {
  useAgrupacionDetail,
  useAgrupacionPuntos,
  useAgrupacionFacturacion,
  useAgrupacionTiposFactura,
  useEliminarAgrupacion,
  useQuitarPuntoDeAgrupacion,
} from '@hooks/useAgrupaciones';
import { getTipoIcon, getTipoBg, getTipoBadgeClass } from '@components/agrupaciones/AgrupacionesGrid';
import AnadirPuntosModal from '@components/agrupaciones/AnadirPuntosModal';
import EditarAgrupacionModal from '@components/agrupaciones/EditarAgrupacionModal';
import ConfirmationModal from '@components/ConfirmationModal';
import {
  ArrowLeft, Edit, Plus, Trash2, BarChart3, TrendingUp, Receipt, MapPin,
  ChevronLeft, ChevronRight, Loader2, X
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { toast } from 'react-hot-toast';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function AgrupacionDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null);
  const [showAnadirModal, setShowAnadirModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [puntoToRemove, setPuntoToRemove] = useState<string | null>(null);

  const { data: agrupacion, isLoading: loadingAgrupacion } = useAgrupacionDetail(id);
  const { data: puntos } = useAgrupacionPuntos(id);
  const { data: facturas, isLoading: loadingFacturas } = useAgrupacionFacturacion(id, selectedYear);
  const { data: tiposFactura } = useAgrupacionTiposFactura(id);
  const eliminarMutation = useEliminarAgrupacion();
  const quitarPuntoMutation = useQuitarPuntoDeAgrupacion();

  // ── Filter facturas by selected tipo ──
  const filteredFacturas = useMemo(() => {
    if (!facturas) return [];
    if (!selectedTipo) return facturas;
    // Get punto IDs that match the selected tipo
    const puntosDelTipo = new Set(
      (puntos || []).filter(p => p.tipo_factura === selectedTipo).map(p => p.id)
    );
    return facturas.filter(f => puntosDelTipo.has(f.punto_id));
  }, [facturas, selectedTipo, puntos]);

  // ── KPIs ──
  const consumoAnual = useMemo(() => {
    return filteredFacturas.reduce((sum, f) => sum + (f.consumo_kwh || 0), 0);
  }, [filteredFacturas]);

  const costeAnual = useMemo(() => {
    return filteredFacturas.reduce((sum, f) => sum + (f.total || 0), 0);
  }, [filteredFacturas]);

  const numPuntos = useMemo(() => {
    if (!puntos) return 0;
    if (!selectedTipo) return puntos.length;
    return puntos.filter(p => p.tipo_factura === selectedTipo).length;
  }, [puntos, selectedTipo]);

  // ── Monthly data ──
  const monthlyData = useMemo(() => {
    const months = MONTH_LABELS.map(label => ({
      mes: label,
      consumo: 0,
      coste: 0,
      _totalSum: 0,
      _consumoSum: 0,
      precio: null as number | null,
    }));

    filteredFacturas.forEach(f => {
      const mIdx = new Date(f.fecha_emision).getMonth();
      if (months[mIdx]) {
        months[mIdx].consumo += f.consumo_kwh || 0;
        months[mIdx].coste += f.total || 0;
        months[mIdx]._totalSum += f.total || 0;
        months[mIdx]._consumoSum += f.consumo_kwh || 0;
      }
    });

    return months.map(m => ({
      mes: m.mes,
      consumo: Math.round(m.consumo),
      coste: Math.round(m.coste * 100) / 100,
      precio: m._consumoSum > 0 ? Math.round((m._totalSum / m._consumoSum) * 10000) / 10000 : null,
    }));
  }, [filteredFacturas]);

  // ── Chart colors ──
  const chartColors = {
    consumo: isDark ? '#34d399' : '#10b981',
    coste: isDark ? '#60a5fa' : '#3b82f6',
    precio: isDark ? '#f59e0b' : '#d97706',
    grid: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#94a3b8' : '#64748b',
  };

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: '12px',
  };

  const handleDelete = async () => {
    try {
      await eliminarMutation.mutateAsync(id);
      toast.success('Agrupación eliminada');
      navigate({ to: '/app/puntos' });
    } catch {
      toast.error('Error al eliminar la agrupación');
    }
  };

  const handleRemovePunto = async () => {
    if (!puntoToRemove) return;
    try {
      await quitarPuntoMutation.mutateAsync({ puntoId: puntoToRemove, agrupacionId: id });
      toast.success('Punto eliminado de la agrupación');
      setPuntoToRemove(null);
    } catch {
      toast.error('Error al quitar el punto');
    }
  };

  // ── Loading ──
  if (loadingAgrupacion) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
          <p className="ml-3 text-secondary font-medium">Cargando agrupación...</p>
        </div>
      </div>
    );
  }

  if (!agrupacion) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="glass-card p-12 text-center text-secondary">
          <p>No se encontró la agrupación o no tienes acceso.</p>
          <Link to="/app/puntos" className="text-fenix-500 hover:underline mt-2 inline-block">
            Volver a Puntos de Suministro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/app/puntos" className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className={`w-10 h-10 rounded-xl ${getTipoBg(agrupacion.tipo)} flex items-center justify-center`}>
            {getTipoIcon(agrupacion.tipo)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">{agrupacion.nombre}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getTipoBadgeClass(agrupacion.tipo)}`}>
                {agrupacion.tipo}
              </span>
            </div>
            {agrupacion.descripcion && (
              <p className="text-sm text-secondary mt-0.5">{agrupacion.descripcion}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer font-medium"
          >
            <Edit size={16} />
            Editar
          </button>
          <button
            onClick={() => setShowAnadirModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 cursor-pointer"
          >
            <Plus size={16} />
            Añadir puntos
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Eliminar agrupación"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* ─── Tipo Factura Tabs ─── */}
      {tiposFactura && tiposFactura.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedTipo(null)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              selectedTipo === null
                ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 border border-fenix-500/30'
                : 'text-secondary hover:text-primary hover:bg-bg-intermediate'
            }`}
          >
            Todos
          </button>
          {tiposFactura.map(tipo => (
            <button
              key={tipo}
              onClick={() => setSelectedTipo(tipo === selectedTipo ? null : tipo)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                selectedTipo === tipo
                  ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 border border-fenix-500/30'
                  : 'text-secondary hover:text-primary hover:bg-bg-intermediate'
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Consumo Anual</p>
            <p className="text-xl font-bold text-primary">{consumoAnual.toLocaleString('es-ES')} kWh</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Coste Anual</p>
            <p className="text-xl font-bold text-primary">
              {costeAnual.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/15 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-fenix-500" />
          </div>
          <div>
            <p className="text-[11px] text-secondary font-medium uppercase tracking-wider">Puntos de Suministro</p>
            <p className="text-xl font-bold text-primary">{numPuntos}</p>
          </div>
        </div>
      </div>

      {/* ─── Year Selector ─── */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setSelectedYear(y => y - 1)}
          className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-bold text-primary min-w-[60px] text-center">{selectedYear}</span>
        <button
          onClick={() => setSelectedYear(y => y + 1)}
          disabled={selectedYear >= currentYear}
          className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ─── Charts ─── */}
      {loadingFacturas ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
          <p className="ml-3 text-secondary font-medium text-sm">Cargando gráficos de {selectedYear}...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Consumo Mensual */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Consumo Mensual (kWh)</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="agConsumoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.consumo} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColors.consumo} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES')} kWh`, 'Consumo']} />
                <Area type="monotone" dataKey="consumo" stroke={chartColors.consumo} strokeWidth={2.5} fill="url(#agConsumoGrad)" dot={{ fill: chartColors.consumo, r: 3 }} activeDot={{ r: 5 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Coste Mensual */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Coste Mensual (€)</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="agCosteGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.coste} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColors.coste} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 'Coste']} />
                <Area type="monotone" dataKey="coste" stroke={chartColors.coste} strokeWidth={2.5} fill="url(#agCosteGrad)" dot={{ fill: chartColors.coste, r: 3 }} activeDot={{ r: 5 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Precio kWh */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">Precio Medio (€/kWh)</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="agPrecioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.precio} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColors.precio} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="mes" tick={{ fill: chartColors.text, fontSize: 10 }} />
                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [value != null ? `${Number(value).toFixed(4)} €/kWh` : 'N/D', 'Precio']} />
                <Area type="monotone" dataKey="precio" stroke={chartColors.precio} strokeWidth={2.5} fill="url(#agPrecioGrad)" dot={{ fill: chartColors.precio, r: 3 }} activeDot={{ r: 5 }} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Puntos List ─── */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-fenix-500/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fenix-500" />
            Puntos en esta agrupación ({puntos?.length || 0})
          </h3>
        </div>
        {puntos && puntos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fenix-500/10">
                  <th className="p-3 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">Dirección</th>
                  <th className="p-3 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">CUPS</th>
                  <th className="p-3 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">Tipo</th>
                  <th className="p-3 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">Tarifa</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/5">
                {puntos.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-fenix-500/5 transition-colors cursor-pointer"
                    onClick={() => navigate({ to: '/app/puntos/$id/detalle', params: { id: p.id } })}
                  >
                    <td className="p-3 text-primary text-xs">
                      {p.direccion_sum}
                      {p.localidad_sum ? `, ${p.localidad_sum}` : ''}
                    </td>
                    <td className="p-3">
                      <code className="text-xs font-mono text-fenix-600 dark:text-fourth">{p.cups}</code>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-secondary bg-bg-intermediate px-1.5 py-0.5 rounded font-bold">
                        {p.tipo_factura || '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-secondary bg-bg-intermediate px-1.5 py-0.5 rounded font-bold">
                        {(p as any).tarifa || '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPuntoToRemove(p.id);
                        }}
                        className="p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Quitar de la agrupación"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-secondary">
            No hay puntos en esta agrupación
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showAnadirModal && (
        <AnadirPuntosModal
          isOpen={showAnadirModal}
          onClose={() => setShowAnadirModal(false)}
          agrupacionId={id}
          agrupacionNombre={agrupacion.nombre}
        />
      )}

      {showEditModal && (
        <EditarAgrupacionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          agrupacion={agrupacion}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar Agrupación"
        message={`¿Estás seguro de que quieres eliminar la agrupación "${agrupacion.nombre}"? Los puntos se desagruparán pero no se eliminarán.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={eliminarMutation.isPending}
      />

      <ConfirmationModal
        isOpen={!!puntoToRemove}
        onClose={() => setPuntoToRemove(null)}
        onConfirm={handleRemovePunto}
        title="Quitar punto"
        message="¿Quieres quitar este punto de la agrupación? El punto no se eliminará, solo se desagrupará."
        confirmText="Sí, Quitar"
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={quitarPuntoMutation.isPending}
      />
    </div>
  );
}
