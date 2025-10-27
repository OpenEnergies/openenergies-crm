import { Outlet, useNavigate, Link } from '@tanstack/react-router';
import { Nav } from './Nav';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
// --- (1) Importar Bell (campana) ---
import { LogOut, Sun, Bell } from 'lucide-react';
import { useState } from 'react';
import { clsx } from '@lib/utils';

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
          <Link to="/app" className="sidebar-title-link">
            <Sun className="sidebar-title-icon" size={20} />
            <h1 className="sidebar-title-text">
              Open Energies
            </h1>
          </Link>
        </div>

        {/* Sección Central: Navegación Principal */}
        <Nav isCollapsed={isCollapsed} />

        {/* --- (2) SECCIÓN INFERIOR MODIFICADA --- */}
        <div className="sidebar-footer">
          {/* Enlace al Perfil */}
          <Link to="/app/perfil" className="profile-link">
            <div className="profile-avatar">
              {avatar_url ? (
                 <img src={avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
               ) : (
                 <span>{fallbackInitial}</span>
               )}
            </div>
            <div className="profile-info">
              <span className="profile-name">{nombre ?? 'Usuario'}</span>
              <span className="profile-role">{rol}</span>
            </div>
          </Link>

          {/* Icono de Notificaciones (a la derecha del perfil) */}
          <Link to="/app/notificaciones" className="notification-button" title="Notificaciones">
             <Bell size={20} />
          </Link>

        </div>
        {/* Botón de Cerrar Sesión (Debajo del footer) */}
        <div className="logout-section">
          <button onClick={logout} className="nav-link logout-button-styled">
            <LogOut size={20} />
            <span className="nav-label">Cerrar sesión</span>
          </button>
        </div>
         {/* --- FIN MODIFICACIÓN SECCIÓN INFERIOR --- */}
      </aside>

      <div className="main-content">
        <main className="container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}