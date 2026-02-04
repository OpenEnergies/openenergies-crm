export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      actividad_log: {
        Row: {
          cliente_id: string | null
          contenido_nota: string | null
          contrato_id: string | null
          creado_en: string
          detalles_json: Json | null
          empresa_id: string | null
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["entidad_tipo_log"]
          id: string
          metadata_usuario: Json | null
          metadatos_entidad: Json | null
          punto_id: string | null
          tipo_evento: Database["public"]["Enums"]["tipo_evento_log"]
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          contenido_nota?: string | null
          contrato_id?: string | null
          creado_en?: string
          detalles_json?: Json | null
          empresa_id?: string | null
          entidad_id: string
          entidad_tipo: Database["public"]["Enums"]["entidad_tipo_log"]
          id?: string
          metadata_usuario?: Json | null
          metadatos_entidad?: Json | null
          punto_id?: string | null
          tipo_evento: Database["public"]["Enums"]["tipo_evento_log"]
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          contenido_nota?: string | null
          contrato_id?: string | null
          creado_en?: string
          detalles_json?: Json | null
          empresa_id?: string | null
          entidad_id?: string
          entidad_tipo?: Database["public"]["Enums"]["entidad_tipo_log"]
          id?: string
          metadata_usuario?: Json | null
          metadatos_entidad?: Json | null
          punto_id?: string | null
          tipo_evento?: Database["public"]["Enums"]["tipo_evento_log"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actividad_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividad_log_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_actividad_log_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_eventos: {
        Row: {
          color: string | null
          creado_en: string | null
          creado_por_email: string | null
          creado_por_nombre: string | null
          empresa_id: string
          etiqueta: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          creado_en?: string | null
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          empresa_id: string
          etiqueta?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          creado_en?: string | null
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          empresa_id?: string
          etiqueta?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agenda_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agenda_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
        ]
      }
      asignaciones_comercial_punto: {
        Row: {
          comercial_user_id: string
          creado_en: string | null
          id: string
          punto_id: string
        }
        Insert: {
          comercial_user_id: string
          creado_en?: string | null
          id?: string
          punto_id: string
        }
        Update: {
          comercial_user_id?: string
          creado_en?: string | null
          id?: string
          punto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_comercial_punto_comercial_user_id_fkey"
            columns: ["comercial_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asignaciones_comercial_punto_comercial_user_id_fkey"
            columns: ["comercial_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asignaciones_comercial_punto_comercial_user_id_fkey"
            columns: ["comercial_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asignaciones_comercial_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_comercial_punto_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      canales: {
        Row: {
          creado_en: string | null
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string | null
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          id: number
          message: Json
          user_id: string
        }
        Insert: {
          id?: number
          message: Json
          user_id: string
        }
        Update: {
          id?: number
          message?: Json
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cif: string | null
          creado_en: string | null
          creado_por: string | null
          dni: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string
          modificado_en: string | null
          modificado_por: string | null
          nombre: string
          numero_cuenta: string | null
          representante: string | null
          telefonos: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }
        Insert: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          nombre: string
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }
        Update: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
        }
        Relationships: []
      }
      comparativas: {
        Row: {
          cliente_id: string | null
          creado_en: string | null
          creado_por: string | null
          creado_por_user_id: string
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          modificado_en: string | null
          modificado_por: string | null
          prospecto_contacto: string | null
          prospecto_nombre: string | null
          punto_id: string | null
          resumen_resultado: string | null
          ruta_pdf: string | null
          solicitada_en: string | null
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          creado_por_user_id: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          prospecto_contacto?: string | null
          prospecto_nombre?: string | null
          punto_id?: string | null
          resumen_resultado?: string | null
          ruta_pdf?: string | null
          solicitada_en?: string | null
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          creado_por_user_id?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          prospecto_contacto?: string | null
          prospecto_nombre?: string | null
          punto_id?: string | null
          resumen_resultado?: string | null
          ruta_pdf?: string | null
          solicitada_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparativas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparativas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparativas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparativas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparativas_creado_por_user_id_fkey"
            columns: ["creado_por_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comparativas_creado_por_user_id_fkey"
            columns: ["creado_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comparativas_creado_por_user_id_fkey"
            columns: ["creado_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comparativas_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparativas_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      consumos: {
        Row: {
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          id: number
          kwh: number
          modificado_en: string | null
          modificado_por: string | null
          periodo_fin: string
          periodo_inicio: string
          precio_kwh: number | null
          punto_id: string
        }
        Insert: {
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: number
          kwh: number
          modificado_en?: string | null
          modificado_por?: string | null
          periodo_fin: string
          periodo_inicio: string
          precio_kwh?: number | null
          punto_id: string
        }
        Update: {
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: number
          kwh?: number
          modificado_en?: string | null
          modificado_por?: string | null
          periodo_fin?: string
          periodo_inicio?: string
          precio_kwh?: number | null
          punto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos_cliente: {
        Row: {
          cliente_id: string
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          modificado_en: string | null
          modificado_por: string | null
          user_id: string
        }
        Insert: {
          cliente_id: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          user_id: string
        }
        Update: {
          cliente_id?: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_cliente_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contactos_cliente_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contactos_cliente_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contratos: {
        Row: {
          aviso_renovacion: boolean
          canal_id: string | null
          cobrado: boolean | null
          comercializadora_id: string
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_contrato"]
          fecha_aceptacion: string | null
          fecha_activacion: string | null
          fecha_aviso: string | null
          fecha_baja: string | null
          fecha_firma: string | null
          fecha_permanencia: string | null
          fecha_renovacion: string | null
          fotovoltaica:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id: string
          modificado_en: string | null
          modificado_por: string | null
          numero_cuenta: string | null
          permanencia: boolean | null
          punto_id: string
        }
        Insert: {
          aviso_renovacion?: boolean
          canal_id?: string | null
          cobrado?: boolean | null
          comercializadora_id: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_contrato"]
          fecha_aceptacion?: string | null
          fecha_activacion?: string | null
          fecha_aviso?: string | null
          fecha_baja?: string | null
          fecha_firma?: string | null
          fecha_permanencia?: string | null
          fecha_renovacion?: string | null
          fotovoltaica?:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          numero_cuenta?: string | null
          permanencia?: boolean | null
          punto_id: string
        }
        Update: {
          aviso_renovacion?: boolean
          canal_id?: string | null
          cobrado?: boolean | null
          comercializadora_id?: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_contrato"]
          fecha_aceptacion?: string | null
          fecha_activacion?: string | null
          fecha_aviso?: string | null
          fecha_baja?: string | null
          fecha_firma?: string | null
          fecha_permanencia?: string | null
          fecha_renovacion?: string | null
          fotovoltaica?:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          numero_cuenta?: string | null
          permanencia?: boolean | null
          punto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_comercializadora_id_fkey"
            columns: ["comercializadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      datos_sensibles_cifrados: {
        Row: {
          campo: string
          created_at: string
          created_by: string | null
          entidad_id: string
          entidad_tipo: string
          id: string
          updated_at: string | null
          updated_by: string | null
          valor_cifrado: string
        }
        Insert: {
          campo: string
          created_at?: string
          created_by?: string | null
          entidad_id: string
          entidad_tipo: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_cifrado: string
        }
        Update: {
          campo?: string
          created_at?: string
          created_by?: string | null
          entidad_id?: string
          entidad_tipo?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_cifrado?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          cliente_id: string | null
          contrato_id: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          factura_cliente_id: string | null
          factura_id: string | null
          id: string
          mime_type: string | null
          modificado_en: string | null
          modificado_por: string | null
          nombre_archivo: string | null
          punto_id: string | null
          ruta_storage: string
          subido_en: string | null
          subido_por_user_id: string | null
          tamano_bytes: number | null
          tipo: string
          visible_para_cliente: boolean
        }
        Insert: {
          cliente_id?: string | null
          contrato_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_cliente_id?: string | null
          factura_id?: string | null
          id?: string
          mime_type?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre_archivo?: string | null
          punto_id?: string | null
          ruta_storage: string
          subido_en?: string | null
          subido_por_user_id?: string | null
          tamano_bytes?: number | null
          tipo: string
          visible_para_cliente?: boolean
        }
        Update: {
          cliente_id?: string | null
          contrato_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_cliente_id?: string | null
          factura_id?: string | null
          id?: string
          mime_type?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre_archivo?: string | null
          punto_id?: string | null
          ruta_storage?: string
          subido_en?: string | null
          subido_por_user_id?: string | null
          tamano_bytes?: number | null
          tipo?: string
          visible_para_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_factura_cliente_id_fkey"
            columns: ["factura_cliente_id"]
            isOneToOne: false
            referencedRelation: "facturacion_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_facturas_activas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
        ]
      }
      empresas: {
        Row: {
          archived_at: string | null
          cif: string | null
          creada_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          id: string
          is_archived: boolean
          logo_url: string | null
          modificado_en: string | null
          modificado_por: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_empresa"]
        }
        Insert: {
          archived_at?: string | null
          cif?: string | null
          creada_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_empresa"]
        }
        Update: {
          archived_at?: string | null
          cif?: string | null
          creada_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_empresa"]
        }
        Relationships: []
      }
      facturacion_clientes: {
        Row: {
          base_impuesto_principal: number | null
          base_impuesto_secundario: number | null
          cliente_id: string
          comercializadora_id: string
          consumo_kwh: number | null
          creado_en: string
          creado_por: string | null
          direccion_suministro: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          fecha_emision: string
          id: string
          importe_impuesto_principal: number | null
          importe_impuesto_secundario: number | null
          modificado_en: string | null
          modificado_por: string | null
          numero_factura: string
          observaciones: string | null
          potencia_kw_max: number | null
          potencia_kw_min: number | null
          precio_eur_kwh: number | null
          provincia: string | null
          punto_id: string
          raw_json: Json
          tarifa: Database["public"]["Enums"]["tipo_tarifa"] | null
          tarifa_externa: string | null
          tipo_factura: Database["public"]["Enums"]["tipo_factura_enum"] | null
          tipo_impuesto_principal_pct: number | null
          tipo_impuesto_secundario_pct: number | null
          total: number
          version: number
        }
        Insert: {
          base_impuesto_principal?: number | null
          base_impuesto_secundario?: number | null
          cliente_id: string
          comercializadora_id: string
          consumo_kwh?: number | null
          creado_en?: string
          creado_por?: string | null
          direccion_suministro?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          fecha_emision: string
          id?: string
          importe_impuesto_principal?: number | null
          importe_impuesto_secundario?: number | null
          modificado_en?: string | null
          modificado_por?: string | null
          numero_factura: string
          observaciones?: string | null
          potencia_kw_max?: number | null
          potencia_kw_min?: number | null
          precio_eur_kwh?: number | null
          provincia?: string | null
          punto_id: string
          raw_json: Json
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tarifa_externa?: string | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
          tipo_impuesto_principal_pct?: number | null
          tipo_impuesto_secundario_pct?: number | null
          total: number
          version?: number
        }
        Update: {
          base_impuesto_principal?: number | null
          base_impuesto_secundario?: number | null
          cliente_id?: string
          comercializadora_id?: string
          consumo_kwh?: number | null
          creado_en?: string
          creado_por?: string | null
          direccion_suministro?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          fecha_emision?: string
          id?: string
          importe_impuesto_principal?: number | null
          importe_impuesto_secundario?: number | null
          modificado_en?: string | null
          modificado_por?: string | null
          numero_factura?: string
          observaciones?: string | null
          potencia_kw_max?: number | null
          potencia_kw_min?: number | null
          precio_eur_kwh?: number | null
          provincia?: string | null
          punto_id?: string
          raw_json?: Json
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tarifa_externa?: string | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
          tipo_impuesto_principal_pct?: number | null
          tipo_impuesto_secundario_pct?: number | null
          total?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "facturacion_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_comercializadora_id_fkey"
            columns: ["comercializadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturacion_clientes_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          cliente_id: string
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_factura"]
          fecha_emision: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          moneda: string
          numero: string
          remesa_id: string | null
          total_eur: number
        }
        Insert: {
          cliente_id: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          fecha_emision: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          moneda?: string
          numero: string
          remesa_id?: string | null
          total_eur: number
        }
        Update: {
          cliente_id?: string
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"]
          fecha_emision?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          moneda?: string
          numero?: string
          remesa_id?: string | null
          total_eur?: number
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_remesa_id_fkey"
            columns: ["remesa_id"]
            isOneToOne: false
            referencedRelation: "remesas"
            referencedColumns: ["id"]
          },
        ]
      }
      informes_mercado: {
        Row: {
          actualizado_en: string | null
          cliente_ids: string[]
          creado_en: string
          creado_por: string
          empresa_id: string
          estado: string
          id: string
          parametros_config: Json
          punto_ids: string[]
          rango_fechas: Json
          ruta_storage: string | null
          tipo_energia: Database["public"]["Enums"]["tipo_energia_informe"]
          tipo_informe: Database["public"]["Enums"]["tipo_informe_mercado"]
          titulo: string
        }
        Insert: {
          actualizado_en?: string | null
          cliente_ids?: string[]
          creado_en?: string
          creado_por: string
          empresa_id: string
          estado?: string
          id?: string
          parametros_config?: Json
          punto_ids?: string[]
          rango_fechas: Json
          ruta_storage?: string | null
          tipo_energia?: Database["public"]["Enums"]["tipo_energia_informe"]
          tipo_informe?: Database["public"]["Enums"]["tipo_informe_mercado"]
          titulo: string
        }
        Update: {
          actualizado_en?: string | null
          cliente_ids?: string[]
          creado_en?: string
          creado_por?: string
          empresa_id?: string
          estado?: string
          id?: string
          parametros_config?: Json
          punto_ids?: string[]
          rango_fechas?: Json
          ruta_storage?: string | null
          tipo_energia?: Database["public"]["Enums"]["tipo_energia_informe"]
          tipo_informe?: Database["public"]["Enums"]["tipo_informe_mercado"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "informes_mercado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_factura: {
        Row: {
          cantidad: number
          creado_en: string | null
          creado_por: string | null
          descripcion: string
          eliminado_en: string | null
          eliminado_por: string | null
          factura_id: string
          id: number
          modificado_en: string | null
          modificado_por: string | null
          precio_unitario: number
          tipo_impuesto: number
        }
        Insert: {
          cantidad: number
          creado_en?: string | null
          creado_por?: string | null
          descripcion: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_id: string
          id?: number
          modificado_en?: string | null
          modificado_por?: string | null
          precio_unitario: number
          tipo_impuesto?: number
        }
        Update: {
          cantidad?: number
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_id?: string
          id?: number
          modificado_en?: string | null
          modificado_por?: string | null
          precio_unitario?: number
          tipo_impuesto?: number
        }
        Relationships: [
          {
            foreignKeyName: "lineas_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_factura_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_facturas_activas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          agenda_evento_id: string | null
          asunto: string
          canal: string
          cliente_id: string | null
          contrato_id: string | null
          creada_en: string | null
          creada_por_user_id: string | null
          creado_en: string | null
          creado_por: string | null
          cuerpo: string
          destinatarios_emails: string[]
          eliminado_en: string | null
          eliminado_por: string | null
          empresa_id: string
          enviada_en: string | null
          error_texto: string | null
          estado: string
          id: string
          leida: boolean
          modificado_en: string | null
          modificado_por: string | null
          programada_para: string
          tipo: string
          user_id_destinatario: string | null
        }
        Insert: {
          agenda_evento_id?: string | null
          asunto: string
          canal?: string
          cliente_id?: string | null
          contrato_id?: string | null
          creada_en?: string | null
          creada_por_user_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          cuerpo: string
          destinatarios_emails: string[]
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id: string
          enviada_en?: string | null
          error_texto?: string | null
          estado?: string
          id?: string
          leida?: boolean
          modificado_en?: string | null
          modificado_por?: string | null
          programada_para: string
          tipo?: string
          user_id_destinatario?: string | null
        }
        Update: {
          agenda_evento_id?: string | null
          asunto?: string
          canal?: string
          cliente_id?: string | null
          contrato_id?: string | null
          creada_en?: string | null
          creada_por_user_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          cuerpo?: string
          destinatarios_emails?: string[]
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id?: string
          enviada_en?: string | null
          error_texto?: string | null
          estado?: string
          id?: string
          leida?: boolean
          modificado_en?: string | null
          modificado_por?: string | null
          programada_para?: string
          tipo?: string
          user_id_destinatario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_agenda_evento_id_fkey"
            columns: ["agenda_evento_id"]
            isOneToOne: false
            referencedRelation: "agenda_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_creada_por_user_id_fkey"
            columns: ["creada_por_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificaciones_creada_por_user_id_fkey"
            columns: ["creada_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificaciones_creada_por_user_id_fkey"
            columns: ["creada_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_user_id_destinatario_fkey"
            columns: ["user_id_destinatario"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificaciones_user_id_destinatario_fkey"
            columns: ["user_id_destinatario"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificaciones_user_id_destinatario_fkey"
            columns: ["user_id_destinatario"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
        ]
      }
      precios_energia: {
        Row: {
          creado_en: string | null
          empresa_id: string
          fecha_mes: string
          id: string
          precio_energia_p1: number | null
          precio_energia_p2: number | null
          precio_energia_p3: number | null
          precio_energia_p4: number | null
          precio_energia_p5: number | null
          precio_energia_p6: number | null
          tarifa: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Insert: {
          creado_en?: string | null
          empresa_id: string
          fecha_mes: string
          id?: string
          precio_energia_p1?: number | null
          precio_energia_p2?: number | null
          precio_energia_p3?: number | null
          precio_energia_p4?: number | null
          precio_energia_p5?: number | null
          precio_energia_p6?: number | null
          tarifa: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Update: {
          creado_en?: string | null
          empresa_id?: string
          fecha_mes?: string
          id?: string
          precio_energia_p1?: number | null
          precio_energia_p2?: number | null
          precio_energia_p3?: number | null
          precio_energia_p4?: number | null
          precio_energia_p5?: number | null
          precio_energia_p6?: number | null
          tarifa?: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Relationships: [
          {
            foreignKeyName: "precios_energia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_potencia: {
        Row: {
          año: number
          creado_en: string | null
          empresa_id: string
          id: string
          precio_potencia_p1: number | null
          precio_potencia_p2: number | null
          precio_potencia_p3: number | null
          precio_potencia_p4: number | null
          precio_potencia_p5: number | null
          precio_potencia_p6: number | null
          tarifa: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Insert: {
          año: number
          creado_en?: string | null
          empresa_id: string
          id?: string
          precio_potencia_p1?: number | null
          precio_potencia_p2?: number | null
          precio_potencia_p3?: number | null
          precio_potencia_p4?: number | null
          precio_potencia_p5?: number | null
          precio_potencia_p6?: number | null
          tarifa: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Update: {
          año?: number
          creado_en?: string | null
          empresa_id?: string
          id?: string
          precio_potencia_p1?: number | null
          precio_potencia_p2?: number | null
          precio_potencia_p3?: number | null
          precio_potencia_p4?: number | null
          precio_potencia_p5?: number | null
          precio_potencia_p6?: number | null
          tarifa?: Database["public"]["Enums"]["tarifa_electrica"]
        }
        Relationships: [
          {
            foreignKeyName: "precios_potencia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_suministro: {
        Row: {
          cliente_id: string
          consumo_anual_kwh: number | null
          creado_en: string | null
          creado_por: string | null
          cups: string
          current_comercializadora_id: string | null
          direccion_fisc: string | null
          direccion_post: string | null
          direccion_sum: string
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_punto"]
          fv_compensacion: Database["public"]["Enums"]["estado_fv"] | null
          id: string
          localidad_fisc: string | null
          localidad_post: string | null
          localidad_sum: string | null
          modificado_en: string | null
          modificado_por: string | null
          p1_kw: number | null
          p2_kw: number | null
          p3_kw: number | null
          p4_kw: number | null
          p5_kw: number | null
          p6_kw: number | null
          provincia_fisc: string | null
          provincia_post: string | null
          provincia_sum: string | null
          tarifa: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv: boolean | null
          tipo_factura: Database["public"]["Enums"]["tipo_factura_enum"] | null
          version: number
        }
        Insert: {
          cliente_id: string
          consumo_anual_kwh?: number | null
          creado_en?: string | null
          creado_por?: string | null
          cups: string
          current_comercializadora_id?: string | null
          direccion_fisc?: string | null
          direccion_post?: string | null
          direccion_sum?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"]
          fv_compensacion?: Database["public"]["Enums"]["estado_fv"] | null
          id?: string
          localidad_fisc?: string | null
          localidad_post?: string | null
          localidad_sum?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          p1_kw?: number | null
          p2_kw?: number | null
          p3_kw?: number | null
          p4_kw?: number | null
          p5_kw?: number | null
          p6_kw?: number | null
          provincia_fisc?: string | null
          provincia_post?: string | null
          provincia_sum?: string | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv?: boolean | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
          version?: number
        }
        Update: {
          cliente_id?: string
          consumo_anual_kwh?: number | null
          creado_en?: string | null
          creado_por?: string | null
          cups?: string
          current_comercializadora_id?: string | null
          direccion_fisc?: string | null
          direccion_post?: string | null
          direccion_sum?: string
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"]
          fv_compensacion?: Database["public"]["Enums"]["estado_fv"] | null
          id?: string
          localidad_fisc?: string | null
          localidad_post?: string | null
          localidad_sum?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          p1_kw?: number | null
          p2_kw?: number | null
          p3_kw?: number | null
          p4_kw?: number | null
          p5_kw?: number | null
          p6_kw?: number | null
          provincia_fisc?: string | null
          provincia_post?: string | null
          provincia_sum?: string | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv?: boolean | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "puntos_current_comerc_fkey"
            columns: ["current_comercializadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
        ]
      }
      remesas: {
        Row: {
          creada_en: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          empresa_id: string
          estado: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          total_eur: number | null
        }
        Insert: {
          creada_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id: string
          estado?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          total_eur?: number | null
        }
        Update: {
          creada_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id?: string
          estado?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          total_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_eliminacion: {
        Row: {
          anonimizado_por: string | null
          creado_en: string
          estado: string
          fecha_anonimizado_parcial: string | null
          fecha_anonimizado_total: string | null
          fecha_puede_anonimizar_total: string | null
          fecha_ultima_factura: string | null
          id: string
          modificado_en: string | null
          motivo: string | null
          notas: string | null
          puede_anonimizar_ahora: boolean | null
          referencia_nombre: string | null
          solicitado_en: string | null
          solicitado_por: string | null
          tiene_contratos_activos: boolean | null
          tiene_deudas_pendientes: boolean | null
          tiene_facturas_recientes: boolean | null
          tipo_usuario: string | null
          usuario_id: string | null
          verificado_en: string | null
          verificado_por: string | null
        }
        Insert: {
          anonimizado_por?: string | null
          creado_en?: string
          estado?: string
          fecha_anonimizado_parcial?: string | null
          fecha_anonimizado_total?: string | null
          fecha_puede_anonimizar_total?: string | null
          fecha_ultima_factura?: string | null
          id?: string
          modificado_en?: string | null
          motivo?: string | null
          notas?: string | null
          puede_anonimizar_ahora?: boolean | null
          referencia_nombre?: string | null
          solicitado_en?: string | null
          solicitado_por?: string | null
          tiene_contratos_activos?: boolean | null
          tiene_deudas_pendientes?: boolean | null
          tiene_facturas_recientes?: boolean | null
          tipo_usuario?: string | null
          usuario_id?: string | null
          verificado_en?: string | null
          verificado_por?: string | null
        }
        Update: {
          anonimizado_por?: string | null
          creado_en?: string
          estado?: string
          fecha_anonimizado_parcial?: string | null
          fecha_anonimizado_total?: string | null
          fecha_puede_anonimizar_total?: string | null
          fecha_ultima_factura?: string | null
          id?: string
          modificado_en?: string | null
          motivo?: string | null
          notas?: string | null
          puede_anonimizar_ahora?: boolean | null
          referencia_nombre?: string | null
          solicitado_en?: string | null
          solicitado_por?: string | null
          tiene_contratos_activos?: boolean | null
          tiene_deudas_pendientes?: boolean | null
          tiene_facturas_recientes?: boolean | null
          tipo_usuario?: string | null
          usuario_id?: string | null
          verificado_en?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      tarifas: {
        Row: {
          creada_en: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          empresa_id: string
          energia: Database["public"]["Enums"]["tipo_energia"]
          id: string
          modificado_en: string | null
          modificado_por: string | null
          oferta: string | null
          precio_unitario: number | null
          tarifa: Database["public"]["Enums"]["tipo_tarifa"] | null
        }
        Insert: {
          creada_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id: string
          energia: Database["public"]["Enums"]["tipo_energia"]
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          oferta?: string | null
          precio_unitario?: number | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
        }
        Update: {
          creada_en?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id?: string
          energia?: Database["public"]["Enums"]["tipo_energia"]
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          oferta?: string | null
          precio_unitario?: number | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_app: {
        Row: {
          activo: boolean
          apellidos: string | null
          avatar_url: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          empresa_id: string
          forzar_cambio_password: boolean | null
          modificado_en: string | null
          modificado_por: string | null
          nombre: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          theme_preference: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id: string
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          theme_preference?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id?: string
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          theme_preference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_app_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vacaciones: {
        Row: {
          creado_en: string | null
          creado_por: string | null
          descripcion: string | null
          dias_totales: number | null
          eliminado_en: string | null
          eliminado_por: string | null
          empresa_id: string
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          modificado_en: string | null
          modificado_por: string | null
          user_id: string | null
        }
        Insert: {
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          dias_totales?: number | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id: string
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          user_id?: string | null
        }
        Update: {
          creado_en?: string | null
          creado_por?: string | null
          descripcion?: string | null
          dias_totales?: number | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          empresa_id?: string
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_clientes_activos: {
        Row: {
          cif: string | null
          creado_en: string | null
          creado_por: string | null
          dni: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string | null
          modificado_en: string | null
          modificado_por: string | null
          nombre: string | null
          numero_cuenta: string | null
          representante: string | null
          telefonos: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Insert: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Update: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Relationships: []
      }
      v_clientes_resumen: {
        Row: {
          cif: string | null
          creado_en: string | null
          creado_por: string | null
          dni: string | null
          email: string | null
          id: string | null
          modificado_en: string | null
          nombre: string | null
          numero_cuenta: string | null
          representante: string | null
          telefonos: string | null
          tiene_datos_cifrados: boolean | null
          tipo: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Insert: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          email?: string | null
          id?: string | null
          modificado_en?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tiene_datos_cifrados?: never
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Update: {
          cif?: string | null
          creado_en?: string | null
          creado_por?: string | null
          dni?: string | null
          email?: string | null
          id?: string | null
          modificado_en?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          representante?: string | null
          telefonos?: string | null
          tiene_datos_cifrados?: never
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Relationships: []
      }
      v_contratos_activos: {
        Row: {
          aviso_renovacion: boolean | null
          canal_id: string | null
          cobrado: boolean | null
          comercializadora_id: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_contrato"] | null
          fecha_aceptacion: string | null
          fecha_activacion: string | null
          fecha_aviso: string | null
          fecha_baja: string | null
          fecha_firma: string | null
          fecha_permanencia: string | null
          fecha_renovacion: string | null
          fotovoltaica:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id: string | null
          modificado_en: string | null
          modificado_por: string | null
          numero_cuenta: string | null
          permanencia: boolean | null
          punto_id: string | null
        }
        Insert: {
          aviso_renovacion?: boolean | null
          canal_id?: string | null
          cobrado?: boolean | null
          comercializadora_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_contrato"] | null
          fecha_aceptacion?: string | null
          fecha_activacion?: string | null
          fecha_aviso?: string | null
          fecha_baja?: string | null
          fecha_firma?: string | null
          fecha_permanencia?: string | null
          fecha_renovacion?: string | null
          fotovoltaica?:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          numero_cuenta?: string | null
          permanencia?: boolean | null
          punto_id?: string | null
        }
        Update: {
          aviso_renovacion?: boolean | null
          canal_id?: string | null
          cobrado?: boolean | null
          comercializadora_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_contrato"] | null
          fecha_aceptacion?: string | null
          fecha_activacion?: string | null
          fecha_aviso?: string | null
          fecha_baja?: string | null
          fecha_firma?: string | null
          fecha_permanencia?: string | null
          fecha_renovacion?: string | null
          fotovoltaica?:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          numero_cuenta?: string | null
          permanencia?: boolean | null
          punto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_comercializadora_id_fkey"
            columns: ["comercializadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_documentos_activos: {
        Row: {
          cliente_id: string | null
          contrato_id: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          factura_id: string | null
          id: string | null
          mime_type: string | null
          modificado_en: string | null
          modificado_por: string | null
          nombre_archivo: string | null
          punto_id: string | null
          ruta_storage: string | null
          subido_en: string | null
          subido_por_user_id: string | null
          tamano_bytes: number | null
          tipo: string | null
          visible_para_cliente: boolean | null
        }
        Insert: {
          cliente_id?: string | null
          contrato_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_id?: string | null
          id?: string | null
          mime_type?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre_archivo?: string | null
          punto_id?: string | null
          ruta_storage?: string | null
          subido_en?: string | null
          subido_por_user_id?: string | null
          tamano_bytes?: number | null
          tipo?: string | null
          visible_para_cliente?: boolean | null
        }
        Update: {
          cliente_id?: string | null
          contrato_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          factura_id?: string | null
          id?: string | null
          mime_type?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre_archivo?: string | null
          punto_id?: string | null
          ruta_storage?: string | null
          subido_en?: string | null
          subido_por_user_id?: string | null
          tamano_bytes?: number | null
          tipo?: string | null
          visible_para_cliente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "v_contratos_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "v_facturas_activas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_suministro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "v_puntos_suministro_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios_app"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_activos"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documentos_subido_por_user_id_fkey"
            columns: ["subido_por_user_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios_app_activos"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_facturas_activas: {
        Row: {
          cliente_id: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_factura"] | null
          fecha_emision: string | null
          id: string | null
          modificado_en: string | null
          modificado_por: string | null
          moneda: string | null
          numero: string | null
          remesa_id: string | null
          total_eur: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"] | null
          fecha_emision?: string | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          moneda?: string | null
          numero?: string | null
          remesa_id?: string | null
          total_eur?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_factura"] | null
          fecha_emision?: string | null
          id?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          moneda?: string | null
          numero?: string | null
          remesa_id?: string | null
          total_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_remesa_id_fkey"
            columns: ["remesa_id"]
            isOneToOne: false
            referencedRelation: "remesas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_puntos_suministro_activos: {
        Row: {
          cliente_id: string | null
          consumo_anual_kwh: number | null
          creado_en: string | null
          creado_por: string | null
          cups: string | null
          current_comercializadora_id: string | null
          direccion_fisc: string | null
          direccion_sum: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_punto"] | null
          fv_compensacion: Database["public"]["Enums"]["estado_fv"] | null
          id: string | null
          localidad_fisc: string | null
          localidad_sum: string | null
          modificado_en: string | null
          modificado_por: string | null
          p1_kw: number | null
          p2_kw: number | null
          p3_kw: number | null
          p4_kw: number | null
          p5_kw: number | null
          p6_kw: number | null
          provincia_fisc: string | null
          provincia_sum: string | null
          tarifa: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv: boolean | null
          tipo_factura: Database["public"]["Enums"]["tipo_factura_enum"] | null
        }
        Insert: {
          cliente_id?: string | null
          consumo_anual_kwh?: number | null
          creado_en?: string | null
          creado_por?: string | null
          cups?: string | null
          current_comercializadora_id?: string | null
          direccion_fisc?: string | null
          direccion_sum?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"] | null
          fv_compensacion?: Database["public"]["Enums"]["estado_fv"] | null
          id?: string | null
          localidad_fisc?: string | null
          localidad_sum?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          p1_kw?: number | null
          p2_kw?: number | null
          p3_kw?: number | null
          p4_kw?: number | null
          p5_kw?: number | null
          p6_kw?: number | null
          provincia_fisc?: string | null
          provincia_sum?: string | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv?: boolean | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
        }
        Update: {
          cliente_id?: string | null
          consumo_anual_kwh?: number | null
          creado_en?: string | null
          creado_por?: string | null
          cups?: string | null
          current_comercializadora_id?: string | null
          direccion_fisc?: string | null
          direccion_sum?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_punto"] | null
          fv_compensacion?: Database["public"]["Enums"]["estado_fv"] | null
          id?: string | null
          localidad_fisc?: string | null
          localidad_sum?: string | null
          modificado_en?: string | null
          modificado_por?: string | null
          p1_kw?: number | null
          p2_kw?: number | null
          p3_kw?: number | null
          p4_kw?: number | null
          p5_kw?: number | null
          p6_kw?: number | null
          provincia_fisc?: string | null
          provincia_sum?: string | null
          tarifa?: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv?: boolean | null
          tipo_factura?: Database["public"]["Enums"]["tipo_factura_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "puntos_current_comerc_fkey"
            columns: ["current_comercializadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clientes_resumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_suministro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vista_clientes_seguros"
            referencedColumns: ["id"]
          },
        ]
      }
      v_usuarios_activos: {
        Row: {
          avatar_url: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          empresa_id: string | null
          forzar_cambio_password: boolean | null
          modificado_en: string | null
          modificado_por: string | null
          nombre: string | null
          rol: Database["public"]["Enums"]["rol_usuario"] | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id?: string | null
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id?: string | null
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_app_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_usuarios_app_activos: {
        Row: {
          activo: boolean | null
          apellidos: string | null
          avatar_url: string | null
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          empresa_id: string | null
          forzar_cambio_password: boolean | null
          modificado_en: string | null
          modificado_por: string | null
          nombre: string | null
          rol: Database["public"]["Enums"]["rol_usuario"] | null
          telefono: string | null
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id?: string | null
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telefono?: string | null
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          apellidos?: string | null
          avatar_url?: string | null
          creado_en?: string | null
          creado_por?: string | null
          eliminado_en?: string | null
          eliminado_por?: string | null
          email?: string | null
          empresa_id?: string | null
          forzar_cambio_password?: boolean | null
          modificado_en?: string | null
          modificado_por?: string | null
          nombre?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telefono?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_app_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vista_clientes_seguros: {
        Row: {
          cif: string | null
          creado_en: string | null
          dni: string | null
          email: string | null
          id: string | null
          is_deleted: boolean | null
          nombre: string | null
          numero_cuenta_masked: string | null
          representante: string | null
          telefonos: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Insert: {
          cif?: never
          creado_en?: string | null
          dni?: never
          email?: never
          id?: string | null
          is_deleted?: never
          nombre?: string | null
          numero_cuenta_masked?: string | null
          representante?: string | null
          telefonos?: never
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Update: {
          cif?: never
          creado_en?: string | null
          dni?: never
          email?: never
          id?: string | null
          is_deleted?: never
          nombre?: string | null
          numero_cuenta_masked?: string | null
          representante?: string | null
          telefonos?: never
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
        }
        Relationships: []
      }
      vista_cron_jobs: {
        Row: {
          command: string | null
          estado: string | null
          jobid: number | null
          jobname: string | null
          schedule: string | null
          ultima_ejecucion: string | null
          ultimo_estado: string | null
        }
        Insert: {
          command?: string | null
          estado?: never
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
          ultima_ejecucion?: never
          ultimo_estado?: never
        }
        Update: {
          command?: string | null
          estado?: never
          jobid?: number | null
          jobname?: string | null
          schedule?: string | null
          ultima_ejecucion?: never
          ultimo_estado?: never
        }
        Relationships: []
      }
      vista_solicitudes_eliminacion: {
        Row: {
          anonimizado_por_email: string | null
          estado: string | null
          fecha_anonimizado_parcial: string | null
          fecha_anonimizado_total: string | null
          fecha_puede_anonimizar_total: string | null
          id: string | null
          notas: string | null
          puede_anonimizar_ahora: boolean | null
          referencia_nombre: string | null
          solicitado_en: string | null
          tiene_contratos_activos: boolean | null
          tiene_deudas_pendientes: boolean | null
          tiene_facturas_recientes: boolean | null
          tipo_usuario: string | null
          usuario_id: string | null
          verificado_por_email: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_disable_user_mfa: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      anonimizar_cliente_parcial: {
        Args: { p_cliente_id: string; p_solicitud_id?: string }
        Returns: Json
      }
      anonimizar_cliente_total: {
        Args: {
          p_cliente_id: string
          p_confirmar?: boolean
          p_solicitud_id?: string
        }
        Returns: Json
      }
      anonimizar_comercial: {
        Args: { p_solicitud_id?: string; p_usuario_id: string }
        Returns: Json
      }
      belongs_to_empresa: { Args: { eid: string }; Returns: boolean }
      can_access_cliente: { Args: { id_cliente: string }; Returns: boolean }
      can_access_contrato: { Args: { coid: string }; Returns: boolean }
      can_access_factura: { Args: { fid: string }; Returns: boolean }
      can_access_punto: { Args: { pid: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_max_requests?: number
          p_operation: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      crear_solicitud_eliminacion: {
        Args: {
          p_metodo?: string
          p_motivo?: string
          p_sujeto_id: string
          p_tipo_sujeto: string
        }
        Returns: Json
      }
      cron_check_password_age: { Args: never; Returns: Json }
      cron_cleanup_audit_logs: { Args: never; Returns: Json }
      cron_cleanup_rate_limit: { Args: never; Returns: Json }
      cron_daily_integrity_check: { Args: never; Returns: Json }
      cron_procesar_gdpr: { Args: never; Returns: Json }
      cron_unlock_expired_accounts: { Args: never; Returns: Json }
      cron_weekly_activity_report: { Args: never; Returns: Json }
      current_user_empresa_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      delete_contrato: {
        Args: { contrato_id_to_delete: string }
        Returns: Json
      }
      delete_punto_suministro: {
        Args: { punto_id_to_delete: string }
        Returns: Json
      }
      ejecutar_cron_job: { Args: { p_job_name: string }; Returns: Json }
      eliminar_dato_sensible: {
        Args: { p_campo?: string; p_entidad_id: string; p_entidad_tipo: string }
        Returns: number
      }
      existe_dato_sensible: {
        Args: { p_campo: string; p_entidad_id: string; p_entidad_tipo: string }
        Returns: boolean
      }
      exportar_datos_cliente: { Args: { p_cliente_id: string }; Returns: Json }
      facturacion_aggregate: {
        Args: {
          cliente_ids?: string[]
          comercializadora_ids?: string[]
          fecha_desde?: string
          fecha_hasta?: string
          group_by_key?: string
          metrics?: Json
          provincia_vals?: string[]
          punto_ids?: string[]
          tarifa_vals?: string[]
          tipo_factura_val?: string
          top_n?: number
        }
        Returns: Json
      }
      get_agenda_items: {
        Args: { fecha_query_fin: string; fecha_query_inicio: string }
        Returns: {
          color: string | null
          creado_en: string | null
          creado_por_email: string | null
          creado_por_nombre: string | null
          empresa_id: string
          etiqueta: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          titulo: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "agenda_eventos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_all_root_documents: {
        Args: never
        Returns: {
          cliente_id: string
          cliente_nombre: string
          full_path: string
          is_folder: boolean
          item_name: string
          visible_para_cliente: boolean
        }[]
      }
      get_analytics_filters: { Args: never; Returns: Json }
      get_contratos_dates: { Args: never; Returns: Json }
      get_factura_cliente_storage_path: {
        Args: { p_comercializadora_id: string; p_numero_factura: string }
        Returns: string
      }
      get_factura_cliente_storage_url: {
        Args: { p_comercializadora_id: string; p_numero_factura: string }
        Returns: string
      }
      get_gas_aggregated_stats: {
        Args: { p_days?: number; p_end_date?: string }
        Returns: {
          fecha_fin: string
          fecha_inicio: string
          fecha_max: string
          fecha_min: string
          num_dias: number
          pvb_avg: number
          pvb_max: number
          pvb_min: number
          pvb_std: number
        }[]
      }
      get_gas_chart_data: {
        Args: { p_days?: number; p_end_date?: string }
        Returns: {
          fecha: string
          pvb_price: number
          vtp_price: number
        }[]
      }
      get_gas_indicators: {
        Args: { p_date?: string }
        Returns: {
          change_pct: number
          country: string
          hub: string
          indicator_code: string
          indicator_name: string
          price_eur_mwh: number
          reference_price: number
          trade_date: string
        }[]
      }
      get_gas_summary: {
        Args: { p_date?: string }
        Returns: {
          fecha: string
          pvb_avg: number
          pvb_change_pct: number
          pvb_price: number
          pvb_yesterday: number
          vtp_price: number
        }[]
      }
      get_informe_facturacion_data: {
        Args: {
          p_cliente_ids: string[]
          p_fecha_fin: string
          p_fecha_inicio: string
          p_punto_ids: string[]
        }
        Returns: Json
      }
      get_informe_market_data: {
        Args: {
          p_fecha_fin: string
          p_fecha_inicio: string
          p_indicator_ids?: number[]
        }
        Returns: Json
      }
      get_my_empresa_id: { Args: never; Returns: string }
      get_puntos_filters_values: {
        Args: { p_cliente_id?: string }
        Returns: Json
      }
      get_storage_statistics: { Args: never; Returns: Json }
      guardar_dato_sensible: {
        Args: {
          p_campo: string
          p_entidad_id: string
          p_entidad_tipo: string
          p_valor: string
        }
        Returns: boolean
      }
      handle_failed_login: {
        Args: { p_email: string; p_ip_address?: unknown }
        Returns: Json
      }
      handle_successful_login: {
        Args: { p_ip_address?: unknown }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_valid_uuid: { Args: { uuid_text: string }; Returns: boolean }
      limpiar_datos_cifrados_cliente: {
        Args: { p_cliente_id: string }
        Returns: number
      }
      log_user_deletion_event: {
        Args: {
          p_deleted_by: string
          p_deleted_user_id: string
          p_original_email: string
          p_original_rol: string
        }
        Returns: undefined
      }
      normalize_empresa_name: { Args: { nombre: string }; Returns: string }
      obtener_campo_cliente: {
        Args: { p_campo: string; p_cliente_id: string }
        Returns: string
      }
      obtener_cliente_completo: {
        Args: { p_cliente_id: string }
        Returns: Json
      }
      obtener_clientes_completos: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      obtener_dato_sensible: {
        Args: { p_campo: string; p_entidad_id: string; p_entidad_tipo: string }
        Returns: string
      }
      obtener_datos_sensibles_entidad: {
        Args: { p_entidad_id: string; p_entidad_tipo: string }
        Returns: Json
      }
      procesar_anonimizaciones_pendientes: { Args: never; Returns: Json }
      procesar_solicitud_eliminacion_gdpr: {
        Args: { p_accion: string; p_solicitud_id: string }
        Returns: Json
      }
      recompute_current_comercializadora: {
        Args: { p_punto_id: string }
        Returns: undefined
      }
      refresh_all_current_comercializadoras: { Args: never; Returns: undefined }
      request_password_change: { Args: never; Returns: Json }
      restaurar_registro_eliminado: {
        Args: { p_id: string; p_motivo?: string; p_tabla: string }
        Returns: Json
      }
      search_clientes: {
        Args: { search_text: string }
        Returns: {
          cif: string | null
          creado_en: string | null
          creado_por: string | null
          dni: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          email: string | null
          id: string
          modificado_en: string | null
          modificado_por: string | null
          nombre: string
          numero_cuenta: string | null
          representante: string | null
          telefonos: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_contratos: {
        Args: { p_cliente_id?: string; search_text: string }
        Returns: {
          aviso_renovacion: boolean
          canal_id: string | null
          cobrado: boolean | null
          comercializadora_id: string
          creado_en: string | null
          creado_por: string | null
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_contrato"]
          fecha_aceptacion: string | null
          fecha_activacion: string | null
          fecha_aviso: string | null
          fecha_baja: string | null
          fecha_firma: string | null
          fecha_permanencia: string | null
          fecha_renovacion: string | null
          fotovoltaica:
          | Database["public"]["Enums"]["estado_fotovoltaica"]
          | null
          id: string
          modificado_en: string | null
          modificado_por: string | null
          numero_cuenta: string | null
          permanencia: boolean | null
          punto_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contratos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_puntos_suministro:
      | {
        Args: {
          cliente_ids?: string[]
          limit_count?: number
          search_text: string
        }
        Returns: {
          cliente_id: string
          cliente_nombre: string
          cups: string
          direccion_sum: string
          has_facturas: boolean
          id: string
          localidad_sum: string
          provincia_sum: string
        }[]
      }
      | {
        Args: { p_cliente_id?: string; search_text: string }
        Returns: {
          cliente_id: string
          consumo_anual_kwh: number | null
          creado_en: string | null
          creado_por: string | null
          cups: string
          current_comercializadora_id: string | null
          direccion_fisc: string | null
          direccion_post: string | null
          direccion_sum: string
          eliminado_en: string | null
          eliminado_por: string | null
          estado: Database["public"]["Enums"]["estado_punto"]
          fv_compensacion: Database["public"]["Enums"]["estado_fv"] | null
          id: string
          localidad_fisc: string | null
          localidad_post: string | null
          localidad_sum: string | null
          modificado_en: string | null
          modificado_por: string | null
          p1_kw: number | null
          p2_kw: number | null
          p3_kw: number | null
          p4_kw: number | null
          p5_kw: number | null
          p6_kw: number | null
          provincia_fisc: string | null
          provincia_post: string | null
          provincia_sum: string | null
          tarifa: Database["public"]["Enums"]["tipo_tarifa"] | null
          tiene_fv: boolean | null
          tipo_factura:
          | Database["public"]["Enums"]["tipo_factura_enum"]
          | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "puntos_suministro"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_folder_visibility: {
        Args: {
          p_cliente_id: string
          p_folder_path: string
          p_is_visible: boolean
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      validate_file_upload: {
        Args: {
          p_bucket_name: string
          p_file_name: string
          p_file_size: number
          p_mime_type: string
        }
        Returns: Json
      }
      verificar_puede_eliminar_cliente: {
        Args: { p_cliente_id: string }
        Returns: Json
      }
      verify_rls_compliance: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          rls_forced: boolean
          status: string
          table_name: string
        }[]
      }
      verify_storage_integrity: {
        Args: { p_bucket_name?: string }
        Returns: {
          documento_id: string
          issue: string
          ruta_storage: string
          status: string
        }[]
      }
    }
    Enums: {
      entidad_tipo_log:
      | "cliente"
      | "punto"
      | "contrato"
      | "documento"
      | "factura"
      | "factura_cliente"
      estado_contrato:
      | "Aceptado"
      | "En curso"
      | "Bloqueado"
      | "Pendiente Doc."
      | "Pendiente firma"
      | "Firmado"
      | "Contratado"
      | "Pendiente renovacion"
      | "Baja"
      | "Standby"
      | "Desiste"
      estado_factura: "borrador" | "emitida" | "pagada" | "anulada"
      estado_fotovoltaica:
      | "Pendiente de instalar"
      | "Activa"
      | "Pendiente de activar"
      | "Duda"
      | "No"
      estado_fv: "activa" | "no" | "pendiente"
      estado_punto:
      | "Nueva Oportunidad"
      | "Solicitar Doc."
      | "Doc. OK"
      | "Estudio enviado"
      | "Aceptado"
      | "Permanencia"
      | "Standby"
      | "Desiste"
      rol_usuario: "administrador" | "comercial" | "cliente"
      tarifa_electrica: "2.0TD" | "3.0TD" | "6.1TD"
      tipo_cliente: "Persona fisica" | "Persona juridica"
      tipo_documento: "factura" | "contrato" | "otro"
      tipo_empresa: "comercializadora" | "openenergies"
      tipo_energia: "luz" | "gas"
      tipo_energia_informe: "electricidad" | "gas" | "ambos"
      tipo_evento_log: "creacion" | "edicion" | "eliminacion" | "nota_manual"
      tipo_factura_enum: "Luz" | "Gas"
      tipo_informe_mercado: "auditoria" | "mercado" | "seguimiento"
      tipo_tarifa:
      | "2.0TD"
      | "3.0TD"
      | "6.1TD"
      | "RL.1"
      | "RL.2"
      | "RL.3"
      | "RL.4"
      | "RL.5"
      | "RL.6"
      | "RL.7"
      | "RL.8"
      | "RL.9"
      | "RL.10"
      | "RL.11"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      entidad_tipo_log: [
        "cliente",
        "punto",
        "contrato",
        "documento",
        "factura",
        "factura_cliente",
      ],
      estado_contrato: [
        "Aceptado",
        "En curso",
        "Bloqueado",
        "Pendiente Doc.",
        "Pendiente firma",
        "Firmado",
        "Contratado",
        "Pendiente renovacion",
        "Baja",
        "Standby",
        "Desiste",
      ],
      estado_factura: ["borrador", "emitida", "pagada", "anulada"],
      estado_fotovoltaica: [
        "Pendiente de instalar",
        "Activa",
        "Pendiente de activar",
        "Duda",
        "No",
      ],
      estado_fv: ["activa", "no", "pendiente"],
      estado_punto: [
        "Nueva Oportunidad",
        "Solicitar Doc.",
        "Doc. OK",
        "Estudio enviado",
        "Aceptado",
        "Permanencia",
        "Standby",
        "Desiste",
      ],
      rol_usuario: ["administrador", "comercial", "cliente"],
      tarifa_electrica: ["2.0TD", "3.0TD", "6.1TD"],
      tipo_cliente: ["Persona fisica", "Persona juridica"],
      tipo_documento: ["factura", "contrato", "otro"],
      tipo_empresa: ["comercializadora", "openenergies"],
      tipo_energia: ["luz", "gas"],
      tipo_energia_informe: ["electricidad", "gas", "ambos"],
      tipo_evento_log: ["creacion", "edicion", "eliminacion", "nota_manual"],
      tipo_factura_enum: ["Luz", "Gas"],
      tipo_informe_mercado: ["auditoria", "mercado", "seguimiento"],
      tipo_tarifa: [
        "2.0TD",
        "3.0TD",
        "6.1TD",
        "RL.1",
        "RL.2",
        "RL.3",
        "RL.4",
        "RL.5",
        "RL.6",
        "RL.7",
        "RL.8",
        "RL.9",
        "RL.10",
        "RL.11",
      ],
    },
  },
} as const

export type UUID = string
export type UsuarioApp = Database['public']['Tables']['usuarios_app']['Row']
export type RolUsuario = Database['public']['Enums']['rol_usuario']
