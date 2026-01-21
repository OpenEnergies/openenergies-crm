import { MarketDailyStats } from '@features/market-data/services/marketData';

interface PeriodsTableWidgetProps {
    data: MarketDailyStats;
}

export default function PeriodsTableWidget({ data }: PeriodsTableWidgetProps) {
    // Logic: If media_p1 is NULL, render a single row spanning full width saying "Día festivo/Fin de semana: Aplica solo precio Valle (P3)".
    // data.period_1_price might be null/undefined.
    const isHolidayOrWeekend = data.period_1_price == null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col justify-center">
            <h3 className="font-semibold text-slate-900 mb-4 px-2">Precios por Periodo</h3>

            <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-2">Periodo</th>
                            <th className="px-4 py-2 text-right">Precio Medio</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isHolidayOrWeekend ? (
                            <>
                                <tr>
                                    <td colSpan={2} className="px-4 py-6 text-center text-emerald-600 font-medium bg-emerald-50/50">
                                        Día festivo/Fin de semana: Aplica solo precio Valle (P3)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span className="font-medium text-slate-700">P3 (Valle)</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                        {data.period_3_price?.toFixed(5) ?? '—'} <span className="text-xs text-slate-500 font-normal">€/MWh</span>
                                    </td>
                                </tr>
                            </>
                        ) : (
                            <>
                                <tr>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        <span className="font-medium text-slate-700">P1 (Punta)</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                        {data.period_1_price?.toFixed(5)} <span className="text-xs text-slate-500 font-normal">€/MWh</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                        <span className="font-medium text-slate-700">P2 (Llano)</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                        {data.period_2_price?.toFixed(5)} <span className="text-xs text-slate-500 font-normal">€/MWh</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span className="font-medium text-slate-700">P3 (Valle)</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                        {data.period_3_price?.toFixed(5)} <span className="text-xs text-slate-500 font-normal">€/MWh</span>
                                    </td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
