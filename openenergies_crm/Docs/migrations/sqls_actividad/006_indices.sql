-- ============================================================================
-- 006_indices.sql
-- Sistema de Auditoría y Actividad - Índices para Optimización
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Índice principal: cliente_id para filtrar por cliente
-- Usado en la vista de ficha de cliente
CREATE INDEX IF NOT EXISTS idx_actividad_log_cliente_id 
ON actividad_log(cliente_id) 
WHERE cliente_id IS NOT NULL;

-- Índice de fecha: para ordenar y filtrar por rango de fechas
-- Usado para paginación cronológica
CREATE INDEX IF NOT EXISTS idx_actividad_log_creado_en 
ON actividad_log(creado_en DESC);

-- Índice compuesto: cliente + fecha (más común)
-- Optimiza la consulta típica de "logs de un cliente ordenados por fecha"
CREATE INDEX IF NOT EXISTS idx_actividad_log_cliente_fecha 
ON actividad_log(cliente_id, creado_en DESC) 
WHERE cliente_id IS NOT NULL;

-- Índice de entidad: tipo + id para buscar logs de un registro específico
CREATE INDEX IF NOT EXISTS idx_actividad_log_entidad 
ON actividad_log(entidad_tipo, entidad_id);

-- Índice de usuario: para filtrar por quién hizo la acción
CREATE INDEX IF NOT EXISTS idx_actividad_log_user_id 
ON actividad_log(user_id);

-- Índice de tipo de evento: para filtrar por acción
CREATE INDEX IF NOT EXISTS idx_actividad_log_tipo_evento 
ON actividad_log(tipo_evento);

-- Índice GIN para búsqueda en detalles JSONB (opcional, para búsquedas avanzadas)
-- Comentado por defecto ya que puede ser costoso en espacio
-- CREATE INDEX IF NOT EXISTS idx_actividad_log_detalles_gin 
-- ON actividad_log USING GIN (detalles_json);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON INDEX idx_actividad_log_cliente_id IS 'Optimiza consultas filtradas por cliente_id';
COMMENT ON INDEX idx_actividad_log_creado_en IS 'Optimiza ordenamiento cronológico y paginación';
COMMENT ON INDEX idx_actividad_log_cliente_fecha IS 'Índice compuesto para consulta típica: logs de cliente ordenados por fecha';
COMMENT ON INDEX idx_actividad_log_entidad IS 'Optimiza búsqueda de logs de un registro específico';
COMMENT ON INDEX idx_actividad_log_user_id IS 'Optimiza filtrado por usuario';
COMMENT ON INDEX idx_actividad_log_tipo_evento IS 'Optimiza filtrado por tipo de evento';
