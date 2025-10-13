export type RolUsuario = 'administrador' | 'comercializadora' | 'comercial' | 'cliente';

// Por simplicidad, tipos USER-DEFINED se tratan como string en TS.
export type UUID = string;

export type TipoCliente = 'persona' | 'sociedad';

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
  tipo: string;  // p.ej. 'openenergies' | 'comercializadora'...
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
}

export interface PuntoSuministro {
  id: UUID;
  cliente_id: UUID;
  titular: string;
  direccion: string;
  cups: string;
  tarifa_acceso: string;
  potencia_contratada_kw: number | null;
  consumo_anual_kwh: number | null;
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
