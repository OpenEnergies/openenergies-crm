// openenergies_crm/src/hooks/useComparativaDraft.ts
// Hook para gestión y persistencia del ComparativaDraft
// Includes: computeFinalMarketPrice, seeded PRNG, reactive KPI recomputation

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ComparativaDraft,
  ComparativaPayload,
  NarrativeSection,
  EnergiaComparativa,
  DatoMensualComparativo,
  DatosTarifaComparativa,
  KPIsComparativa,
  ComparativaGlobal,
  ComparativaTarifa,
} from '@lib/comparativaDraftTypes';
import {
  buildComparativaPayload,
  createEmptyNarrativeSection,
} from '@lib/comparativaDraftTypes';
import type { UUID } from '@lib/types';

// ============================================================================
// STORAGE KEY
// ============================================================================

function getDraftStorageKey(clienteId: string, fechaInicio: string, fechaFin: string): string {
  return `comparativa-draft-${clienteId}-${fechaInicio}-${fechaFin}`;
}

// ============================================================================
// SEEDED PRNG — deterministic random for stable values across renders
// ============================================================================

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash; // to 32-bit int
  }
  // Use sine to scatter and normalize to [0, 1)
  const x = Math.sin(hash * 9301 + 49297) * 233280;
  return Math.abs(x - Math.floor(x));
}

// ============================================================================
// computeFinalMarketPrice — implements the user's new market price logic
// ============================================================================

/**
 * CASE A: If mercadoMedio >= precioCliente → keep mercadoMedio as-is
 * CASE B: If mercadoMedio < precioCliente → random between
 *         limInf = precioCliente + 0.005
 *         limSup = (precioCliente + mercadoMax) / 2
 * Returns null only when raw market data is missing.
 */
export function computeFinalMarketPrice(args: {
  precioCliente: number | null;
  precioMercadoMedio: number | null;
  precioMercadoMax: number | null;
  seed: string;
}): number | null {
  const { precioCliente, precioMercadoMedio, precioMercadoMax, seed } = args;

  if (precioMercadoMedio == null) {
    if (import.meta.env.DEV) {
      console.warn(`[computeFinalMarketPrice] No market data for seed=${seed}`);
    }
    return null;
  }
  if (precioCliente == null || precioCliente <= 0) {
    return Math.round(precioMercadoMedio * 10000) / 10000;
  }

  // CASE A: market >= client → keep as-is
  if (precioMercadoMedio >= precioCliente) {
    return Math.round(precioMercadoMedio * 10000) / 10000;
  }

  // CASE B: market < client → generate random in range
  const limInf = precioCliente + 0.005;
  const maxRef = precioMercadoMax != null && precioMercadoMax > precioCliente
    ? precioMercadoMax
    : precioCliente + 0.02; // fallback if max not available or too low
  const limSup = (precioCliente + maxRef) / 2;

  if (limSup <= limInf) {
    // Degenerate range — return the lower limit
    return Math.round(limInf * 10000) / 10000;
  }

  const rand = seededRandom(seed);
  const price = limInf + rand * (limSup - limInf);
  return Math.round(price * 10000) / 10000;
}

// ============================================================================
// recomputeAllKpis — recalculate tarifa comparativa + global KPIs from mensual
// ============================================================================

function recomputeAllKpis(draft: ComparativaDraft): ComparativaDraft {
  let gConsumo = 0;
  let gCoste = 0;
  let gWpCNum = 0;
  let gWpCDen = 0;
  let gWpMNum = 0;
  let gWpMDen = 0;
  let gPuntos = 0;
  let gTarifas = 0;
  let gFacturas = 0;

  const newEnergias = draft.energias.map((energia) => {
    const newTarifas = energia.tarifas.map((tarifa) => {
      let wpCNum = 0, wpCDen = 0;
      let wpMNum = 0, wpMDen = 0;

      const newMensual = tarifa.mensual.map((mes) => {
        const pc = mes.precio_cliente_eur_kwh;
        const pm = mes.precio_mercado_eur_kwh;
        const deltaAbs = pc != null && pm != null ? pc - pm : null;
        const deltaPct = deltaAbs != null && pm != null && pm > 0
          ? (deltaAbs / pm) * 100
          : null;
        const impacto = deltaAbs != null ? deltaAbs * mes.consumo_kwh : null;

        if (pc != null && mes.consumo_kwh > 0) {
          wpCNum += pc * mes.consumo_kwh;
          wpCDen += mes.consumo_kwh;
        }
        if (pm != null && mes.consumo_kwh > 0) {
          wpMNum += pm * mes.consumo_kwh;
          wpMDen += mes.consumo_kwh;
        }

        return {
          ...mes,
          delta_abs_eur_kwh: deltaAbs,
          delta_pct: deltaPct,
          impacto_eur: impacto,
        };
      });

      const tarifaClienteAvg = wpCDen > 0 ? wpCNum / wpCDen : null;
      const tarifaMercadoAvg = wpMDen > 0 ? wpMNum / wpMDen : null;
      const tDelta = tarifaClienteAvg != null && tarifaMercadoAvg != null
        ? tarifaClienteAvg - tarifaMercadoAvg : null;
      const tDeltaPct = tDelta != null && tarifaMercadoAvg != null && tarifaMercadoAvg > 0
        ? (tDelta / tarifaMercadoAvg) * 100 : null;
      const tImpacto = tDelta != null
        ? tDelta * tarifa.kpis.consumo_total_kwh : null;

      // Accumulate globals
      gConsumo += tarifa.kpis.consumo_total_kwh;
      gCoste += tarifa.kpis.coste_total_eur;
      gPuntos += tarifa.kpis.num_puntos;
      gFacturas += tarifa.kpis.num_facturas;
      gTarifas++;
      if (tarifaClienteAvg != null && tarifa.kpis.consumo_total_kwh > 0) {
        gWpCNum += tarifaClienteAvg * tarifa.kpis.consumo_total_kwh;
        gWpCDen += tarifa.kpis.consumo_total_kwh;
      }
      if (tarifaMercadoAvg != null && tarifa.kpis.consumo_total_kwh > 0) {
        gWpMNum += tarifaMercadoAvg * tarifa.kpis.consumo_total_kwh;
        gWpMDen += tarifa.kpis.consumo_total_kwh;
      }

      return {
        ...tarifa,
        mensual: newMensual,
        comparativa: {
          precio_cliente_eur_kwh: tarifaClienteAvg,
          precio_mercado_eur_kwh: tarifaMercadoAvg,
          delta_abs_eur_kwh: tDelta,
          delta_pct: tDeltaPct,
          impacto_eur: tImpacto,
        } as ComparativaTarifa,
      };
    });

    return { ...energia, tarifas: newTarifas };
  });

  const gClienteAvg = gWpCDen > 0 ? gWpCNum / gWpCDen : null;
  const gMercadoAvg = gWpMDen > 0 ? gWpMNum / gWpMDen : null;
  const gDelta = gClienteAvg != null && gMercadoAvg != null
    ? gClienteAvg - gMercadoAvg : null;
  const gDeltaPct = gDelta != null && gMercadoAvg != null && gMercadoAvg > 0
    ? (gDelta / gMercadoAvg) * 100 : null;
  const gImpacto = gDelta != null ? gDelta * gConsumo : null;

  // ── Format helpers for text generation ──
  const fmtNum = (v: number | null, d: number) => v != null ? v.toFixed(d) : 'N/D';
  const fmtPct = (v: number | null) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : 'N/D';

  // ── Regenerate dynamic texts (section 3 + conclusion) ──
  // Always update texto_generado so it stays in sync with KPIs.
  // If the user manually edited the text (estado='edited'), their edit is preserved
  // as texto_editado and shown in the UI, but texto_generado still updates.
  const clienteNombre = draft.metadata?.cliente_nombre || 'el cliente';
  const newTextoComparativaGlobal = `A nivel global, el cliente ha pagado un precio medio de ${fmtNum(gClienteAvg, 4)} €/kWh frente a un precio medio de mercado de ${fmtNum(gMercadoAvg, 4)} €/kWh, lo que representa una diferencia del ${fmtPct(gDeltaPct)}. Esto se traduce en un impacto económico estimado de ${fmtNum(gImpacto, 2)} € en el periodo analizado.`;
  const newConclusionFinal = `El análisis revela que ${clienteNombre} paga, en promedio, un ${fmtPct(gDeltaPct)} respecto al precio de referencia del mercado mayorista, con un impacto económico estimado de ${fmtNum(gImpacto, 2)} € en el periodo analizado.`;

  const updatedTextos = { ...draft.textos };

  // Update texto_comparativa_global
  updatedTextos.texto_comparativa_global = {
    ...updatedTextos.texto_comparativa_global,
    texto_generado: newTextoComparativaGlobal,
  };

  // Update conclusion_final
  updatedTextos.conclusion_final = {
    ...updatedTextos.conclusion_final,
    texto_generado: newConclusionFinal,
  };

  return {
    ...draft,
    energias: newEnergias,
    textos: updatedTextos,
    kpis_globales: {
      consumo_total_kwh: gConsumo,
      coste_total_eur: gCoste,
      precio_medio_eur_kwh: gClienteAvg,
      num_tarifas: gTarifas,
      num_puntos: gPuntos,
      num_facturas: gFacturas,
    },
    comparativa_global: {
      precio_mercado_medio_eur_kwh: gMercadoAvg,
      delta_abs_eur_kwh: gDelta,
      delta_pct: gDeltaPct,
      impacto_economico_eur: gImpacto,
    },
  };
}

// ============================================================================
// applyMarketPriceLogic — compute final market prices for all tarifas/months
// ============================================================================

function applyMarketPriceLogic(
  draft: ComparativaDraft,
  seedBase: string,
): ComparativaDraft {
  const newEnergias = draft.energias.map((energia) => {
    const newTarifas = energia.tarifas.map((tarifa) => {
      const newMensual = tarifa.mensual.map((mes) => {
        const rawMedio = mes.precio_mercado_medio_raw ?? null;
        const rawMax = mes.precio_mercado_max_raw ?? null;

        if (rawMedio == null) {
          // No market data at all — log error
          console.error(
            `[applyMarketPriceLogic] Missing market data: energia=${energia.energia} tarifa=${tarifa.tarifa} mes=${mes.mes}`
          );
          return mes;
        }

        const seed = `${seedBase}|${energia.energia}|${tarifa.tarifa}|${mes.mes}`;
        const finalPrice = computeFinalMarketPrice({
          precioCliente: mes.precio_cliente_eur_kwh,
          precioMercadoMedio: rawMedio,
          precioMercadoMax: rawMax,
          seed,
        });

        return {
          ...mes,
          precio_mercado_eur_kwh: finalPrice,
        };
      });
      return { ...tarifa, mensual: newMensual };
    });
    return { ...energia, tarifas: newTarifas };
  });

  return { ...draft, energias: newEnergias };
}

// ============================================================================
// TIPOS
// ============================================================================

interface UseComparativaDraftOptions {
  clienteId: UUID;
  clienteNombre: string;
  puntoIds: UUID[];
  fechaInicio: string;
  fechaFin: string;
  titulo: string;
  /** calculated_data from the Edge Function (first call without DOCX, or a prefetch) */
  calculatedData: Record<string, unknown> | null;
  enabled?: boolean;
}

export interface UseComparativaDraftReturn {
  draft: ComparativaDraft | null;
  isLoading: boolean;
  error: Error | null;

  // Text actions
  updateTexto: (key: keyof ComparativaDraft['textos'], texto: string) => void;
  toggleRecomendaciones: (enabled: boolean) => void;
  updateRecomendacionesText: (texto: string) => void;

  // Market price action
  updateMarketPrice: (
    energiaIdx: number,
    tarifaIdx: number,
    mesIdx: number,
    newPrice: number
  ) => void;

  // Build payload
  getPayload: () => ComparativaPayload | null;

  // Regenerate
  regenerate: () => void;
}

// ============================================================================
// BUILD DRAFT FROM EDGE FUNCTION DATA
// ============================================================================

function buildDraftFromCalculatedData(
  data: Record<string, unknown>,
  meta: {
    clienteId: UUID;
    clienteNombre: string;
    puntoIds: UUID[];
    fechaInicio: string;
    fechaFin: string;
    titulo: string;
  }
): ComparativaDraft {
  const d = data as any;
  const now = new Date().toISOString();

  const textos = d.textos || {};
  const kpis = d.kpis_globales || {};
  const comp = d.comparativa_global || {};

  return {
    metadata: {
      informe_id: d.meta?.id_informe || null,
      cliente_id: meta.clienteId,
      cliente_nombre: meta.clienteNombre,
      punto_ids: meta.puntoIds,
      fecha_inicio: meta.fechaInicio,
      fecha_fin: meta.fechaFin,
      titulo: meta.titulo,
      creado_at: now,
      actualizado_at: now,
      version: 1,
    },
    kpis_globales: {
      consumo_total_kwh: kpis.consumo_total_kwh ?? 0,
      coste_total_eur: kpis.coste_total_eur ?? 0,
      precio_medio_eur_kwh: kpis.precio_medio_eur_kwh ?? null,
      num_tarifas: kpis.num_tarifas ?? 0,
      num_puntos: kpis.num_puntos ?? 0,
      num_facturas: kpis.num_facturas ?? 0,
    },
    comparativa_global: {
      precio_mercado_medio_eur_kwh: comp.precio_mercado_medio_eur_kwh ?? null,
      delta_abs_eur_kwh: comp.delta_abs_eur_kwh ?? null,
      delta_pct: comp.delta_pct ?? null,
      impacto_economico_eur: comp.impacto_economico_eur ?? null,
    },
    energias: (d.energias || []).map((e: any) => ({
      energia: e.energia,
      mercado: e.mercado || { fuente: '', unidad: '€/kWh', granularidad: 'diaria', serie_mensual: [] },
      tarifas: (e.tarifas || []).map((t: any) => ({
        tarifa: t.tarifa,
        kpis: t.kpis || { consumo_total_kwh: 0, coste_total_eur: 0, precio_medio_eur_kwh: null, num_puntos: 0, num_facturas: 0 },
        comparativa: t.comparativa || {},
        mensual: (t.mensual || []).map((m: any) => ({
          mes: m.mes,
          consumo_kwh: m.consumo_kwh ?? 0,
          coste_eur: m.coste_eur ?? 0,
          precio_cliente_eur_kwh: m.precio_cliente_eur_kwh ?? null,
          precio_mercado_eur_kwh: m.precio_mercado_eur_kwh ?? null,
          precio_mercado_medio_raw: m.precio_mercado_medio_raw ?? null,
          precio_mercado_max_raw: m.precio_mercado_max_raw ?? null,
          delta_abs_eur_kwh: m.delta_abs_eur_kwh ?? null,
          delta_pct: m.delta_pct ?? null,
          impacto_eur: m.impacto_eur ?? null,
          num_puntos: m.num_puntos ?? 0,
        })),
        extremos: t.extremos || { top_consumo: [], bottom_consumo: [], top_coste: [], bottom_coste: [] },
        potencias: t.potencias || { disponible: false, cobertura_porcentaje: 0, puntos_con_datos: 0, puntos_totales: 0, p1_kw: 0, p2_kw: 0, p3_kw: 0, p4_kw: 0, p5_kw: 0, p6_kw: 0 },
      })),
    })),
    textos: {
      titulo_portada: createEmptyNarrativeSection(textos.titulo_portada || meta.titulo),
      subtitulo_portada: createEmptyNarrativeSection(textos.subtitulo_portada || ''),
      resumen_ejecutivo: createEmptyNarrativeSection(textos.resumen_ejecutivo || ''),
      texto_metodologia: createEmptyNarrativeSection(textos.texto_metodologia || ''),
      texto_fuentes_notas: createEmptyNarrativeSection(textos.texto_fuentes_notas || ''),
      texto_comparativa_global: createEmptyNarrativeSection(textos.texto_comparativa_global || ''),
      texto_intro_electricidad: createEmptyNarrativeSection(textos.texto_intro_electricidad || ''),
      texto_intro_gas: createEmptyNarrativeSection(textos.texto_intro_gas || ''),
      texto_extremos: createEmptyNarrativeSection(textos.texto_extremos || ''),
      texto_limitaciones: createEmptyNarrativeSection(textos.texto_limitaciones || ''),
      desviaciones_texto: createEmptyNarrativeSection(textos.desviaciones_texto || ''),
      conclusion_final: createEmptyNarrativeSection(textos.conclusion_final || ''),
    },
    recomendaciones_enabled: d.recomendaciones?.habilitada ?? false,
    recomendaciones_text: d.recomendaciones?.texto ?? '',
  };
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useComparativaDraft(options: UseComparativaDraftOptions): UseComparativaDraftReturn {
  const {
    clienteId,
    clienteNombre,
    puntoIds,
    fechaInicio,
    fechaFin,
    titulo,
    calculatedData,
    enabled = true,
  } = options;

  const [draft, setDraft] = useState<ComparativaDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = getDraftStorageKey(clienteId, fechaInicio, fechaFin);

  // ─── Load or generate draft ───
  useEffect(() => {
    if (!enabled || !calculatedData || !clienteId) return;

    setIsLoading(true);
    setError(null);

    try {
      // ALWAYS generate new draft from calculated data (no localStorage cache)
      // This ensures fresh data with gas prices on every load
      const rawDraft = buildDraftFromCalculatedData(calculatedData, {
        clienteId,
        clienteNombre,
        puntoIds,
        fechaInicio,
        fechaFin,
        titulo,
      });

      // Apply market price logic (seeded random) and recompute all KPIs
      const seedBase = `${clienteId}|${fechaInicio}|${fechaFin}`;
      const withPrices = applyMarketPriceLogic(rawDraft, seedBase);
      const newDraft = recomputeAllKpis(withPrices);

      setDraft(newDraft);
      // Note: We still save to localStorage to allow manual edits persistence during the session
      localStorage.setItem(storageKey, JSON.stringify(newDraft));
    } catch (err) {
      console.error('[ComparativaDraft] Error:', err);
      setError(err instanceof Error ? err : new Error('Error generando draft'));
    } finally {
      setIsLoading(false);
    }
  }, [calculatedData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo, enabled, storageKey]);

  // ─── Debounced save ───
  const debouncedSave = useCallback((d: ComparativaDraft) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const updated = {
          ...d,
          metadata: { ...d.metadata, actualizado_at: new Date().toISOString(), version: d.metadata.version + 1 },
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }, 1000);
  }, [storageKey]);

  // ─── Update texto section ───
  const updateTexto = useCallback((key: keyof ComparativaDraft['textos'], texto: string) => {
    if (!draft) return;
    const updated: ComparativaDraft = {
      ...draft,
      textos: {
        ...draft.textos,
        [key]: { ...draft.textos[key], texto_editado: texto, estado: 'edited' as const },
      },
    };
    setDraft(updated);
    debouncedSave(updated);
  }, [draft, debouncedSave]);

  // ─── Toggle recomendaciones ───
  const toggleRecomendaciones = useCallback((en: boolean) => {
    if (!draft) return;
    const updated: ComparativaDraft = { ...draft, recomendaciones_enabled: en };
    setDraft(updated);
    debouncedSave(updated);
  }, [draft, debouncedSave]);

  const updateRecomendacionesText = useCallback((texto: string) => {
    if (!draft) return;
    const updated: ComparativaDraft = { ...draft, recomendaciones_text: texto };
    setDraft(updated);
    debouncedSave(updated);
  }, [draft, debouncedSave]);

  // ─── Update market price (triggers full KPI recalculation) ───
  const updateMarketPrice = useCallback((
    energiaIdx: number,
    tarifaIdx: number,
    mesIdx: number,
    newPrice: number
  ) => {
    if (!draft) return;

    const newEnergias = [...draft.energias];
    const energia: EnergiaComparativa = { ...newEnergias[energiaIdx]! };
    const tarifas = [...energia.tarifas];
    const tarifa = { ...tarifas[tarifaIdx]! };
    const mensual = [...tarifa.mensual];
    const mes = { ...mensual[mesIdx]! };

    mes.precio_mercado_eur_kwh = newPrice;

    mensual[mesIdx] = mes;
    tarifa.mensual = mensual;
    tarifas[tarifaIdx] = tarifa;
    energia.tarifas = tarifas;
    newEnergias[energiaIdx] = energia;

    // Recompute ALL KPIs (tarifa comparativa + global)
    const withNewPrice: ComparativaDraft = { ...draft, energias: newEnergias };
    const updated = recomputeAllKpis(withNewPrice);

    setDraft(updated);
    debouncedSave(updated);
  }, [draft, debouncedSave]);

  // ─── Regenerate ───
  const regenerate = useCallback(() => {
    if (!calculatedData || !clienteId) return;
    
    // Build fresh draft (same as initial load, no cache)
    const rawDraft = buildDraftFromCalculatedData(calculatedData, {
      clienteId,
      clienteNombre,
      puntoIds,
      fechaInicio,
      fechaFin,
      titulo,
    });
    
    // Re-apply market price logic with fresh random + recompute KPIs
    const seedBase = `${clienteId}|${fechaInicio}|${fechaFin}`;
    const withPrices = applyMarketPriceLogic(rawDraft, seedBase);
    const newDraft = recomputeAllKpis(withPrices);

    setDraft(newDraft);
    localStorage.setItem(storageKey, JSON.stringify(newDraft));
  }, [calculatedData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo, storageKey]);

  // ─── Build payload ───
  const getPayload = useCallback((): ComparativaPayload | null => {
    if (!draft) return null;
    return buildComparativaPayload(draft);
  }, [draft]);

  return {
    draft,
    isLoading,
    error,
    updateTexto,
    toggleRecomendaciones,
    updateRecomendacionesText,
    updateMarketPrice,
    getPayload,
    regenerate,
  };
}
