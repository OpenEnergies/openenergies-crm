import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useSession } from '@hooks/useSession';
import { clsx } from '@lib/utils';
// Importamos los iconos que vamos a usar
import { Home, Users, Building, HardHat, FileText, FolderKanban } from 'lucide-react';

export function Nav() {
  const { location } = useRouterState();
  const { rol } = useSession();

  const navItems = [
    { to: '/app', label: 'Inicio', icon: Home, module: 'inicio' },
    { to: '/app/empresas', label: 'Empresas', icon: Building, module: 'empresas' },
    { to: '/app/usuarios', label: 'Usuarios', icon: Users, module: 'usuarios' },
    { to: '/app/clientes', label: 'Clientes', icon: HardHat, module: 'clientes' },
    { to: '/app/puntos', label: 'Puntos', icon: FolderKanban, module: 'puntos' },
    { to: '/app/contratos', label: 'Contratos', icon: FileText, module: 'contratos' },
    { to: '/app/documentos', label: 'Documentos', icon: FileText, module: 'documentos' },
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
          const isActive = location.pathname.startsWith(item.to) && (item.to !== '/app' || location.pathname === '/app');
          return (
            <li key={item.to}>
              <Link to={item.to} className={clsx('nav-link', isActive && 'active')}>
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
