// src/hooks/useAgrupaciones.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useClienteId } from './useClienteId';
import { useSession } from './useSession';

// ── Types ──
export type TipoAgrupacion = 'edificio' | 'grupo' | 'proyecto' | 'zona' | 'cartera' | 'delegación' | 'centro';

export interface Agrupacion {
  id: string;
  cliente_id: string;
  nombre: string;
  tipo: TipoAgrupacion;
  codigo: string | null;
  direccion: string | null;
  descripcion: string | null;
  creado_en: string;
}

export interface AgrupacionConStats extends Agrupacion {
  numPuntos: number;
  costeAnual: number;
}

export interface PuntoSinAgrupar {
  id: string;
  cups: string;
  direccion_sum: string;
  localidad_sum: string | null;
  provincia_sum: string | null;
  tipo_factura: string | null;
}

// ── Fetch agrupaciones del cliente autenticado ──
export function useAgrupacionesCliente(overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const clienteId = overrideClienteId || ownClienteId;

  return useQuery({
    queryKey: ['agrupaciones-cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      // 1. Fetch agrupaciones
      const { data: agrupaciones, error: agErr } = await supabase
        .from('agrupaciones_puntos')
        .select('id, cliente_id, nombre, tipo, codigo, direccion, descripcion, creado_en')
        .eq('cliente_id', clienteId)
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .range(0, 99999);

      if (agErr) throw agErr;
      if (!agrupaciones || agrupaciones.length === 0) return [];

      const agrupacionIds = agrupaciones.map(a => a.id);

      // 2. Count puntos per agrupación
      const { data: puntos, error: pErr } = await supabase
        .from('puntos_suministro')
        .select('id, agrupacion_id')
        .in('agrupacion_id', agrupacionIds)
        .eq('cliente_id', clienteId)
        .is('eliminado_en', null)
        .range(0, 99999);

      if (pErr) throw pErr;

      // 3. Get coste anual (last 12 months) for puntos in agrupaciones
      const puntoIds = (puntos || []).map(p => p.id);
      let facturacionData: { punto_id: string; total: number }[] = [];

      if (puntoIds.length > 0) {
        const since = new Date();
        since.setFullYear(since.getFullYear() - 1);
        const sinceStr = since.toISOString().split('T')[0];

        const { data: facturas, error: fErr } = await supabase
          .from('facturacion_clientes')
          .select('punto_id, total')
          .in('punto_id', puntoIds)
          .eq('cliente_id', clienteId)
          .gte('fecha_emision', sinceStr)
          .is('eliminado_en', null)
          .range(0, 99999);

        if (fErr) throw fErr;
        facturacionData = facturas || [];
      }

      // 4. Build punto → agrupacion_id map
      const puntoToAgrupacion = new Map<string, string>();
      (puntos || []).forEach(p => {
        if (p.agrupacion_id) puntoToAgrupacion.set(p.id, p.agrupacion_id);
      });

      // 5. Aggregate stats
      const countMap = new Map<string, number>();
      const costeMap = new Map<string, number>();

      (puntos || []).forEach(p => {
        if (p.agrupacion_id) {
          countMap.set(p.agrupacion_id, (countMap.get(p.agrupacion_id) || 0) + 1);
        }
      });

      facturacionData.forEach(f => {
        const agId = puntoToAgrupacion.get(f.punto_id);
        if (agId) {
          costeMap.set(agId, (costeMap.get(agId) || 0) + (f.total || 0));
        }
      });

      return agrupaciones.map(a => ({
        ...a,
        numPuntos: countMap.get(a.id) || 0,
        costeAnual: Math.round((costeMap.get(a.id) || 0) * 100) / 100,
      })) as AgrupacionConStats[];
    },
    enabled: !!clienteId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Fetch single agrupación detail ──
export function useAgrupacionDetail(agrupacionId: string | undefined, overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['agrupacion-detail', agrupacionId, clienteId],
    queryFn: async () => {
      if (!agrupacionId) return null;

      let query = supabase
        .from('agrupaciones_puntos')
        .select('id, cliente_id, nombre, tipo, codigo, direccion, descripcion, creado_en')
        .eq('id', agrupacionId)
        .is('eliminado_en', null);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { data, error } = await query.single();
      if (error) throw error;
      return data as Agrupacion;
    },
    enabled: !!agrupacionId && (!!clienteId || isStaff),
  });
}

// ── Fetch puntos of an agrupación ──
export function useAgrupacionPuntos(agrupacionId: string | undefined, overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['agrupacion-puntos', agrupacionId, clienteId],
    queryFn: async () => {
      if (!agrupacionId) return [];

      let query = supabase
        .from('puntos_suministro')
        .select('id, cups, direccion_sum, localidad_sum, provincia_sum, tipo_factura, tarifa')
        .eq('agrupacion_id', agrupacionId)
        .is('eliminado_en', null);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { data, error } = await query.range(0, 99999);
      if (error) throw error;
      return data || [];
    },
    enabled: !!agrupacionId && (!!clienteId || isStaff),
  });
}

// ── Fetch KPIs & charts data for agrupación ──
export interface AgrupacionFacturaRow {
  fecha_emision: string;
  consumo_kwh: number | null;
  total: number;
  precio_eur_kwh: number | null;
  tipo_factura: string | null;
  punto_id: string;
}

export function useAgrupacionFacturacion(agrupacionId: string | undefined, year: number, overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['agrupacion-facturacion', agrupacionId, clienteId, year],
    queryFn: async () => {
      if (!agrupacionId) return [];

      // Get punto IDs in this agrupación
      let pQuery = supabase
        .from('puntos_suministro')
        .select('id')
        .eq('agrupacion_id', agrupacionId)
        .is('eliminado_en', null);

      if (clienteId) pQuery = pQuery.eq('cliente_id', clienteId);

      const { data: puntos, error: pErr } = await pQuery.range(0, 99999);
      if (pErr) throw pErr;
      const puntoIds = (puntos || []).map(p => p.id);
      if (puntoIds.length === 0) return [];

      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      let fQuery = supabase
        .from('facturacion_clientes')
        .select('fecha_emision, consumo_kwh, total, precio_eur_kwh, tipo_factura, punto_id')
        .in('punto_id', puntoIds)
        .gte('fecha_emision', startDate)
        .lte('fecha_emision', endDate)
        .is('eliminado_en', null)
        .order('fecha_emision', { ascending: true });

      if (clienteId) fQuery = fQuery.eq('cliente_id', clienteId);

      const { data: facturas, error: fErr } = await fQuery.range(0, 99999);
      if (fErr) throw fErr;
      return (facturas || []) as AgrupacionFacturaRow[];
    },
    enabled: !!agrupacionId && (!!clienteId || isStaff),
  });
}

// ── Fetch distinct tipo_factura for agrupación ──
export function useAgrupacionTiposFactura(agrupacionId: string | undefined, overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['agrupacion-tipos', agrupacionId, clienteId],
    queryFn: async () => {
      if (!agrupacionId) return [];

      let query = supabase
        .from('puntos_suministro')
        .select('tipo_factura')
        .eq('agrupacion_id', agrupacionId)
        .is('eliminado_en', null);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { data: puntos, error } = await query.range(0, 99999);
      if (error) throw error;
      const tipos = new Set<string>();
      (puntos || []).forEach(p => {
        if (p.tipo_factura) tipos.add(p.tipo_factura);
      });
      return Array.from(tipos).sort();
    },
    enabled: !!agrupacionId && (!!clienteId || isStaff),
  });
}

// ── Fetch puntos without agrupación (for selector) ──
export function usePuntosSinAgrupar(overrideClienteId?: string) {
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['puntos-sin-agrupar', clienteId],
    queryFn: async () => {
      if (!clienteId && !isStaff) return [];

      let query = supabase
        .from('puntos_suministro')
        .select('id, cups, direccion_sum, localidad_sum, provincia_sum, tipo_factura')
        .is('agrupacion_id', null)
        .is('eliminado_en', null)
        .order('direccion_sum', { ascending: true });

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { data, error } = await query.range(0, 99999);
      if (error) throw error;
      return (data || []) as PuntoSinAgrupar[];
    },
    enabled: !!clienteId || isStaff,
  });
}

// ── Fetch agrupación info for a punto (for badge display) ──
export function useAgrupacionPunto(agrupacionId: string | null | undefined) {
  const { clienteId } = useClienteId();
  const { rol } = useSession();
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useQuery({
    queryKey: ['agrupacion-punto-badge', agrupacionId, clienteId],
    queryFn: async () => {
      if (!agrupacionId) return null;

      let query = supabase
        .from('agrupaciones_puntos')
        .select('id, nombre, tipo')
        .eq('id', agrupacionId)
        .is('eliminado_en', null);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { data, error } = await query.single();
      if (error) return null;
      return data as { id: string; nombre: string; tipo: TipoAgrupacion };
    },
    enabled: !!agrupacionId && (!!clienteId || isStaff),
  });
}

// ── Mutations ──

export function useCrearAgrupacion(overrideClienteId?: string) {
  const queryClient = useQueryClient();
  const { clienteId: ownClienteId } = useClienteId();
  const clienteId = overrideClienteId || ownClienteId;

  return useMutation({
    mutationFn: async (params: {
      nombre: string;
      tipo: TipoAgrupacion;
      codigo?: string;
      direccion?: string;
      descripcion?: string;
      puntoIds: string[];
    }) => {
      if (!clienteId) throw new Error('No se pudo determinar el cliente');

      // 1. Create agrupación
      const { data: agrupacion, error: agErr } = await supabase
        .from('agrupaciones_puntos')
        .insert({
          cliente_id: clienteId,
          nombre: params.nombre,
          tipo: params.tipo,
          codigo: params.codigo || null,
          direccion: params.direccion || null,
          descripcion: params.descripcion || null,
        })
        .select('id')
        .single();

      if (agErr) throw agErr;

      // 2. Assign puntos via RPC (bypasses RLS on puntos_suministro)
      if (params.puntoIds.length > 0) {
        const { error: pErr } = await supabase.rpc('asignar_puntos_agrupacion', {
          p_agrupacion_id: agrupacion.id,
          p_punto_ids: params.puntoIds,
        });

        if (pErr) throw pErr;
      }

      return agrupacion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupaciones-cliente'] });
      queryClient.invalidateQueries({ queryKey: ['puntos-sin-agrupar'] });
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
  });
}

export function useAnadirPuntosAgrupacion(overrideClienteId?: string) {
  const queryClient = useQueryClient();
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useMutation({
    mutationFn: async (params: { agrupacionId: string; puntoIds: string[] }) => {
      if (!clienteId && !isStaff) throw new Error('No se pudo determinar el cliente');

      // Assign via RPC (handles ownership & RLS checks server-side)
      const { error } = await supabase.rpc('asignar_puntos_agrupacion', {
        p_agrupacion_id: params.agrupacionId,
        p_punto_ids: params.puntoIds,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agrupaciones-cliente'] });
      queryClient.invalidateQueries({ queryKey: ['puntos-sin-agrupar'] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-puntos', variables.agrupacionId] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-facturacion'] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-tipos'] });
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
  });
}

export function useEditarAgrupacion(overrideClienteId?: string) {
  const queryClient = useQueryClient();
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useMutation({
    mutationFn: async (params: {
      id: string;
      nombre: string;
      tipo: TipoAgrupacion;
      codigo?: string;
      direccion?: string;
      descripcion?: string;
    }) => {
      if (!clienteId && !isStaff) throw new Error('No se pudo determinar el cliente');

      let query = supabase
        .from('agrupaciones_puntos')
        .update({
          nombre: params.nombre,
          tipo: params.tipo,
          codigo: params.codigo || null,
          direccion: params.direccion || null,
          descripcion: params.descripcion || null,
        })
        .eq('id', params.id);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupaciones-cliente'] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-detail'] });
    },
  });
}

export function useEliminarAgrupacion(overrideClienteId?: string) {
  const queryClient = useQueryClient();
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useMutation({
    mutationFn: async (agrupacionId: string) => {
      if (!clienteId && !isStaff) throw new Error('No se pudo determinar el cliente');

      // 1. Unassign all puntos via RPC
      const { error: pErr } = await supabase.rpc('desasignar_todos_puntos_agrupacion', {
        p_agrupacion_id: agrupacionId,
      });

      if (pErr) throw pErr;

      // 2. Soft-delete agrupación
      let query = supabase
        .from('agrupaciones_puntos')
        .update({ eliminado_en: new Date().toISOString() })
        .eq('id', agrupacionId);

      if (clienteId) query = query.eq('cliente_id', clienteId);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupaciones-cliente'] });
      queryClient.invalidateQueries({ queryKey: ['puntos-sin-agrupar'] });
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
  });
}

export function useQuitarPuntoDeAgrupacion(overrideClienteId?: string) {
  const queryClient = useQueryClient();
  const { clienteId: ownClienteId } = useClienteId();
  const { rol } = useSession();
  const clienteId = overrideClienteId || ownClienteId;
  const isStaff = rol === 'administrador' || rol === 'comercial';

  return useMutation({
    mutationFn: async (params: { puntoId: string; agrupacionId: string }) => {
      if (!clienteId && !isStaff) throw new Error('No se pudo determinar el cliente');

      // Desasignar via RPC (handles RLS bypass)
      const { error } = await supabase.rpc('desasignar_punto_agrupacion', {
        p_punto_id: params.puntoId,
        p_agrupacion_id: params.agrupacionId,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agrupaciones-cliente'] });
      queryClient.invalidateQueries({ queryKey: ['puntos-sin-agrupar'] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-puntos', variables.agrupacionId] });
      queryClient.invalidateQueries({ queryKey: ['agrupacion-facturacion'] });
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
    },
  });
}
