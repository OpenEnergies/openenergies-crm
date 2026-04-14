import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllRows } from '@lib/supabaseFetchAll';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { useClienteId } from '@hooks/useClienteId';
import type { PuntosExportScope } from '@hooks/puntosExportScope';

const PUNTO_IDS_CHUNK_SIZE = 200;

type PuntoExportRow = {
  id: string;
  cliente_id: string;
  cups: string;
  direccion_sum: string | null;
  provincia_sum: string | null;
  localidad_sum: string | null;
  tipo_factura: string | null;
  tarifa: string | null;
  p1_kw: number | null;
  p2_kw: number | null;
  p3_kw: number | null;
  p4_kw: number | null;
  p5_kw: number | null;
  p6_kw: number | null;
  consumo_anual_kwh: number | null;
  tiene_fv: boolean | null;
  fv_compensacion: string | null;
  direccion_fisc: string | null;
  provincia_fisc: string | null;
  localidad_fisc: string | null;
  direccion_post: string | null;
  provincia_post: string | null;
  localidad_post: string | null;
  clientes: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  comercializadora: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

type SimpleOption = {
  id: string;
  label: string;
  carteraId?: string | null;
};

type ClienteMetaRow = {
  id: string;
  nombre: string;
  grupo_cliente_id: string | null;
  grupos_clientes: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getRelatedName(value: { nombre: string } | { nombre: string }[] | null): string {
  if (!value) return '—';
  if (Array.isArray(value)) return value[0]?.nombre || '—';
  return value.nombre || '—';
}

export function usePuntosExportFilters(isOpen: boolean, scope?: PuntosExportScope) {
  const { rol, userId } = useSession();
  const { clienteId: sessionClienteId } = useClienteId();

  const isCliente = rol === 'cliente';
  const isComercial = rol === 'comercial';

  const fixedClienteIds = useMemo(() => {
    if (scope?.clienteId) return [scope.clienteId];
    if (scope?.clienteIds && scope.clienteIds.length > 0) return uniqueSorted(scope.clienteIds);
    if (isCliente && sessionClienteId) return [sessionClienteId];
    return [];
  }, [scope?.clienteId, scope?.clienteIds, isCliente, sessionClienteId]);

  const hasFixedClienteScope = fixedClienteIds.length > 0;
  const canSelectClientes = !isCliente && !hasFixedClienteScope;

  const [selectedClienteIds, setSelectedClienteIds] = useState<string[]>([]);
  const [selectedCarteraIds, setSelectedCarteraIds] = useState<string[]>([]);
  const [selectedPuntoIds, setSelectedPuntoIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCarteraIds([]);
    setSelectedClienteIds([]);
    setSelectedPuntoIds([]);
  }, [isOpen]);

  const { data: assignedPuntoIds = [], isLoading: isAssignedPuntosLoading } = useQuery({
    queryKey: ['puntos-export-assigned-puntos', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('asignaciones_comercial_punto')
        .select('punto_id')
        .eq('comercial_user_id', userId);

      if (error) throw error;
      return uniqueSorted((data || []).map((row) => row.punto_id));
    },
    enabled: isOpen && isComercial && !!userId,
  });

  const { data: scopedPuntos = [], isLoading: isPuntosLoading } = useQuery({
    queryKey: ['puntos-export-scoped-puntos', rol, userId, fixedClienteIds, assignedPuntoIds],
    queryFn: async () => {
      const selectClause = `
        id,
        cliente_id,
        cups,
        direccion_sum,
        provincia_sum,
        localidad_sum,
        tipo_factura,
        tarifa,
        p1_kw,
        p2_kw,
        p3_kw,
        p4_kw,
        p5_kw,
        p6_kw,
        consumo_anual_kwh,
        tiene_fv,
        fv_compensacion,
        direccion_fisc,
        provincia_fisc,
        localidad_fisc,
        direccion_post,
        provincia_post,
        localidad_post,
        clientes (id, nombre),
        comercializadora:empresas!current_comercializadora_id (id, nombre)
      `;

      const createBaseQuery = () => {
        let query = supabase
          .from('puntos_suministro')
          .select(selectClause)
          .is('eliminado_en', null)
          .order('cups', { ascending: true });

        if (fixedClienteIds.length === 1) {
          query = query.eq('cliente_id', fixedClienteIds[0]);
        } else if (fixedClienteIds.length > 1) {
          query = query.in('cliente_id', fixedClienteIds);
        }

        return query;
      };

      if (isComercial) {
        if (assignedPuntoIds.length === 0) return [];

        const chunks = chunkArray(assignedPuntoIds, PUNTO_IDS_CHUNK_SIZE);
        const rows: PuntoExportRow[] = [];

        for (const chunk of chunks) {
          const partialRows = await fetchAllRows<PuntoExportRow>(createBaseQuery().in('id', chunk));
          rows.push(...partialRows);
        }

        const uniqueById = new Map(rows.map((row) => [row.id, row]));
        return [...uniqueById.values()];
      }

      return await fetchAllRows<PuntoExportRow>(createBaseQuery());
    },
    enabled: isOpen && (!isComercial || !!userId),
  });

  const clienteOptions = useMemo<SimpleOption[]>(() => {
    const map = new Map<string, SimpleOption>();
    const byClienteId = new Map<string, { id: string; nombre: string }>();

    scopedPuntos.forEach((punto) => {
      const nombre = getRelatedName(punto.clientes);
      if (punto.cliente_id && nombre !== '—') {
        byClienteId.set(punto.cliente_id, { id: punto.cliente_id, nombre });
      }
    });

    byClienteId.forEach((cliente) => {
      map.set(cliente.id, {
        id: cliente.id,
        label: cliente.nombre,
        carteraId: null,
      });
    });

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [scopedPuntos]);

  const scopedClienteIds = useMemo(() => uniqueSorted(scopedPuntos.map((punto) => punto.cliente_id)), [scopedPuntos]);

  const { data: clientesMeta = [] } = useQuery({
    queryKey: ['puntos-export-clientes-meta', scopedClienteIds],
    queryFn: async () => {
      if (scopedClienteIds.length === 0) return [] as ClienteMetaRow[];

      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, grupo_cliente_id, grupos_clientes:grupo_cliente_id (id, nombre)')
        .in('id', scopedClienteIds)
        .is('eliminado_en', null);

      if (error) throw error;
      return (data || []) as ClienteMetaRow[];
    },
    enabled: isOpen,
  });

  const clienteOptionsWithCartera = useMemo<SimpleOption[]>(() => {
    const map = new Map<string, string>();
    const carteraByClienteId = new Map<string, string | null>();

    (clientesMeta || []).forEach((cliente) => {
      carteraByClienteId.set(cliente.id, cliente.grupo_cliente_id || null);
    });

    scopedPuntos.forEach((punto) => {
      const nombre = getRelatedName(punto.clientes);
      if (punto.cliente_id && nombre !== '—') {
        map.set(punto.cliente_id, nombre);
      }
    });

    return [...map.entries()]
      .map(([id, label]) => ({ id, label, carteraId: carteraByClienteId.get(id) ?? null }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [scopedPuntos, clientesMeta]);

  const carteraOptions = useMemo<SimpleOption[]>(() => {
    const map = new Map<string, string>();

    (clientesMeta || []).forEach((cliente) => {
      const groupRelation = cliente.grupos_clientes;
      const group = Array.isArray(groupRelation) ? groupRelation[0] : groupRelation;
      if (group?.id && group?.nombre) {
        map.set(group.id, group.nombre);
      }
    });

    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientesMeta]);

  useEffect(() => {
    if (!isOpen || !canSelectClientes) {
      setSelectedCarteraIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const validIds = new Set(carteraOptions.map((option) => option.id));
    setSelectedCarteraIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, canSelectClientes, carteraOptions]);

  const clienteOptionsByCartera = useMemo(() => {
    if (!canSelectClientes || selectedCarteraIds.length === 0) return clienteOptionsWithCartera;
    const selectedSet = new Set(selectedCarteraIds);
    return clienteOptionsWithCartera.filter((option) => option.carteraId && selectedSet.has(option.carteraId));
  }, [canSelectClientes, selectedCarteraIds, clienteOptionsWithCartera]);

  useEffect(() => {
    if (!isOpen || !canSelectClientes) {
      setSelectedClienteIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const validIds = new Set(clienteOptionsByCartera.map((option) => option.id));
    setSelectedClienteIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, canSelectClientes, clienteOptionsByCartera]);

  const puntosByCarteraFilter = useMemo(() => {
    if (!canSelectClientes || selectedCarteraIds.length === 0) return scopedPuntos;
    const allowedClienteIds = new Set(clienteOptionsByCartera.map((option) => option.id));
    return scopedPuntos.filter((punto) => allowedClienteIds.has(punto.cliente_id));
  }, [scopedPuntos, canSelectClientes, selectedCarteraIds, clienteOptionsByCartera]);

  const puntosByClienteFilter = useMemo(() => {
    if (!canSelectClientes || selectedClienteIds.length === 0) return puntosByCarteraFilter;
    const selectedSet = new Set(selectedClienteIds);
    return puntosByCarteraFilter.filter((punto) => selectedSet.has(punto.cliente_id));
  }, [puntosByCarteraFilter, canSelectClientes, selectedClienteIds]);

  const puntoOptions = useMemo(() => {
    return puntosByClienteFilter
      .map((punto) => ({
        id: punto.id,
        label: punto.cups,
        subtitle: [punto.direccion_sum, punto.localidad_sum, punto.provincia_sum].filter(Boolean).join(' - '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [puntosByClienteFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const validIds = new Set(puntoOptions.map((option) => option.id));
    setSelectedPuntoIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, puntoOptions]);

  const selectedPuntos = useMemo(() => {
    if (selectedPuntoIds.length === 0) return puntosByClienteFilter;
    const selectedSet = new Set(selectedPuntoIds);
    return puntosByClienteFilter.filter((punto) => selectedSet.has(punto.id));
  }, [puntosByClienteFilter, selectedPuntoIds]);

  const isInitializingFilters = isOpen && (isAssignedPuntosLoading || isPuntosLoading);

  return {
    rol,
    isCliente,
    isComercial,
    canSelectClientes,
    selectedCarteraIds,
    setSelectedCarteraIds,
    carteraOptions,
    selectedClienteIds,
    setSelectedClienteIds,
    clienteOptions: clienteOptionsByCartera,
    selectedPuntoIds,
    setSelectedPuntoIds,
    puntoOptions,
    selectedPuntos,
    isInitializingFilters,
  };
}
