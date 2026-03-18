import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { fetchAllRows } from '@lib/supabaseFetchAll';
import { useSession } from '@hooks/useSession';
import { useClienteId } from '@hooks/useClienteId';
import type { FacturaExportScope } from '@hooks/facturaExportScope';

type ScopedInvoice = {
  id: string;
  cliente_id: string;
  comercializadora_id: string;
  tipo_factura: 'Luz' | 'Gas' | null;
  fecha_emision: string;
  punto_id: string;
  comercializadora: { id: string; nombre: string } | null;
  cliente: { id: string; nombre: string } | null;
};

type SimpleOption = { id: string; nombre: string };

type PuntoAgrupacionRow = {
  id: string;
  agrupacion_id: string | null;
};

const PUNTO_IDS_CHUNK_SIZE = 200;

function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function withinRange(date: string, from: string, to: string): boolean {
  if (!from || !to) return true;
  return date >= from && date <= to;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function useFacturaExportFilters(isOpen: boolean, scope?: FacturaExportScope) {
  const { rol, userId } = useSession();
  const { clienteId } = useClienteId();

  const isCliente = rol === 'cliente';
  const isComercial = rol === 'comercial';

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectedComercializadoras, setSelectedComercializadoras] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedAgrupaciones, setSelectedAgrupaciones] = useState<string[]>([]);
  const [selectedSociedades, setSelectedSociedades] = useState<string[]>([]);

  const hasExplicitScope = Boolean(
    scope?.clienteId
    || scope?.puntoId
    || scope?.comercializadoraId
    || scope?.agrupacionId
    || (scope?.puntoIds && scope.puntoIds.length > 0)
  );

  const effectiveClienteId = scope?.clienteId ?? (isCliente ? (clienteId ?? null) : null);
  const canSelectSociedades = isComercial
    && !scope?.clienteId
    && !scope?.puntoId
    && !(scope?.puntoIds && scope.puntoIds.length > 0)
    && !scope?.agrupacionId;

  const { data: assignedPuntoIds = [], isLoading: isAssignedPuntosLoading } = useQuery({
    queryKey: ['export-facturas-assigned-puntos', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('asignaciones_comercial_punto')
        .select('punto_id')
        .eq('comercial_user_id', userId);

      if (error) throw error;
      return uniqueSorted((data || []).map(r => r.punto_id));
    },
    enabled: isOpen && isComercial && !!userId && !hasExplicitScope,
  });

  const { data: contextPuntoIds = [], isLoading: isContextPuntosLoading } = useQuery({
    queryKey: ['export-facturas-context-puntos', scope?.puntoId, scope?.puntoIds, scope?.agrupacionId, scope?.clienteId],
    queryFn: async () => {
      if (scope?.puntoId) {
        return [scope.puntoId];
      }

      if (scope?.puntoIds && scope.puntoIds.length > 0) {
        return uniqueSorted(scope.puntoIds);
      }

      if (!scope?.agrupacionId) {
        return [];
      }

      let query = supabase
        .from('puntos_suministro')
        .select('id')
        .eq('agrupacion_id', scope.agrupacionId)
        .is('eliminado_en', null);

      if (scope.clienteId) {
        query = query.eq('cliente_id', scope.clienteId);
      }

      const { data, error } = await query.range(0, 99999);
      if (error) throw error;

      return uniqueSorted((data || []).map((row) => row.id));
    },
    enabled: isOpen && Boolean(scope?.puntoId || (scope?.puntoIds && scope.puntoIds.length > 0) || scope?.agrupacionId),
  });

  const { data: scopedInvoices = [], isLoading: isScopedInvoicesLoading } = useQuery({
    queryKey: [
      'export-facturas-scoped-invoices',
      rol,
      userId,
      clienteId,
      effectiveClienteId,
      scope?.comercializadoraId,
      assignedPuntoIds,
      contextPuntoIds,
      hasExplicitScope,
    ],
    queryFn: async () => {
      const createBaseQuery = () => {
        let query = supabase
          .from('facturacion_clientes')
          .select(`
            id,
            cliente_id,
            comercializadora_id,
            tipo_factura,
            fecha_emision,
            punto_id,
            comercializadora:empresas!comercializadora_id (id, nombre),
            cliente:clientes!cliente_id (id, nombre)
          `)
          .is('eliminado_en', null)
          .order('fecha_emision', { ascending: true });

        if (scope?.comercializadoraId) {
          query = query.eq('comercializadora_id', scope.comercializadoraId);
        }

        if (effectiveClienteId) {
          query = query.eq('cliente_id', effectiveClienteId);
        }

        return query;
      };

      if (contextPuntoIds.length > 0) {
        const chunks = chunkArray(contextPuntoIds, PUNTO_IDS_CHUNK_SIZE);
        const allRows: ScopedInvoice[] = [];

        for (const puntoChunk of chunks) {
          const rows = await fetchAllRows<ScopedInvoice>(createBaseQuery().in('punto_id', puntoChunk));
          allRows.push(...rows);
        }

        const uniqueById = new Map(allRows.map(row => [row.id, row]));
        return [...uniqueById.values()].sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision));
      }

      if (isComercial && !hasExplicitScope) {
        if (assignedPuntoIds.length === 0) return [];

        const chunks = chunkArray(assignedPuntoIds, PUNTO_IDS_CHUNK_SIZE);
        const allRows: ScopedInvoice[] = [];

        for (const puntoChunk of chunks) {
          const rows = await fetchAllRows<ScopedInvoice>(createBaseQuery().in('punto_id', puntoChunk));
          allRows.push(...rows);
        }

        const uniqueById = new Map(allRows.map(row => [row.id, row]));
        return [...uniqueById.values()].sort((a, b) => a.fecha_emision.localeCompare(b.fecha_emision));
      }

      return await fetchAllRows<ScopedInvoice>(createBaseQuery());
    },
    enabled: isOpen && (!isCliente || !!clienteId) && (!isComercial || !!userId || hasExplicitScope),
  });

  const minFecha = useMemo(() => scopedInvoices.at(0)?.fecha_emision ?? '', [scopedInvoices]);
  const maxFecha = useMemo(() => scopedInvoices.at(-1)?.fecha_emision ?? '', [scopedInvoices]);

  useEffect(() => {
    if (!isOpen) return;
    setFechaDesde(minFecha || '');
    setFechaHasta(maxFecha || '');
    setSelectedComercializadoras([]);
    setSelectedTipos([]);
    setSelectedAgrupaciones([]);
    setSelectedSociedades([]);
  }, [isOpen, minFecha, maxFecha]);

  const periodInvoices = useMemo(() => {
    return scopedInvoices.filter(i => withinRange(i.fecha_emision, fechaDesde || minFecha, fechaHasta || maxFecha));
  }, [scopedInvoices, fechaDesde, fechaHasta, minFecha, maxFecha]);

  const scopedPuntoIds = useMemo(() => {
    if (scope?.puntoId) return [scope.puntoId];
    if (scope?.puntoIds && scope.puntoIds.length > 0) return uniqueSorted(scope.puntoIds);
    if (scope?.agrupacionId) return contextPuntoIds;
    return [];
  }, [scope?.puntoId, scope?.puntoIds, scope?.agrupacionId, contextPuntoIds]);

  const comercializadoraOptions = useMemo<SimpleOption[]>(() => {
    const map = new Map<string, string>();
    periodInvoices.forEach(i => {
      if (i.comercializadora_id && i.comercializadora?.nombre) {
        map.set(i.comercializadora_id, i.comercializadora.nombre);
      }
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [periodInvoices]);

  const tipoOptions = useMemo<string[]>(() => {
    const tipos = new Set<string>();
    periodInvoices.forEach(i => {
      if (i.tipo_factura) tipos.add(i.tipo_factura);
    });
    return [...tipos].sort();
  }, [periodInvoices]);

  const sociedadOptions = useMemo<SimpleOption[]>(() => {
    const map = new Map<string, string>();
    periodInvoices.forEach(i => {
      if (i.cliente_id && i.cliente?.nombre) {
        map.set(i.cliente_id, i.cliente.nombre);
      }
    });
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [periodInvoices]);

  const fixedClienteIds = useMemo<string[]>(() => {
    if (effectiveClienteId) return [effectiveClienteId];
    return uniqueSorted(periodInvoices.map((invoice) => invoice.cliente_id));
  }, [effectiveClienteId, periodInvoices]);

  useEffect(() => {
    if (!isOpen) return;
    const ids = comercializadoraOptions.map(c => c.id);
    setSelectedComercializadoras(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const next = kept.length > 0 ? kept : ids;
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, comercializadoraOptions]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTipos(prev => {
      const kept = prev.filter(t => tipoOptions.includes(t));
      const next = kept.length > 0 ? kept : tipoOptions;
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, tipoOptions]);

  useEffect(() => {
    if (!isOpen || !canSelectSociedades) {
      setSelectedSociedades((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const ids = sociedadOptions.map(s => s.id);
    setSelectedSociedades(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const next = kept.length > 0 ? kept : ids;
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, canSelectSociedades, sociedadOptions]);

  const agrupacionSourceInvoices = useMemo(() => {
    if (!canSelectSociedades || selectedSociedades.length === 0) return periodInvoices;
    return periodInvoices.filter((invoice) => selectedSociedades.includes(invoice.cliente_id));
  }, [periodInvoices, canSelectSociedades, selectedSociedades]);

  const agrupacionPuntoIds = useMemo(() => {
    return uniqueSorted(agrupacionSourceInvoices.map((invoice) => invoice.punto_id));
  }, [agrupacionSourceInvoices]);

  const { data: agrupaciones = [], isLoading: isAgrupacionesLoading } = useQuery({
    queryKey: ['export-facturas-agrupaciones', agrupacionPuntoIds, scope?.agrupacionId],
    queryFn: async () => {
      if (scope?.agrupacionId) {
        const { data, error } = await supabase
          .from('agrupaciones_puntos')
          .select('id, nombre, cliente_id')
          .eq('id', scope.agrupacionId)
          .is('eliminado_en', null)
          .order('nombre');

        if (error) throw error;
        return data || [];
      }

      if (agrupacionPuntoIds.length === 0) return [];

      const puntoChunks = chunkArray(agrupacionPuntoIds, PUNTO_IDS_CHUNK_SIZE);
      const agrupacionIds = new Set<string>();

      for (const puntoChunk of puntoChunks) {
        const { data, error } = await supabase
          .from('puntos_suministro')
          .select('id, agrupacion_id')
          .in('id', puntoChunk)
          .is('eliminado_en', null);

        if (error) throw error;

        (data as PuntoAgrupacionRow[] | null)?.forEach((row) => {
          if (row.agrupacion_id) agrupacionIds.add(row.agrupacion_id);
        });
      }

      const ids = [...agrupacionIds];
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('agrupaciones_puntos')
        .select('id, nombre, cliente_id')
        .in('id', ids)
        .is('eliminado_en', null)
        .order('nombre');

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (scope?.agrupacionId) {
      const ids = (agrupaciones || []).map((a) => a.id);
      const next = ids.includes(scope.agrupacionId) ? [scope.agrupacionId] : [];
      setSelectedAgrupaciones(prev => (arrayEquals(prev, next) ? prev : next));
      return;
    }

    const ids = (agrupaciones || []).map(a => a.id);
    setSelectedAgrupaciones(prev => {
      const next = prev.filter(id => ids.includes(id));
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, agrupaciones, scope?.agrupacionId]);

  const baseSelectionsReady =
    (comercializadoraOptions.length === 0 || selectedComercializadoras.length > 0)
    && (tipoOptions.length === 0 || selectedTipos.length > 0)
    && (!canSelectSociedades || sociedadOptions.length === 0 || selectedSociedades.length > 0)
    && (!scope?.agrupacionId || selectedAgrupaciones.length > 0);

  const isInitializingFilters =
    isOpen
    && (
      isAssignedPuntosLoading
      || isContextPuntosLoading
      || isScopedInvoicesLoading
      || isAgrupacionesLoading
      || !baseSelectionsReady
    );

  return {
    isCliente,
    isComercial,
    clienteId: effectiveClienteId,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    minFecha,
    maxFecha,
    comercializadoraOptions,
    selectedComercializadoras,
    setSelectedComercializadoras,
    tipoOptions,
    selectedTipos,
    setSelectedTipos,
    sociedadOptions,
    fixedClienteIds,
    canSelectSociedades,
    selectedSociedades,
    setSelectedSociedades,
    agrupaciones,
    selectedAgrupaciones,
    setSelectedAgrupaciones,
    scopedPuntoIds,
    isInitializingFilters,
  };
}
