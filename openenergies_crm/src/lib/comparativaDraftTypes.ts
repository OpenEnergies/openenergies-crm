// openenergies_crm/src/lib/comparativaDraftTypes.ts
// Tipos para el draft de Auditoría Comparativa con el Mercado (Step 2)

import type { NarrativeSection } from './reportDraftTypes';
export { createEmptyNarrativeSection, getFinalText } from './reportDraftTypes';
export type { NarrativeSection } from './reportDraftTypes';
import type { UUID } from './types';

// ============================================================================
// DATOS MENSUALES COMPARATIVOS
// ============================================================================

export interface DatoMensualComparativo {
  mes: string;              // YYYY-MM
  consumo_kwh: number;
  coste_eur: number;
  precio_cliente_eur_kwh: number | null;
  precio_mercado_eur_kwh: number | null;   // Editable — final market price
  precio_mercado_medio_raw?: number | null; // Raw market mean (before adjustment)
  precio_mercado_max_raw?: number | null;   // Raw market max (for random range)
  delta_abs_eur_kwh: number | null;
  delta_pct: number | null;
  impacto_eur: number | null;
  num_puntos: number;
}

// ============================================================================
// COMPARATIVA POR TARIFA
// ============================================================================

export interface ComparativaTarifa {
  precio_cliente_eur_kwh: number | null;
  precio_mercado_eur_kwh: number | null;
  delta_abs_eur_kwh: number | null;
  delta_pct: number | null;
  impacto_eur: number | null;
}

export interface TarifaKpis {
  consumo_total_kwh: number;
  coste_total_eur: number;
  precio_medio_eur_kwh: number | null;
  num_puntos: number;
  num_facturas: number;
}

export interface ExtremoItem {
  cups: string;
  consumo_kwh: number;
  coste_eur: number;
  precio_medio_eur_kwh: number | null;
}

export interface ExtremosTarifa {
  top_consumo: ExtremoItem[];
  bottom_consumo: ExtremoItem[];
  top_coste: ExtremoItem[];
  bottom_coste: ExtremoItem[];
}

export interface PotenciasTarifa {
  disponible: boolean;
  cobertura_porcentaje: number;
  puntos_con_datos: number;
  puntos_totales: number;
  p1_kw: number;
  p2_kw: number;
  p3_kw: number;
  p4_kw: number;
  p5_kw: number;
  p6_kw: number;
}

export interface DatosTarifaComparativa {
  tarifa: string;
  kpis: TarifaKpis;
  comparativa: ComparativaTarifa;
  mensual: DatoMensualComparativo[];
  extremos: ExtremosTarifa;
  potencias: PotenciasTarifa;
}

// ============================================================================
// DATOS POR ENERGÍA
// ============================================================================

export interface MercadoSerieMensual {
  mes: string;
  precio_medio_eur_kwh: number | null;
  precio_min_eur_kwh: number | null;
  precio_max_eur_kwh: number | null;
  volatilidad_eur_kwh: number | null;
  dias_con_datos: number;
}

export interface MercadoConfig {
  fuente: string;
  unidad: string;
  granularidad: string;
  serie_mensual: MercadoSerieMensual[];
}

export interface EnergiaComparativa {
  energia: 'electricidad' | 'gas';
  mercado: MercadoConfig;
  tarifas: DatosTarifaComparativa[];
}

// ============================================================================
// KPIS GLOBALES COMPARATIVA
// ============================================================================

export interface KPIsComparativa {
  consumo_total_kwh: number;
  coste_total_eur: number;
  precio_medio_eur_kwh: number | null;
  num_tarifas: number;
  num_puntos: number;
  num_facturas: number;
}

export interface ComparativaGlobal {
  precio_mercado_medio_eur_kwh: number | null;
  delta_abs_eur_kwh: number | null;
  delta_pct: number | null;
  impacto_economico_eur: number | null;
}

// ============================================================================
// METADATA
// ============================================================================

export interface ComparativaDraftMetadata {
  informe_id: string | null;
  cliente_id: UUID;
  cliente_nombre: string;
  punto_ids: UUID[];
  fecha_inicio: string;
  fecha_fin: string;
  titulo: string;
  creado_at: string;
  actualizado_at: string;
  version: number;
}

// ============================================================================
// COMPARATIVA DRAFT — CONTRATO PRINCIPAL
// ============================================================================

export interface ComparativaDraft {
  metadata: ComparativaDraftMetadata;

  // KPIs globales
  kpis_globales: KPIsComparativa;
  comparativa_global: ComparativaGlobal;

  // Datos por energía (electricidad / gas)
  energias: EnergiaComparativa[];

  // Narrativa editable (12 secciones como la auditoría, adaptadas)
  textos: {
    titulo_portada: NarrativeSection;
    subtitulo_portada: NarrativeSection;
    resumen_ejecutivo: NarrativeSection;
    texto_metodologia: NarrativeSection;
    texto_fuentes_notas: NarrativeSection;
    texto_comparativa_global: NarrativeSection;
    texto_intro_electricidad: NarrativeSection;
    texto_intro_gas: NarrativeSection;
    texto_extremos: NarrativeSection;
    texto_limitaciones: NarrativeSection;
    desviaciones_texto: NarrativeSection;
    conclusion_final: NarrativeSection;
  };

  // Recomendaciones (toggle OFF por defecto)
  recomendaciones_enabled: boolean;
  recomendaciones_text: string;
}

// ============================================================================
// PAYLOAD FINAL PARA EDGE FUNCTION
// ============================================================================

export interface ComparativaPayload {
  metadata: {
    titulo: string;
    cliente_id: UUID;
    punto_ids: UUID[];
    fecha_inicio: string;
    fecha_fin: string;
  };
  overrides: {
    textos: Record<string, string>;
    energias: unknown[];  // Full per-tarifa data (source of truth from draft)
    kpis_globales: KPIsComparativa;
    comparativa_global: ComparativaGlobal;
    recomendaciones: {
      habilitada: boolean;
      texto: string;
    };
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/** Builds ComparativaPayload from a draft */
export function buildComparativaPayload(draft: ComparativaDraft): ComparativaPayload {
  // Extract edited texts
  const textos: Record<string, string> = {};
  for (const [key, section] of Object.entries(draft.textos)) {
    const text = section.estado === 'edited' && section.texto_editado !== null
      ? section.texto_editado
      : section.texto_generado;
    textos[key] = text;
  }

  // Build full energias array: per-tarifa data is the source of truth.
  // Strip raw fields so the microservice doesn't get confused.
  const energias = draft.energias.map(e => ({
    energia: e.energia,
    mercado: e.mercado,
    tarifas: e.tarifas.map(t => ({
      tarifa: t.tarifa,
      kpis: t.kpis,
      comparativa: t.comparativa,
      mensual: t.mensual.map(m => ({
        mes: m.mes,
        consumo_kwh: m.consumo_kwh,
        coste_eur: m.coste_eur,
        precio_cliente_eur_kwh: m.precio_cliente_eur_kwh,
        precio_mercado_eur_kwh: m.precio_mercado_eur_kwh,
        delta_abs_eur_kwh: m.delta_abs_eur_kwh,
        delta_pct: m.delta_pct,
        impacto_eur: m.impacto_eur,
        num_puntos: m.num_puntos,
      })),
      extremos: t.extremos,
      potencias: t.potencias,
    })),
  }));

  return {
    metadata: {
      titulo: draft.metadata.titulo,
      cliente_id: draft.metadata.cliente_id,
      punto_ids: draft.metadata.punto_ids,
      fecha_inicio: draft.metadata.fecha_inicio,
      fecha_fin: draft.metadata.fecha_fin,
    },
    overrides: {
      textos,
      energias,
      kpis_globales: draft.kpis_globales,
      comparativa_global: draft.comparativa_global,
      recomendaciones: {
        habilitada: draft.recomendaciones_enabled,
        texto: draft.recomendaciones_text,
      },
    },
  };
}
