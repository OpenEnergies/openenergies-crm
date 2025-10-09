import { Outlet } from '@tanstack/react-router';
import { Nav } from './Nav';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';

export default function Layout() {
  const { userId, rol } = useSession();

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Barra lateral">
        <div style={{display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'1rem'}}>
          <div aria-hidden="true" style={{width:10, height:10, borderRadius:999, background:'var(--primary)'}} />
          <strong>Open Energies CRM</strong>
        </div>
        <div style={{marginBottom:'1rem', color:'var(--muted)'}}>
          <div><span className="kbd">{rol ?? '—'}</span></div>
        </div>
        <Nav />
      </aside>
      <main>
        <div className="topbar">
          <div aria-live="polite">Sesión: {userId ? <span className="badge">{userId.slice(0,8)}</span> : '—'}</div>
          <div>
            <button onClick={logout} aria-label="Cerrar sesión">Salir</button>
          </div>
        </div>
        <div className="container"><Outlet /></div>
      </main>
    </div>
  );
}
