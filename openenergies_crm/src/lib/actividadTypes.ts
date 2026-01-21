// src/lib/actividadTypes.ts
// Tipos TypeScript para el Sistema de Auditoría y Actividad

/**
 * Tipos de eventos que se pueden registrar en el log de actividad
 */
export type TipoEventoLog = 'creacion' | 'edicion' | 'eliminacion' | 'nota_manual';

/**
 * Tipos de entidades/tablas que generan eventos de auditoría
 */
export type EntidadTipoLog = 'cliente' | 'punto' | 'contrato' | 'documento' | 'factura' | 'factura_cliente';

/**
 * Estructura del JSONB detalles_json
 */
export interface DetallesJson {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
}

/**
 * Metadata del usuario denormalizada
 */
export interface MetadataUsuario {
    nombre: string;
    apellidos?: string;
    email: string;
}

/**
 * Metadatos de la entidad (datos legibles humanos)
 * Capturados en el momento del evento para evitar mostrar UUIDs
 */
export interface MetadatosEntidad {
    cliente_nombre?: string;
    cups?: string;
    direccion?: string;
    comercializadora_nombre?: string;
}

/**
 * Entrada del log de actividad
 */
export interface ActividadLogEntry {
    id: string;
    cliente_id: string | null;
    empresa_id: string | null;
    punto_id: string | null;
    contrato_id: string | null;
    user_id: string;
    tipo_evento: TipoEventoLog;
    entidad_tipo: EntidadTipoLog;
    entidad_id: string;
    detalles_json: DetallesJson | null;
    contenido_nota: string | null;
    metadata_usuario: MetadataUsuario | null;
    metadatos_entidad: MetadatosEntidad | null;
    creado_en: string;
}

/**
 * Filtros para consultar el log de actividad
 */
export interface ActividadFilters {
    // Filtros de entidad jerárquica (múltiple)
    cliente_ids?: string[];
    punto_ids?: string[];
    contrato_ids?: string[];
    // Filtros simples
    cliente_id?: string;
    empresa_id?: string;
    user_id?: string;
    tipo_evento?: TipoEventoLog[];
    entidad_tipo?: EntidadTipoLog[];
    entidad_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
}

/**
 * Opciones de paginación
 */
export interface PaginationOptions {
    page: number;
    pageSize: number;
}

/**
 * Respuesta paginada del log
 */
export interface ActividadLogResponse {
    data: ActividadLogEntry[];
    totalCount: number;
    hasMore: boolean;
}

/**
 * Labels en español para tipos de evento
 */
export const TIPO_EVENTO_LABELS: Record<TipoEventoLog, string> = {
    creacion: 'Creación',
    edicion: 'Edición',
    eliminacion: 'Eliminación',
    nota_manual: 'Nota',
};

/**
 * Labels en español para tipos de entidad
 */
export const ENTIDAD_TIPO_LABELS: Record<EntidadTipoLog, string> = {
    cliente: 'CLIENTE',
    punto: 'PUNTO',
    contrato: 'CONTRATO',
    documento: 'DOCUMENTO',
    factura: 'FACTURA',
    factura_cliente: 'FACTURA',
};

/**
 * Colores para badges de entidad (soft)
 */
export const ENTIDAD_TIPO_COLORS: Record<EntidadTipoLog, string> = {
    cliente: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    punto: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    contrato: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    documento: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    factura: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    factura_cliente: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

/**
 * Colores para tipos de evento
 */
export const TIPO_EVENTO_COLORS: Record<TipoEventoLog, string> = {
    creacion: 'text-emerald-600 dark:text-emerald-400',
    edicion: 'text-blue-600 dark:text-blue-400',
    eliminacion: 'text-red-600 dark:text-red-400',
    nota_manual: 'text-fenix-600 dark:text-fenix-400',
};

/**
 * Iconos para tipos de evento
 */
export const TIPO_EVENTO_ICONS: Record<TipoEventoLog, string> = {
    creacion: 'Plus',
    edicion: 'Pencil',
    eliminacion: 'Trash2',
    nota_manual: 'MessageSquare',
};

/**
 * Campos que deben ocultarse en el diff viewer
 */
export const CAMPOS_OCULTOS_DIFF: string[] = [
    'id',
    'creado_en',
    'creado_por',
    'modificado_en',
    'modificado_por',
    'eliminado_en',
    'eliminado_por',
    'numero_cuenta',
    'raw_json',
    'version',
];

/**
 * Campos que son IDs de FK y necesitan resolución a nombre
 */
export const CAMPOS_FK_A_RESOLVER: Record<string, string> = {
    cliente_id: 'clientes',
    punto_id: 'puntos_suministro',
    contrato_id: 'contratos',
    comercializadora_id: 'empresas',
    canal_id: 'empresas',
    current_comercializadora_id: 'empresas',
};

/**
 * Labels en español para campos comunes
 */
export const CAMPO_LABELS: Record<string, string> = {
    nombre: 'Nombre',
    email: 'Email',
    telefono: 'Teléfono',
    telefonos: 'Teléfonos',
    direccion: 'Dirección',
    cups: 'CUPS',
    estado: 'Estado',
    tipo: 'Tipo',
    dni: 'DNI',
    cif: 'CIF',
    representante: 'Representante',
    fecha_firma: 'Fecha Firma',
    fecha_activacion: 'Fecha Activación',
    fecha_renovacion: 'Fecha Renovación',
    aviso_renovacion: 'Aviso Renovación',
    fecha_aviso: 'Fecha Aviso',
    comercializadora_id: 'Comercializadora',
    punto_id: 'Punto de Suministro',
    cliente_id: 'Cliente',
    consumo_anual_kwh: 'Consumo Anual (kWh)',
    p1_kw: 'Potencia P1 (kW)',
    p2_kw: 'Potencia P2 (kW)',
    p3_kw: 'Potencia P3 (kW)',
    p4_kw: 'Potencia P4 (kW)',
    p5_kw: 'Potencia P5 (kW)',
    p6_kw: 'Potencia P6 (kW)',
    tarifa: 'Tarifa',
    direccion_sum: 'Dirección Suministro',
    localidad_sum: 'Localidad',
    provincia_sum: 'Provincia',
    tiene_fv: 'Tiene FV',
    fv_compensacion: 'Compensación FV',
    fecha_emision: 'Fecha Emisión',
    numero_factura: 'Nº Factura',
    total: 'Total',
    consumo_kwh: 'Consumo (kWh)',
    precio_eur_kwh: 'Precio (€/kWh)',
    ruta_storage: 'Archivo',
    nombre_archivo: 'Nombre Archivo',
    visible_para_cliente: 'Visible Cliente',
    cobrado: 'Cobrado',
    permanencia: 'Permanencia',
    fecha_permanencia: 'Fecha Permanencia',
    fotovoltaica: 'Fotovoltaica',
    canal_id: 'Canal',
    current_comercializadora_id: 'Comercializadora Actual',
};

/**
 * Opción para selectores
 */
export interface SelectOption {
    value: string;
    label: string;
    subtitle?: string;
}
