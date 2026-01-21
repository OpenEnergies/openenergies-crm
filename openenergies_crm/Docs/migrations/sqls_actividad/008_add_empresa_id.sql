-- ============================================================================
-- 008_add_empresa_id.sql
-- Sistema de Auditoría y Actividad - Añadir empresa_id
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-21
-- ============================================================================

-- Añadir columna empresa_id a la tabla actividad_log
ALTER TABLE actividad_log 
ADD COLUMN IF NOT EXISTS empresa_id UUID;

-- Añadir índice para búsquedas por empresa
CREATE INDEX IF NOT EXISTS idx_actividad_log_empresa_id 
ON actividad_log(empresa_id) 
WHERE empresa_id IS NOT NULL;

-- Índice compuesto empresa + fecha para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_actividad_log_empresa_fecha 
ON actividad_log(empresa_id, creado_en DESC) 
WHERE empresa_id IS NOT NULL;

-- Añadir foreign key constraint
ALTER TABLE actividad_log 
ADD CONSTRAINT fk_actividad_log_empresa 
FOREIGN KEY (empresa_id) 
REFERENCES empresas(id) 
ON DELETE SET NULL;

-- Comentarios
COMMENT ON COLUMN actividad_log.empresa_id IS 'ID de la empresa/comercializadora relacionada (denormalizado para filtrado eficiente)';
