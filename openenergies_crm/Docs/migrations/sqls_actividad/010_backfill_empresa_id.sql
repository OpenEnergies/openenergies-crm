-- ============================================================================
-- 010_backfill_empresa_id.sql
-- Sistema de Auditoría y Actividad - Backfill empresa_id
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-21
-- ============================================================================

-- Backfill empresa_id para registros existentes basado en el tipo de entidad

-- 1. Actualizar desde contratos directamente
UPDATE actividad_log al
SET empresa_id = c.comercializadora_id
FROM contratos c
WHERE al.entidad_tipo = 'contrato'
  AND al.entidad_id = c.id
  AND al.empresa_id IS NULL;

-- 2. Actualizar desde puntos directamente
UPDATE actividad_log al
SET empresa_id = ps.current_comercializadora_id
FROM puntos_suministro ps
WHERE al.entidad_tipo = 'punto'
  AND al.entidad_id = ps.id
  AND al.empresa_id IS NULL;

-- 3. Actualizar desde facturas_clientes directamente
UPDATE actividad_log al
SET empresa_id = fc.comercializadora_id
FROM facturacion_clientes fc
WHERE al.entidad_tipo = 'factura_cliente'
  AND al.entidad_id = fc.id
  AND al.empresa_id IS NULL;

-- 4. Actualizar desde contrato_id (para documentos y otros con contrato_id)
UPDATE actividad_log al
SET empresa_id = c.comercializadora_id
FROM contratos c
WHERE al.contrato_id IS NOT NULL
  AND al.contrato_id = c.id
  AND al.empresa_id IS NULL;

-- 5. Actualizar desde punto_id (para documentos y otros con punto_id)
UPDATE actividad_log al
SET empresa_id = ps.current_comercializadora_id
FROM puntos_suministro ps
WHERE al.punto_id IS NOT NULL
  AND al.punto_id = ps.id
  AND al.empresa_id IS NULL;

-- Verificar resultados
DO $$
DECLARE
    v_total_records BIGINT;
    v_with_empresa BIGINT;
    v_without_empresa BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total_records FROM actividad_log;
    SELECT COUNT(*) INTO v_with_empresa FROM actividad_log WHERE empresa_id IS NOT NULL;
    SELECT COUNT(*) INTO v_without_empresa FROM actividad_log WHERE empresa_id IS NULL;
    
    RAISE NOTICE 'Backfill completado:';
    RAISE NOTICE '  Total registros: %', v_total_records;
    RAISE NOTICE '  Con empresa_id: % (%.1f%%)', v_with_empresa, (v_with_empresa::FLOAT / NULLIF(v_total_records, 0)) * 100;
    RAISE NOTICE '  Sin empresa_id: % (%.1f%%)', v_without_empresa, (v_without_empresa::FLOAT / NULLIF(v_total_records, 0)) * 100;
END $$;
