import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useState } from 'react';
import {
    Home,
    Users,
    Building2,
    Handshake,
    Files,
    Zap,
    ChartNoAxesCombined,
    CalendarCheck,
    BriefcaseBusiness,
    User,
    LogOut,
    X,
    Radio,
    Receipt,
    Scale,
    ChevronRight,
    Settings,
    Activity,
    type LucideIcon
} from 'lucide-react';

type NavItem = {
    to: string;
    label: string;
    module: string;
};

type NavGroup = {
    id: string;
    label: string;
    icon: LucideIcon;
    items: NavItem[];
};

type IndividualPage = {
    to: string;
    label: string;
    icon: LucideIcon;
    module: string;
    exact?: boolean;
};

type NavEntry = IndividualPage | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
    return 'items' in entry;
}

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

    // Estado para grupos expandidos
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(['gestion', 'operaciones', 'analisis', 'configuracion'])
    );

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const isComercial = userRole === 'comercial';

    // Estructura de navegación
    const navStructure: NavEntry[] = [
        { to: '/app', label: 'Inicio', icon: Home, module: 'inicio', exact: true },
        {
            id: 'gestion',
            label: 'Gestión comercial',
            icon: Handshake,
            items: [
                { to: '/app/clientes', label: isComercial ? 'Sociedades' : 'Clientes', module: 'clientes' },
                { to: '/app/empresas', label: 'Comercializadoras', module: 'empresas' },
                { to: '/app/puntos', label: 'Puntos de suministro', module: 'puntos' },
                { to: '/app/contratos', label: 'Contratos', module: 'contratos' },
                { to: '/app/renovaciones', label: 'Renovaciones', module: 'renovaciones' },
                { to: '/app/canales', label: 'Canales', module: 'canales' },
            ],
        },
        {
            id: 'operaciones',
            label: 'Operaciones',
            icon: Receipt,
            items: [
                { to: '/app/facturas', label: 'Facturas', module: 'facturas' },
                { to: '/app/comparativas/nueva', label: 'Comparativas', module: 'comparativas' },
                { to: '/app/informes', label: 'Informes de Mercado', module: 'comparativas' },
            ],
        },
        { to: '/app/documentos', label: 'Documentos', icon: Files, module: 'documentos', exact: true },
        {
            id: 'analisis',
            label: 'Análisis',
            icon: ChartNoAxesCombined,
            items: [
                { to: '/app/analiticas', label: 'Analíticas', module: 'estadisticas' },
                { to: '/app/actividad', label: 'Actividad', module: 'actividad' },
            ],
        },
        {
            id: 'configuracion',
            label: 'Configuración',
            icon: Settings,
            items: [
                { to: '/app/usuarios', label: 'Usuarios', module: 'usuarios' },
                { to: '/app/perfil', label: 'Ajustes', module: 'inicio' },
            ],
        },
    ];

    const filterByPermissions = (module: string): boolean => {
        if (module === 'inicio') return true;
        return canSeeModule(userRole as any, module as any);
    };

    const processedStructure = navStructure
        .map((entry) => {
            if (isGroup(entry)) {
                const visibleItems = entry.items.filter((item) => filterByPermissions(item.module));
                if (visibleItems.length === 0) return null;
                if (visibleItems.length === 1) {
                    const firstItem = visibleItems[0]!;
                    return {
                        to: firstItem.to,
                        label: firstItem.label,
                        icon: entry.icon,
                        module: firstItem.module,
                    } as IndividualPage;
                }
                return { ...entry, items: visibleItems };
            }
            return filterByPermissions(entry.module) ? entry : null;
        })
        .filter(Boolean) as NavEntry[];

    const handleNavClick = () => onClose();
    const handleLogout = () => { onClose(); onLogout(); };

    const isItemActive = (to: string, exact = false) => {
        return exact
            ? location.pathname === to
            : location.pathname.startsWith(to);
    };

    const isGroupActive = (items: NavItem[]) => {
        return items.some((item) => isItemActive(item.to));
    };

    const renderIndividualPage = (page: IndividualPage, index: number, totalItems: number) => {
        const isActive = isItemActive(page.to, page.exact);
        const showConnector = index < totalItems - 1;
        return (
            <li key={page.to} className="relative">
                {/* Línea conectora vertical */}
                {showConnector && (
                    <div className="absolute left-[21px] top-11 w-px h-[calc(100%-2.75rem+0.125rem)] bg-slate-200 dark:bg-slate-700" />
                )}
                <Link
                    to={page.to}
                    className={`
            flex items-center gap-3 h-11 px-3 rounded-lg
            transition-colors duration-150
            ${isActive
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'}
          `}
                    onClick={handleNavClick}
                >
                    <page.icon size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium">{page.label}</span>
                </Link>
            </li>
        );
    };

    const renderGroup = (group: NavGroup, index: number, totalItems: number) => {
        const isExpanded = expandedGroups.has(group.id);
        const hasActiveItem = isGroupActive(group.items);
        const showConnector = index < totalItems - 1;

        // Calcular altura del conector: base + altura extra si está expandido
        const subItemsHeight = isExpanded ? group.items.length * 36 + 4 : 0; // h-9 = 36px, mt-1 = 4px

        return (
            <li key={group.id} className="relative">
                {/* Línea conectora vertical - posición fija */}
                {showConnector && (
                    <div
                        className="absolute left-[21px] top-11 w-px bg-slate-200 dark:bg-slate-700 transition-all duration-200"
                        style={{ height: `calc(100% - 2.75rem + 0.125rem + ${subItemsHeight}px)` }}
                    />
                )}
                <button
                    onClick={() => toggleGroup(group.id)}
                    className={`
            w-full flex items-center gap-3 h-11 px-3 rounded-lg
            transition-colors duration-150 cursor-pointer
            ${hasActiveItem
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'}
          `}
                >
                    <group.icon size={18} className="flex-shrink-0" />
                    <span className="flex-1 text-left text-sm font-medium">{group.label}</span>
                    <ChevronRight
                        size={14}
                        className={`
              flex-shrink-0 text-slate-400 dark:text-slate-500
              transition-transform duration-200
              ${isExpanded ? 'rotate-90' : 'rotate-0'}
            `}
                    />
                </button>

                {/* Submenú con posición absoluta para no afectar el layout de los iconos */}
                <div className={`
          overflow-hidden transition-all duration-200
          ${isExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}
        `}>
                    <ul className="ml-5 pl-3 mt-1 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        {group.items.map((item) => {
                            const isActive = isItemActive(item.to);
                            return (
                                <li key={item.to}>
                                    <Link
                                        to={item.to}
                                        className={`
                    flex items-center h-9 px-2 rounded-md
                    text-[13px] transition-colors duration-150
                    ${isActive
                                                ? 'text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-800'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                  `}
                                        onClick={handleNavClick}
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </li>
        );
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`
          fixed inset-0 bg-black/50 z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Side Panel - Fondo sólido */}
            <div className={`
        fixed top-0 left-0 h-full w-72 z-50
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
        shadow-xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="font-semibold text-slate-900 dark:text-white">Menú</span>
                    <button
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={onClose}
                        aria-label="Cerrar menú"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="w-10 h-10 rounded-full bg-slate-600 dark:bg-slate-700 flex items-center justify-center text-white">
                        <User size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{userName}</span>
                        {userRole === 'administrador' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{userRole}</span>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 bg-white dark:bg-slate-900">
                    <ul className="space-y-0.5">
                        {processedStructure.map((entry, index) => {
                            if (isGroup(entry)) {
                                return renderGroup(entry, index, processedStructure.length);
                            }
                            return renderIndividualPage(entry, index, processedStructure.length);
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                    <button
                        className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                        onClick={handleLogout}
                    >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Cerrar sesión</span>
                    </button>
                </div>
            </div>
        </>
    );
}
