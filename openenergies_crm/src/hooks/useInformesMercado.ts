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
  RangoFechas,
  AuditoriaEnergeticaData
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
  auditoriaData: (clienteId: string, rango: RangoFechas) =>
    [...informesKeys.all, 'auditoria', { clienteId, rango }] as const,
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

      // CORRECCIÓN: Relación explícita con creador
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
    staleTime: 5 * 60 * 1000,
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
      const { data: informe, error: fetchError } = await supabase
        .from('informes_mercado')
        .select('ruta_storage')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error('Error obteniendo informe');
      }

      if (informe?.ruta_storage) {
        await supabase.storage.from('informes-mercado').remove([informe.ruta_storage]);
      }

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
        .createSignedUrl(rutaStorage, 3600);

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      return data?.signedUrl || null;
    },
    enabled: !!rutaStorage,
    staleTime: 30 * 60 * 1000,
  });
}

// ============================================================================
// HOOK: Clientes para Selector
// ============================================================================

export function useClientesForSelect(
  searchTerm: string = '',
  startDate?: string,
  endDate?: string
) {
  const { empresaId } = useEmpresaId();

  return useQuery({
    queryKey: ['clientes-select', empresaId, searchTerm, startDate, endDate],
    queryFn: async () => {
      if (!empresaId) return [];

      // Si no hay término de búsqueda, no ejecutar consulta (evitar carga masiva)
      if (!searchTerm || searchTerm.trim().length === 0) {
        return [];
      }

      // Si no hay rango de fechas, no mostrar nada
      if (!startDate || !endDate) {
        return [];
      }

      // PASO 1: Buscar TODOS los clientes que coincidan con el término de búsqueda
      let clientesQuery = supabase
        .from('clientes')
        .select('id, nombre, email')
        .is('eliminado_en', null)
        .or(`nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('nombre');

      const { data: clientes, error: clientesError } = await clientesQuery;

      if (clientesError) throw clientesError;

      if (!clientes || clientes.length === 0) {
        return []; // No hay clientes que coincidan con la búsqueda
      }

      // PASO 2: Obtener los cliente_ids que tienen facturas en el rango
      let facturasQuery = supabase
        .from('facturacion_clientes')
        .select('cliente_id')
        .in('cliente_id', clientes.map(c => c.id))
        .gte('fecha_emision', startDate)
        .lte('fecha_emision', endDate);

      const { data: facturas, error: facturasError } = await facturasQuery;

      if (facturasError) {
        console.error('Error fetching facturas for clientes:', facturasError);
        // Si hay error, mostrar todos como deshabilitados
        return clientes.map((c) => ({
          value: c.id,
          label: c.nombre,
          subtitle: c.email || undefined,
          disabled: true,
        }));
      }

      // Obtener IDs únicos de clientes con facturas
      const clientesConFacturas = new Set(
        (facturas || []).map(f => f.cliente_id)
      );

      // PASO 3: Convertir a formato de opciones
      // Habilitados: los que tienen facturas
      // Deshabilitados: los que NO tienen facturas
      return clientes.map((c) => {
        const tieneFacturas = clientesConFacturas.has(c.id);
        return {
          value: c.id,
          label: c.nombre,
          subtitle: tieneFacturas 
            ? (c.email || undefined) 
            : 'No se encontraron facturas en ese rango de fechas',
          disabled: !tieneFacturas, // Deshabilitado si NO tiene facturas
        };
      });
    },
    enabled: !!empresaId && !!searchTerm && searchTerm.trim().length > 0,
  });
}

// ============================================================================
// HOOK: Puntos para Selector (filtrado por clientes seleccionados)
// ============================================================================

export function usePuntosForSelect(
  clienteIds: string[],
  searchTerm: string = '',
  startDate?: string,
  endDate?: string,
  tipoEnergia?: 'electricidad' | 'gas' | 'ambos'
) {
  const { empresaId } = useEmpresaId();

  return useQuery({
    queryKey: ['puntos-select', empresaId, clienteIds, searchTerm, startDate, endDate, tipoEnergia],
    queryFn: async () => {
      if (!empresaId) return [];

      // Si no hay rango de fechas o tipo de energía, no mostrar nada
      if (!startDate || !endDate || !tipoEnergia) {
        return [];
      }

      // PASO 1: Obtener SOLO los punto_ids que tienen facturas en el rango
      let facturasQuery = supabase
        .from('facturacion_clientes')
        .select('punto_id', { count: 'exact' });

      facturasQuery = facturasQuery
        .gte('fecha_emision', startDate)
        .lte('fecha_emision', endDate);

      // Filtrar por tipo de energía
      if (tipoEnergia === 'electricidad') {
        facturasQuery = facturasQuery.eq('tipo_factura', 'Luz');
      } else if (tipoEnergia === 'gas') {
        facturasQuery = facturasQuery.eq('tipo_factura', 'Gas');
      } else if (tipoEnergia === 'ambos') {
        facturasQuery = facturasQuery.in('tipo_factura', ['Luz', 'Gas']);
      }

      const { data: facturas, error: facturasError } = await facturasQuery;

      if (facturasError) {
        console.error('Error fetching facturas for puntos:', facturasError);
        return [];
      }

      if (!facturas || facturas.length === 0) {
        return []; // No hay facturas, no hay puntos disponibles
      }

      // Obtener IDs únicos de puntos
      const puntoIds = Array.from(new Set(facturas.map(f => f.punto_id)));

      // PASO 2: Obtener datos de esos puntos específicos
      let puntosQuery = supabase
        .from('puntos_suministro')
        .select('id, cups, direccion_sum, cliente_id')
        .in('id', puntoIds)
        .is('eliminado_en', null)
        .order('cups');

      // Filtrar por clientes seleccionados si hay alguno
      if (clienteIds.length > 0) {
        puntosQuery = puntosQuery.in('cliente_id', clienteIds);
      }

      if (searchTerm) {
        puntosQuery = puntosQuery.or(`cups.ilike.%${searchTerm}%,direccion_sum.ilike.%${searchTerm}%`);
      }

      const { data: puntos, error: puntosError } = await puntosQuery;

      if (puntosError) throw puntosError;

      if (!puntos || puntos.length === 0) return [];

      // PASO 3: Obtener nombres de clientes para los puntos
      const uniqueClienteIds = Array.from(new Set(puntos.map(p => p.cliente_id).filter(Boolean)));

      let clientesMap: Record<string, string> = {};

      if (uniqueClienteIds.length > 0) {
        const { data: clientes, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nombre')
          .in('id', uniqueClienteIds);

        if (!clientesError && clientes) {
          clientesMap = clientes.reduce((acc, curr) => {
            acc[curr.id] = curr.nombre;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // PASO 4: Convertir a formato de opciones (todos habilitados porque ya están filtrados)
      return puntos.map((p) => ({
        value: p.id,
        label: p.cups,
        subtitle: `${p.direccion_sum} - ${clientesMap[p.cliente_id] || 'N/A'}`,
        disabled: false, // Todos están habilitados porque tienen facturas
      }));
    },
    enabled: !!empresaId,
  });
}

// ============================================================================
// HOOK: Datos de Auditoría Energética
// Obtiene datos agregados por tarifa/mes para un cliente
// ============================================================================

export function useAuditoriaEnergeticaData(
  clienteId: string | null,
  rangoFechas: RangoFechas,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: informesKeys.auditoriaData(clienteId || '', rangoFechas),
    queryFn: async (): Promise<AuditoriaEnergeticaData> => {
      if (!clienteId) {
        throw new Error('Se requiere un cliente para obtener datos de auditoría');
      }

      const { data, error } = await supabase.rpc('get_auditoria_energetica_data', {
        p_cliente_id: clienteId,
        p_fecha_inicio: rangoFechas.start,
        p_fecha_fin: rangoFechas.end,
      });

      if (error) {
        console.error('Error fetching auditoria data:', error);
        throw error;
      }

      // La RPC devuelve JSONB directamente
      return data as AuditoriaEnergeticaData;
    },
    enabled: enabled && !!clienteId && !!rangoFechas.start && !!rangoFechas.end,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
}