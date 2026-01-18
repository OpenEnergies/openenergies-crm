-- ============================================================================
-- 004_triggers_por_tabla.sql
-- Sistema de Auditoría y Actividad - Triggers para cada tabla
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- ============================================================================
-- TRIGGER: clientes
-- cliente_id = el propio id del cliente (direct)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_clientes ON clientes;

CREATE TRIGGER trg_actividad_clientes
    AFTER INSERT OR UPDATE OR DELETE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('cliente', 'direct');

COMMENT ON TRIGGER trg_actividad_clientes ON clientes IS 'Registra eventos de auditoría para la tabla clientes';

-- ============================================================================
-- TRIGGER: puntos_suministro
-- cliente_id = campo directo en la tabla
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_puntos ON puntos_suministro;

CREATE TRIGGER trg_actividad_puntos
    AFTER INSERT OR UPDATE OR DELETE ON puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('punto', 'direct');

COMMENT ON TRIGGER trg_actividad_puntos ON puntos_suministro IS 'Registra eventos de auditoría para la tabla puntos_suministro';

-- ============================================================================
-- TRIGGER: contratos
-- cliente_id = se obtiene via punto_id -> puntos_suministro.cliente_id
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_contratos ON contratos;

CREATE TRIGGER trg_actividad_contratos
    AFTER INSERT OR UPDATE OR DELETE ON contratos
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('contrato', 'via_punto');

COMMENT ON TRIGGER trg_actividad_contratos ON contratos IS 'Registra eventos de auditoría para la tabla contratos';

-- ============================================================================
-- TRIGGER: documentos
-- cliente_id = cascada: primero cliente_id, luego punto_id, luego contrato_id
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_documentos ON documentos;

CREATE TRIGGER trg_actividad_documentos
    AFTER INSERT OR UPDATE OR DELETE ON documentos
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('documento', 'documento_cascada');

COMMENT ON TRIGGER trg_actividad_documentos ON documentos IS 'Registra eventos de auditoría para la tabla documentos';

-- ============================================================================
-- TRIGGER: facturas
-- cliente_id = campo directo en la tabla
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_facturas ON facturas;

CREATE TRIGGER trg_actividad_facturas
    AFTER INSERT OR UPDATE OR DELETE ON facturas
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('factura', 'direct');

COMMENT ON TRIGGER trg_actividad_facturas ON facturas IS 'Registra eventos de auditoría para la tabla facturas';

-- ============================================================================
-- TRIGGER: facturacion_clientes
-- cliente_id = campo directo en la tabla
-- ============================================================================
DROP TRIGGER IF EXISTS trg_actividad_facturacion_clientes ON facturacion_clientes;

CREATE TRIGGER trg_actividad_facturacion_clientes
    AFTER INSERT OR UPDATE OR DELETE ON facturacion_clientes
    FOR EACH ROW
    EXECUTE FUNCTION fn_registrar_actividad('factura_cliente', 'direct');

COMMENT ON TRIGGER trg_actividad_facturacion_clientes ON facturacion_clientes IS 'Registra eventos de auditoría para la tabla facturacion_clientes';
