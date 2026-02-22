import { Link, useRouterState } from '@tanstack/react-router';
import { canSeeModule } from '@lib/permissions';
import { useSession } from '@hooks/useSession';
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

export function Nav({ isCollapsed }: { isCollapsed: boolean }) {
  const { location } = useRouterState();
  const { rol } = useSession();

  // Estado de grupos persistente
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

  // Estructura de navegación
  const navStructure: NavEntry[] = [
    { to: '/app', label: 'Inicio', icon: Home, module: 'inicio', exact: true },
    {
      id: 'gestion',
      label: 'Gestión comercial',
      icon: Handshake,
      items: [
        { to: '/app/clientes', label: 'Clientes', module: 'clientes' },
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
    return canSeeModule(rol ?? 'cliente', module as any);
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

  const isItemActive = (to: string, exact = false) => {
    return exact
      ? location.pathname === to
      : location.pathname.startsWith(to);
  };

  const isGroupActive = (items: NavItem[]) => {
    return items.some((item) => isItemActive(item.to));
  };

  // Calcular altura del espaciado cuando está colapsado pero el grupo está expandido
  const getCollapsedGroupSpacing = (itemCount: number) => {
    // Cada item tiene altura de 32px (h-8), exactamente igual que en expandido
    // El mt-0.5 (2px) se aplica desde la clase, no se suma aquí
    return itemCount * 32;
  };

  // Estilo común para headers (tanto grupos como páginas individuales)
  const getHeaderClasses = (isActive: boolean) => `
    flex items-center gap-2.5 h-9 px-2.5 rounded-md
    transition-colors duration-150
    ${isActive
      ? 'bg-fenix-500/10 text-slate-700 dark:text-slate-300'
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-fenix-500/5 dark:hover:bg-fenix-500/10'}
  `;

  // Render página individual (mismo estilo que header de grupo)
  const renderIndividualPage = (page: IndividualPage) => {
    const isActive = isItemActive(page.to, page.exact);
    const textColorClass = isActive
      ? 'text-slate-700 dark:text-slate-300'
      : 'text-slate-500 dark:text-slate-400';

    return (
      <li key={page.to}>
        <Link to={page.to} className={getHeaderClasses(isActive)}>
          <page.icon size={18} className={`flex-shrink-0 ${textColorClass}`} />
          <span className={`
            text-sm font-medium whitespace-nowrap overflow-hidden
            transition-all duration-200 ${textColorClass}
            ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
          `}>
            {page.label}
          </span>
          {/* Chevron placeholder para mantener consistencia visual con grupos */}
          <span className={`
            w-3.5 flex-shrink-0
            transition-all duration-200
            ${isCollapsed ? 'opacity-0 w-0' : 'opacity-0'}
          `} />
        </Link>
      </li>
    );
  };

  // Render grupo
  const renderGroup = (group: NavGroup) => {
    const isExpanded = expandedGroups.has(group.id);
    const hasActiveItem = isGroupActive(group.items);
    const textColorClass = hasActiveItem
      ? 'text-slate-700 dark:text-slate-300'
      : 'text-slate-500 dark:text-slate-400';

    return (
      <li key={group.id}>
        {/* Header del grupo */}
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full cursor-pointer ${getHeaderClasses(hasActiveItem)}`}
        >
          <group.icon size={18} className={`flex-shrink-0 ${textColorClass}`} />
          <span className={`
            flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden
            transition-all duration-200 ${textColorClass}
            ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
          `}>
            {group.label}
          </span>
          <ChevronRight
            size={14}
            className={`
              flex-shrink-0 text-tertiary
              transition-all duration-200
              ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}
              ${isExpanded ? 'rotate-90' : 'rotate-0'}
            `}
          />
        </button>

        {/* Items del grupo - visible cuando sidebar está expandido */}
        {!isCollapsed && (
          <ul className={`
            ml-4 pl-2.5 border-l border-slate-200 dark:border-fenix-900/50
            overflow-hidden transition-all duration-200
            ${isExpanded ? 'max-h-64 opacity-100 mt-0.5' : 'max-h-0 opacity-0'}
          `}>
            {group.items.map((item) => {
              const isActive = isItemActive(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`
                      flex items-center h-8 px-2 rounded-md
                      text-[13px] transition-colors duration-150
                      ${isActive
                        ? 'text-slate-700 dark:text-slate-300 font-medium bg-fenix-500/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-fenix-500/5 dark:hover:bg-fenix-500/10'}
                    `}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Espaciador visual cuando está colapsado pero el grupo está expandido */}
        {isCollapsed && isExpanded && (
          <div
            className="relative ml-4 mt-0.5 transition-all duration-200"
            style={{ height: `${getCollapsedGroupSpacing(group.items.length)}px` }}
          >
            {/* Línea vertical de conexión - misma posición que border-l del ul */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200 dark:bg-fenix-900/50" />
          </div>
        )}
      </li>
    );
  };

  return (
    <nav className={`flex-1 overflow-y-auto py-2 px-1.5 ${isCollapsed ? 'scrollbar-hide' : ''}`}>
      <ul className="space-y-0.5">
        {processedStructure.map((entry) => {
          if (isGroup(entry)) {
            return renderGroup(entry);
          }
          return renderIndividualPage(entry);
        })}
      </ul>
    </nav>
  );
}