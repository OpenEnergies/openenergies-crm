import { Outlet, useNavigate, Link } from '@tanstack/react-router';
import { Nav } from './Nav';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { LogOut, Sun } from 'lucide-react'; // Importamos un icono para el logout
import { useState } from 'react';
import { clsx } from '@lib/utils'; // Importamos clsx

export default function Layout() {
  const { rol, nombre, avatar_url, loading: sessionLoading, userId } = useSession();
  const navigate = useNavigate();

  // Estado para controlar el colapso del sidebar
  const [isCollapsed, setIsCollapsed] = useState(true);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  const fallbackInitial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  if (sessionLoading) {
       return <div className="card">Cargando sesión...</div>; // O un spinner más elegante
  }
  if (!userId && !sessionLoading) {
      navigate({ to: '/login', replace: true });
      return null; // Evita renderizar el layout
  }

  return (
    <div className="layout">
      <aside 
        className={clsx('sidebar', isCollapsed && 'collapsed')}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        {/* Sección Superior: Logo y Título */}
        <div>
          {/* Modificamos el título para que se adapte al colapso */}
          <Link to="/app" className="sidebar-title-link">
            <Sun className="sidebar-title-icon" size={20} />
            <h1 className="sidebar-title-text">
              Open Energies
            </h1>
          </Link>
        </div>

        {/* Sección Central: Navegación Principal */}
        <Nav isCollapsed={isCollapsed} />

        {/* Sección Inferior: Perfil y Logout */}
        <div className="sidebar-footer">
          <Link to="/app/perfil" className="profile-link">
            {/* Aquí podríamos poner el avatar en el futuro */}
            <div className="profile-avatar">
              {avatar_url ? (
                 <img src={avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
               ) : (
                 <span>{fallbackInitial}</span> // Usa el fallback calculado
               )}
            </div>
            <div className="profile-info">
              <span className="profile-name">{nombre ?? 'Usuario'}</span>
              <span className="profile-role">{rol}</span>
            </div>
          </Link>
          <button onClick={logout} className="logout-button">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <div className="main-content">
        {/* La barra superior ahora puede estar vacía o tener otros elementos como notificaciones */}
        <header className="topbar"></header>
        <main className="container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
