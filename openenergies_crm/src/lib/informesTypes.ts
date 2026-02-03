// openenergies_crm/src/lib/informesTypes.ts
// Tipos para el módulo de Informes de Mercado

import type { UUID } from './types';

// ============================================================================
// ENUMS Y TIPOS BASE
// ============================================================================

export type TipoInformeMercado = 'auditoria' | 'mercado' | 'seguimiento';
export type TipoEnergiaInforme = 'electricidad' | 'gas' | 'ambos';
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
  tipo_energia: TipoEnergiaInforme;
  rango_fechas: RangoFechas;
  rango_preset: RangoPreset;
  cliente_ids: UUID[];
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
// MODELO DE INFORME GUARDADO
// ============================================================================

export interface InformeMercado {
  id: UUID;
  titulo: string;
  tipo_informe: TipoInformeMercado;
  tipo_energia: TipoEnergiaInforme;
  rango_fechas: RangoFechas;
  cliente_ids: UUID[];
  punto_ids: UUID[];
  parametros_config: InformeContent;
  ruta_storage: string | null;
  creado_por: UUID;
  empresa_id: UUID;
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
  clientes_info?: Array<{
    id: UUID;
    nombre: string;
  }>;
  puntos_info?: Array<{
    id: UUID;
    cups: string;
    direccion: string;
  }>;
}

// ============================================================================
// REQUEST/RESPONSE PARA API
// ============================================================================

export interface GenerateInformeRequest {
  config: Omit<InformeConfig, 'rango_preset'> & { empresa_id?: string };
  content: InformeContent;
}

export interface GenerateInformeResponse {
  success: boolean;
  informe?: InformeMercado;
  download_url?: string;
  expires_in?: number;
  error?: string;
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
  tipo_informe: 'mercado',
  tipo_energia: 'electricidad',
  rango_fechas: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  },
  rango_preset: 'ultimo_mes',
  cliente_ids: [],
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

// ============================================================================
// HELPERS
// ============================================================================

export function getRangoFromPreset(preset: RangoPreset): RangoFechas {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;

  switch (preset) {
    case 'ultimo_mes':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'ultimo_trimestre':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'ultimo_semestre':
      start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'ultimo_año':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'personalizado':
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  return { start, end };
}

export function getTipoInformeLabel(tipo: TipoInformeMercado): string {
  const labels: Record<TipoInformeMercado, string> = {
    auditoria: 'Auditoría Energética',
    mercado: 'Situación de Mercado',
    seguimiento: 'Seguimiento Periódico'
  };
  return labels[tipo];
}

export function getTipoEnergiaLabel(tipo: TipoEnergiaInforme): string {
  const labels: Record<TipoEnergiaInforme, string> = {
    electricidad: 'Electricidad',
    gas: 'Gas Natural',
    ambos: 'Electricidad y Gas'
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
