// openenergies_crm/src/hooks/useInformesMercado.ts
// Hooks para el módulo de Informes de Mercado

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from './useSession';
import { useEmpresaId } from './useEmpresaId';
import type {
  InformeMercado,
  InformeMercadoConRelaciones,
  GenerateInformeRequest,
  GenerateInformeResponse,
  DatosCalculados,
  RangoFechas
} from '@lib/informesTypes';
import toast from 'react-hot-toast';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const informesKeys = {
  all: ['informes-mercado'] as const,
  lists: () => [...informesKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...informesKeys.lists(), filters] as const,
  details: () => [...informesKeys.all, 'detail'] as const,
  detail: (id: string) => [...informesKeys.details(), id] as const,
  datosCalculados: (clienteIds: string[], puntoIds: string[], rango: RangoFechas) =>
    [...informesKeys.all, 'datos', { clienteIds, puntoIds, rango }] as const,
};

// ============================================================================
// HOOK: Lista de Informes
// ============================================================================

interface UseInformesListOptions {
  tipo_informe?: string;
  estado?: string;
  limit?: number;
}

export function useInformesList(options: UseInformesListOptions = {}) {
  const { empresaId } = useEmpresaId();

  return useQuery({
    queryKey: informesKeys.list({ empresaId, ...options }),
    queryFn: async (): Promise<InformeMercadoConRelaciones[]> => {
      if (!empresaId) return [];

      let query = supabase
        .from('informes_mercado')
        .select(`
          *,
          creador:usuarios_app!creado_por(nombre, apellidos)
        `)
        .eq('empresa_id', empresaId)
        .order('creado_en', { ascending: false });

      if (options.tipo_informe) {
        query = query.eq('tipo_informe', options.tipo_informe);
      }

      if (options.estado) {
        query = query.eq('estado', options.estado);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching informes:', error);
        throw error;
      }

      return (data || []) as InformeMercadoConRelaciones[];
    },
    enabled: !!empresaId,
  });
}

// ============================================================================
// HOOK: Detalle de un Informe
// ============================================================================

export function useInformeDetail(id: string | undefined) {
  return useQuery({
    queryKey: informesKeys.detail(id || ''),
    queryFn: async (): Promise<InformeMercadoConRelaciones | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('informes_mercado')
        .select(`
          *,
          creador:usuarios_app!creado_por(nombre, apellidos)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching informe detail:', error);
        throw error;
      }

      // Fetch related clientes and puntos info
      if (data) {
        const [clientesRes, puntosRes] = await Promise.all([
          data.cliente_ids?.length
            ? supabase
                .from('clientes')
                .select('id, nombre')
                .in('id', data.cliente_ids)
            : Promise.resolve({ data: [] }),
          data.punto_ids?.length
            ? supabase
                .from('puntos_suministro')
                .select('id, cups, direccion')
                .in('id', data.punto_ids)
            : Promise.resolve({ data: [] }),
        ]);

        return {
          ...data,
          clientes_info: clientesRes.data || [],
          puntos_info: puntosRes.data || [],
        } as InformeMercadoConRelaciones;
      }

      return null;
    },
    enabled: !!id,
  });
}

// ============================================================================
// HOOK: Datos Calculados para el Wizard
// ============================================================================

export function useDatosCalculados(
  clienteIds: string[],
  puntoIds: string[],
  rangoFechas: RangoFechas,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: informesKeys.datosCalculados(clienteIds, puntoIds, rangoFechas),
    queryFn: async (): Promise<DatosCalculados> => {
      // Fetch facturacion data
      const { data: facturacionData, error: factError } = await supabase
        .rpc('get_informe_facturacion_data', {
          p_cliente_ids: clienteIds,
          p_punto_ids: puntoIds,
          p_fecha_inicio: rangoFechas.start,
          p_fecha_fin: rangoFechas.end,
        });

      if (factError) {
        console.error('Error fetching facturacion data:', factError);
      }

      // Fetch market data
      const { data: marketData, error: marketError } = await supabase
        .rpc('get_informe_market_data', {
          p_fecha_inicio: rangoFechas.start,
          p_fecha_fin: rangoFechas.end,
          p_indicator_ids: [600, 1001], // SPOT y PVPC
        });

      if (marketError) {
        console.error('Error fetching market data:', marketError);
      }

      return {
        facturacion: facturacionData || {
          resumen: { total_facturas: 0, importe_total: 0, consumo_total_kwh: 0, precio_medio_kwh: 0 },
          por_mes: [],
          por_cliente: [],
        },
        mercado: marketData || {
          estadisticas_diarias: [],
          resumen_periodo: [],
        },
      };
    },
    enabled: enabled && (clienteIds.length > 0 || puntoIds.length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// ============================================================================
// HOOK: Generar Informe
// ============================================================================

export function useGenerateInforme() {
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();

  return useMutation({
    mutationFn: async (request: GenerateInformeRequest): Promise<GenerateInformeResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      // Add empresa_id to config if not present
      const enrichedRequest = {
        ...request,
        config: {
          ...request.config,
          empresa_id: request.config.empresa_id || empresaId,
        },
      };

      const response = await supabase.functions.invoke('generate-market-report', {
        body: enrichedRequest,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error generando informe');
      }

      return response.data as GenerateInformeResponse;
    },
    onSuccess: (data) => {
      // Invalidate lists to show new informe
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });

      if (data.success) {
        toast.success('Informe generado correctamente');
      }
    },
    onError: (error: Error) => {
      console.error('Error generating informe:', error);
      toast.error(`Error: ${error.message}`);
    },
  });
}

// ============================================================================
// HOOK: Eliminar Informe
// ============================================================================

export function useDeleteInforme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // First get the informe to know the storage path
      const { data: informe, error: fetchError } = await supabase
        .from('informes_mercado')
        .select('ruta_storage')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error('Error obteniendo informe');
      }

      // Delete from storage if exists
      if (informe?.ruta_storage) {
        await supabase.storage.from('informes-mercado').remove([informe.ruta_storage]);
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('informes_mercado')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error('Error eliminando informe');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });
      toast.success('Informe eliminado');
    },
    onError: (error: Error) => {
      console.error('Error deleting informe:', error);
      toast.error(`Error: ${error.message}`);
    },
  });
}

// ============================================================================
// HOOK: Obtener URL de Descarga
// ============================================================================

export function useInformeDownloadUrl(rutaStorage: string | null | undefined) {
  return useQuery({
    queryKey: ['informe-download', rutaStorage],
    queryFn: async (): Promise<string | null> => {
      if (!rutaStorage) return null;

      const { data, error } = await supabase.storage
        .from('informes-mercado')
        .createSignedUrl(rutaStorage, 3600); // 1 hour

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      return data?.signedUrl || null;
    },
    enabled: !!rutaStorage,
    staleTime: 30 * 60 * 1000, // 30 minutos (menos que la expiración de 1h)
  });
}

// ============================================================================
// HOOK: Clientes para Selector
// ============================================================================

export function useClientesForSelect(searchTerm: string = '') {
  const { empresaId } = useEmpresaId();

  return useQuery({
    queryKey: ['clientes-select', empresaId, searchTerm],
    queryFn: async () => {
      if (!empresaId) return [];

      let query = supabase
        .from('clientes')
        .select('id, nombre, email_facturacion, estado')
        .eq('empresa_id', empresaId)
        .eq('estado', 'activo')
        .order('nombre');

      if (searchTerm) {
        query = query.or(`nombre.ilike.%${searchTerm}%,email_facturacion.ilike.%${searchTerm}%`);
      }

      query = query.limit(50);

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((c) => ({
        value: c.id,
        label: c.nombre,
        subtitle: c.email_facturacion || undefined,
      }));
    },
    enabled: !!empresaId,
  });
}

// ============================================================================
// HOOK: Puntos para Selector (filtrado por clientes seleccionados)
// ============================================================================

export function usePuntosForSelect(clienteIds: string[], searchTerm: string = '') {
  const { empresaId } = useEmpresaId();

  return useQuery({
    queryKey: ['puntos-select', empresaId, clienteIds, searchTerm],
    queryFn: async () => {
      if (!empresaId) return [];

      let query = supabase
        .from('puntos_suministro')
        .select(`
          id,
          cups,
          direccion,
          titular,
          cliente_id,
          clientes!inner(empresa_id, nombre)
        `)
        .eq('clientes.empresa_id', empresaId)
        .order('cups');

      // Filter by selected clients if any
      if (clienteIds.length > 0) {
        query = query.in('cliente_id', clienteIds);
      }

      if (searchTerm) {
        query = query.or(`cups.ilike.%${searchTerm}%,direccion.ilike.%${searchTerm}%,titular.ilike.%${searchTerm}%`);
      }

      query = query.limit(100);

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((p: any) => ({
        value: p.id,
        label: p.cups,
        subtitle: `${p.direccion} - ${p.clientes?.nombre || p.titular}`,
      }));
    },
    enabled: !!empresaId,
  });
}
