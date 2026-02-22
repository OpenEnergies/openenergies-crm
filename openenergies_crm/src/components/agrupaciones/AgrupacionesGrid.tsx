// src/components/agrupaciones/AgrupacionesGrid.tsx
import { useNavigate } from '@tanstack/react-router';
import { useAgrupacionesCliente, type TipoAgrupacion } from '@hooks/useAgrupaciones';
import { Building2, Layers, FolderOpen, MapIcon, Loader2, Package } from 'lucide-react';
import { EmptyState } from '@components/EmptyState';

// ── Icon map for tipo ──
const TIPO_ICONS: Record<string, React.ReactNode> = {
  edificio: <Building2 className="w-5 h-5 text-blue-500" />,
  grupo: <Layers className="w-5 h-5 text-purple-500" />,
  proyecto: <FolderOpen className="w-5 h-5 text-amber-500" />,
  zona: <MapIcon className="w-5 h-5 text-emerald-500" />,
  cartera: <Package className="w-5 h-5 text-rose-500" />,
  delegación: <Building2 className="w-5 h-5 text-cyan-500" />,
  centro: <Building2 className="w-5 h-5 text-indigo-500" />,
};

const TIPO_BG: Record<string, string> = {
  edificio: 'bg-blue-500/15',
  grupo: 'bg-purple-500/15',
  proyecto: 'bg-amber-500/15',
  zona: 'bg-emerald-500/15',
  cartera: 'bg-rose-500/15',
  delegación: 'bg-cyan-500/15',
  centro: 'bg-indigo-500/15',
};

export function getTipoIcon(tipo: TipoAgrupacion) {
  return TIPO_ICONS[tipo] || <Layers className="w-5 h-5 text-gray-500" />;
}

export function getTipoBg(tipo: TipoAgrupacion) {
  return TIPO_BG[tipo] || 'bg-gray-500/15';
}

export function getTipoBadgeClass(tipo: TipoAgrupacion): string {
  const map: Record<string, string> = {
    edificio: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30',
    grupo: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30',
    proyecto: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    zona: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    cartera: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30',
    delegación: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30',
    centro: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
  };
  return map[tipo] || 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30';
}

export default function AgrupacionesGrid() {
  const { data: agrupaciones, isLoading } = useAgrupacionesCliente();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        <p className="ml-3 text-secondary font-medium">Cargando agrupaciones...</p>
      </div>
    );
  }

  if (!agrupaciones || agrupaciones.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-10 h-10 text-fenix-500/50" />}
        title="Sin agrupaciones"
        description="Crea tu primera agrupación para organizar tus puntos de suministro."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {agrupaciones.map(ag => (
        <div
          key={ag.id}
          className="glass-card p-5 cursor-pointer hover:ring-2 hover:ring-fenix-500/30 transition-all duration-200 hover:scale-[1.01] group"
          onClick={() => navigate({ to: `/app/agrupaciones/${ag.id}` as string })}
        >
          {/* Icon + Tipo */}
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl ${getTipoBg(ag.tipo)} flex items-center justify-center`}>
              {getTipoIcon(ag.tipo)}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getTipoBadgeClass(ag.tipo)}`}>
              {ag.tipo}
            </span>
          </div>

          {/* Name */}
          <h3 className="text-base font-bold text-primary mb-1 group-hover:text-fenix-600 dark:group-hover:text-fenix-400 transition-colors">
            {ag.nombre}
          </h3>

          {/* Description (max 2 lines fixed height) */}
          <div className="h-10 mb-3">
            {ag.descripcion && (
              <p className="text-sm text-secondary line-clamp-2">
                {ag.descripcion}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-fenix-500/10">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-secondary font-medium uppercase tracking-wider">Puntos</span>
              <span className="text-sm font-bold text-primary">{ag.numPuntos}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-secondary font-medium uppercase tracking-wider">Coste anual</span>
              <span className="text-sm font-bold text-primary">
                {ag.costeAnual.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
