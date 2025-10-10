import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useSession } from '@hooks/useSession';

export function Nav() {
  const routerState = useRouterState();
  const { rol } = useSession();

  const items = [
    { to: '/app', label: 'Inicio' },
    canSeeModule(rol ?? 'cliente', 'empresas') && { to: '/app/empresas', label: 'Empresas' },
    canSeeModule(rol ?? 'cliente', 'usuarios') && { to: '/app/usuarios', label: 'Usuarios' },
    canSeeModule(rol ?? 'cliente', 'clientes') && { to: '/app/clientes', label: 'Clientes' },
    canSeeModule(rol ?? 'cliente', 'puntos') && { to: '/app/puntos', label: 'Puntos' },
    canSeeModule(rol ?? 'cliente', 'contratos') && { to: '/app/contratos', label: 'Contratos' },
    canSeeModule(rol ?? 'cliente', 'documentos') && { to: '/app/documentos', label: 'Documentos' }
  ].filter(Boolean) as {to:string;label:string}[];

  return (
    <nav aria-label="Navegación principal">
      <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:'.25rem'}}>
        {items.map(it =>
          <li key={it.to}>
            <Link to={it.to} className={routerState.location.href?.startsWith(it.to) ? 'badge' : ''}>
              {it.label}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
