import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import {
    Home,
    Users,
    Building2,
    Handshake,
    Files,
    Zap,
    ChartNoAxesCombined,
    CalendarCheck,
    CalendarDays,
    BriefcaseBusiness,
    User, // Moved User here
    LogOut,
    X,
    Layers,
    Radio
} from 'lucide-react';

interface NavigationMenuProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly userRole: string;
    readonly userName?: string;
    readonly onLogout: () => void;
}

export function NavigationMenu({
    isOpen,
    onClose,
    userRole,
    userName = 'Usuario',
    onLogout
}: NavigationMenuProps) {
    const { location } = useRouterState();


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
        { to: '/app/comparativas/nueva', label: 'Comparativas', icon: ChartNoAxesCombined, module: 'comparativas' },
        { to: '/app/documentos', label: 'Documentos', icon: Files, module: 'documentos' },
    ];

    const visibleItems = navItems.filter(item => {
        if (item.module === 'inicio') return true;
        return canSeeModule(userRole as any, item.module as any);
    });

    const handleNavClick = () => {
        onClose();
    };

    const handleLogout = () => {
        onClose();
        onLogout();
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`
          fixed inset-0 bg-black/60 backdrop-blur-sm z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Side Panel */}
            <div className={`
        fixed top-0 left-0 h-full w-72 z-50
        glass-sidebar
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-bg-intermediate">
                    <span className="font-semibold text-white">Menú</span>
                    <button
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-fenix-500/8 transition-colors"
                        onClick={onClose}
                        aria-label="Cerrar menú"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 p-4 border-b border-bg-intermediate">
                    <div className="w-10 h-10 rounded-full bg-fenix-500 flex items-center justify-center text-white">
                        <User size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">{userName}</span>
                        <span className="text-xs text-gray-400 capitalize">{userRole}</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    <ul className="space-y-1">
                        {visibleItems.map(item => {
                            const isActive = location.pathname.startsWith(item.to) &&
                                (item.to !== '/app' || location.pathname === '/app');
                            return (
                                <li key={item.to}>
                                    <Link
                                        to={item.to}
                                        className={`
                      flex items-center gap-3 px-3 py-3 rounded-lg
                      transition-colors duration-150 touch-target
                      ${isActive
                                                ? 'bg-fenix-500/15 text-fenix-400'
                                                : 'text-gray-300 hover:text-white hover:bg-fenix-500/8'}
                    `}
                                        onClick={handleNavClick}
                                    >
                                        <item.icon size={20} />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="border-t border-bg-intermediate p-3 space-y-1">
                    <Link
                        to="/app/perfil"
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-fenix-500/8 transition-colors touch-target"
                        onClick={handleNavClick}
                    >
                        <User size={20} />
                        <span className="text-sm font-medium">Mi Perfil</span>
                    </Link>
                    <button
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-500/15 transition-colors touch-target cursor-pointer"
                        onClick={handleLogout}
                    >
                        <LogOut size={20} />
                        <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                </div>
            </div>
        </>
    );
}
