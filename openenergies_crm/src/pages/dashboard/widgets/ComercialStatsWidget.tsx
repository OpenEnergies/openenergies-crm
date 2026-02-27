// src/pages/dashboard/widgets/ComercialStatsWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Loader2, Users, MapPin } from 'lucide-react';
import { useSession } from '@hooks/useSession';
import { Link } from '@tanstack/react-router';

interface ComercialStats {
    sociedadesAsignadas: number;
    puntosAsignados: number;
}

async function fetchComercialStats(userId: string | null): Promise<ComercialStats> {
    if (!userId) return { sociedadesAsignadas: 0, puntosAsignados: 0 };

    const { data, error } = await supabase
        .from('asignaciones_comercial_punto')
        .select('punto_id, puntos_suministro!inner(cliente_id)')
        .eq('comercial_user_id', userId);

    if (error) {
        console.error('Error fetching comercial stats:', error);
        throw error;
    }

    const puntosAsignados = data?.length ?? 0;
    const clienteIds = new Set<string>();
    (data || []).forEach((a: any) => {
        const ps = Array.isArray(a.puntos_suministro) ? a.puntos_suministro[0] : a.puntos_suministro;
        if (ps?.cliente_id) clienteIds.add(ps.cliente_id);
    });

    return {
        sociedadesAsignadas: clienteIds.size,
        puntosAsignados,
    };
}

export default function ComercialStatsWidget() {
    const { userId } = useSession();

    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['comercial-stats', userId],
        queryFn: () => fetchComercialStats(userId),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-fenix-600 dark:text-fenix-400" />
                </div>
                <h3 className="text-base font-bold text-primary">Mis Asignaciones</h3>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
                </div>
            )}

            {isError && (
                <p className="text-sm text-red-600 dark:text-red-400 text-center py-4 font-medium italic">Error al cargar.</p>
            )}

            {!isLoading && !isError && stats && (
                <div className="grid grid-cols-2 gap-4">
                    <Link
                        to="/app/clientes"
                        className="block text-center p-4 rounded-lg bg-bg-intermediate/30 hover:bg-bg-intermediate transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                            <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <p className="text-3xl font-bold text-secondary mb-1">{stats.sociedadesAsignadas}</p>
                        <p className="text-xs text-secondary opacity-70 font-semibold uppercase tracking-tight">Sociedades</p>
                    </Link>
                    <Link
                        to="/app/puntos"
                        className="block text-center p-4 rounded-lg bg-bg-intermediate/30 hover:bg-bg-intermediate transition-colors"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                            <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-3xl font-bold text-secondary mb-1">{stats.puntosAsignados}</p>
                        <p className="text-xs text-secondary opacity-70 font-semibold uppercase tracking-tight">Puntos</p>
                    </Link>
                </div>
            )}
        </div>
    );
}
