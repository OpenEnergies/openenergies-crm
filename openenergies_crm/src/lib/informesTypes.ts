// openenergies_crm/src/lib/informesTypes.ts
// Tipos para el módulo de Informes de Mercado

import type { UUID } from './types';

// ============================================================================
// ENUMS Y TIPOS BASE
// ============================================================================

export type TipoInformeMercado = 'auditoria' | 'comparativa';
export type EstadoInforme = 'borrador' | 'generando' | 'completado' | 'error';
export type ConclusionTipo = 'favorable' | 'informativa';

// ============================================================================
// CONFIGURACIÓN DEL INFORME (PASO 1)
// ============================================================================

export interface RangoFechas {
  start: string;  // ISO date string (YYYY-MM-DD)
  end: string;
}

export type RangoPreset = 'ultimo_mes' | 'ultimo_trimestre' | 'ultimo_semestre' | 'ultimo_año' | 'personalizado';

export interface InformeConfig {
  titulo: string;
  tipo_informe: TipoInformeMercado;
  fecha_inicio: string;
  fecha_fin: string;
  rango_preset: RangoPreset;
  cliente_id: UUID | null;
  punto_ids: UUID[];
}

// ============================================================================
// CONTENIDO DEL INFORME (PASO 2)
// ============================================================================

export interface ResumenEjecutivo {
  coste_total: string;
  consumo_total: string;
  ahorro_potencial: string;
  observaciones?: string;
}

export interface Incidencias {
  excesos_potencia: boolean;
  energia_reactiva: boolean;
  desviaciones_consumo: boolean;
  penalizaciones: boolean;
  otras?: string[];
}

export interface Recomendaciones {
  sin_inversion: string[];
  con_inversion: string[];
}

// Tipos de gráficos disponibles
export type GraficoDisponible =
  | 'evolucion_pool'          // Evolución Precio Pool vs Precio Cliente
  | 'mapa_calor_consumo'      // Mapa de Calor de Consumo
  | 'mix_generacion'          // Mix de Generación
  | 'comparativa_tarifas'     // Comparativa de Tarifas
  | 'consumo_mensual'         // Consumo Mensual
  | 'desglose_costes'         // Desglose de Costes
  | 'curva_carga'             // Curva de Carga
  | 'evolucion_potencia';     // Evolución de Potencia

export interface GraficoConfig {
  id: GraficoDisponible;
  nombre: string;
  descripcion: string;
  icono: string;
  categoria: 'mercado' | 'consumo' | 'costes';
}

export const GRAFICOS_DISPONIBLES: GraficoConfig[] = [
  {
    id: 'evolucion_pool',
    nombre: 'Evolución Precio Pool',
    descripcion: 'Compara el precio SPOT del mercado con el precio pagado por el cliente',
    icono: 'TrendingUp',
    categoria: 'mercado'
  },
  {
    id: 'mapa_calor_consumo',
    nombre: 'Mapa de Calor de Consumo',
    descripcion: 'Visualización horaria del consumo a lo largo del período',
    icono: 'Grid3X3',
    categoria: 'consumo'
  },
  {
    id: 'mix_generacion',
    nombre: 'Mix de Generación',
    descripcion: 'Distribución de fuentes de generación eléctrica',
    icono: 'PieChart',
    categoria: 'mercado'
  },
  {
    id: 'comparativa_tarifas',
    nombre: 'Comparativa de Tarifas',
    descripcion: 'Análisis comparativo entre diferentes estructuras tarifarias',
    icono: 'BarChart3',
    categoria: 'costes'
  },
  {
    id: 'consumo_mensual',
    nombre: 'Consumo Mensual',
    descripcion: 'Evolución del consumo mes a mes',
    icono: 'BarChart',
    categoria: 'consumo'
  },
  {
    id: 'desglose_costes',
    nombre: 'Desglose de Costes',
    descripcion: 'Distribución porcentual de los conceptos de facturación',
    icono: 'Receipt',
    categoria: 'costes'
  },
  {
    id: 'curva_carga',
    nombre: 'Curva de Carga',
    descripcion: 'Perfil de consumo horario típico',
    icono: 'Activity',
    categoria: 'consumo'
  },
  {
    id: 'evolucion_potencia',
    nombre: 'Evolución de Potencia',
    descripcion: 'Análisis de maxímetros y potencia demandada',
    icono: 'Zap',
    categoria: 'consumo'
  }
];

export interface InformeContent {
  graficos_seleccionados: GraficoDisponible[];
  resumen_ejecutivo: ResumenEjecutivo;
  analisis_mercado: string;
  incidencias: Incidencias;
  recomendaciones: Recomendaciones;
  conclusion_tipo: ConclusionTipo;
  precio_medio_pagado?: number;
  precio_medio_mercado?: number;
}

// ============================================================================
// DATOS CALCULADOS (PRE-RELLENO)
// ============================================================================

export interface DatosCalculados {
  facturacion: {
    resumen: {
      total_facturas: number;
      importe_total: number;
      consumo_total_kwh: number;
      precio_medio_kwh: number;
    };
    por_mes: Array<{
      mes: string;
      importe: number;
      consumo: number;
    }>;
    por_cliente: Array<{
      cliente_id: string;
      cliente_nombre: string;
      importe_total: number;
      consumo_total: number;
    }>;
  };
  mercado: {
    estadisticas_diarias: Array<{
      indicator_id: number;
      indicator_nombre: string;
      fecha: string;
      valor_medio: number;
      valor_min: number;
      valor_max: number;
      media_p1?: number;
      media_p2?: number;
      media_p3?: number;
    }>;
    resumen_periodo: Array<{
      indicator_id: number;
      indicator_nombre: string;
      media_periodo: number;
      minimo_periodo: number;
      maximo_periodo: number;
      volatilidad: number;
    }>;
  };
}

// ============================================================================
// AUDITORÍA ENERGÉTICA - DATOS DESDE RPC
// ============================================================================

/** Datos mensuales para una tarifa específica */
export interface DatoMensualTarifa {
  mes: string;           // YYYY-MM
  mes_nombre: string;    // "Enero 2025"
  consumo_total: number;
  coste_total: number;
  precio_medio_kwh: number;
  puntos_activos: number;
  potencia_maxima_registrada: number;
}

/** Resumen agregado por tarifa */
export interface ResumenPorTarifa {
  tarifa: string;
  total_consumo: number;
  total_coste: number;
  precio_medio: number;
  datos_mensuales: DatoMensualTarifa[];
}

/** Potencias contratadas por período */
export interface PotenciasContratadas {
  p1: number | null;
  p2: number | null;
  p3: number | null;
  p4: number | null;
  p5: number | null;
  p6: number | null;
}

/** Punto de suministro en el inventario */
export interface InventarioSuministro {
  punto_id: string;
  cups: string;
  direccion: string;
  tarifa: string;
  comercializadora: string;
  comercializadora_id: string | null;
  potencias_contratadas: PotenciasContratadas;
  estado: string;
}

/** Tipo de recomendación de potencia */
export type RecomendacionPotencia = 'SUBIR_POTENCIA' | 'BAJAR_POTENCIA' | 'OPTIMA';

/** Análisis de potencia por punto de suministro */
export interface AnalisisPotencia {
  punto_id: string;
  cups: string;
  tarifa: string;
  potencia_contratada_total: number;
  potencia_max_registrada: number;
  potencia_media_registrada: number;
  diferencia_pct: number;
  recomendacion_potencia: RecomendacionPotencia;
}

/** Facturación agregada por punto en el período */
export interface FacturacionPorPunto {
  punto_id: string;
  cups: string;
  tarifa: string;
  consumo_total: number;
  coste_total: number;
  precio_medio: number;
}

/** Respuesta completa de la RPC get_auditoria_energetica_data */
export interface AuditoriaEnergeticaData {
  cliente_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  resumen_por_tarifa: ResumenPorTarifa[];
  inventario_suministros: InventarioSuministro[];
  analisis_potencias: AnalisisPotencia[];
  facturacion_por_punto: FacturacionPorPunto[];
  generado_at: string;
  error?: string;
}

// ============================================================================
// AUDITORÍA ENERGÉTICA - CONTENIDO EDITABLE (PASO 2)
// ============================================================================

/** Celda editable en la tabla mensual */
export interface DatoMensualEditable extends DatoMensualTarifa {
  observaciones?: string;
}

/** Resumen de tarifa con datos editables */
export interface ResumenTarifaEditable {
  tarifa: string;
  total_consumo: number;
  total_coste: number;
  precio_medio: number;
  datos_mensuales: DatoMensualEditable[];
  comentario_tarifa?: string;
}

/** Recomendación individual para el informe */
export interface RecomendacionAuditoria {
  id: string;
  descripcion: string;
  ahorro_estimado: number | null;
  prioridad: 'alta' | 'media' | 'baja';
  tipo: 'sin_inversion' | 'con_inversion';
}

/** Contenido completo editable para auditoría energética */
export interface AuditoriaContent {
  // Bloque A: Resumen Ejecutivo por Tarifa
  resumen_tarifas: ResumenTarifaEditable[];
  
  // Bloque B: Inventario de Suministros
  inventario: InventarioSuministro[];
  inventario_limitaciones: string;
  inventario_desviaciones: string;
  
  // Bloque C: Análisis de Potencias
  analisis_potencias: AnalisisPotencia[];
  potencias_comentario: string;
  
  // Bloque D: Recomendaciones
  recomendaciones: RecomendacionAuditoria[];
  
  // Resumen ejecutivo general
  resumen_general: string;
  conclusion: string;
}

// ============================================================================
// MODELO DE INFORME GUARDADO
// ============================================================================

export interface InformeMercado {
  id: UUID;
  titulo: string;
  tipo_informe: TipoInformeMercado;
  fecha_inicio: string;
  fecha_fin: string;
  cliente_id: UUID;
  parametros_config: InformeContent;
  ruta_storage: string | null;
  creado_por: UUID;
  creado_en: string;
  actualizado_en: string | null;
  estado: EstadoInforme;
}

// Con relaciones expandidas
export interface InformeMercadoConRelaciones extends InformeMercado {
  creador?: {
    nombre: string | null;
    apellidos: string | null;
  };
  cliente_info?: {
    id: UUID;
    nombre: string;
  };
}

// ============================================================================
// REQUEST/RESPONSE PARA API
// ============================================================================

import type { FinalReportPayload } from './reportDraftTypes';

export interface GenerateInformeRequest {
  config: Omit<InformeConfig, 'rango_preset'>;
  content: InformeContent | FinalReportPayload;
}

export interface GenerateInformeResponse {
  success: boolean;
  informe?: InformeMercado;
  download_url?: string;
  expires_in?: number;
  error?: string;
  message?: string;
  details?: string;
  payload_preview?: {
    data_summary: {
      facturas_count: number;
      importe_total: number;
      market_data_days: number;
    };
  };
}

// ============================================================================
// ESTADO DEL WIZARD
// ============================================================================

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  currentStep: WizardStep;
  config: InformeConfig;
  content: InformeContent;
  datosCalculados: DatosCalculados | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
}

// ============================================================================
// VALORES POR DEFECTO
// ============================================================================

export const DEFAULT_CONFIG: InformeConfig = {
  titulo: '',
  tipo_informe: 'auditoria',
  fecha_inicio: getRangoFromPreset('ultimo_mes').start,
  fecha_fin: getRangoFromPreset('ultimo_mes').end,
  rango_preset: 'ultimo_mes',
  cliente_id: null,
  punto_ids: []
};

export const DEFAULT_CONTENT: InformeContent = {
  graficos_seleccionados: ['evolucion_pool', 'consumo_mensual', 'desglose_costes'],
  resumen_ejecutivo: {
    coste_total: '',
    consumo_total: '',
    ahorro_potencial: ''
  },
  analisis_mercado: '',
  incidencias: {
    excesos_potencia: false,
    energia_reactiva: false,
    desviaciones_consumo: false,
    penalizaciones: false
  },
  recomendaciones: {
    sin_inversion: [],
    con_inversion: []
  },
  conclusion_tipo: 'informativa',
  precio_medio_pagado: undefined,
  precio_medio_mercado: undefined
};

export const DEFAULT_AUDITORIA_CONTENT: AuditoriaContent = {
  resumen_tarifas: [],
  inventario: [],
  inventario_limitaciones: '',
  inventario_desviaciones: '',
  analisis_potencias: [],
  potencias_comentario: '',
  recomendaciones: [],
  resumen_general: '',
  conclusion: ''
};

// ============================================================================
// HELPERS
// ============================================================================

export function getRangoFromPreset(preset: RangoPreset): RangoFechas {
  const now = new Date();
  let start: string;
  let end: string;

  switch (preset) {
    case 'ultimo_mes': {
      // Último mes natural completo (ej: si estamos en Febrero 2026, devuelve Enero 2026)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      // Para obtener el último día del mes anterior: día 0 del mes actual
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1 + 1, 0);
      start = lastMonth.toISOString().split('T')[0] ?? '';
      end = lastMonthEnd.toISOString().split('T')[0] ?? '';
      break;
    }
    case 'ultimo_trimestre': {
      // Últimos 3 meses naturales completos
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      // Último día del mes anterior (3 meses de duración)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      start = threeMonthsAgo.toISOString().split('T')[0] ?? '';
      end = lastMonthEnd.toISOString().split('T')[0] ?? '';
      break;
    }
    case 'ultimo_semestre': {
      // Últimos 6 meses naturales completos
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      // Último día del mes anterior
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      start = sixMonthsAgo.toISOString().split('T')[0] ?? '';
      end = lastMonthEnd.toISOString().split('T')[0] ?? '';
      break;
    }
    case 'ultimo_año': {
      // Último año natural completo (ej: si estamos en 2026, devuelve todo 2025)
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 0, 1).toISOString().split('T')[0] ?? '';
      end = new Date(lastYear, 11, 31).toISOString().split('T')[0] ?? '';
      break;
    }
    case 'personalizado':
    default: {
      // Por defecto: último mes natural
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1 + 1, 0);
      start = lastMonth.toISOString().split('T')[0] ?? '';
      end = lastMonthEnd.toISOString().split('T')[0] ?? '';
    }
  }

  return { start, end };
}

export function getTipoInformeLabel(tipo: TipoInformeMercado): string {
  const labels: Record<TipoInformeMercado, string> = {
    auditoria: 'Auditoría Energética',
    comparativa: 'Auditoría Comparativa con el Mercado'
  };
  return labels[tipo];
}



export function getEstadoLabel(estado: EstadoInforme): string {
  const labels: Record<EstadoInforme, string> = {
    borrador: 'Borrador',
    generando: 'Generando...',
    completado: 'Completado',
    error: 'Error'
  };
  return labels[estado];
}

export function getEstadoColor(estado: EstadoInforme): string {
  const colors: Record<EstadoInforme, string> = {
    borrador: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    generando: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    completado: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
    error: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
  };
  return colors[estado];
}
