// src/hooks/useActividadLog.ts
// Hook React Query para consultar y crear entradas en el log de actividad

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import type {
    ActividadLogEntry,
    ActividadFilters,
    PaginationOptions,
    ActividadLogResponse,
    SelectOption,
} from '@lib/actividadTypes';

const DEFAULT_PAGE_SIZE = 30;

/**
 * Construye la query de Supabase con filtros jerárquicos
 * Lógica: (cliente_ids OR punto_ids OR contrato_ids) AND tipo_evento AND entidad_tipo
 */
function buildQuery(
    filters: ActividadFilters,
    pagination: PaginationOptions
) {
    let query = supabase
        .from('actividad_log')
        .select(`
      *,
      cliente:clientes!cliente_id(nombre),
      punto:puntos_suministro!punto_id(cups, direccion_sum),
      contrato:contratos!contrato_id(estado)
    `, { count: 'exact' })
        .order('creado_en', { ascending: false });

    // Filtros jerárquicos (OR entre categorías)
    // Si hay múltiples IDs, usamos .in(), si es uno solo, usamos .eq()
    const hasClienteFilter = filters.cliente_ids && filters.cliente_ids.length > 0;
    const hasPuntoFilter = filters.punto_ids && filters.punto_ids.length > 0;
    const hasContratoFilter = filters.contrato_ids && filters.contrato_ids.length > 0;

    // Construir filtro OR jerárquico
    if (hasClienteFilter || hasPuntoFilter || hasContratoFilter) {
        const orConditions: string[] = [];

        if (hasClienteFilter) {
            orConditions.push(`cliente_id.in.(${filters.cliente_ids!.join(',')})`);
        }
        if (hasPuntoFilter) {
            orConditions.push(`punto_id.in.(${filters.punto_ids!.join(',')})`);
        }
        if (hasContratoFilter) {
            orConditions.push(`contrato_id.in.(${filters.contrato_ids!.join(',')})`);
        }

        if (orConditions.length > 0) {
            query = query.or(orConditions.join(','));
        }
    }

    // Filtro legacy por cliente_id simple (para vista de ficha de cliente)
    if (filters.cliente_id && !hasClienteFilter) {
        query = query.eq('cliente_id', filters.cliente_id);
    }

    // Filtro por usuario
    if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
    }

    // Filtro por tipo de evento (AND con los demás)
    if (filters.tipo_evento && filters.tipo_evento.length > 0) {
        query = query.in('tipo_evento', filters.tipo_evento);
    }

    // Filtro por tipo de entidad (AND con los demás)
    if (filters.entidad_tipo && filters.entidad_tipo.length > 0) {
        query = query.in('entidad_tipo', filters.entidad_tipo);
    }

    // Filtro por entidad específica
    if (filters.entidad_id) {
        query = query.eq('entidad_id', filters.entidad_id);
    }

    // Filtro por rango de fechas
    if (filters.fecha_desde) {
        query = query.gte('creado_en', filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
        query = query.lte('creado_en', filters.fecha_hasta);
    }

    // Paginación
    const from = pagination.page * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    query = query.range(from, to);

    return query;
}

/**
 * Hook principal para consultar el log de actividad
 */
export function useActividadLog(
    filters: ActividadFilters = {},
    pagination: PaginationOptions = { page: 0, pageSize: DEFAULT_PAGE_SIZE }
) {
    return useQuery<ActividadLogResponse>({
        queryKey: ['actividad_log', filters, pagination],
        queryFn: async () => {
            const query = buildQuery(filters, pagination);
            const { data, error, count } = await query;

            if (error) {
                console.error('[useActividadLog] Error:', error);
                throw error;
            }

            const totalCount = count ?? 0;
            const hasMore = (pagination.page + 1) * pagination.pageSize < totalCount;

            return {
                data: (data as ActividadLogEntry[]) || [],
                totalCount,
                hasMore,
            };
        },
        staleTime: 1000 * 60 * 2, // 2 minutos
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook para obtener log de un cliente específico
 */
export function useActividadCliente(
    clienteId: string | undefined,
    filters: Omit<ActividadFilters, 'cliente_id'> = {},
    pagination: PaginationOptions = { page: 0, pageSize: DEFAULT_PAGE_SIZE }
) {
    return useActividadLog(
        clienteId ? { ...filters, cliente_id: clienteId } : filters,
        pagination
    );
}

/**
 * Hook para insertar notas manuales
 */
export function useInsertarNotaManual() {
    const queryClient = useQueryClient();
    const { userId, nombre, apellidos } = useSession();

    return useMutation({
        mutationFn: async ({
            clienteId,
            contenido,
        }: {
            clienteId: string | null;
            contenido: string;
        }) => {
            if (!userId) {
                throw new Error('Usuario no autenticado');
            }

            if (!contenido.trim()) {
                throw new Error('El contenido de la nota no puede estar vacío');
            }

            // Obtener email del usuario actual
            const { data: userData } = await supabase
                .from('usuarios_app')
                .select('email')
                .eq('user_id', userId)
                .single();

            const { data, error } = await supabase
                .from('actividad_log')
                .insert({
                    cliente_id: clienteId,
                    user_id: userId,
                    tipo_evento: 'nota_manual',
                    entidad_tipo: clienteId ? 'cliente' : 'cliente', // Default a cliente
                    entidad_id: clienteId || userId, // Si no hay cliente, usar userId como referencia
                    contenido_nota: contenido.trim(),
                    metadata_usuario: {
                        nombre: nombre || 'Usuario',
                        apellidos: apellidos || '',
                        email: userData?.email || '',
                    },
                })
                .select()
                .single();

            if (error) {
                console.error('[useInsertarNotaManual] Error:', error);
                throw error;
            }

            return data as ActividadLogEntry;
        },
        onSuccess: (_, variables) => {
            // Invalidar queries relevantes
            queryClient.invalidateQueries({ queryKey: ['actividad_log'] });
            if (variables.clienteId) {
                queryClient.invalidateQueries({
                    queryKey: ['actividad_log', { cliente_id: variables.clienteId }],
                });
            }
        },
    });
}

/**
 * Hook para obtener lista de usuarios para el filtro
 */
export function useUsuariosParaFiltro() {
    return useQuery<SelectOption[]>({
        queryKey: ['usuarios_filtro_actividad'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('usuarios_app')
                .select('user_id, nombre, apellidos, email')
                .eq('activo', true)
                .is('eliminado_en', null)
                .order('nombre');

            if (error) throw error;

            return data.map((u) => ({
                value: u.user_id,
                label: `${u.nombre || ''} ${u.apellidos || ''}`.trim() || u.email || 'Usuario',
            }));
        },
        staleTime: 1000 * 60 * 10, // 10 minutos
    });
}

/**
 * Hook para obtener lista de clientes para el filtro (vista global)
 */
export function useClientesParaFiltro() {
    return useQuery<SelectOption[]>({
        queryKey: ['clientes_filtro_actividad'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('clientes')
                .select('id, nombre')
                .is('eliminado_en', null)
                .order('nombre')
                .limit(500); // Limitar para rendimiento

            if (error) throw error;

            return data.map((c) => ({
                value: c.id,
                label: c.nombre,
            }));
        },
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
}

/**
 * Hook para obtener lista de puntos para el filtro
 * Incluye CUPS y Dirección para búsqueda
 */
export function usePuntosParaFiltro(clienteIds?: string[]) {
    return useQuery<SelectOption[]>({
        queryKey: ['puntos_filtro_actividad', clienteIds],
        queryFn: async () => {
            let query = supabase
                .from('puntos_suministro')
                .select('id, cups, direccion_sum, cliente_id')
                .is('eliminado_en', null)
                .order('cups')
                .limit(500);

            // Si hay clientes seleccionados, filtrar puntos de esos clientes
            if (clienteIds && clienteIds.length > 0) {
                query = query.in('cliente_id', clienteIds);
            }

            const { data, error } = await query;

            if (error) throw error;

            return data.map((p) => ({
                value: p.id,
                label: p.cups,
                subtitle: p.direccion_sum || undefined,
            }));
        },
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
}

/**
 * Hook para obtener lista de contratos para el filtro
 * Incluye CUPS asociado para búsqueda
 */
export function useContratosParaFiltro(puntoIds?: string[], clienteIds?: string[]) {
    return useQuery<SelectOption[]>({
        queryKey: ['contratos_filtro_actividad', puntoIds, clienteIds],
        queryFn: async () => {
            let query = supabase
                .from('contratos')
                .select(`
          id,
          estado,
          punto_id,
          punto:puntos_suministro!punto_id(cups, cliente_id)
        `)
                .is('eliminado_en', null)
                .order('creado_en', { ascending: false })
                .limit(500);

            // Filtrar por puntos si están seleccionados
            if (puntoIds && puntoIds.length > 0) {
                query = query.in('punto_id', puntoIds);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Filtrar por clientes si están seleccionados (post-query)
            let filtered = data;
            if (clienteIds && clienteIds.length > 0 && !puntoIds?.length) {
                filtered = data.filter((c: any) =>
                    clienteIds.includes(c.punto?.cliente_id)
                );
            }

            return filtered.map((c: any) => ({
                value: c.id,
                label: c.punto?.cups || 'Sin CUPS',
                subtitle: `Estado: ${c.estado || 'Desconocido'}`,
            }));
        },
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
}
