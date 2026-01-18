-- ============================================================================
-- 002_crear_tabla_actividad_log.sql
-- Sistema de Auditoría y Actividad - Tabla Principal
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Tabla centralizada de actividad y auditoría
CREATE TABLE IF NOT EXISTS actividad_log (
    -- Identificador único del evento
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relación con cliente (nullable para eventos globales o cuando el cliente no aplica)
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    
    -- Usuario que generó el evento (obligatorio)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de evento
    tipo_evento tipo_evento_log NOT NULL,
    
    -- Tipo de entidad afectada
    entidad_tipo entidad_tipo_log NOT NULL,
    
    -- ID del registro afectado (referencia genérica, no FK)
    entidad_id UUID NOT NULL,
    
    -- Detalles del cambio en formato JSON
    -- Para creación: { "new": {...} }
    -- Para edición: { "old": {...}, "new": {...} }
    -- Para eliminación: { "old": {...} }
    -- Para nota_manual: null
    detalles_json JSONB,
    
    -- Contenido de la nota (solo para tipo_evento = 'nota_manual')
    contenido_nota TEXT,
    
    -- Metadata del usuario denormalizada para evitar joins pesados
    -- Estructura: { "nombre": "...", "email": "...", "apellidos": "..." }
    metadata_usuario JSONB,
    
    -- Timestamp del evento
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraint: contenido_nota solo puede tener valor si tipo_evento es nota_manual
    CONSTRAINT chk_nota_solo_manual CHECK (
        (tipo_evento = 'nota_manual' AND contenido_nota IS NOT NULL) OR
        (tipo_evento != 'nota_manual' AND contenido_nota IS NULL)
    )
);

-- Habilitar RLS
ALTER TABLE actividad_log ENABLE ROW LEVEL SECURITY;

-- Comentarios de documentación
COMMENT ON TABLE actividad_log IS 'Log centralizado de auditoría y actividad del CRM. Almacena eventos automáticos (creación/edición/eliminación) y notas manuales.';
COMMENT ON COLUMN actividad_log.cliente_id IS 'Cliente asociado al evento. Nullable para eventos globales.';
COMMENT ON COLUMN actividad_log.user_id IS 'Usuario que generó el evento (auth.uid()).';
COMMENT ON COLUMN actividad_log.tipo_evento IS 'Tipo de evento: creacion, edicion, eliminacion, nota_manual.';
COMMENT ON COLUMN actividad_log.entidad_tipo IS 'Tipo de entidad afectada: cliente, punto, contrato, documento, factura, factura_cliente.';
COMMENT ON COLUMN actividad_log.entidad_id IS 'UUID del registro afectado en su tabla origen.';
COMMENT ON COLUMN actividad_log.detalles_json IS 'Estado OLD/NEW del registro en formato JSONB.';
COMMENT ON COLUMN actividad_log.contenido_nota IS 'Texto de la nota manual (solo para tipo nota_manual).';
COMMENT ON COLUMN actividad_log.metadata_usuario IS 'Nombre y email del usuario denormalizados al momento del evento.';
