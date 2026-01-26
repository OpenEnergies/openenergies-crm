import { Zap, Flame, LayoutGrid } from 'lucide-react';

export type MarketView = 'indicators' | 'electricity' | 'gas';

interface MarketTabSelectorProps {
    activeView: MarketView;
    onViewChange: (view: MarketView) => void;
}

/**
 * Selector de pestañas para las vistas del mercado energético
 */
export default function MarketTabSelector({ activeView, onViewChange }: MarketTabSelectorProps) {
    const tabs = [
        { id: 'indicators' as const, label: 'Indicadores Clave', icon: LayoutGrid },
        { id: 'electricity' as const, label: 'Luz', icon: Zap },
        { id: 'gas' as const, label: 'Gas', icon: Flame },
    ];

    return (
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onViewChange(tab.id)}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                        transition-all duration-200 cursor-pointer
                        ${activeView === tab.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                        }
                    `}
                >
                    <tab.icon className={`h-4 w-4 ${tab.id === 'electricity' ? 'text-amber-500' :
                            tab.id === 'gas' ? 'text-orange-500' :
                                'text-indigo-500'
                        }`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                </button>
            ))}
        </div>
    );
}
