-- ============================================================================
-- 003_audit_triggers.sql
-- TRIGGERS DE AUDITORÍA PARA TABLAS PRINCIPALES
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 30, ISO 27001 A.12.4.1/A.12.4.3, NIS2 Art. 21, SOC 2 CC7.2
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script crea triggers de auditoría que registran TODOS los cambios
-- (INSERT, UPDATE, DELETE) en las tablas principales del sistema.
-- Los registros se almacenan en audit.logged_actions.
--
-- IMPORTANTE: Ejecutar DESPUÉS de 001_audit_schema.sql y 002_traceability_columns.sql

BEGIN;

-- ============================================================================
-- SECCIÓN 1: VERIFICAR QUE EXISTE EL SCHEMA AUDIT
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'audit') THEN
        RAISE EXCEPTION 'El schema audit no existe. Ejecute primero 001_audit_schema.sql';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'audit' AND table_name = 'logged_actions') THEN
        RAISE EXCEPTION 'La tabla audit.logged_actions no existe. Ejecute primero 001_audit_schema.sql';
    END IF;
END $$;

-- ============================================================================
-- SECCIÓN 2: TRIGGERS PARA TABLA CLIENTES
-- ============================================================================
-- Datos altamente sensibles (PII): nombre, DNI/CIF, email, teléfono, dirección, IBAN

DROP TRIGGER IF EXISTS trg_audit_clientes ON public.clientes;
CREATE TRIGGER trg_audit_clientes
    AFTER INSERT OR UPDATE OR DELETE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_clientes ON public.clientes IS 
'Trigger de auditoría para tabla clientes.
Registra: INSERT, UPDATE, DELETE.
Datos sensibles: PII (nombre, DNI, email, teléfono, dirección, IBAN).
Retención: 10 años (requisito fiscal + GDPR).';

-- ============================================================================
-- SECCIÓN 3: TRIGGERS PARA TABLA CONTRATOS
-- ============================================================================
-- Datos contractuales: relación comercial, condiciones, precios

DROP TRIGGER IF EXISTS trg_audit_contratos ON public.contratos;
CREATE TRIGGER trg_audit_contratos
    AFTER INSERT OR UPDATE OR DELETE ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_contratos ON public.contratos IS 
'Trigger de auditoría para tabla contratos.
Registra: cambios en relaciones contractuales.
Retención: 10 años (requisito fiscal).';

-- ============================================================================
-- SECCIÓN 4: TRIGGERS PARA TABLA DOCUMENTOS
-- ============================================================================
-- Metadatos de documentos (el contenido está en storage)

DROP TRIGGER IF EXISTS trg_audit_documentos ON public.documentos;
CREATE TRIGGER trg_audit_documentos
    AFTER INSERT OR UPDATE OR DELETE ON public.documentos
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_documentos ON public.documentos IS 
'Trigger de auditoría para metadatos de documentos.
IMPORTANTE: Solo audita metadatos, no el contenido del archivo.
El acceso a archivos en Storage se audita por separado.';

-- ============================================================================
-- SECCIÓN 5: TRIGGERS PARA TABLA EMPRESAS
-- ============================================================================
-- Datos de comercializadoras y OpenEnergies

DROP TRIGGER IF EXISTS trg_audit_empresas ON public.empresas;
CREATE TRIGGER trg_audit_empresas
    AFTER INSERT OR UPDATE OR DELETE ON public.empresas
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_empresas ON public.empresas IS 
'Trigger de auditoría para tabla empresas.
Multitenancy: cambios en configuración de empresas/comercializadoras.';

-- ============================================================================
-- SECCIÓN 6: TRIGGERS PARA TABLA FACTURAS
-- ============================================================================
-- Datos fiscales críticos - Retención obligatoria 10 años

DROP TRIGGER IF EXISTS trg_audit_facturas ON public.facturas;
CREATE TRIGGER trg_audit_facturas
    AFTER INSERT OR UPDATE OR DELETE ON public.facturas
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_facturas ON public.facturas IS 
'Trigger de auditoría para facturas.
CRÍTICO: Datos fiscales con retención legal obligatoria (10 años - Ley 58/2003).
Cualquier modificación debe quedar registrada para auditorías fiscales.';

-- ============================================================================
-- SECCIÓN 7: TRIGGERS PARA TABLA LINEAS_FACTURA
-- ============================================================================
-- Detalle de líneas de factura - parte del documento fiscal

DROP TRIGGER IF EXISTS trg_audit_lineas_factura ON public.lineas_factura;
CREATE TRIGGER trg_audit_lineas_factura
    AFTER INSERT OR UPDATE OR DELETE ON public.lineas_factura
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_lineas_factura ON public.lineas_factura IS 
'Trigger de auditoría para líneas de factura.
Parte integral de documentos fiscales - misma retención que facturas.';

-- ============================================================================
-- SECCIÓN 8: TRIGGERS PARA TABLA PUNTOS_SUMINISTRO
-- ============================================================================
-- Datos de puntos de suministro eléctrico (CUPS, direcciones, etc.)

DROP TRIGGER IF EXISTS trg_audit_puntos_suministro ON public.puntos_suministro;
CREATE TRIGGER trg_audit_puntos_suministro
    AFTER INSERT OR UPDATE OR DELETE ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_puntos_suministro ON public.puntos_suministro IS 
'Trigger de auditoría para puntos de suministro.
Datos técnicos y de ubicación de suministros eléctricos.';

-- ============================================================================
-- SECCIÓN 9: TRIGGERS PARA TABLA TARIFAS
-- ============================================================================
-- Configuración de tarifas (datos de negocio)

DROP TRIGGER IF EXISTS trg_audit_tarifas ON public.tarifas;
CREATE TRIGGER trg_audit_tarifas
    AFTER INSERT OR UPDATE OR DELETE ON public.tarifas
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_tarifas ON public.tarifas IS 
'Trigger de auditoría para tarifas.
Cambios en precios y condiciones tarifarias.';

-- ============================================================================
-- SECCIÓN 10: TRIGGERS PARA TABLA USUARIOS_APP
-- ============================================================================
-- Datos de usuarios internos del sistema - altamente sensibles

DROP TRIGGER IF EXISTS trg_audit_usuarios_app ON public.usuarios_app;
CREATE TRIGGER trg_audit_usuarios_app
    AFTER INSERT OR UPDATE OR DELETE ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_usuarios_app ON public.usuarios_app IS 
'Trigger de auditoría para usuarios de la aplicación.
SENSIBLE: Cambios en roles, permisos, estados de cuenta.
ISO 27001 A.9 - Control de Acceso.';

-- ============================================================================
-- SECCIÓN 11: TRIGGERS PARA TABLA FACTURACION_CLIENTES
-- ============================================================================
-- Datos de facturación procesados desde archivos externos

DROP TRIGGER IF EXISTS trg_audit_facturacion_clientes ON public.facturacion_clientes;
CREATE TRIGGER trg_audit_facturacion_clientes
    AFTER INSERT OR UPDATE OR DELETE ON public.facturacion_clientes
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_facturacion_clientes ON public.facturacion_clientes IS 
'Trigger de auditoría para datos de facturación importados.
Trazabilidad de datos procesados desde archivos externos.';

-- ============================================================================
-- SECCIÓN 12: TRIGGERS ADICIONALES PARA TABLAS SECUNDARIAS
-- ============================================================================

-- Agenda Eventos (ya tiene triggers, pero aseguramos auditoría)
DROP TRIGGER IF EXISTS trg_audit_agenda_eventos ON public.agenda_eventos;
CREATE TRIGGER trg_audit_agenda_eventos
    AFTER INSERT OR UPDATE OR DELETE ON public.agenda_eventos
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

-- Asignaciones Comercial
DROP TRIGGER IF EXISTS trg_audit_asignaciones_comercial ON public.asignaciones_comercial;
CREATE TRIGGER trg_audit_asignaciones_comercial
    AFTER INSERT OR UPDATE OR DELETE ON public.asignaciones_comercial
    FOR EACH ROW
    EXECUTE FUNCTION audit.log_action();

COMMENT ON TRIGGER trg_audit_asignaciones_comercial ON public.asignaciones_comercial IS 
'Auditoría de asignaciones de comerciales a clientes.
Importante para trazabilidad de responsabilidades.';

-- ============================================================================
-- SECCIÓN 13: FUNCIÓN PARA HABILITAR/DESHABILITAR TRIGGERS DE AUDITORÍA
-- ============================================================================
-- Utilidad para mantenimiento (USAR CON PRECAUCIÓN)

CREATE OR REPLACE FUNCTION audit.toggle_audit_triggers(
    p_table_name TEXT,
    p_enable BOOLEAN DEFAULT TRUE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action TEXT;
    v_trigger_name TEXT;
BEGIN
    -- Solo administradores pueden ejecutar esta función
    IF NOT EXISTS (
        SELECT 1 FROM public.usuarios_app 
        WHERE user_id = auth.uid() AND rol = 'administrador'
    ) THEN
        RAISE EXCEPTION 'Solo administradores pueden modificar triggers de auditoría';
    END IF;
    
    v_trigger_name := 'trg_audit_' || p_table_name;
    v_action := CASE WHEN p_enable THEN 'ENABLE' ELSE 'DISABLE' END;
    
    -- Registrar la operación ANTES de ejecutar
    INSERT INTO audit.security_events (
        event_type,
        user_id,
        event_timestamp,
        success,
        metadata
    ) VALUES (
        'AUDIT_TRIGGER_TOGGLE',
        auth.uid(),
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'table', p_table_name,
            'trigger', v_trigger_name,
            'action', v_action,
            'timestamp', current_timestamp
        )
    );
    
    -- Ejecutar cambio
    EXECUTE format('ALTER TABLE public.%I %s TRIGGER %I', 
                   p_table_name, v_action, v_trigger_name);
    
    RETURN format('Trigger %s en tabla %s: %s', 
                  v_trigger_name, p_table_name, 
                  CASE WHEN p_enable THEN 'HABILITADO' ELSE 'DESHABILITADO' END);
END;
$$;

COMMENT ON FUNCTION audit.toggle_audit_triggers IS 
'ADVERTENCIA: Solo usar para mantenimiento.
Deshabilitar auditoría puede violar requisitos de cumplimiento.
Todas las operaciones quedan registradas en audit.security_events.';

-- ============================================================================
-- SECCIÓN 14: FUNCIÓN PARA VERIFICAR ESTADO DE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.get_audit_trigger_status()
RETURNS TABLE (
    table_name TEXT,
    trigger_name TEXT,
    is_enabled BOOLEAN,
    trigger_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.event_object_table::TEXT,
        t.trigger_name::TEXT,
        (t.trigger_name NOT IN (
            SELECT tg.tgname 
            FROM pg_trigger tg 
            WHERE tg.tgenabled = 'D'
        )),
        t.action_timing || ' ' || t.event_manipulation
    FROM information_schema.triggers t
    WHERE t.trigger_schema = 'public'
      AND t.trigger_name LIKE 'trg_audit_%'
    ORDER BY t.event_object_table, t.trigger_name;
END;
$$;

-- ============================================================================
-- SECCIÓN 15: TRIGGER ESPECIAL PARA DETECTAR ELIMINACIONES FÍSICAS
-- ============================================================================
-- Genera alerta cuando se intenta DELETE físico en lugar de soft delete

CREATE OR REPLACE FUNCTION audit.detect_physical_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
BEGIN
    v_user_id := auth.uid();
    
    SELECT rol::TEXT INTO v_user_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id;
    
    -- Registrar alerta de seguridad
    INSERT INTO audit.security_events (
        event_type,
        user_id,
        event_timestamp,
        success,
        metadata
    ) VALUES (
        'PHYSICAL_DELETE_ATTEMPT',
        v_user_id,
        current_timestamp,
        TRUE,  -- La operación procede, pero queda registrada
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'record_id', OLD.id,
            'user_role', v_user_role,
            'record_data', to_jsonb(OLD),
            'warning', 'Se realizó DELETE físico en lugar de soft delete'
        )
    );
    
    -- Permitir la eliminación pero quedará registrada
    RETURN OLD;
END;
$$;

-- Aplicar a tablas que deberían usar soft delete
DROP TRIGGER IF EXISTS trg_detect_physical_delete_clientes ON public.clientes;
CREATE TRIGGER trg_detect_physical_delete_clientes
    BEFORE DELETE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION audit.detect_physical_delete();

DROP TRIGGER IF EXISTS trg_detect_physical_delete_contratos ON public.contratos;
CREATE TRIGGER trg_detect_physical_delete_contratos
    BEFORE DELETE ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION audit.detect_physical_delete();

DROP TRIGGER IF EXISTS trg_detect_physical_delete_puntos_suministro ON public.puntos_suministro;
CREATE TRIGGER trg_detect_physical_delete_puntos_suministro
    BEFORE DELETE ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION audit.detect_physical_delete();

DROP TRIGGER IF EXISTS trg_detect_physical_delete_facturas ON public.facturas;
CREATE TRIGGER trg_detect_physical_delete_facturas
    BEFORE DELETE ON public.facturas
    FOR EACH ROW
    EXECUTE FUNCTION audit.detect_physical_delete();

DROP TRIGGER IF EXISTS trg_detect_physical_delete_usuarios_app ON public.usuarios_app;
CREATE TRIGGER trg_detect_physical_delete_usuarios_app
    BEFORE DELETE ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION audit.detect_physical_delete();

-- ============================================================================
-- SECCIÓN 16: TRIGGER PARA AUDITAR CAMBIOS DE ROLES CRÍTICOS
-- ============================================================================
-- Alerta especial cuando se modifica el rol de un usuario

CREATE OR REPLACE FUNCTION audit.audit_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Detectar cambio de rol
    IF OLD.rol IS DISTINCT FROM NEW.rol THEN
        INSERT INTO audit.security_events (
            event_type,
            user_id,
            event_timestamp,
            success,
            metadata
        ) VALUES (
            'USER_ROLE_CHANGE',
            auth.uid(),
            current_timestamp,
            TRUE,
            jsonb_build_object(
                'target_user_id', NEW.user_id,
                'target_email', NEW.email,
                'old_role', OLD.rol,
                'new_role', NEW.rol,
                'changed_by', auth.uid(),
                'timestamp', current_timestamp
            )
        );
    END IF;
    
    -- Nota: MFA se gestiona en Supabase Auth, no en usuarios_app
    -- Los cambios de MFA se auditan a través de auth.mfa_factors
    
    -- Detectar desbloqueo de cuenta (columnas agregadas en 002)
    IF OLD.bloqueado_hasta IS NOT NULL AND NEW.bloqueado_hasta IS NULL THEN
        INSERT INTO audit.security_events (
            event_type,
            user_id,
            event_timestamp,
            success,
            metadata
        ) VALUES (
            'ACCOUNT_UNLOCKED',
            NEW.user_id,
            current_timestamp,
            TRUE,
            jsonb_build_object(
                'user_email', NEW.email,
                'unlocked_by', auth.uid()
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.usuarios_app;
CREATE TRIGGER trg_audit_role_change
    AFTER UPDATE ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION audit.audit_role_change();

-- ============================================================================
-- SECCIÓN 17: RESUMEN DE TRIGGERS CREADOS
-- ============================================================================

-- Vista para consultar todos los triggers de auditoría
CREATE OR REPLACE VIEW audit.v_audit_triggers_summary AS
SELECT 
    event_object_table AS tabla,
    trigger_name AS nombre_trigger,
    action_timing AS momento,
    string_agg(event_manipulation, ', ' ORDER BY event_manipulation) AS operaciones
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_audit_%'
GROUP BY event_object_table, trigger_name, action_timing
ORDER BY event_object_table;

COMMENT ON VIEW audit.v_audit_triggers_summary IS 
'Vista resumen de todos los triggers de auditoría activos en el sistema.';

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar triggers creados
SELECT * FROM audit.v_audit_triggers_summary;

-- 2. Verificar que los triggers están habilitados
SELECT * FROM audit.get_audit_trigger_status();

-- 3. Probar auditoría con un UPDATE de prueba
UPDATE public.clientes SET nombre = nombre WHERE id = (SELECT id FROM public.clientes LIMIT 1);

-- 4. Verificar que se creó registro en audit.logged_actions
SELECT * FROM audit.logged_actions WHERE table_name = 'clientes' ORDER BY event_id DESC LIMIT 1;

-- 5. Verificar eventos de seguridad
SELECT * FROM audit.security_events ORDER BY id DESC LIMIT 10;
*/
