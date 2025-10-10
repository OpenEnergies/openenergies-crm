import { Outlet, useNavigate } from '@tanstack/react-router';
import { Nav } from './Nav';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';

export default function Layout() {
  const { rol } = useSession();
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary)' }}>Open Energies</h1>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>CRM</p>
          <div style={{ textTransform: 'capitalize' }}>
            Rol: <span className="badge">{rol ?? '—'}</span>
          </div>
        </div>
        <Nav />
      </aside>

      <div className="main-content">
        <header className="topbar">
          <button onClick={logout} className="secondary">Cerrar sesión</button>
        </header>
        <main className="container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
