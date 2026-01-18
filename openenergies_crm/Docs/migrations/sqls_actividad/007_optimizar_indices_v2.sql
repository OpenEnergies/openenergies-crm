-- ============================================================================
-- 007_optimizar_indices_v2.sql
-- Sistema de Auditoría y Actividad - Índices Adicionales para Filtrado Jerárquico
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Índice compuesto para filtrado jerárquico: cliente + entidad + fecha
-- Optimiza consultas que filtran por cliente y opcionalmente por tipo de entidad
CREATE INDEX IF NOT EXISTS idx_actividad_log_cliente_entidad_fecha 
ON actividad_log(cliente_id, entidad_tipo, creado_en DESC) 
WHERE cliente_id IS NOT NULL;

-- Índice para búsquedas por punto_id dentro del detalles_json
-- Nota: Esto requiere que el punto_id esté almacenado en detalles_json
-- Para búsquedas eficientes, creamos un índice GIN parcial
CREATE INDEX IF NOT EXISTS idx_actividad_log_detalles_punto
ON actividad_log USING GIN ((detalles_json->'new'))
WHERE entidad_tipo IN ('punto', 'contrato');

-- Índice compuesto para filtrado por múltiples entidades
-- Útil cuando se filtra por cliente + lista de puntos/contratos
CREATE INDEX IF NOT EXISTS idx_actividad_log_entidad_id_tipo
ON actividad_log(entidad_id, entidad_tipo);

-- Índice para ordenamiento cronológico descendente con cliente
-- Optimiza la consulta más común: logs de un cliente ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_actividad_log_fecha_desc
ON actividad_log(creado_en DESC NULLS LAST);

-- ============================================================================
-- COLUMNAS ADICIONALES PARA FILTRADO JERÁRQUICO
-- Añadir punto_id y contrato_id denormalizados para búsquedas eficientes
-- ============================================================================

-- Columna punto_id denormalizada (nullable)
-- Permite filtrar directamente por punto sin hacer join
ALTER TABLE actividad_log 
ADD COLUMN IF NOT EXISTS punto_id UUID REFERENCES puntos_suministro(id) ON DELETE SET NULL;

-- Columna contrato_id denormalizada (nullable)
-- Permite filtrar directamente por contrato sin hacer join
ALTER TABLE actividad_log 
ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL;

-- Índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_actividad_log_punto_id 
ON actividad_log(punto_id) 
WHERE punto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actividad_log_contrato_id 
ON actividad_log(contrato_id) 
WHERE contrato_id IS NOT NULL;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON COLUMN actividad_log.punto_id IS 'ID del punto de suministro relacionado (denormalizado para filtrado eficiente)';
COMMENT ON COLUMN actividad_log.contrato_id IS 'ID del contrato relacionado (denormalizado para filtrado eficiente)';
