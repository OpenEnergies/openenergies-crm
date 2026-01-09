import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useSession } from '@hooks/useSession';
import { Home, Users, Building2, Handshake, Files, Zap, ChartNoAxesCombined, CalendarCheck, CalendarDays, BriefcaseBusiness, Layers, Radio, Receipt, Scale } from 'lucide-react';

export function Nav({ isCollapsed }: { isCollapsed: boolean }) {
  const { location } = useRouterState();
  const { rol } = useSession();

  const navItems = [
    { to: '/app', label: 'Inicio', icon: Home, module: 'inicio' },
    { to: '/app/clientes', label: 'Clientes', icon: Handshake, module: 'clientes' },
    { to: '/app/puntos', label: 'Puntos', icon: Zap, module: 'puntos' },
    { to: '/app/contratos', label: 'Contratos', icon: BriefcaseBusiness, module: 'contratos' },
    { to: '/app/empresas', label: 'Empresas', icon: Building2, module: 'empresas' },
    { to: '/app/canales', label: 'Canales', icon: Radio, module: 'canales' },
    { to: '/app/renovaciones', label: 'Renovaciones', icon: CalendarCheck, module: 'renovaciones' },
    { to: '/app/usuarios', label: 'Usuarios', icon: Users, module: 'usuarios' },
    { to: '/app/agenda', label: 'Agenda', icon: CalendarDays, module: 'agenda' },
    { to: '/app/comparativas/nueva', label: 'Comparativas', icon: Scale, module: 'comparativas' },
    { to: '/app/documentos', label: 'Documentos', icon: Files, module: 'documentos' },
    { to: '/app/facturas', label: 'Facturas', icon: Receipt, module: 'facturas' },
    { to: '/app/analiticas', label: 'Analíticas', icon: ChartNoAxesCombined, module: 'estadisticas' },
  ];

  const visibleItems = navItems.filter(item => {
    if (item.module === 'inicio') return true;
    return canSeeModule(rol ?? 'cliente', item.module as any);
  });

  return (
    <nav className={`flex-1 overflow-y-auto py-3 px-2 ${isCollapsed ? 'scrollbar-hide' : ''}`}>
      <ul className="space-y-1">
        {visibleItems.map(item => {
          const isActive = location.pathname.startsWith(item.to) && (item.to !== '/app' || location.pathname === '/app');
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${isActive
                    ? 'bg-fenix-500/15 text-fenix-600 dark:text-fenix-400 border-l-2 border-fenix-500 ml-0'
                    : 'text-secondary hover:text-primary hover:bg-fenix-500/8'}
                `}
              >
                <item.icon size={20} className="flex-shrink-0" />
                <span className={`
                  text-sm font-medium whitespace-nowrap
                  transition-opacity duration-200
                  ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}
                `}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}