-- ============================================================================
-- 005_secure_functions.sql
-- SEGURIDAD DE FUNCIONES Y PROCEDIMIENTOS
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 32, ISO 27001 A.9.4/A.14.2, NIS2 Art. 21, SOC 2 CC6.1
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script:
-- 1. Revoca permisos de ejecución del rol 'anon' en funciones sensibles
-- 2. Añade validaciones de autorización en funciones SECURITY DEFINER
-- 3. Implementa rate limiting para funciones críticas
-- 4. Añade logging de seguridad para operaciones sensibles

BEGIN;

-- ============================================================================
-- SECCIÓN 1: REVOCAR PERMISOS DE ANON EN FUNCIONES SENSIBLES
-- ============================================================================
-- El rol 'anon' (usuarios no autenticados) NO debe poder ejecutar
-- funciones que modifiquen datos o accedan a información sensible

-- NOTA: Las funciones delete_contrato, delete_punto_suministro, set_folder_visibility
-- y get_agenda_items se recrean más adelante, por lo que los permisos se configuran al final.

-- Funciones helper de acceso (estas NO se recrean, solo se revocan)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_empresa_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_cliente(UUID) FROM anon;

-- ============================================================================
-- SECCIÓN 2: MEJORAR FUNCIÓN delete_contrato CON VALIDACIONES
-- ============================================================================
-- NOTA: Las funciones existentes retornan VOID, las nuevas retornan JSON.
-- PostgreSQL no permite cambiar el tipo de retorno, hay que recrearlas.

DROP FUNCTION IF EXISTS public.delete_contrato(UUID);
DROP FUNCTION IF EXISTS public.delete_punto_suministro(UUID);
DROP FUNCTION IF EXISTS public.set_folder_visibility(UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_agenda_items(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.delete_contrato(contrato_id_to_delete UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_cliente_id UUID;
    v_result JSON;
BEGIN
    -- Obtener información del usuario actual
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado: esta operación requiere autenticación'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener rol del usuario
    SELECT rol::TEXT INTO v_user_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o desactivado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Solo administradores y comerciales pueden eliminar contratos
    IF v_user_role NOT IN ('administrador', 'comercial') THEN
        -- Registrar intento no autorizado
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Rol insuficiente para eliminar contrato',
            jsonb_build_object('contrato_id', contrato_id_to_delete, 'user_role', v_user_role)
        );
        
        RAISE EXCEPTION 'Acceso denegado: rol % no puede eliminar contratos', v_user_role
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar que el contrato existe y obtener cliente_id a través de punto_suministro
    SELECT ps.cliente_id INTO v_cliente_id
    FROM public.contratos c
    JOIN public.puntos_suministro ps ON ps.id = c.punto_id
    WHERE c.id = contrato_id_to_delete
      AND c.eliminado_en IS NULL;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Contrato no encontrado o ya eliminado'
            USING ERRCODE = 'NTFND';
    END IF;
    
    -- Comerciales solo pueden eliminar contratos de clientes asignados
    IF v_user_role = 'comercial' THEN
        IF NOT public.can_access_cliente(v_cliente_id) THEN
            INSERT INTO audit.security_events (
                event_type, user_id, event_timestamp, success, failure_reason, metadata
            ) VALUES (
                'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
                'Comercial intentó eliminar contrato de cliente no asignado',
                jsonb_build_object('contrato_id', contrato_id_to_delete, 'cliente_id', v_cliente_id)
            );
            
            RAISE EXCEPTION 'Acceso denegado: no tiene permiso sobre este cliente'
                USING ERRCODE = 'AUTHZ';
        END IF;
    END IF;
    
    -- Realizar soft delete en lugar de eliminación física
    UPDATE public.contratos
    SET 
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = contrato_id_to_delete
      AND eliminado_en IS NULL;
    
    -- Registrar operación exitosa
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'CONTRACT_SOFT_DELETE', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'contrato_id', contrato_id_to_delete,
            'cliente_id', v_cliente_id,
            'user_role', v_user_role
        )
    );
    
    v_result := json_build_object(
        'success', TRUE,
        'message', 'Contrato marcado como eliminado correctamente',
        'contrato_id', contrato_id_to_delete
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.delete_contrato IS 
'Elimina un contrato de forma segura (soft delete).
Validaciones: autenticación, rol (admin/comercial), acceso al cliente.
ISO 27001 A.9.4.1 - Restricción de acceso a información.';

-- ============================================================================
-- SECCIÓN 3: MEJORAR FUNCIÓN delete_punto_suministro CON VALIDACIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_punto_suministro(punto_id_to_delete UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_cliente_id UUID;
    v_contratos_activos INT;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado: esta operación requiere autenticación'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT rol::TEXT INTO v_user_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    IF v_user_role NOT IN ('administrador', 'comercial') THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Rol insuficiente para eliminar punto de suministro',
            jsonb_build_object('punto_id', punto_id_to_delete, 'user_role', v_user_role)
        );
        
        RAISE EXCEPTION 'Acceso denegado: rol % no puede eliminar puntos de suministro', v_user_role
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener cliente_id del punto
    SELECT cliente_id INTO v_cliente_id
    FROM public.puntos_suministro
    WHERE id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Punto de suministro no encontrado o ya eliminado'
            USING ERRCODE = 'NTFND';
    END IF;
    
    -- Verificar acceso al cliente
    IF v_user_role = 'comercial' AND NOT public.can_access_cliente(v_cliente_id) THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Comercial intentó eliminar punto de cliente no asignado',
            jsonb_build_object('punto_id', punto_id_to_delete, 'cliente_id', v_cliente_id)
        );
        
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso sobre este cliente'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar si hay contratos activos vinculados
    SELECT COUNT(*) INTO v_contratos_activos
    FROM public.contratos
    WHERE punto_id = punto_id_to_delete
      AND eliminado_en IS NULL
      AND estado NOT IN ('vencido', 'resuelto');
    
    IF v_contratos_activos > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar: hay % contratos activos vinculados', v_contratos_activos
            USING ERRCODE = 'DPNDY';
    END IF;
    
    -- Soft delete del punto
    UPDATE public.puntos_suministro
    SET 
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    -- Soft delete de contratos vencidos/resueltos vinculados
    UPDATE public.contratos
    SET 
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE punto_id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'SUPPLY_POINT_SOFT_DELETE', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'punto_id', punto_id_to_delete,
            'cliente_id', v_cliente_id,
            'user_role', v_user_role
        )
    );
    
    v_result := json_build_object(
        'success', TRUE,
        'message', 'Punto de suministro marcado como eliminado',
        'punto_id', punto_id_to_delete
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- SECCIÓN 4: MEJORAR FUNCIÓN set_folder_visibility CON VALIDACIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_folder_visibility(
    p_cliente_id UUID,
    p_folder_path TEXT,
    p_is_visible BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_updated_count INT;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT rol::TEXT INTO v_user_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    -- Solo admins y comerciales pueden cambiar visibilidad
    IF v_user_role NOT IN ('administrador', 'comercial') THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_VISIBILITY_CHANGE', v_user_id, current_timestamp, FALSE,
            'Rol insuficiente para cambiar visibilidad de carpeta',
            jsonb_build_object('cliente_id', p_cliente_id, 'folder_path', p_folder_path)
        );
        
        RAISE EXCEPTION 'Acceso denegado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar acceso al cliente
    IF NOT public.can_access_cliente(p_cliente_id) THEN
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso sobre este cliente'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Validar path para prevenir path traversal
    IF p_folder_path LIKE '%..%' OR p_folder_path LIKE '%//%' THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'PATH_TRAVERSAL_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Intento de path traversal detectado',
            jsonb_build_object('folder_path', p_folder_path)
        );
        
        RAISE EXCEPTION 'Path inválido'
            USING ERRCODE = 'INVLD';
    END IF;
    
    -- Actualizar visibilidad (usando columnas reales de la tabla documentos)
    UPDATE public.documentos
    SET 
        visible_para_cliente = p_is_visible,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE cliente_id = p_cliente_id
      AND ruta_storage LIKE p_folder_path || '%'
      AND eliminado_en IS NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'FOLDER_VISIBILITY_CHANGED', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'folder_path', p_folder_path,
            'is_visible', p_is_visible,
            'documents_updated', v_updated_count
        )
    );
    
    v_result := json_build_object(
        'success', TRUE,
        'documents_updated', v_updated_count,
        'is_visible', p_is_visible
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- SECCIÓN 5: MEJORAR FUNCIÓN get_agenda_items CON VALIDACIONES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agenda_items(
    fecha_query_inicio TIMESTAMPTZ,
    fecha_query_fin TIMESTAMPTZ
)
RETURNS SETOF public.agenda_eventos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_empresa_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Validar rango de fechas (prevenir consultas excesivas)
    IF fecha_query_fin - fecha_query_inicio > INTERVAL '1 year' THEN
        RAISE EXCEPTION 'El rango de fechas no puede exceder 1 año'
            USING ERRCODE = 'INVLD';
    END IF;
    
    SELECT rol::TEXT, empresa_id 
    INTO v_user_role, v_empresa_id
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    -- Administradores ven todos los eventos
    IF v_user_role = 'administrador' THEN
        RETURN QUERY
        SELECT *
        FROM public.agenda_eventos
        WHERE fecha_inicio >= fecha_query_inicio
          AND fecha_inicio <= fecha_query_fin
        ORDER BY fecha_inicio;
    
    -- Comerciales ven sus propios eventos y los de su empresa
    ELSIF v_user_role = 'comercial' THEN
        RETURN QUERY
        SELECT *
        FROM public.agenda_eventos
        WHERE fecha_inicio >= fecha_query_inicio
          AND fecha_inicio <= fecha_query_fin
          AND (
              user_id = v_user_id
              OR empresa_id = v_empresa_id
          )
        ORDER BY fecha_inicio;
    
    -- Otros usuarios solo ven sus propios eventos
    ELSE
        RETURN QUERY
        SELECT *
        FROM public.agenda_eventos
        WHERE fecha_inicio >= fecha_query_inicio
          AND fecha_inicio <= fecha_query_fin
          AND user_id = v_user_id
        ORDER BY fecha_inicio;
    END IF;
END;
$$;

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN DE RATE LIMITING PARA OPERACIONES SENSIBLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    operation TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_op 
    ON public.rate_limit_log (user_id, operation, timestamp);

-- Limpiar registros antiguos automáticamente
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup 
    ON public.rate_limit_log (timestamp);

-- Función de rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_operation TEXT,
    p_max_requests INT DEFAULT 10,
    p_window_minutes INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_count INT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;  -- No permitir sin autenticación
    END IF;
    
    -- Contar operaciones en la ventana de tiempo
    SELECT COUNT(*) INTO v_count
    FROM public.rate_limit_log
    WHERE user_id = v_user_id
      AND operation = p_operation
      AND timestamp > (current_timestamp - (p_window_minutes || ' minutes')::INTERVAL);
    
    IF v_count >= p_max_requests THEN
        -- Registrar intento bloqueado
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'RATE_LIMIT_EXCEEDED', v_user_id, current_timestamp, FALSE,
            'Rate limit excedido',
            jsonb_build_object(
                'operation', p_operation,
                'count', v_count,
                'limit', p_max_requests,
                'window_minutes', p_window_minutes
            )
        );
        
        RETURN FALSE;
    END IF;
    
    -- Registrar operación
    INSERT INTO public.rate_limit_log (user_id, operation, timestamp)
    VALUES (v_user_id, p_operation, current_timestamp);
    
    RETURN TRUE;
END;
$$;

-- RLS para rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_admin ON public.rate_limit_log;
CREATE POLICY rate_limit_admin ON public.rate_limit_log
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_app
            WHERE user_id = auth.uid() AND rol = 'administrador'
        )
    );

-- ============================================================================
-- SECCIÓN 7: FUNCIONES SEGURAS PARA OPERACIONES DE USUARIO
-- ============================================================================

-- Función para cambio de contraseña con validaciones
CREATE OR REPLACE FUNCTION public.request_password_change()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Rate limiting: máximo 3 solicitudes por hora
    IF NOT public.check_rate_limit('password_change', 3, 60) THEN
        RAISE EXCEPTION 'Demasiadas solicitudes. Intente más tarde.' USING ERRCODE = 'RATLM';
    END IF;
    
    SELECT email INTO v_email FROM public.usuarios_app WHERE user_id = v_user_id;
    
    INSERT INTO audit.security_events (
        event_type, user_id, email, event_timestamp, success, metadata
    ) VALUES (
        'PASSWORD_CHANGE_REQUESTED', v_user_id, v_email, current_timestamp, TRUE,
        jsonb_build_object('source', 'user_initiated')
    );
    
    RETURN json_build_object('success', TRUE, 'message', 'Solicitud registrada');
END;
$$;

-- Función para deshabilitar MFA (requiere admin)
CREATE OR REPLACE FUNCTION public.admin_disable_user_mfa(p_target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_target_email TEXT;
BEGIN
    v_admin_id := auth.uid();
    
    -- Verificar que es admin
    IF NOT public.is_admin() THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_MFA_DISABLE', v_admin_id, current_timestamp, FALSE,
            'Usuario no administrador intentó deshabilitar MFA',
            jsonb_build_object('target_user_id', p_target_user_id)
        );
        
        RAISE EXCEPTION 'Acceso denegado: solo administradores' USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT email INTO v_target_email FROM public.usuarios_app WHERE user_id = p_target_user_id;
    
    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- Nota: MFA se gestiona a través de Supabase Auth, no de usuarios_app
    -- Esta función registra la solicitud para seguimiento
    INSERT INTO audit.security_events (
        event_type, user_id, email, event_timestamp, success, metadata
    ) VALUES (
        'MFA_DISABLE_REQUESTED', p_target_user_id, v_target_email, current_timestamp, TRUE,
        jsonb_build_object(
            'requested_by', v_admin_id,
            'reason', 'Admin action',
            'note', 'MFA debe deshabilitarse desde Supabase Dashboard o Auth API'
        )
    );
    
    RETURN json_build_object(
        'success', TRUE,
        'message', 'Solicitud de desactivación de MFA registrada. Completar desde Supabase Auth.',
        'user_email', v_target_email
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 8: FUNCIÓN PARA BLOQUEAR CUENTA POR INTENTOS FALLIDOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_failed_login(p_email TEXT, p_ip_address INET DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_attempts INT;
    v_max_attempts INT := 5;
    v_lockout_minutes INT := 30;
    v_blocked_until TIMESTAMPTZ;
BEGIN
    -- Buscar usuario por email
    SELECT user_id, intentos_fallidos, bloqueado_hasta
    INTO v_user_id, v_attempts, v_blocked_until
    FROM public.usuarios_app
    WHERE email = p_email
      AND eliminado_en IS NULL;
    
    IF v_user_id IS NULL THEN
        -- No revelar si el usuario existe
        INSERT INTO audit.security_events (
            event_type, email, ip_address, event_timestamp, success, failure_reason
        ) VALUES (
            'LOGIN_FAILED', p_email, p_ip_address, current_timestamp, FALSE,
            'Usuario no encontrado'
        );
        RETURN json_build_object('blocked', FALSE);
    END IF;
    
    -- Verificar si ya está bloqueado
    IF v_blocked_until IS NOT NULL AND v_blocked_until > current_timestamp THEN
        INSERT INTO audit.security_events (
            event_type, user_id, email, ip_address, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'LOGIN_BLOCKED', v_user_id, p_email, p_ip_address, current_timestamp, FALSE,
            'Cuenta bloqueada',
            jsonb_build_object('blocked_until', v_blocked_until)
        );
        RETURN json_build_object(
            'blocked', TRUE,
            'blocked_until', v_blocked_until,
            'message', 'Cuenta bloqueada temporalmente'
        );
    END IF;
    
    -- Incrementar intentos fallidos
    v_attempts := COALESCE(v_attempts, 0) + 1;
    
    IF v_attempts >= v_max_attempts THEN
        -- Bloquear cuenta
        v_blocked_until := current_timestamp + (v_lockout_minutes || ' minutes')::INTERVAL;
        
        UPDATE public.usuarios_app
        SET 
            intentos_fallidos = v_attempts,
            bloqueado_hasta = v_blocked_until,
            modificado_en = current_timestamp
        WHERE user_id = v_user_id;
        
        INSERT INTO audit.security_events (
            event_type, user_id, email, ip_address, event_timestamp, success, metadata
        ) VALUES (
            'ACCOUNT_LOCKED', v_user_id, p_email, p_ip_address, current_timestamp, TRUE,
            jsonb_build_object(
                'attempts', v_attempts,
                'locked_until', v_blocked_until,
                'lockout_minutes', v_lockout_minutes
            )
        );
        
        RETURN json_build_object(
            'blocked', TRUE,
            'blocked_until', v_blocked_until,
            'message', 'Cuenta bloqueada por demasiados intentos fallidos'
        );
    ELSE
        UPDATE public.usuarios_app
        SET 
            intentos_fallidos = v_attempts,
            modificado_en = current_timestamp
        WHERE user_id = v_user_id;
        
        INSERT INTO audit.security_events (
            event_type, user_id, email, ip_address, event_timestamp, success, metadata
        ) VALUES (
            'LOGIN_FAILED', v_user_id, p_email, p_ip_address, current_timestamp, FALSE,
            jsonb_build_object(
                'attempts', v_attempts,
                'remaining', v_max_attempts - v_attempts
            )
        );
        
        RETURN json_build_object(
            'blocked', FALSE,
            'remaining_attempts', v_max_attempts - v_attempts
        );
    END IF;
END;
$$;

-- Función para resetear contador tras login exitoso
CREATE OR REPLACE FUNCTION public.handle_successful_login(p_ip_address INET DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;
    
    SELECT email INTO v_email FROM public.usuarios_app WHERE user_id = v_user_id;
    
    UPDATE public.usuarios_app
    SET 
        intentos_fallidos = 0,
        bloqueado_hasta = NULL,
        ultimo_login = current_timestamp,
        ultimo_login_ip = p_ip_address,
        modificado_en = current_timestamp
    WHERE user_id = v_user_id;
    
    INSERT INTO audit.security_events (
        event_type, user_id, email, ip_address, event_timestamp, success
    ) VALUES (
        'LOGIN_SUCCESS', v_user_id, v_email, p_ip_address, current_timestamp, TRUE
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 9: GRANTS Y PERMISOS FINALES
-- ============================================================================

-- Asegurar que solo authenticated puede usar funciones críticas
GRANT EXECUTE ON FUNCTION public.delete_contrato(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_punto_suministro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_folder_visibility(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_items(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disable_user_mfa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_successful_login(INET) TO authenticated;

-- handle_failed_login necesita ser accesible desde anon (antes del login)
GRANT EXECUTE ON FUNCTION public.handle_failed_login(TEXT, INET) TO anon, authenticated;

-- Rate limit table: solo lectura para admins
GRANT SELECT ON public.rate_limit_log TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar permisos de funciones
SELECT 
    p.proname as function_name,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security,
    array_agg(g.grantee) as grantees
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN information_schema.routine_privileges g 
    ON g.routine_name = p.proname AND g.routine_schema = n.nspname
WHERE n.nspname = 'public'
  AND p.proname IN ('delete_contrato', 'delete_punto_suministro', 
                    'set_folder_visibility', 'get_agenda_items',
                    'handle_failed_login', 'handle_successful_login')
GROUP BY p.proname, p.prosecdef;

-- 2. Verificar que anon no tiene permisos en funciones sensibles
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE grantee = 'anon'
  AND routine_schema = 'public';

-- 3. Probar rate limiting
SELECT public.check_rate_limit('test_operation', 5, 1);
*/
