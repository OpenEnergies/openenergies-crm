import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import ClientInsightsWidget, { CostBreakdownWidget } from '@components/dashboard/ClientInsightsWidget';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function ClienteGlobal() {
    const { id: clienteId } = useParams({ from: clienteDetailRoute.id });
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const [viewMode, setViewMode] = useState<'anual' | 'mensual'>('anual');
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    const handlePrev = () => {
        if (viewMode === 'anual') {
            setSelectedYear(y => y - 1);
        } else {
            if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(y => y - 1);
            } else {
                setSelectedMonth(m => m - 1);
            }
        }
    };

    const handleNext = () => {
        if (viewMode === 'anual') {
            if (selectedYear < currentYear) setSelectedYear(y => y + 1);
        } else {
            const isCurrentPeriod = selectedYear === currentYear && selectedMonth === currentMonth;
            if (!isCurrentPeriod) {
                if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(y => y + 1);
                } else {
                    setSelectedMonth(m => m + 1);
                }
            }
        }
    };

    const isNextDisabled = viewMode === 'anual'
        ? selectedYear >= currentYear
        : selectedYear === currentYear && selectedMonth >= currentMonth;

    const periodDisplay = viewMode === 'anual'
        ? String(selectedYear)
        : `${MONTH_LABELS[selectedMonth]} ${selectedYear}`;

    return (
        <div className="space-y-6 animate-fade-in w-full">
            {/* ═══ View Mode Toggle + Period Selector ═══ */}
            <div className="relative flex items-center">
                {/* Anual / Mensual Toggle — pinned left */}
                <div className="flex gap-1 bg-bg-intermediate rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('anual')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${viewMode === 'anual'
                            ? 'bg-fenix-500 text-white shadow-md'
                            : 'text-secondary hover:text-primary hover:bg-white/5'
                            }`}
                    >
                        Anual
                    </button>
                    <button
                        onClick={() => setViewMode('mensual')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${viewMode === 'mensual'
                            ? 'bg-fenix-500 text-white shadow-md'
                            : 'text-secondary hover:text-primary hover:bg-white/5'
                            }`}
                    >
                        Mensual
                    </button>
                </div>

                {/* Period Navigator — absolutely centered in the full row */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-3 pointer-events-auto">
                    <button
                        onClick={handlePrev}
                        className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 min-w-[120px] justify-center">
                        <Calendar size={16} className="text-fenix-500" />
                        <span className="text-lg font-bold text-primary">{periodDisplay}</span>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={isNextDisabled}
                        className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={20} />
                    </button>
                    </div>
                </div>
            </div>

            <ClientInsightsWidget
                clienteId={clienteId}
                year={selectedYear}
                month={viewMode === 'mensual' ? selectedMonth : undefined}
            />
            <CostBreakdownWidget
                clienteId={clienteId}
                year={selectedYear}
                month={viewMode === 'mensual' ? selectedMonth : undefined}
            />
        </div>
    );
}
