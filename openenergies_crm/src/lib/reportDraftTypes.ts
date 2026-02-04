// openenergies_crm/src/lib/reportDraftTypes.ts
// Tipos para ReportDraft - Paso 2 del wizard de Informes

import type { UUID } from './types';

// ============================================================================
// TIPOS BASE
// ============================================================================

/** Estado de edición de una sección narrativa */
export type NarrativeStatus = 'auto' | 'edited';

/** Sección narrativa con texto generado y editado */
export interface NarrativeSection {
  texto_generado: string;
  texto_editado: string | null;
  estado: NarrativeStatus;
}

/** Helper para obtener el texto final de una sección */
export function getFinalText(section: NarrativeSection): string {
  return section.estado === 'edited' && section.texto_editado !== null
    ? section.texto_editado
    : section.texto_generado;
}

// ============================================================================
// KPIS GLOBALES
// ============================================================================

export interface KPIsGlobales {
  cliente_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  meses_n: number;
  facturas_n: number;
  puntos_n: number;
  tarifas_n: number;
  consumo_total_kwh: number;
  coste_total_eur: number;
  precio_medio_eur_kwh: number;
  // Mes con máximo coste
  mes_coste_max_nombre: string;
  mes_coste_max_eur: number;
  // Mes con máximo consumo
  mes_consumo_max_nombre: string;
  mes_consumo_max_kwh: number;
  // Mes con máximo precio
  mes_precio_max_nombre: string;
  mes_precio_max_eur_kwh: number;
  // Tarifa top en coste
  tarifa_top_coste: string;
  tarifa_top_coste_eur: number;
  tarifa_top_coste_pct: number;
  // Tarifa top en consumo
  tarifa_top_consumo: string;
  tarifa_top_consumo_kwh: number;
  tarifa_top_consumo_pct: number;
  // Tarifas con precio extremo
  tarifa_precio_max: string;
  tarifa_precio_max_eur_kwh: number;
  tarifa_precio_min: string;
  tarifa_precio_min_eur_kwh: number;
  // Calidad de datos
  calidad_consumo_pct_faltante: number;
  calidad_precio_pct_faltante: number;
  potencias_disponibles_pct: number;
  potencias_faltantes_pct: number;
  // Desviaciones autogeneradas
  desviaciones_sugeridas: string[];
}

// ============================================================================
// DATOS POR TARIFA
// ============================================================================

/** Datos mensuales para una tarifa */
export interface DatoMensualTarifaDraft {
  mes: string;           // YYYY-MM
  mes_nombre: string;    // "Enero 2025"
  consumo_kwh: number;
  coste_eur: number;
  precio_eur_kwh: number;
  facturas_n: number;
}

/** Potencias agregadas por tarifa */
export interface PotenciasTarifaDraft {
  p1_kw: number | null;
  p2_kw: number | null;
  p3_kw: number | null;
  p4_kw: number | null;
  p5_kw: number | null;
  p6_kw: number | null;
  periodos_disponibles: number;
  periodos_totales: number;
  // Cobertura: puntos con datos / puntos totales en tarifa
  puntos_con_potencia: number;
  puntos_totales: number;
  cobertura_pct: number;
  alerta_resumen: string | null;
}

/** Punto extremo individual */
export interface PuntoExtremo {
  cups: string;  // Sin enmascarar en memoria, se enmascara solo en UI si es necesario
  valor: number;  // kWh o €
  precio_medio_eur_kwh: number;
}

/** Extremos Top 3 / Bottom 3 por tarifa - único lugar con puntos individuales */
export interface ExtremosTarifaDraft {
  top_consumo: PuntoExtremo[];  // Top 3 mayor consumo
  bottom_consumo: PuntoExtremo[];  // Bottom 3 menor consumo
  top_coste: PuntoExtremo[];  // Top 3 mayor coste
  bottom_coste: PuntoExtremo[];  // Bottom 3 menor coste
}

/** Datos completos por tarifa */
export interface DatosTarifaDraft {
  tarifa_nombre: string;
  consumo_kwh: number;
  coste_eur: number;
  precio_eur_kwh: number;
  facturas_n: number;
  puntos_n: number;
  // Mes con máximos para esta tarifa
  mes_coste_max_nombre: string;
  mes_coste_max_eur: number;
  mes_consumo_max_nombre: string;
  mes_consumo_max_kwh: number;
  mes_precio_max_nombre: string;
  mes_precio_max_eur_kwh: number;
  // Series mensuales
  datos_mensuales: DatoMensualTarifaDraft[];
  // Potencias
  potencias: PotenciasTarifaDraft;
  // Extremos
  extremos: ExtremosTarifaDraft | null;
}

// ============================================================================
// METADATA DEL DRAFT
// ============================================================================

export interface ReportDraftMetadata {
  informe_id: string | null;        // null si es nuevo
  cliente_id: UUID;
  punto_ids: UUID[];
  fecha_inicio: string;
  fecha_fin: string;
  titulo: string;
  creado_at: string;
  actualizado_at: string;
  version: number;
}

// ============================================================================
// REPORT DRAFT - CONTRATO PRINCIPAL
// ============================================================================

export interface ReportDraft {
  metadata: ReportDraftMetadata;
  
  // KPIs globales calculados
  kpis_globales: KPIsGlobales;
  
  // Datos por tarifa (incluye series mensuales, potencias, extremos)
  por_tarifa: DatosTarifaDraft[];
  
  // Narrativa por secciones
  narrativa: {
    portada: NarrativeSection;
    portada_sublinea: NarrativeSection;
    alcance: NarrativeSection;
    metodologia: NarrativeSection;
    resumen_ejecutivo: NarrativeSection;
    analisis_tarifas: NarrativeSection;
    evolucion_mensual: NarrativeSection;
    potencias: NarrativeSection;
    extremos: NarrativeSection;
    limitaciones: NarrativeSection;
    desviaciones: NarrativeSection;
    conclusion: NarrativeSection;
  };
  
  // Recomendaciones (toggle OFF por defecto)
  recomendaciones_enabled: boolean;
  recomendaciones_text: string;
}

// ============================================================================
// PAYLOAD FINAL PARA EDGE FUNCTION
// ============================================================================

export interface ReportPayloadSection {
  titulo: string;
  contenido: string;
}

export interface ReportPayloadTarifa {
  tarifa_nombre: string;
  consumo_kwh: number;
  coste_eur: number;
  precio_eur_kwh: number;
  datos_mensuales: DatoMensualTarifaDraft[];
  potencias: PotenciasTarifaDraft;
  extremos: ExtremosTarifaDraft | null;
}

export interface FinalReportPayload {
  metadata: {
    titulo: string;
    cliente_id: UUID;
    punto_ids: UUID[];
    fecha_inicio: string;
    fecha_fin: string;
  };
  kpis: KPIsGlobales;
  secciones: {
    portada: string;
    portada_sublinea: string;
    alcance: string;
    metodologia: string;
    resumen_ejecutivo: string;
    analisis_tarifas: string;
    evolucion_mensual: string;
    potencias: string;
    extremos: string;
    limitaciones: string;
    desviaciones: string;
    conclusion: string;
    recomendaciones?: string;  // Solo si enabled
  };
  tarifas: ReportPayloadTarifa[];
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export function createEmptyNarrativeSection(texto: string = ''): NarrativeSection {
  return {
    texto_generado: texto,
    texto_editado: null,
    estado: 'auto',
  };
}

export function createEmptyReportDraft(
  clienteId: UUID,
  puntoIds: UUID[],
  fechaInicio: string,
  fechaFin: string,
  titulo: string,
  clienteNombre: string
): ReportDraft {
  const now = new Date().toISOString();
  
  return {
    metadata: {
      informe_id: null,
      cliente_id: clienteId,
      punto_ids: puntoIds,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      titulo,
      creado_at: now,
      actualizado_at: now,
      version: 1,
    },
    kpis_globales: {
      cliente_nombre: clienteNombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      meses_n: 0,
      facturas_n: 0,
      puntos_n: puntoIds.length,
      tarifas_n: 0,
      consumo_total_kwh: 0,
      coste_total_eur: 0,
      precio_medio_eur_kwh: 0,
      mes_coste_max_nombre: '',
      mes_coste_max_eur: 0,
      mes_consumo_max_nombre: '',
      mes_consumo_max_kwh: 0,
      mes_precio_max_nombre: '',
      mes_precio_max_eur_kwh: 0,
      tarifa_top_coste: '',
      tarifa_top_coste_eur: 0,
      tarifa_top_coste_pct: 0,
      tarifa_top_consumo: '',
      tarifa_top_consumo_kwh: 0,
      tarifa_top_consumo_pct: 0,
      tarifa_precio_max: '',
      tarifa_precio_max_eur_kwh: 0,
      tarifa_precio_min: '',
      tarifa_precio_min_eur_kwh: 0,
      calidad_consumo_pct_faltante: 0,
      calidad_precio_pct_faltante: 0,
      potencias_disponibles_pct: 0,
      potencias_faltantes_pct: 0,
      desviaciones_sugeridas: [],
    },
    por_tarifa: [],
    narrativa: {
      portada: createEmptyNarrativeSection(),
      portada_sublinea: createEmptyNarrativeSection(),
      alcance: createEmptyNarrativeSection(),
      metodologia: createEmptyNarrativeSection(),
      resumen_ejecutivo: createEmptyNarrativeSection(),
      analisis_tarifas: createEmptyNarrativeSection(),
      evolucion_mensual: createEmptyNarrativeSection(),
      potencias: createEmptyNarrativeSection(),
      extremos: createEmptyNarrativeSection(),
      limitaciones: createEmptyNarrativeSection(),
      desviaciones: createEmptyNarrativeSection(),
      conclusion: createEmptyNarrativeSection(),
    },
    recomendaciones_enabled: false,
    recomendaciones_text: '',
  };
}
