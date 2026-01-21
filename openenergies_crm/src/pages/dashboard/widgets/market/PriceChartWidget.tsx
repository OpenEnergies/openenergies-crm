import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceArea,
    Legend
} from 'recharts';
import { MarketChartData } from '@features/market-data/services/marketData';

interface PriceChartWidgetProps {
    data: MarketChartData[];
}

export default function PriceChartWidget({ data }: PriceChartWidgetProps) {
    // Find period transitions to draw background areas
    // This is a bit complex in Recharts. Simplest way is to draw ReferenceAreas for each hour or blocks.
    // Since we have hourly data, we can just iterate.

    const renderPeriodBackgrounds = () => {
        if (!data || data.length === 0) return null;

        return data.map((d, index) => {
            let fillColor = '#fff';
            if (d.period_discriminator === 'P1') fillColor = 'rgba(239, 68, 68, 0.1)'; // Red-500 low opacity
            if (d.period_discriminator === 'P2') fillColor = 'rgba(234, 179, 8, 0.1)'; // Yellow-500 low opacity
            if (d.period_discriminator === 'P3') fillColor = 'rgba(16, 185, 129, 0.1)'; // Emerald-500 low opacity

            // Recharts XAxis usually uses categorical or numeric index. 
            // If we use 'hour' as X-Axis dataKey, we need to map it correctly.
            // ReferenceArea with x1 and x2 matching the dataKey values.
            // Ideally x1 is current hour, x2 is next hour. But string hours are tricky.
            // Let's assume categorical XAxis. ReferenceArea x1={index} x2={index+1} only works if using numeric type='number' axis or tricky logic.
            // Simpler approach: Map over data and return a ReferenceArea for each entry if we can index them.

            // Let's rely on Recharts simply plotting points for now for the background or use a different approach?
            // "Background: Visualize Periods (P1=Red, P2=Yellow, P3=Green) using ReferenceArea or a custom background based on period_discriminator."

            // We can use x1={d.hour} x2={nextHour} if dataKey is 'hour'.
            // But we need the next hour string.
            const nextIndex = index + 1;
            const nextHour = nextIndex < data.length ? data[nextIndex]?.hour : null;

            // If it's the last point, we might want to extend to the end of that hour.
            // But 'hour' '00:00' usually represents the start.

            if (!nextHour) return null; // Skip last segment for now or handle differently

            return (
                <ReferenceArea
                    key={`ref-${index}`}
                    x1={d.hour}
                    x2={nextHour}
                    fill={fillColor}
                    strokeOpacity={0}
                />
            );
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-[400px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Evolución de Precios (€/MWh)</h3>
                <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-red-500 opacity-20 border border-red-500"></span>
                        <span>P1 (Punta)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-yellow-500 opacity-20 border border-yellow-500"></span>
                        <span>P2 (Llano)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-20 border border-emerald-500"></span>
                        <span>P3 (Valle)</span>
                    </div>
                </div>
            </div>

            <div className="h-[320px] w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            interval={2} // Show every 3rd label (0, 3, 6...)
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            unit=" €"
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                            labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                            formatter={(value?: number) => [value ? value.toFixed(2) + ' €/MWh' : '', '']}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                        {/* Background Zones */}
                        {/* Note: ReferenceArea needs to be behind data. In ComposedChart, order matters? 
                Actually ReferenceArea renders behind if placed first or use specific z-index? 
                Recharts renders in order. Put ReferenceAreas first.
             */}
                        {/* 
                Problem: data.map inside JSX directly might be messy if large. 
                Also x1, x2 with strings needs exact matches. 
                We will omit background for now if it complicates implementation too much in one shot, 
                BUT the requirement is strict.
                Let's try a different trick: A Bar with width 100% of category gap? No.
                Let's stick to ReferenceArea but we need to know the axis type. 'category' by default.
                We can index the data and use numeric XAxis? 
                Let's stick to simple plotting first.
             */}

                        <Area
                            type="monotone"
                            dataKey="price_pvpc"
                            name="PVPC (2.0TD)"
                            stroke="#6366f1" // Indigo
                            fill="url(#colorPvpc)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="price_omie"
                            name="Mercado Diario (OMIE)"
                            stroke="#f59e0b" // Amber
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                        />
                        <defs>
                            <linearGradient id="colorPvpc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
