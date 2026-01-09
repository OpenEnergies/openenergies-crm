import { Outlet, useNavigate, Link } from '@tanstack/react-router';
import { Nav } from './Nav';
import { HamburgerButton } from './navigation/HamburgerButton';
import { NavigationMenu } from './navigation/NavigationMenu';

import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { LogOut, Bell, Loader2, User, MoreVertical, Leaf } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@hooks/useNotifications';
import ChatWidget from '@features/chat/ChatWidget';

export default function Layout() {
  const { rol, nombre, avatar_url, loading: sessionLoading, userId } = useSession();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  const fallbackInitial = nombre ? nombre.charAt(0).toUpperCase() : '?';

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
          <span className="text-secondary">Cargando sesión...</span>
        </div>
      </div>
    );
  }

  if (!userId && !sessionLoading) {
    navigate({ to: '/login', replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col md:flex-row">
      {/* Mobile Navigation Menu */}
      <NavigationMenu
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        userRole={rol ?? 'comercial'}
        userName={nombre ?? undefined}
        onLogout={logout}
      />

      {/* Sidebar - Hidden on mobile, visible from md+ */}
      <aside
        className={`
          hidden md:flex flex-col
          fixed top-0 left-0 h-screen z-[100]
          glass-sidebar
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
        `}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        {/* Logo */}
        <div className="p-3 border-b border-bg-intermediate">
          <Link
            to="/app"
            className="flex items-center gap-3 text-primary hover:text-fenix-500 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-white/90 flex items-center justify-center flex-shrink-0">
              <img src="/logo_openenergies.png" alt="OE" className="w-9 h-9" />
            </div>
            <h1 className={`
              font-semibold text-lg whitespace-nowrap
              transition-opacity duration-200
              ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}
            `}>
              Open Energies
            </h1>
          </Link>
        </div>

        {/* Navigation */}
        <Nav isCollapsed={isCollapsed} />

        {/* Copyright */}
        <div className={`
          mt-auto px-3 py-2 text-xs text-secondary text-center border-t border-primary
          transition-opacity duration-200
          ${isCollapsed ? 'opacity-0' : 'opacity-100'}
        `}>
          © {new Date().getFullYear()} Converly
        </div>
      </aside>

      {/* Main Content */}
      <div className={`
        flex-1 flex flex-col min-h-screen
        transition-all duration-300
        md:ml-16 lg:ml-16
      `}>
        {/* Mobile Topbar */}
        <header className="
          md:hidden
          sticky top-0 z-20
          glass-card rounded-none border-x-0 border-t-0
          flex items-center justify-between
          px-4 py-3
        ">
          <div className="flex items-center gap-3">
            <HamburgerButton
              isOpen={isNavOpen}
              onClick={() => setIsNavOpen(!isNavOpen)}
            />
            <span className="font-semibold text-primary">CRM Open Energies</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/app/notificaciones"
              className="relative p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors"
              title="Notificaciones"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Desktop Topbar */}
        <header className="
          hidden md:flex
          sticky top-0 z-20
          items-center justify-end
          px-6 lg:px-8 py-3
          bg-bg-primary/80 backdrop-blur-sm
        ">
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Link
              to="/app/notificaciones"
              className="relative p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors"
              title="Notificaciones"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Separator */}
            <div className="w-px h-6 bg-bg-intermediate mx-1" />

            {/* Profile */}
            <Link
              to="/app/perfil"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-intermediate transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-fenix-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden ring-2 ring-transparent group-hover:ring-fenix-500 transition-all">
                {avatar_url ? (
                  <img src={avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{fallbackInitial}</span>
                )}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-sm text-primary truncate max-w-[120px]">{nombre ?? 'Usuario'}</span>
                <span className="text-xs text-secondary capitalize">{rol}</span>
              </div>
            </Link>

            {/* More Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                title="Más opciones"
              >
                <MoreVertical size={20} />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 py-2 glass-modal rounded-xl shadow-xl z-50 animate-fade-in">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-secondary hover:text-red-500 hover:bg-red-500/15 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 pt-4 px-4 pb-4 md:pt-3 md:px-6 md:pb-6 lg:pt-0 lg:px-8 lg:pb-8 w-full">
          <Outlet />
        </main>
      </div>

      {/* Floating Chat Widget - visible for admin and comercial */}
      {/* TODO: Re-enable ChatWidget after improvements */}
      {/* {(rol === 'administrador' || rol === 'comercial') && <ChatWidget />} */}
    </div>
  );
}