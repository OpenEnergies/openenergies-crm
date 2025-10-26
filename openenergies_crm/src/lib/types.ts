export type RolUsuario = 'administrador' | 'comercial' | 'cliente';

// Por simplicidad, tipos USER-DEFINED se tratan como string en TS.
export type UUID = string;

export type TipoCliente = 'persona' | 'sociedad';

export type EstadoCliente = 'desistido' | 'stand by' | 'procesando' | 'activo';

export type RootDocumentItem = {
  cliente_id: string;
  cliente_nombre: string;
  item_name: string;
  is_folder: boolean;
  full_path: string;
  visible_para_cliente: boolean; // <-- AÑADIR ESTA LÍNEA
};

export interface UsuarioApp {
  user_id: UUID;
  empresa_id: UUID;
  rol: RolUsuario;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  creado_en: string | null;
  avatar_url: string | null;
}

export interface Empresa {
  id: UUID;
  nombre: string;
  cif: string | null;
  tipo: 'openenergies' | 'comercializadora'; // p.ej. 'openenergies' | 'comercializadora'...
  creada_en: string | null;
}

export interface Cliente {
  id: UUID;
  empresa_id: UUID;
  tipo: TipoCliente; // (persona | sociedad) → esquema no impone literal
  nombre: string;
  dni: string | null;
  cif: string | null;
  email_facturacion: string | null;
  creado_en: string | null;
  estado: EstadoCliente;
}

export type TipoFactura = 'Luz' | 'Gas';
export interface PuntoSuministro {
  id: UUID;
  cliente_id: UUID;
  titular: string;
  direccion: string;
  cups: string;
  tarifa_acceso: string;
  potencia_contratada_kw: number | null;
  consumo_anual_kwh: number | null;
  localidad?: string | null; // <-- NUEVO
  provincia?: string | null; // <-- NUEVO
  tipo_factura?: TipoFactura | null;
}



export interface Contrato {
  id: UUID;
  punto_id: UUID;
  comercializadora_id: UUID;
  oferta: string | null;
  fecha_inicio: string; // date
  fecha_fin: string | null; // date
  aviso_renovacion: boolean;
  fecha_aviso: string | null; // date
  estado: string; // 'activo'...
}

export interface Documento {
  id: UUID;
  cliente_id: UUID | null;
  punto_id: UUID | null;
  contrato_id: UUID | null;
  factura_id: UUID | null;
  tipo: string;
  ruta_storage: string;   // path en bucket
  nombre_archivo: string | null;
  mime_type: string | null;
  tamano_bytes: number | null;
  subido_por_user_id: UUID | null;
  subido_en: string | null;
}


export type AgendaItem = {
  id: string
  titulo: string
  fecha_inicio: string // (vendrá como string ISO 8601)
  fecha_fin: string | null
  color: string | null
  etiqueta: string | null
  tipo_evento: 'evento' | 'renovacion'
  es_editable: boolean
  cliente_id_relacionado: string | null
  creador_nombre: string | null
}

/**
 * Campos para el formulario de eventos (crear/editar)
 */
export type AgendaEventoForm = {
  titulo: string
  fecha_inicio: string // Usamos string para el input datetime-local
  fecha_fin?: string | null
  color: string
  etiqueta: string
}

export interface Documento {
  id: UUID;
  cliente_id: UUID | null;
  punto_id: UUID | null;
  contrato_id: UUID | null;
  factura_id: UUID | null;
  tipo: string;
  ruta_storage: string;   // path en bucket
  nombre_archivo: string | null;
  mime_type: string | null;
  tamano_bytes: number | null;
  subido_por_user_id: UUID | null;
  subido_en: string | null;
  visible_para_cliente: boolean; // <-- AÑADIR ESTA LÍNEA
}