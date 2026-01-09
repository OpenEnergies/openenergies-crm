import { useState, useEffect } from 'react';
import { useSession } from '@hooks/useSession';
import { Settings, Eye, EyeOff } from 'lucide-react';

// New energy analytics widgets
import KPICardsSection from './dashboard/widgets/KPICardsSection';
import EstadoCharts from './dashboard/widgets/EstadoCharts';
import TopPuntosValorWidget from './dashboard/widgets/TopPuntosValorWidget';

// Existing widgets
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';
import MisClientesAsignadosWidget from './dashboard/widgets/MisClientesAsignadosWidget';
import EstadoMisClientesWidget from './dashboard/widgets/EstadoMisClientesWidget';

type ViewSettings = {
  showKPIs: boolean;
  showCharts: boolean;
  showTopPuntos: boolean;
  showAgenda: boolean;
  showRenovaciones: boolean;
};

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  showKPIs: true,
  showCharts: true,
  showTopPuntos: true,
  showAgenda: true,
  showRenovaciones: true,
};

const STORAGE_KEY = 'dashboard-view-settings';

function loadViewSettings(): ViewSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_VIEW_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_VIEW_SETTINGS;
}

function saveViewSettings(settings: ViewSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export default function Dashboard() {
  const { rol, nombre, apellidos } = useSession();
  const [viewSettings, setViewSettings] = useState<ViewSettings>(loadViewSettings);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Permissions
  const isAdmin = rol === 'administrador';
  const isComercial = rol === 'comercial';
  const canSeeAgendaWidget = isAdmin || isComercial;
  const canSeeRenovacionesWidget = isAdmin || isComercial;
  const canSeeMisClientesWidget = isComercial;
  const canSeeEstadoMisClientesWidget = isComercial;
  const canSeeEnergyAnalytics = isAdmin; // Solo admin ve analytics de energía

  // Save settings on change
  useEffect(() => {
    saveViewSettings(viewSettings);
  }, [viewSettings]);

  const toggleSetting = (key: keyof ViewSettings) => {
    setViewSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header with Settings */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fenix-500">
            {nombre ? `Bienvenido, ${nombre}${apellidos ? ` ${apellidos}` : ''}` : 'Bienvenido'}
          </h1>
          <p className="text-fenix-500/70 text-sm sm:text-base">
            Gestiona tus clientes, contratos y documentos desde un único lugar.
          </p>
        </div>

        {/* Settings Dropdown */}
        {canSeeEnergyAnalytics && (
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-intermediate hover:bg-bg-intermediate/60 text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              <Settings size={18} />
              <span className="text-sm hidden sm:inline">Ajustes de Vista</span>
            </button>

            {showSettingsMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSettingsMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-bg-secondary border border-primary rounded-xl shadow-2xl p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-secondary opacity-70 uppercase tracking-wider">
                    Mostrar/Ocultar Secciones
                  </p>

                  {[
                    { key: 'showKPIs' as const, label: 'Indicadores (KPIs)' },
                    { key: 'showCharts' as const, label: 'Gráficos de Estado' },
                    { key: 'showTopPuntos' as const, label: 'Puntos de Alto Valor' },
                    { key: 'showAgenda' as const, label: 'Próximos Eventos' },
                    { key: 'showRenovaciones' as const, label: 'Contratos por Vencer' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleSetting(key)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                    >
                      <span>{label}</span>
                      {viewSettings[key] ? (
                        <Eye size={16} className="text-fenix-500" />
                      ) : (
                        <EyeOff size={16} className="text-secondary opacity-50" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards - Admin only */}
      {canSeeEnergyAnalytics && viewSettings.showKPIs && (
        <KPICardsSection />
      )}

      {/* Estado Charts - Admin only */}
      {canSeeEnergyAnalytics && viewSettings.showCharts && (
        <EstadoCharts />
      )}

      {/* Main Widgets Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {/* Top Puntos - Admin only */}
        {canSeeEnergyAnalytics && viewSettings.showTopPuntos && (
          <TopPuntosValorWidget />
        )}

        {/* Agenda Widget */}
        {canSeeAgendaWidget && viewSettings.showAgenda && (
          <ProximosEventosWidget />
        )}

        {/* Renovaciones Widget */}
        {canSeeRenovacionesWidget && viewSettings.showRenovaciones && (
          <ContratosPorVencerWidget />
        )}

        {/* Comercial-specific widgets */}
        {canSeeMisClientesWidget && <MisClientesAsignadosWidget />}
        {canSeeEstadoMisClientesWidget && <EstadoMisClientesWidget />}
      </div>
    </div>
  );
}
