import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { fetchAllRows } from '@lib/supabaseFetchAll';
import { useSession } from '@hooks/useSession';
import { useClienteId } from '@hooks/useClienteId';

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

export function useFacturaExportFilters(isOpen: boolean) {
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

  const { data: assignedPuntoIds = [], isLoading: isAssignedPuntosLoading } = useQuery({
    queryKey: ['export-facturas-assigned-puntos', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('asignaciones_comercial_punto')
        .select('punto_id')
        .eq('comercial_user_id', userId);

      if (error) throw error;
      return (data || []).map(r => r.punto_id);
    },
    enabled: isOpen && isComercial && !!userId,
  });

  const { data: scopedInvoices = [], isLoading: isScopedInvoicesLoading } = useQuery({
    queryKey: ['export-facturas-scoped-invoices', rol, userId, clienteId, assignedPuntoIds],
    queryFn: async () => {
      const createBaseQuery = () =>
        supabase
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

      if (isCliente && clienteId) {
        return await fetchAllRows<ScopedInvoice>(createBaseQuery().eq('cliente_id', clienteId));
      } else if (isComercial) {
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
    enabled: isOpen && (!isCliente || !!clienteId) && (!isComercial || !!userId),
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
    if (!isOpen || !isComercial) return;
    const ids = sociedadOptions.map(s => s.id);
    setSelectedSociedades(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const next = kept.length > 0 ? kept : ids;
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, isComercial, sociedadOptions]);

  const agrupacionesEnabled = isOpen && (isCliente ? !!clienteId : isComercial ? selectedSociedades.length > 0 : true);

  const { data: agrupaciones = [], isLoading: isAgrupacionesLoading } = useQuery({
    queryKey: ['export-facturas-agrupaciones', isCliente ? clienteId : selectedSociedades],
    queryFn: async () => {
      let query = supabase
        .from('agrupaciones_puntos')
        .select('id, nombre, cliente_id')
        .is('eliminado_en', null)
        .order('nombre');

      if (isCliente) {
        if (!clienteId) return [];
        query = query.eq('cliente_id', clienteId);
      } else if (isComercial) {
        if (selectedSociedades.length === 0) return [];
        query = query.in('cliente_id', selectedSociedades);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: agrupacionesEnabled,
  });

  useEffect(() => {
    if (!isOpen) return;
    const ids = (agrupaciones || []).map(a => a.id);
    setSelectedAgrupaciones(prev => {
      const next = prev.filter(id => ids.includes(id));
      return arrayEquals(prev, next) ? prev : next;
    });
  }, [isOpen, agrupaciones]);

  const baseSelectionsReady =
    (comercializadoraOptions.length === 0 || selectedComercializadoras.length > 0)
    && (tipoOptions.length === 0 || selectedTipos.length > 0)
    && (!isComercial || sociedadOptions.length === 0 || selectedSociedades.length > 0);

  const isInitializingFilters =
    isOpen
    && (
      isAssignedPuntosLoading
      || isScopedInvoicesLoading
      || (agrupacionesEnabled && isAgrupacionesLoading)
      || !baseSelectionsReady
    );

  return {
    isCliente,
    isComercial,
    clienteId,
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
    selectedSociedades,
    setSelectedSociedades,
    agrupaciones,
    selectedAgrupaciones,
    setSelectedAgrupaciones,
    isInitializingFilters,
  };
}
