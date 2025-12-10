import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useSession } from '@hooks/useSession';
import { clsx } from '@lib/utils';
// Importamos los iconos que vamos a usar
import { Home, Users, Building2, Handshake, Files, EvCharger, ChartNoAxesCombined, CalendarCheck, CalendarDays, BriefcaseBusiness } from 'lucide-react';

export function Nav({ isCollapsed }: { isCollapsed: boolean }) {
  const { location } = useRouterState();
  const { rol } = useSession();

  // Reordenado: Usuarios movido después de Agenda
  const navItems = [
    { to: '/app', label: 'Inicio', icon: Home, module: 'inicio' },
    { to: '/app/empresas', label: 'Empresas', icon: Building2, module: 'empresas' },
    { to: '/app/clientes', label: 'Clientes', icon: Handshake, module: 'clientes' },
    { to: '/app/puntos', label: 'Puntos', icon: EvCharger, module: 'puntos' },
    { to: '/app/contratos', label: 'Contratos', icon: BriefcaseBusiness, module: 'contratos' },
    { to: '/app/renovaciones', label: 'Renovaciones', icon: CalendarCheck, module: 'renovaciones' },
    { to: '/app/documentos', label: 'Documentos', icon: Files, module: 'documentos' },
    { to: '/app/comparativas/nueva', label: 'Comparativas', icon: ChartNoAxesCombined, module: 'comparativas' },
    { to: '/app/agenda', label: 'Agenda', icon: CalendarDays, module: 'agenda' },
    { to: '/app/usuarios', label: 'Usuarios', icon: Users, module: 'usuarios' }, // <-- MOVIDO AQUÍ
  ];

  // Filtramos los items según los permisos del rol
  const visibleItems = navItems.filter(item => {
    if (item.module === 'inicio') return true;
    return canSeeModule(rol ?? 'cliente', item.module as any);
  });

  return (
    <nav className="main-nav">
      <ul>
        {visibleItems.map(item => {
          const exactMatchRoutes = ['/app', '/app/empresas', '/app/usuarios'];
          
          const isActive = exactMatchRoutes.includes(item.to)
            ? location.pathname === item.to // Coincidencia exacta
            : location.pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link to={item.to} className={clsx('nav-link', isActive && 'active')}>
                <item.icon size={20} />
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}