-- ============================================================================
-- 001_crear_tipos_enum.sql
-- Sistema de Auditoría y Actividad - Tipos ENUM
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Tipo de evento de auditoría
-- creacion: Registro nuevo creado
-- edicion: Registro modificado
-- eliminacion: Registro eliminado (soft delete o hard delete)
-- nota_manual: Nota añadida manualmente por un usuario
DO $$ BEGIN
    CREATE TYPE tipo_evento_log AS ENUM (
        'creacion',
        'edicion',
        'eliminacion',
        'nota_manual'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de entidad afectada
-- Mapea las tablas principales del CRM que serán auditadas
DO $$ BEGIN
    CREATE TYPE entidad_tipo_log AS ENUM (
        'cliente',
        'punto',
        'contrato',
        'documento',
        'factura',
        'factura_cliente'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Comentarios para documentación
COMMENT ON TYPE tipo_evento_log IS 'Tipos de eventos capturados en el log de actividad';
COMMENT ON TYPE entidad_tipo_log IS 'Tipos de entidades/tablas que generan eventos de auditoría';
