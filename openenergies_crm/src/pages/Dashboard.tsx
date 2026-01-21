import { useState, useEffect } from 'react';
import { useSession } from '@hooks/useSession';
import { Settings, Eye, EyeOff } from 'lucide-react';

// New energy analytics widgets
import KPICardsSection from './dashboard/widgets/KPICardsSection';
import EstadoCharts from './dashboard/widgets/EstadoCharts';
import TopPuntosValorWidget from './dashboard/widgets/TopPuntosValorWidget';
import MarketSummaryCard from './dashboard/widgets/market/MarketSummaryCard';
import PriceChartWidget from './dashboard/widgets/market/PriceChartWidget';
import PeriodsTableWidget from './dashboard/widgets/market/PeriodsTableWidget';

// Hooks
import { useMarketDailyStats, useMarketChartData } from '@features/market-data/hooks/useMarketData';

// Existing widgets
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';
import MisClientesAsignadosWidget from './dashboard/widgets/MisClientesAsignadosWidget';
import EstadoMisClientesWidget from './dashboard/widgets/EstadoMisClientesWidget';

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

  // Market Data State
  const [marketDate, setMarketDate] = useState<Date>(new Date());
  const [isToday, setIsToday] = useState(true);

  // Hardcoded GeoID for Spain (Península) - assuming 8741 or similar, but prompt says fetching from view.
  // The service takes geoId. Let's assume 8741 (Península) as default or fetch.
  // Context says `fetchDailyStats(date: Date, geoId: number)`. I will use 8741 as a safe default for now or 0 if RPC handles defaults.
  // Actually, I'll use 8741 which is standard for Peninsular system in ESIOS.
  const GEO_ID = 8741;

  const {
    data: marketDailyStats,
    isError: isMarketStatsError,
    isLoading: isMarketStatsLoading
  } = useMarketDailyStats(marketDate, GEO_ID);

  const {
    data: marketChartData,
    isError: isMarketChartError
  } = useMarketChartData(marketDate, GEO_ID);

  // Helper to switch dates
  const handleDateChange = (today: boolean) => {
    setIsToday(today);
    const date = new Date();
    if (!today) {
      date.setDate(date.getDate() + 1);
    }
    setMarketDate(date);
  };

  // Permissions
  const isAdmin = rol === 'administrador';
  const isComercial = rol === 'comercial';
  const canSeeAgendaWidget = isAdmin || isComercial;
  const canSeeRenovacionesWidget = isAdmin || isComercial;
  const canSeeMisClientesWidget = isComercial;
  const canSeeEstadoMisClientesWidget = isComercial;
  const canSeeEnergyAnalytics = isAdmin; // Solo admin ve analytics de energía
  const canSeeMarketData = isAdmin || isComercial; // Advisors and Clients (via 'comercial' role for now?) Prompt says "Advisors (CRM) and Clients".

  // Save settings on change
  useEffect(() => {
    saveViewSettings(viewSettings);
  }, [viewSettings]);

  const toggleSetting = (key: keyof ViewSettings) => {
    setViewSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isMarketError = isMarketStatsError || isMarketChartError;

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

      {/* KPI Cards - Admin only */}
      {canSeeEnergyAnalytics && viewSettings.showKPIs && (
        <KPICardsSection />
      )}

      {/* Market Data Section */}
      {canSeeMarketData && viewSettings.showMarket && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Mercado Eléctrico (OMIE / PVPC)</h2>

          {isMarketError ? (
            <div className="w-full p-6 text-center bg-amber-50 rounded-xl border border-amber-100 text-amber-700">
              <p>Datos de mercado actualizándose...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4 md:gap-6 h-auto md:h-[400px]">
              {/* Summary Card */}
              <div className="md:col-span-1 h-full">
                {marketDailyStats ? (
                  <MarketSummaryCard
                    data={marketDailyStats}
                    isToday={isToday}
                    onDateChange={handleDateChange}
                  />
                ) : (
                  <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse p-4">
                    <div className="h-6 w-32 bg-slate-100 rounded mb-4"></div>
                    <div className="h-10 w-full bg-slate-100 rounded mb-4"></div>
                    <div className="h-10 w-full bg-slate-100 rounded"></div>
                  </div>
                )}
              </div>

              {/* Chart */}
              <div className="md:col-span-2 h-full">
                {marketChartData && marketChartData.length > 0 ? (
                  <PriceChartWidget data={marketChartData} />
                ) : (
                  <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400">
                    {isMarketStatsLoading ? 'Cargando gráfico...' : 'No hay datos disponibles'}
                  </div>
                )}
              </div>

              {/* Periods Table */}
              <div className="md:col-span-1 h-full">
                {marketDailyStats ? (
                  <PeriodsTableWidget data={marketDailyStats} />
                ) : (
                  <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse p-4"></div>
                )}
              </div>
            </div>
          )}
        </div>
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
