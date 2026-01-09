import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, Zap, FileCheck, Clock } from 'lucide-react';

type KPIData = {
    contratosActivos: number;
    energiaGestionadaGWh: number;
    puntosEnProceso: number;
};

async function fetchKPIData(): Promise<KPIData> {
    // Fetch contratos activos (estados que implican actividad)
    const { count: contratosActivos } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'En curso');

    // Fetch puntos con contrato activo para calcular energía gestionada
    const { data: puntosActivos } = await supabase
        .from('puntos_suministro')
        .select(`
      consumo_anual_kwh,
      contratos!inner(estado)
    `)
        .eq('contratos.estado', 'En curso');

    const totalKwh = puntosActivos?.reduce((sum, p) => sum + (p.consumo_anual_kwh || 0), 0) || 0;
    const energiaGestionadaGWh = totalKwh / 1_000_000;

    // Fetch puntos en proceso (no activos ni desistidos)
    const { count: puntosEnProceso } = await supabase
        .from('puntos_suministro')
        .select('*', { count: 'exact', head: true })
        .not('estado', 'in', '(Aceptado,Desiste)');

    return {
        contratosActivos: contratosActivos || 0,
        energiaGestionadaGWh,
        puntosEnProceso: puntosEnProceso || 0,
    };
}

function KPICard({
    icon: Icon,
    label,
    value,
    subValue,
    iconColor = 'text-fenix-500',
    iconBgColor = 'bg-fenix-500/20'
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    iconColor?: string;
    iconBgColor?: string;
}) {
    return (
        <div className="glass-card p-5 flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${iconBgColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-secondary font-bold uppercase tracking-tight mb-1">{label}</p>
                <p className="text-2xl font-bold text-fenix-600 dark:text-fourth">{value}</p>
                {subValue && <p className="text-xs text-secondary opacity-70 mt-0.5">{subValue}</p>}
            </div>
        </div>
    );
}

export default function KPICardsSection() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard-kpis'],
        queryFn: fetchKPIData,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });

    if (isLoading) {
        return (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card p-5 flex items-center justify-center h-24">
                        <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
                    </div>
                ))}
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="glass-card p-5 text-center text-red-600 dark:text-red-400 font-medium">
                Error al cargar los indicadores
            </div>
        );
    }

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data && (
                <>
                    <KPICard
                        icon={FileCheck}
                        label="Contratos Activos"
                        value={data.contratosActivos}
                        subValue="Firmados, contratados o en curso"
                    />
                    <KPICard
                        icon={Zap}
                        label="Energía Gestionada"
                        value={`${data.energiaGestionadaGWh.toFixed(2)} GWh`}
                        subValue="Consumo anual de contratos activos"
                        iconColor="text-amber-400"
                        iconBgColor="bg-amber-500/20"
                    />
                    <KPICard
                        icon={Clock}
                        label="Puntos en Proceso"
                        value={data.puntosEnProceso}
                        subValue="Pendientes de firma"
                        iconColor="text-blue-400"
                        iconBgColor="bg-blue-500/20"
                    />
                </>
            )}
        </div>
    );
}

