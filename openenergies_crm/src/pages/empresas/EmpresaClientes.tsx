// src/pages/empresas/EmpresaClientes.tsx
import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { empresaDetailRoute } from '@router/routes';
import { EmptyState } from '@components/EmptyState';
import { Pagination } from '@components/Pagination';
import { ExternalLink, Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

interface ClienteConPuntos {
    id: string;
    nombre: string;
    dni: string | null;
    cif: string | null;
    email: string | null;
    telefonos: string | null;
    tipo: 'Persona fisica' | 'Persona juridica' | null;
    puntos_count: number;
}

async function fetchClientesDeEmpresa(empresaId: string): Promise<ClienteConPuntos[]> {
    // Simple query: get all cliente_ids from puntos for this empresa
    const { data: puntosData, error: puntosError } = await supabase
        .from('puntos_suministro')
        .select('cliente_id')
        .eq('current_comercializadora_id', empresaId)
        .is('eliminado_en', null)
        .not('cliente_id', 'is', null);

    if (puntosError) throw puntosError;

    if (!puntosData || puntosData.length === 0) {
        return [];
    }

    // Get unique cliente IDs
    const uniqueClienteIds = [...new Set(puntosData.map(p => p.cliente_id).filter(Boolean))] as string[];

    if (uniqueClienteIds.length === 0) {
        return [];
    }

    // Query each cliente individually to avoid .in() issues
    const clientesPromises = uniqueClienteIds.map(async (clienteId) => {
        const { data, error } = await supabase
            .from('clientes')
            .select('id, nombre, dni, cif, email, telefonos, tipo')
            .eq('id', clienteId)
            .is('eliminado_en', null)
            .single();

        if (error || !data) return null;
        return data;
    });

    const clientesResults = await Promise.all(clientesPromises);
    const clientesData = clientesResults.filter(c => c !== null);

    // Count points for each cliente and build result
    const result: ClienteConPuntos[] = clientesData.map(cliente => ({
        id: cliente.id,
        nombre: cliente.nombre,
        dni: cliente.dni,
        cif: cliente.cif,
        email: cliente.email,
        telefonos: cliente.telefonos,
        tipo: cliente.tipo,
        puntos_count: puntosData.filter(p => p.cliente_id === cliente.id).length,
    }));

    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export default function EmpresaClientes() {
    const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
    const [currentPage, setCurrentPage] = useState(1);

    const { data: clientes, isLoading, isError } = useQuery({
        queryKey: ['empresa-clientes', empresaId],
        queryFn: () => fetchClientesDeEmpresa(empresaId),
        enabled: !!empresaId,
    });

    // Pagination logic
    const totalItems = clientes?.length || 0;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const paginatedClientes = clientes?.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    ) || [];

    if (isLoading) {
        return (
            <div className="glass-card p-6 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
                <span className="text-secondary font-medium">Cargando clientes...</span>
            </div>
        );
    }

    if (isError) {
        return <div className="glass-card p-6 text-red-400">Error al cargar los clientes.</div>;
    }

    if (!clientes?.length) {
        return (
            <div className="glass-card">
                <EmptyState
                    title="Sin clientes"
                    description="No hay clientes con puntos de suministro asociados a esta comercializadora."
                />
            </div>
        );
    }

    return (
        <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 border-primary bg-bg-intermediate">
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Nombre</th>
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">DNI/CIF</th>
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Email</th>
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Teléfono</th>
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Puntos</th>
                            <th className="p-4 text-left text-xs font-bold text-primary uppercase tracking-wider">Tipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedClientes.map((cliente) => (
                            <tr key={cliente.id} className="border-b border-primary/10 hover:bg-bg-intermediate/50 transition-colors cursor-pointer">
                                <td className="p-4">
                                    <Link
                                        to="/app/clientes/$id"
                                        params={{ id: cliente.id }}
                                        className="inline-flex items-center gap-2 text-fenix-600 dark:text-fourth hover:text-fenix-500 transition-colors font-bold"
                                    >
                                        {cliente.nombre}
                                        <ExternalLink size={14} />
                                    </Link>
                                </td>
                                <td className="p-4 text-secondary font-mono">{cliente.dni || cliente.cif || '—'}</td>
                                <td className="p-4">
                                    {cliente.email ? (
                                        <a href={`mailto:${cliente.email}`} className="text-fenix-600 dark:text-fourth hover:underline">
                                            {cliente.email}
                                        </a>
                                    ) : <span className="text-secondary opacity-50">—</span>}
                                </td>
                                <td className="p-4 text-secondary">{cliente.telefonos || '—'}</td>
                                <td className="p-4">
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-fenix-500/20 text-fenix-600 dark:text-fenix-400">
                                        {cliente.puntos_count}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {cliente.tipo && (
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-bg-intermediate text-secondary">
                                            {cliente.tipo}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    isLoading={isLoading}
                />
            )}
        </div>
    );
}

