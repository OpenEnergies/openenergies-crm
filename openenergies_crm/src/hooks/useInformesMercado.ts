// openenergies_crm/src/hooks/useInformesMercado.ts
// Hooks para el módulo de Informes de Mercado

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { fetchAllRows } from '@lib/supabaseFetchAll';
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
import type { FinalReportPayload } from '@lib/reportDraftTypes';
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

      // Query base: obtener informes del usuario o de su empresa
      let query = supabase
        .from('informes_mercado')
        .select(`
          *,
          creador:usuarios_app!creado_por(nombre, apellidos),
          cliente_info:clientes!cliente_id(id, nombre)
        `)
        .is('eliminado_en', null)
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

      const data = await fetchAllRows<InformeMercado>(query);

      // Obtener targets para cada informe
      if (data && data.length > 0) {
        const informeIds = data.map(i => i.id);
        const { data: targets } = await supabase
          .from('informes_targets')
          .select('informe_id, punto_id')
          .in('informe_id', informeIds)
          .range(0, 99999);

        // Agrupar targets por informe
        const targetsMap = new Map<string, string[]>();
        (targets || []).forEach(t => {
          if (!targetsMap.has(t.informe_id)) {
            targetsMap.set(t.informe_id, []);
          }
          targetsMap.get(t.informe_id)!.push(t.punto_id);
        });

        // Agregar punto_ids a cada informe
        return data.map(informe => ({
          ...informe,
          punto_ids: targetsMap.get(informe.id) || []
        })) as InformeMercadoConRelaciones[];
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
          creador:usuarios_app!creado_por(nombre, apellidos),
          cliente_info:clientes!cliente_id(id, nombre)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching informe detail:', error);
        throw error;
      }

      if (data) {
        // Fetch targets
        const { data: targets } = await supabase
          .from('informes_targets')
          .select('punto_id')
          .eq('informe_id', id)
          .range(0, 99999);

        const puntoIds = (targets || []).map(t => t.punto_id);

        // Fetch puntos info
        const { data: puntosData } = puntoIds.length > 0
          ? await supabase
            .from('puntos_suministro')
            .select('id, cups, direccion_sum')
            .in('id', puntoIds)
            .range(0, 99999)
          : { data: [] };

        return {
          ...data,
          punto_ids: puntoIds,
          puntos_info: puntosData || []
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
  clienteId: string | null,
  puntoIds: string[],
  fechaInicio: string,
  fechaFin: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: informesKeys.datosCalculados([clienteId || ''], puntoIds, { start: fechaInicio, end: fechaFin }),
    queryFn: async (): Promise<DatosCalculados> => {
      if (!clienteId) {
        throw new Error('Se requiere un cliente');
      }

      const { data: facturacionData, error: factError } = await supabase
        .rpc('get_informe_facturacion_data', {
          p_cliente_id: clienteId,
          p_punto_ids: puntoIds,
          p_fecha_inicio: fechaInicio,
          p_fecha_fin: fechaFin,
        });

      if (factError) {
        console.error('Error fetching facturacion data:', factError);
      }

      const { data: marketData, error: marketError } = await supabase
        .rpc('get_informe_market_data', {
          p_fecha_inicio: fechaInicio,
          p_fecha_fin: fechaFin,
          p_indicator_ids: [600, 1001], // SPOT y PVPC
        });

      if (marketError) {
        console.error('Error fetching market data:', marketError);
      }

      return {
        facturacion: facturacionData || {
          resumen: { total_facturas: 0, importe_total: 0, consumo_total_kwh: 0, precio_medio_kwh: 0 },
          por_mes: [],
          por_punto: [],
        },
        mercado: marketData || {
          estadisticas_diarias: [],
          resumen_periodo: [],
        },
      };
    },
    enabled: enabled && !!clienteId && puntoIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// HOOK: Generar Informe
// ============================================================================

export function useGenerateInforme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: GenerateInformeRequest): Promise<GenerateInformeResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const response = await supabase.functions.invoke('generate-market-report', {
        body: request,
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
// HOOK: Generar Informe de Auditoría Energética
// Llama a generate-audit-report Edge Function y descarga automáticamente el DOCX
// ============================================================================

/** Trigger automatic download of a file from a signed URL */
function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function useGenerateAuditReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FinalReportPayload): Promise<GenerateInformeResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const response = await supabase.functions.invoke('generate-audit-report', {
        body: payload,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error generando informe de auditoría');
      }

      const data = response.data as GenerateInformeResponse;

      // Trigger automatic download if URL is available
      if (data.success && data.download_url) {
        const filename = `${payload.metadata.titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '_')}.docx`;
        triggerDownload(data.download_url, filename);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });

      if (data.success) {
        if (data.download_url) {
          toast.success('Informe de auditoría generado y descargado correctamente');
        } else {
          toast.success('Informe guardado (sin documento - microservicio no configurado)');
        }
      }
    },
    onError: (error: Error) => {
      console.error('Error generating audit report:', error);
      toast.error(`Error generando auditoría: ${error.message}`);
    },
  });
}



export function useDeleteInforme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // 1. Obtener usuario actual para el log
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // 2. Obtener ruta del archivo
      const { data: informe, error: fetchError } = await supabase
        .from('informes_mercado')
        .select('ruta_storage')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error('Error obteniendo informe');
      }

      // 3. HARD DELETE del archivo en Storage
      if (informe?.ruta_storage) {
        const { error: storageError } = await supabase.storage
          .from('informes-mercado')
          .remove([informe.ruta_storage]);

        if (storageError) {
          console.error('Error eliminando archivo de storage:', storageError);
          // No lanzamos error aquí para permitir que continúe el borrado lógico en BD
        }
      }

      // 4. SOFT DELETE del registro en BD
      const { error: updateError } = await supabase
        .from('informes_mercado')
        .update({
          eliminado_en: new Date().toISOString(),
          eliminado_por: user.id
        })
        .eq('id', id);

      if (updateError) {
        throw new Error('Error marcando informe como eliminado');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });
      toast.success('Informe eliminado correctamente');
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
        // Silently ignore "Object not found" errors (expected for deleted files or incorrectly stored paths)
        // These can occur when:
        // 1. File was deleted from storage but DB record remains
        // 2. Path format changed between versions
        // 3. File generation failed but record was created
        if (
          error.message.includes('Object not found') ||
          error.message.includes('400') ||
          error.message.includes('Not found')
        ) {
          return null;
        }

        // Only log unexpected errors (like network issues or permissions)
        console.warn('[useInformeDownloadUrl] Unexpected error creating signed URL:', error.message);
        return null;
      }

      return data?.signedUrl || null;
    },
    enabled: !!rutaStorage,
    staleTime: 30 * 60 * 1000,
    retry: false, // No reintentar si el archivo no existe
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

      const clientes = await fetchAllRows<{ id: string; nombre: string; email: string | null }>(clientesQuery);

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

      const facturas = await fetchAllRows<{ cliente_id: string }>(facturasQuery);

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

      const facturas = await fetchAllRows<{ punto_id: string }>(facturasQuery);

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

      const puntos = await fetchAllRows<{ id: string; cups: string; direccion_sum: string | null; cliente_id: string }>(puntosQuery);

      if (!puntos || puntos.length === 0) return [];

      // PASO 3: Obtener nombres de clientes para los puntos
      const uniqueClienteIds = Array.from(new Set(puntos.map(p => p.cliente_id).filter(Boolean)));

      let clientesMap: Record<string, string> = {};

      if (uniqueClienteIds.length > 0) {
        const { data: clientes, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nombre')
          .in('id', uniqueClienteIds)
          .range(0, 99999);

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
  fechaInicio: string,
  fechaFin: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: informesKeys.auditoriaData(clienteId || '', { start: fechaInicio, end: fechaFin }),
    queryFn: async (): Promise<AuditoriaEnergeticaData> => {
      if (!clienteId) {
        throw new Error('Se requiere un cliente para obtener datos de auditoría');
      }

      const { data, error } = await supabase.rpc('get_auditoria_energetica_data', {
        p_cliente_id: clienteId,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
      });

      if (error) {
        console.error('Error fetching auditoria data:', error);
        throw error;
      }

      // La RPC devuelve JSONB directamente
      return data as AuditoriaEnergeticaData;
    },
    enabled: enabled && !!clienteId && !!fechaInicio && !!fechaFin,
    staleTime: 0, // Siempre refrescar datos al navegar entre pasos del wizard
  });
}

// ============================================================================
// HOOK: Generar Informe Comparativo con Mercado
// Llama a generate-comparative-audit-report Edge Function
// ============================================================================

import type { ComparativaPayload, ComparativaDraft } from '@lib/comparativaDraftTypes';

/** Response from the comparative Edge Function */
export interface ComparativeReportResponse extends GenerateInformeResponse {
  calculated_data?: Record<string, unknown>;
}

export function useGenerateComparativeReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ComparativaPayload): Promise<ComparativeReportResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('No hay sesión activa');
      }

      // The Edge Function returns DOCX binary directly in generate mode.
      // We use fetch() to handle the binary response properly.
      const generatePayload = { ...payload, mode: 'generate' };

      const url = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/generate-comparative-audit-report`;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(generatePayload),
      });

      if (!resp.ok) {
        // Try to parse error JSON
        let errMsg = `Error ${resp.status}`;
        try {
          const errJson = await resp.json();
          errMsg = errJson.error || errMsg;
        } catch { /* ignore parse error */ }
        throw new Error(errMsg);
      }

      const contentType = resp.headers.get('Content-Type') || '';
      const informeId = resp.headers.get('X-Informe-Id') || '';

      if (contentType.includes('application/vnd.openxmlformats')) {
        // Binary DOCX response — download it
        const blob = await resp.blob();
        const filename = `${payload.metadata.titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '_')}.docx`;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        return { success: true, informe_id: informeId } as ComparativeReportResponse;
      }

      // Fallback: JSON response (e.g. if Cloud Run not configured)
      const data = await resp.json();
      return data as ComparativeReportResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });
      toast.success('Informe comparativo generado y descargado correctamente');
    },
    onError: (error: Error) => {
      console.error('Error generating comparative report:', error);
      toast.error(`Error generando comparativa: ${error.message}`);
    },
  });
}