import { Outlet, useNavigate, Link } from '@tanstack/react-router';
import { Nav } from './Nav';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { LogOut } from 'lucide-react'; // Importamos un icono para el logout

export default function Layout() {
  const { rol, nombre } = useSession();
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Sección Superior: Logo y Título */}
        <div>
          <h1 style={{ margin: 7, fontSize: '1.25rem', color: 'var(--primary)' }}>CRM Open Energies</h1>
        </div>

        {/* Sección Central: Navegación Principal */}
        <Nav />

        {/* Sección Inferior: Perfil y Logout */}
        <div className="sidebar-footer">
          <Link to="/app/perfil" className="profile-link">
            {/* Aquí podríamos poner el avatar en el futuro */}
            <div className="profile-avatar">
              <span>{nombre ? nombre.charAt(0).toUpperCase() : '?'}</span>
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
