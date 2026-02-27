import { useState, useEffect, lazy, Suspense } from 'react';
import { useSession } from '@hooks/useSession';
import { Settings, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useClienteId } from '@hooks/useClienteId';

// Lazy-loaded client widgets (code-split, only loaded for client role)
const MapWidget = lazy(() => import('@components/map/MapWidget'));
const ClientInsightsWidget = lazy(() => import('@components/dashboard/ClientInsightsWidget'));
import { CostBreakdownWidget } from '@components/dashboard/ClientInsightsWidget';

// New energy analytics widgets
import KPICardsSection from './dashboard/widgets/KPICardsSection';
import EstadoCharts from './dashboard/widgets/EstadoCharts';
import TopPuntosValorWidget from './dashboard/widgets/TopPuntosValorWidget';

// New comercial dashboard widgets
import TopPuntosKwhWidget from './dashboard/widgets/TopPuntosKwhWidget';
import TopPuntosEurosWidget from './dashboard/widgets/TopPuntosEurosWidget';
import ComercialStatsWidget from './dashboard/widgets/ComercialStatsWidget';

// New OMIE-style Market Dashboard
import MercadoDashboard from './dashboard/widgets/market/MercadoDashboard';
import GasDashboard from './dashboard/widgets/market/GasDashboard';
import MarketTabSelector, { type MarketView } from './dashboard/widgets/market/MarketTabSelector';

// Existing widgets
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';

type ViewSettings = {
  showKPIs: boolean;
  showCharts: boolean;
  showTopPuntos: boolean;
  showMarket: boolean;
  showAgenda: boolean;
  showRenovaciones: boolean;
};

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  showKPIs: true,
  showCharts: true,
  showTopPuntos: true,
  showMarket: true,
  showAgenda: true,
  showRenovaciones: true,
};

const STORAGE_KEY = 'dashboard-view-settings';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
  const [marketView, setMarketView] = useState<MarketView>('indicators');

  // Client dashboard state
  const { clienteId } = useClienteId();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const [clientViewMode, setClientViewMode] = useState<'anual' | 'mensual'>('anual');
  const [clientYear, setClientYear] = useState(currentYear);
  const [clientMonth, setClientMonth] = useState(currentMonth);

  const handleClientPrev = () => {
    if (clientViewMode === 'anual') {
      setClientYear(y => y - 1);
    } else {
      if (clientMonth === 0) {
        setClientMonth(11);
        setClientYear(y => y - 1);
      } else {
        setClientMonth(m => m - 1);
      }
    }
  };

  const handleClientNext = () => {
    if (clientViewMode === 'anual') {
      if (clientYear < currentYear) setClientYear(y => y + 1);
    } else {
      const isCurrentPeriod = clientYear === currentYear && clientMonth === currentMonth;
      if (!isCurrentPeriod) {
        if (clientMonth === 11) {
          setClientMonth(0);
          setClientYear(y => y + 1);
        } else {
          setClientMonth(m => m + 1);
        }
      }
    }
  };

  const isClientNextDisabled = clientViewMode === 'anual'
    ? clientYear >= currentYear
    : clientYear === currentYear && clientMonth >= currentMonth;

  const clientPeriodDisplay = clientViewMode === 'anual'
    ? String(clientYear)
    : `${MONTH_LABELS[clientMonth]} ${clientYear}`;

  // Permissions
  const isAdmin = rol === 'administrador';
  const isComercial = rol === 'comercial';
  const isCliente = rol === 'cliente';
  const canSeeAgendaWidget = isAdmin;
  const canSeeRenovacionesWidget = isAdmin;
  const canSeeEnergyAnalytics = isAdmin;
  const canSeeMarketData = isAdmin;

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
            {isCliente || isComercial
              ? 'Gestiona tus suministros desde un único lugar.'
              : 'Gestiona tus clientes, contratos y documentos desde un único lugar.'}
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
                    { key: 'showMarket' as const, label: 'Mercado Eléctrico' },
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

      {/* ============ CLIENT DASHBOARD ============ */}
      {(isCliente || isComercial) && (
        <Suspense fallback={
          <div className="glass-card p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <span className="text-sm text-secondary">{isComercial ? 'Cargando panel comercial…' : 'Cargando panel de cliente…'}</span>
          </div>
        }>
          {/* View Mode Toggle + Period Selector */}
          <div className="relative flex items-center">
            <div className="flex gap-1 bg-bg-intermediate rounded-xl p-1">
              <button
                onClick={() => setClientViewMode('anual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${clientViewMode === 'anual'
                  ? 'bg-fenix-500 text-white shadow-md'
                  : 'text-secondary hover:text-primary hover:bg-white/5'
                }`}
              >
                Anual
              </button>
              <button
                onClick={() => setClientViewMode('mensual')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${clientViewMode === 'mensual'
                  ? 'bg-fenix-500 text-white shadow-md'
                  : 'text-secondary hover:text-primary hover:bg-white/5'
                }`}
              >
                Mensual
              </button>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  onClick={handleClientPrev}
                  className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 min-w-[120px] justify-center">
                  <Calendar size={16} className="text-fenix-500" />
                  <span className="text-lg font-bold text-primary">{clientPeriodDisplay}</span>
                </div>
                <button
                  onClick={handleClientNext}
                  disabled={isClientNextDisabled}
                  className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>

          <ClientInsightsWidget
            clienteId={isCliente ? (clienteId ?? undefined) : undefined}
            year={clientYear}
            month={clientViewMode === 'mensual' ? clientMonth : undefined}
          />
          <CostBreakdownWidget
            clienteId={isCliente ? (clienteId ?? undefined) : undefined}
            year={clientYear}
            month={clientViewMode === 'mensual' ? clientMonth : undefined}
          />

          {/* Comercial-specific bottom widgets */}
          {isComercial && (
            <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
              <TopPuntosKwhWidget />
              <TopPuntosEurosWidget />
              <ComercialStatsWidget />
            </div>
          )}
        </Suspense>
      )}

      {/* Market View Selector - Always visible when user has access */}
      {canSeeMarketData && viewSettings.showMarket && (
        <MarketTabSelector activeView={marketView} onViewChange={setMarketView} />
      )}

      {/* ============================================================
          PESTAÑA: INDICADORES CLAVE
          ============================================================ */}
      {marketView === 'indicators' && (
        <>
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
          </div>
        </>
      )}

      {/* ============================================================
          PESTAÑA: LUZ (MERCADO ELÉCTRICO)
          ============================================================ */}
      {canSeeMarketData && viewSettings.showMarket && marketView === 'electricity' && (
        <MercadoDashboard />
      )}

      {/* ============================================================
          PESTAÑA: GAS (MERCADO DE GAS NATURAL)
          ============================================================ */}
      {canSeeMarketData && viewSettings.showMarket && marketView === 'gas' && (
        <GasDashboard />
      )}
    </div>
  );
}
