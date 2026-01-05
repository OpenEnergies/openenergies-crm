-- ============================================================================
-- 001_audit_schema.sql
-- INFRAESTRUCTURA DE AUDITORÍA COMPLETA
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 30, ISO 27001 A.12.4, NIS2 Art. 21, SOC 2 CC6.1/CC7.2
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: CREACIÓN DEL SCHEMA DE AUDITORÍA
-- ============================================================================
-- El schema audit separa los logs de auditoría de los datos operativos,
-- facilitando la gestión, backup y retención independiente.

BEGIN;

-- Crear schema dedicado para auditoría
CREATE SCHEMA IF NOT EXISTS audit;

-- Añadir comentario descriptivo al schema
COMMENT ON SCHEMA audit IS 
'Schema de auditoría para cumplimiento GDPR/ISO27001/NIS2/SOC2. 
Contiene logs de todas las operaciones CRUD en tablas sensibles.
Retención mínima: 3 años (recomendado: 7 años para auditorías).
IMPORTANTE: No eliminar registros manualmente - usar jobs programados.';

-- ============================================================================
-- SECCIÓN 2: TIPO ENUM PARA OPERACIONES
-- ============================================================================
-- Definimos un tipo enum para garantizar integridad en las operaciones

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_operation') THEN
        CREATE TYPE audit.audit_operation AS ENUM (
            'INSERT',
            'UPDATE', 
            'DELETE',
            'TRUNCATE',
            'SELECT'  -- Para auditoría de acceso a datos sensibles
        );
    END IF;
END $$;

-- ============================================================================
-- SECCIÓN 3: TABLA PRINCIPAL DE AUDITORÍA - logged_actions
-- ============================================================================
-- Esta tabla almacena TODOS los cambios realizados en las tablas monitoreadas.
-- Diseñada para alto rendimiento y cumplimiento normativo.

CREATE TABLE IF NOT EXISTS audit.logged_actions (
    -- Identificador único del evento
    event_id            BIGSERIAL PRIMARY KEY,
    
    -- Información del schema y tabla
    schema_name         TEXT NOT NULL,
    table_name          TEXT NOT NULL,
    
    -- Identificador de la fila afectada (normalmente UUID o ID)
    relid               OID,  -- OID de la tabla para referencia rápida
    
    -- Información de la sesión
    session_user_name   TEXT,  -- Usuario de PostgreSQL
    application_name    TEXT,  -- Nombre de la aplicación (ej: "PostgREST")
    client_addr         INET,  -- IP del cliente
    client_port         INTEGER,  -- Puerto del cliente
    
    -- Información temporal con zona horaria (crítico para GDPR)
    action_tstamp_tx    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,  -- Timestamp de la transacción
    action_tstamp_stm   TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,  -- Timestamp del statement
    action_tstamp_clk   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),  -- Timestamp del reloj
    
    -- ID de transacción para agrupar operaciones
    transaction_id      BIGINT,
    
    -- Tipo de operación
    action              TEXT NOT NULL CHECK (action IN ('I','D','U','T')),
    
    -- Datos antiguos (antes del cambio) - NULL para INSERT
    old_data            JSONB,
    
    -- Datos nuevos (después del cambio) - NULL para DELETE
    new_data            JSONB,
    
    -- Columnas cambiadas (solo para UPDATE)
    changed_fields      JSONB,
    
    -- Contexto del statement SQL (opcional, para debugging)
    statement_only      BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- =========================================================================
    -- CAMPOS ESPECÍFICOS PARA CUMPLIMIENTO NORMATIVO
    -- =========================================================================
    
    -- ID del usuario de Supabase/Auth (auth.uid())
    user_id             UUID,
    
    -- Rol del usuario en el momento de la acción
    user_role           TEXT,
    
    -- ID de la empresa para multitenancy
    empresa_id          UUID,
    
    -- Motivo del cambio (opcional, para cambios sensibles)
    reason              TEXT,
    
    -- Referencia a solicitud GDPR si aplica
    gdpr_request_id     UUID,
    
    -- Hash de integridad para detectar manipulación
    integrity_hash      TEXT,
    
    -- Metadatos adicionales
    metadata            JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SECCIÓN 4: ÍNDICES OPTIMIZADOS PARA CONSULTAS
-- ============================================================================
-- Índices diseñados para patrones de consulta comunes en auditorías

-- Índice compuesto principal para búsquedas por tabla y tiempo
CREATE INDEX IF NOT EXISTS logged_actions_schema_table_idx 
    ON audit.logged_actions (schema_name, table_name);

-- Índice para búsquedas por timestamp (consultas de rango temporal)
CREATE INDEX IF NOT EXISTS logged_actions_action_tstamp_idx 
    ON audit.logged_actions (action_tstamp_tx);

-- Índice para búsquedas por usuario de Supabase
CREATE INDEX IF NOT EXISTS logged_actions_user_id_idx 
    ON audit.logged_actions (user_id) 
    WHERE user_id IS NOT NULL;

-- Índice para búsquedas por empresa (multitenancy)
CREATE INDEX IF NOT EXISTS logged_actions_empresa_id_idx 
    ON audit.logged_actions (empresa_id) 
    WHERE empresa_id IS NOT NULL;

-- Índice para solicitudes GDPR
CREATE INDEX IF NOT EXISTS logged_actions_gdpr_request_idx 
    ON audit.logged_actions (gdpr_request_id) 
    WHERE gdpr_request_id IS NOT NULL;

-- Índice parcial para operaciones de DELETE (importante para GDPR)
CREATE INDEX IF NOT EXISTS logged_actions_deletes_idx 
    ON audit.logged_actions (table_name, action_tstamp_tx) 
    WHERE action = 'D';

-- Índice para transacción (agrupar operaciones de una transacción)
CREATE INDEX IF NOT EXISTS logged_actions_txid_idx 
    ON audit.logged_actions (transaction_id);

-- Índice GIN para búsquedas en datos JSON
CREATE INDEX IF NOT EXISTS logged_actions_old_data_gin_idx 
    ON audit.logged_actions USING GIN (old_data jsonb_path_ops);

CREATE INDEX IF NOT EXISTS logged_actions_new_data_gin_idx 
    ON audit.logged_actions USING GIN (new_data jsonb_path_ops);

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PRINCIPAL DE LOGGING
-- ============================================================================
-- Esta función es llamada por los triggers para registrar cambios

CREATE OR REPLACE FUNCTION audit.log_action()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields JSONB;
    v_user_id UUID;
    v_user_role TEXT;
    v_empresa_id UUID;
    v_integrity_hash TEXT;
    v_action TEXT;
BEGIN
    -- Determinar la acción
    v_action := CASE TG_OP
        WHEN 'INSERT' THEN 'I'
        WHEN 'UPDATE' THEN 'U'
        WHEN 'DELETE' THEN 'D'
        WHEN 'TRUNCATE' THEN 'T'
    END;

    -- Obtener información del usuario actual de Supabase
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Obtener rol del usuario
    BEGIN
        SELECT rol::TEXT INTO v_user_role
        FROM public.usuarios_app
        WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_user_role := NULL;
    END;

    -- Obtener empresa del usuario
    BEGIN
        SELECT empresa_id INTO v_empresa_id
        FROM public.usuarios_app
        WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_empresa_id := NULL;
    END;

    -- Procesar según tipo de operación
    IF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Calcular campos cambiados
        SELECT jsonb_object_agg(key, value)
        INTO v_changed_fields
        FROM (
            SELECT key, value
            FROM jsonb_each(v_new_data)
            WHERE NOT v_old_data ? key 
               OR v_old_data->key IS DISTINCT FROM v_new_data->key
        ) AS changes;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_changed_fields := NULL;
        
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_changed_fields := NULL;
    END IF;

    -- Generar hash de integridad (SHA-256)
    v_integrity_hash := encode(
        extensions.digest(
            COALESCE(v_old_data::TEXT, '') || 
            COALESCE(v_new_data::TEXT, '') || 
            v_action || 
            current_timestamp::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insertar registro de auditoría
    INSERT INTO audit.logged_actions (
        schema_name,
        table_name,
        relid,
        session_user_name,
        application_name,
        client_addr,
        client_port,
        action_tstamp_tx,
        action_tstamp_stm,
        action_tstamp_clk,
        transaction_id,
        action,
        old_data,
        new_data,
        changed_fields,
        statement_only,
        user_id,
        user_role,
        empresa_id,
        integrity_hash,
        metadata
    ) VALUES (
        TG_TABLE_SCHEMA::TEXT,
        TG_TABLE_NAME::TEXT,
        TG_RELID,
        session_user::TEXT,
        current_setting('application_name', TRUE),
        inet_client_addr(),
        inet_client_port(),
        current_timestamp,
        statement_timestamp(),
        clock_timestamp(),
        txid_current(),
        v_action,
        v_old_data,
        v_new_data,
        v_changed_fields,
        FALSE,
        v_user_id,
        v_user_role,
        v_empresa_id,
        v_integrity_hash,
        jsonb_build_object(
            'trigger_name', TG_NAME,
            'trigger_when', TG_WHEN,
            'trigger_level', TG_LEVEL
        )
    );

    -- Retornar según operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

COMMENT ON FUNCTION audit.log_action() IS 
'Función trigger para registrar todas las operaciones CRUD.
Captura: datos antes/después, usuario, rol, empresa, timestamp, hash integridad.
Cumple: GDPR Art. 30, ISO 27001 A.12.4, NIS2 Art. 21.';

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN AUXILIAR PARA EXCLUIR COLUMNAS
-- ============================================================================
-- Permite excluir columnas sensibles del logging (ej: passwords hasheados)

CREATE OR REPLACE FUNCTION audit.log_action_exclude_columns()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_fields JSONB;
    v_user_id UUID;
    v_user_role TEXT;
    v_empresa_id UUID;
    v_integrity_hash TEXT;
    v_action TEXT;
    col TEXT;
    excluded_cols TEXT[];
    i INT;
BEGIN
    -- Obtener columnas excluidas desde TG_ARGV
    -- Los argumentos se pasan al crear el trigger, ej:
    -- CREATE TRIGGER ... EXECUTE FUNCTION audit.log_action_exclude_columns('password', 'token');
    excluded_cols := ARRAY[]::TEXT[];
    FOR i IN 0..(TG_NARGS - 1) LOOP
        excluded_cols := array_append(excluded_cols, TG_ARGV[i]);
    END LOOP;
    -- Determinar la acción
    v_action := CASE TG_OP
        WHEN 'INSERT' THEN 'I'
        WHEN 'UPDATE' THEN 'U'
        WHEN 'DELETE' THEN 'D'
    END;

    -- Obtener información del usuario
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    BEGIN
        SELECT rol::TEXT, empresa_id INTO v_user_role, v_empresa_id
        FROM public.usuarios_app
        WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_user_role := NULL;
        v_empresa_id := NULL;
    END;

    -- Procesar datos según operación
    IF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Eliminar columnas excluidas
        FOREACH col IN ARRAY excluded_cols LOOP
            v_old_data := v_old_data - col;
            v_new_data := v_new_data - col;
        END LOOP;
        
        -- Calcular campos cambiados (excluyendo columnas sensibles)
        SELECT jsonb_object_agg(key, value)
        INTO v_changed_fields
        FROM (
            SELECT key, value
            FROM jsonb_each(v_new_data)
            WHERE NOT v_old_data ? key 
               OR v_old_data->key IS DISTINCT FROM v_new_data->key
        ) AS changes;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        FOREACH col IN ARRAY excluded_cols LOOP
            v_old_data := v_old_data - col;
        END LOOP;
        v_new_data := NULL;
        
    ELSIF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        FOREACH col IN ARRAY excluded_cols LOOP
            v_new_data := v_new_data - col;
        END LOOP;
    END IF;

    -- Generar hash de integridad
    v_integrity_hash := encode(
        extensions.digest(
            COALESCE(v_old_data::TEXT, '') || 
            COALESCE(v_new_data::TEXT, '') || 
            v_action || 
            current_timestamp::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insertar registro
    INSERT INTO audit.logged_actions (
        schema_name, table_name, relid, session_user_name,
        application_name, client_addr, client_port,
        action_tstamp_tx, action_tstamp_stm, action_tstamp_clk,
        transaction_id, action, old_data, new_data,
        changed_fields, statement_only, user_id, user_role,
        empresa_id, integrity_hash,
        metadata
    ) VALUES (
        TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_RELID, session_user,
        current_setting('application_name', TRUE), inet_client_addr(), inet_client_port(),
        current_timestamp, statement_timestamp(), clock_timestamp(),
        txid_current(), v_action, v_old_data, v_new_data,
        v_changed_fields, FALSE, v_user_id, v_user_role,
        v_empresa_id, v_integrity_hash,
        jsonb_build_object('excluded_columns', excluded_cols)
    );

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ============================================================================
-- SECCIÓN 7: FUNCIONES HELPER PARA CONSULTAS DE AUDITORÍA
-- ============================================================================

-- Función para obtener historial completo de un registro
CREATE OR REPLACE FUNCTION audit.get_record_history(
    p_table_name TEXT,
    p_record_id UUID,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    event_id BIGINT,
    action TEXT,
    action_timestamp TIMESTAMPTZ,
    user_id UUID,
    user_role TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        la.event_id,
        la.action,
        la.action_tstamp_tx,
        la.user_id,
        la.user_role,
        la.old_data,
        la.new_data,
        la.changed_fields
    FROM audit.logged_actions la
    WHERE la.table_name = p_table_name
      AND (
          (la.old_data->>'id')::UUID = p_record_id
          OR (la.new_data->>'id')::UUID = p_record_id
      )
    ORDER BY la.action_tstamp_tx DESC
    LIMIT p_limit;
END;
$$;

-- Función para obtener cambios de un usuario específico
CREATE OR REPLACE FUNCTION audit.get_user_activity(
    p_user_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 500
)
RETURNS TABLE (
    event_id BIGINT,
    table_name TEXT,
    action TEXT,
    action_timestamp TIMESTAMPTZ,
    changed_fields JSONB,
    record_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        la.event_id,
        la.table_name,
        la.action,
        la.action_tstamp_tx,
        la.changed_fields,
        COALESCE(la.new_data->>'id', la.old_data->>'id')
    FROM audit.logged_actions la
    WHERE la.user_id = p_user_id
      AND (p_start_date IS NULL OR la.action_tstamp_tx >= p_start_date)
      AND (p_end_date IS NULL OR la.action_tstamp_tx <= p_end_date)
    ORDER BY la.action_tstamp_tx DESC
    LIMIT p_limit;
END;
$$;

-- Función para estadísticas de auditoría (dashboard)
CREATE OR REPLACE FUNCTION audit.get_audit_statistics(
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    table_name TEXT,
    total_inserts BIGINT,
    total_updates BIGINT,
    total_deletes BIGINT,
    unique_users INT,
    last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        la.table_name,
        COUNT(*) FILTER (WHERE la.action = 'I'),
        COUNT(*) FILTER (WHERE la.action = 'U'),
        COUNT(*) FILTER (WHERE la.action = 'D'),
        COUNT(DISTINCT la.user_id)::INT,
        MAX(la.action_tstamp_tx)
    FROM audit.logged_actions la
    WHERE la.action_tstamp_tx >= (current_timestamp - (p_days || ' days')::INTERVAL)
    GROUP BY la.table_name
    ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- SECCIÓN 8: POLÍTICAS RLS PARA EL SCHEMA AUDIT
-- ============================================================================
-- Solo administradores pueden ver los logs de auditoría

ALTER TABLE audit.logged_actions ENABLE ROW LEVEL SECURITY;

-- Política para SELECT - Solo administradores
CREATE POLICY audit_select_admin ON audit.logged_actions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.rol = 'administrador'
        )
    );

-- Política para INSERT - Solo sistema (triggers internos)
-- Los triggers usan SECURITY DEFINER, por lo que pueden insertar
CREATE POLICY audit_insert_system ON audit.logged_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (FALSE);  -- Usuarios no pueden insertar directamente

-- Denegar UPDATE y DELETE completamente
-- Los logs de auditoría son inmutables
CREATE POLICY audit_no_update ON audit.logged_actions
    FOR UPDATE
    TO authenticated
    USING (FALSE);

CREATE POLICY audit_no_delete ON audit.logged_actions
    FOR DELETE
    TO authenticated
    USING (FALSE);

-- ============================================================================
-- SECCIÓN 9: TABLA DE CONFIGURACIÓN DE AUDITORÍA
-- ============================================================================
-- Permite configurar qué tablas y columnas se auditan

CREATE TABLE IF NOT EXISTS audit.audit_config (
    id SERIAL PRIMARY KEY,
    schema_name TEXT NOT NULL DEFAULT 'public',
    table_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    excluded_columns TEXT[] DEFAULT '{}',
    log_old_data BOOLEAN NOT NULL DEFAULT TRUE,
    log_new_data BOOLEAN NOT NULL DEFAULT TRUE,
    retention_days INT DEFAULT 2555,  -- 7 años por defecto
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    UNIQUE(schema_name, table_name)
);

COMMENT ON TABLE audit.audit_config IS 
'Configuración de auditoría por tabla.
retention_days: días de retención (2555 = 7 años para cumplir ISO 27001).
excluded_columns: columnas sensibles a excluir del log.';

-- Insertar configuración inicial para tablas principales
INSERT INTO audit.audit_config (schema_name, table_name, excluded_columns, retention_days)
VALUES 
    ('public', 'clientes', '{}', 3650),      -- 10 años (retención fiscal)
    ('public', 'contratos', '{}', 3650),
    ('public', 'documentos', '{}', 3650),
    ('public', 'empresas', '{}', 2555),       -- 7 años
    ('public', 'facturas', '{}', 3650),
    ('public', 'lineas_factura', '{}', 3650),
    ('public', 'puntos_suministro', '{}', 3650),
    ('public', 'tarifas', '{}', 2555),
    ('public', 'usuarios_app', '{}', 2555),
    ('public', 'facturacion_clientes', '{}', 3650)
ON CONFLICT (schema_name, table_name) DO NOTHING;

-- ============================================================================
-- SECCIÓN 10: TABLA DE EVENTOS DE SEGURIDAD
-- ============================================================================
-- Para registrar eventos de seguridad específicos (login, logout, cambio password, etc.)

CREATE TABLE IF NOT EXISTS audit.security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,  -- LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGE, MFA_ENABLED, etc.
    user_id UUID,
    email TEXT,
    ip_address INET,
    user_agent TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    success BOOLEAN,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    integrity_hash TEXT
);

-- Índices para security_events
CREATE INDEX IF NOT EXISTS security_events_user_idx 
    ON audit.security_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_events_timestamp_idx 
    ON audit.security_events (event_timestamp);
CREATE INDEX IF NOT EXISTS security_events_type_idx 
    ON audit.security_events (event_type);

-- RLS para security_events
ALTER TABLE audit.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_admin ON audit.security_events
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.rol = 'administrador'
        )
    );

-- ============================================================================
-- SECCIÓN 11: FUNCIÓN PARA VALIDAR INTEGRIDAD
-- ============================================================================
-- Permite verificar que los logs no han sido manipulados

CREATE OR REPLACE FUNCTION audit.verify_log_integrity(p_event_id BIGINT)
RETURNS TABLE (
    is_valid BOOLEAN,
    original_hash TEXT,
    calculated_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
DECLARE
    v_record RECORD;
    v_calculated_hash TEXT;
BEGIN
    SELECT * INTO v_record
    FROM audit.logged_actions
    WHERE event_id = p_event_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- Recalcular hash
    v_calculated_hash := encode(
        extensions.digest(
            COALESCE(v_record.old_data::TEXT, '') || 
            COALESCE(v_record.new_data::TEXT, '') || 
            v_record.action || 
            v_record.action_tstamp_tx::TEXT,
            'sha256'
        ),
        'hex'
    );

    RETURN QUERY SELECT 
        v_record.integrity_hash = v_calculated_hash,
        v_record.integrity_hash,
        v_calculated_hash;
END;
$$;

-- ============================================================================
-- SECCIÓN 12: FUNCIÓN PARA LIMPIAR LOGS ANTIGUOS
-- ============================================================================
-- Respeta el período de retención configurado por tabla

CREATE OR REPLACE FUNCTION audit.cleanup_old_logs()
RETURNS TABLE (
    table_name TEXT,
    deleted_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
DECLARE
    v_config RECORD;
    v_deleted BIGINT;
BEGIN
    FOR v_config IN SELECT * FROM audit.audit_config WHERE is_enabled LOOP
        DELETE FROM audit.logged_actions la
        WHERE la.schema_name = v_config.schema_name
          AND la.table_name = v_config.table_name
          AND la.action_tstamp_tx < (current_timestamp - (v_config.retention_days || ' days')::INTERVAL);
        
        GET DIAGNOSTICS v_deleted = ROW_COUNT;
        
        IF v_deleted > 0 THEN
            table_name := v_config.table_name;
            deleted_count := v_deleted;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION audit.cleanup_old_logs() IS 
'Limpia logs de auditoría que exceden el período de retención.
Ejecutar mensualmente vía pg_cron.
IMPORTANTE: Verificar que cumple con requisitos legales antes de ejecutar.';

-- ============================================================================
-- SECCIÓN 13: FUNCIÓN PARA EXPORTAR LOGS (GDPR Art. 15)
-- ============================================================================
-- Permite exportar todos los logs relacionados con un sujeto de datos

CREATE OR REPLACE FUNCTION audit.export_user_logs(
    p_user_id UUID,
    p_format TEXT DEFAULT 'json'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_catalog
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Verificar que el solicitante es admin o el propio usuario
    IF NOT (
        auth.uid() = p_user_id 
        OR EXISTS (
            SELECT 1 FROM public.usuarios_app u
            WHERE u.user_id = auth.uid() AND u.rol = 'administrador'
        )
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: solo el usuario o un administrador pueden exportar estos logs';
    END IF;

    SELECT jsonb_build_object(
        'export_date', current_timestamp,
        'user_id', p_user_id,
        'total_records', COUNT(*),
        'records', jsonb_agg(
            jsonb_build_object(
                'table', table_name,
                'action', action,
                'timestamp', action_tstamp_tx,
                'changed_fields', changed_fields
            ) ORDER BY action_tstamp_tx
        )
    )
    INTO v_result
    FROM audit.logged_actions
    WHERE user_id = p_user_id;

    RETURN v_result;
END;
$$;

-- ============================================================================
-- SECCIÓN 14: GRANTS Y PERMISOS
-- ============================================================================

-- Revocar acceso público al schema audit
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;

-- Permitir acceso al rol authenticated (controlado por RLS)
GRANT USAGE ON SCHEMA audit TO authenticated;
GRANT SELECT ON audit.logged_actions TO authenticated;
GRANT SELECT ON audit.security_events TO authenticated;
GRANT SELECT ON audit.audit_config TO authenticated;

-- Service role tiene acceso completo (para triggers)
GRANT ALL ON SCHEMA audit TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA audit TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA audit TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA audit TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Ejecutar después de la migración para verificar:

/*
-- 1. Verificar que el schema existe
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'audit';

-- 2. Verificar tablas creadas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'audit';

-- 3. Verificar funciones creadas
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'audit';

-- 4. Verificar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'audit';

-- 5. Verificar políticas
SELECT * FROM pg_policies WHERE schemaname = 'audit';
*/
