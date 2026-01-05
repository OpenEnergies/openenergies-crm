-- ============================================================================
-- 009_gdpr_cron_jobs_v2.sql
-- JOBS PROGRAMADOS PARA GDPR Y MANTENIMIENTO DE SEGURIDAD (CORREGIDO)
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- NOTA: Esta versión corrige referencias a tablas/columnas que no existen
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECCIÓN 1: VERIFICAR QUE pg_cron ESTÁ DISPONIBLE
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE EXCEPTION 'pg_cron no está instalada. Contacte al administrador de Supabase.';
    END IF;
END $$;

-- ============================================================================
-- SECCIÓN 2: FUNCIÓN PARA PROCESAR SOLICITUDES GDPR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_procesar_gdpr()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_resultado JSONB;
    v_procesadas INT := 0;
    v_errores INT := 0;
    v_solicitud RECORD;
BEGIN
    -- Procesar solicitudes aprobadas cuya fecha límite ya pasó
    FOR v_solicitud IN
        SELECT * FROM public.solicitudes_eliminacion
        WHERE estado = 'aprobada'
          AND fecha_limite <= current_timestamp
        ORDER BY fecha_solicitud
        LIMIT 5
    LOOP
        BEGIN
            UPDATE public.solicitudes_eliminacion
            SET estado = 'procesando', modificado_en = current_timestamp
            WHERE id = v_solicitud.id;
            
            IF v_solicitud.tipo_sujeto = 'cliente' THEN
                PERFORM public.anonimizar_cliente_parcial(v_solicitud.sujeto_id, v_solicitud.id);
            ELSIF v_solicitud.tipo_sujeto IN ('comercial', 'usuario') THEN
                PERFORM public.anonimizar_comercial(v_solicitud.sujeto_id, v_solicitud.id);
            END IF;
            
            v_procesadas := v_procesadas + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errores := v_errores + 1;
            
            UPDATE public.solicitudes_eliminacion
            SET 
                estado = 'error',
                notas_internas = COALESCE(notas_internas, '') || 
                    E'\n[CRON] Error ' || current_timestamp || ': ' || SQLERRM,
                modificado_en = current_timestamp
            WHERE id = v_solicitud.id;
        END;
    END LOOP;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_procesar_gdpr',
        'procesadas', v_procesadas,
        'errores', v_errores,
        'ejecutado_en', current_timestamp
    );
    
    IF v_procesadas > 0 OR v_errores > 0 THEN
        INSERT INTO audit.security_events (
            event_type, event_timestamp, success, metadata
        ) VALUES (
            'CRON_GDPR_PROCESSING', current_timestamp, v_errores = 0, v_resultado
        );
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN PARA LIMPIAR LOGS DE AUDITORÍA (CORREGIDA)
-- Eliminada referencia a audit.storage_access_log que no existe
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_cleanup_audit_logs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_catalog
AS $$
DECLARE
    v_deleted_actions BIGINT := 0;
    v_deleted_security BIGINT := 0;
    v_resultado JSONB;
BEGIN
    -- Limpiar logged_actions según configuración en audit_config
    WITH deleted AS (
        DELETE FROM audit.logged_actions la
        WHERE EXISTS (
            SELECT 1 FROM audit.audit_config ac
            WHERE ac.table_name = la.table_name
              AND ac.schema_name = la.schema_name
              AND la.action_tstamp_tx < (current_timestamp - (ac.retention_days || ' days')::INTERVAL)
        )
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_actions FROM deleted;
    
    -- Limpiar security_events (retención: 3 años)
    WITH deleted AS (
        DELETE FROM audit.security_events
        WHERE event_timestamp < (current_timestamp - INTERVAL '3 years')
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_security FROM deleted;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_cleanup_audit_logs',
        'deleted_logged_actions', v_deleted_actions,
        'deleted_security_events', v_deleted_security,
        'ejecutado_en', current_timestamp
    );
    
    IF v_deleted_actions > 0 OR v_deleted_security > 0 THEN
        INSERT INTO audit.security_events (
            event_type, event_timestamp, success, metadata
        ) VALUES (
            'CRON_AUDIT_CLEANUP', current_timestamp, TRUE, v_resultado
        );
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 4: FUNCIÓN PARA LIMPIAR RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_cleanup_rate_limit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_deleted BIGINT;
    v_resultado JSONB;
BEGIN
    WITH deleted AS (
        DELETE FROM public.rate_limit_log
        WHERE timestamp < (current_timestamp - INTERVAL '1 hour')
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_cleanup_rate_limit',
        'deleted', v_deleted,
        'ejecutado_en', current_timestamp
    );
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PARA VERIFICAR INTEGRIDAD DIARIA (CORREGIDA)
-- Corregido: usa ruta_storage en vez de storage_path
-- Eliminada referencia a storage_bucket_config
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_daily_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_catalog
AS $$
DECLARE
    v_issues JSONB := '[]'::jsonb;
    v_resultado JSONB;
    v_orphan_count INT;
    v_missing_rls INT;
    v_pending_gdpr INT;
    v_blocked_accounts INT;
BEGIN
    -- Verificar archivos huérfanos en storage (CORREGIDO: usa ruta_storage)
    SELECT COUNT(*) INTO v_orphan_count
    FROM storage.objects o
    WHERE o.bucket_id = 'documentos'
      AND NOT EXISTS (
          SELECT 1 FROM public.documentos d WHERE d.ruta_storage = o.name
      )
      AND o.created_at < (current_timestamp - INTERVAL '7 days');
    
    IF v_orphan_count > 0 THEN
        v_issues := v_issues || jsonb_build_object(
            'tipo', 'orphan_files',
            'count', v_orphan_count,
            'severidad', 'warning'
        );
    END IF;
    
    -- Verificar tablas sin RLS (CORREGIDO: eliminada storage_bucket_config)
    SELECT COUNT(*) INTO v_missing_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
      AND c.relname NOT IN ('rate_limit_log');  -- Excepciones conocidas
    
    IF v_missing_rls > 0 THEN
        v_issues := v_issues || jsonb_build_object(
            'tipo', 'missing_rls',
            'count', v_missing_rls,
            'severidad', 'critical'
        );
    END IF;
    
    -- Verificar solicitudes GDPR pendientes próximas a vencer
    SELECT COUNT(*) INTO v_pending_gdpr
    FROM public.solicitudes_eliminacion
    WHERE estado IN ('pendiente', 'en_revision')
      AND fecha_limite BETWEEN current_timestamp AND (current_timestamp + INTERVAL '5 days');
    
    IF v_pending_gdpr > 0 THEN
        v_issues := v_issues || jsonb_build_object(
            'tipo', 'gdpr_expiring_soon',
            'count', v_pending_gdpr,
            'severidad', 'warning'
        );
    END IF;
    
    -- Verificar cuentas bloqueadas
    SELECT COUNT(*) INTO v_blocked_accounts
    FROM public.usuarios_app
    WHERE bloqueado_hasta IS NOT NULL
      AND bloqueado_hasta > current_timestamp;
    
    IF v_blocked_accounts > 0 THEN
        v_issues := v_issues || jsonb_build_object(
            'tipo', 'blocked_accounts',
            'count', v_blocked_accounts,
            'severidad', 'info'
        );
    END IF;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_daily_integrity_check',
        'issues_found', jsonb_array_length(v_issues),
        'issues', v_issues,
        'checks_passed', CASE WHEN jsonb_array_length(v_issues) = 0 THEN TRUE ELSE FALSE END,
        'ejecutado_en', current_timestamp
    );
    
    INSERT INTO audit.security_events (
        event_type, event_timestamp, 
        success, 
        metadata
    ) VALUES (
        'CRON_INTEGRITY_CHECK', current_timestamp,
        jsonb_array_length(v_issues) = 0,
        v_resultado
    );
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN PARA GENERAR REPORTE SEMANAL DE ACTIVIDAD
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_weekly_activity_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_catalog
AS $$
DECLARE
    v_resultado JSONB;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    v_period_end := current_timestamp;
    v_period_start := v_period_end - INTERVAL '7 days';
    
    v_resultado := jsonb_build_object(
        'job', 'cron_weekly_activity_report',
        'period', jsonb_build_object(
            'start', v_period_start,
            'end', v_period_end
        ),
        
        -- Resumen de operaciones CRUD
        'crud_summary', (
            SELECT COALESCE(jsonb_object_agg(
                table_name,
                jsonb_build_object(
                    'inserts', COUNT(*) FILTER (WHERE action = 'I'),
                    'updates', COUNT(*) FILTER (WHERE action = 'U'),
                    'deletes', COUNT(*) FILTER (WHERE action = 'D')
                )
            ), '{}'::jsonb)
            FROM audit.logged_actions
            WHERE action_tstamp_tx BETWEEN v_period_start AND v_period_end
            GROUP BY table_name
        ),
        
        -- Eventos de seguridad
        'security_events', (
            SELECT COALESCE(jsonb_object_agg(
                event_type,
                cnt
            ), '{}'::jsonb)
            FROM (
                SELECT event_type, COUNT(*) as cnt
                FROM audit.security_events
                WHERE event_timestamp BETWEEN v_period_start AND v_period_end
                GROUP BY event_type
            ) sub
        ),
        
        -- Usuarios más activos
        'top_users', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'user_id', user_id,
                    'actions', action_count
                )
            ), '[]'::jsonb)
            FROM (
                SELECT user_id, COUNT(*) as action_count
                FROM audit.logged_actions
                WHERE action_tstamp_tx BETWEEN v_period_start AND v_period_end
                  AND user_id IS NOT NULL
                GROUP BY user_id
                ORDER BY COUNT(*) DESC
                LIMIT 10
            ) top
        ),
        
        -- Alertas de seguridad importantes
        'security_alerts', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', event_type,
                    'user', user_id,
                    'timestamp', event_timestamp
                )
            ), '[]'::jsonb)
            FROM audit.security_events
            WHERE event_timestamp BETWEEN v_period_start AND v_period_end
              AND event_type IN (
                  'UNAUTHORIZED_DELETE_ATTEMPT',
                  'PATH_TRAVERSAL_ATTEMPT',
                  'RATE_LIMIT_EXCEEDED',
                  'BLOCKED_FILE_EXTENSION',
                  'ACCOUNT_LOCKED',
                  'PHYSICAL_DELETE_ATTEMPT'
              )
            ORDER BY event_timestamp DESC
            LIMIT 50
        ),
        
        -- GDPR
        'gdpr_summary', (
            SELECT jsonb_build_object(
                'new_requests', COUNT(*) FILTER (WHERE fecha_solicitud BETWEEN v_period_start AND v_period_end),
                'processed', COUNT(*) FILTER (WHERE fecha_completado BETWEEN v_period_start AND v_period_end),
                'pending', COUNT(*) FILTER (WHERE estado IN ('pendiente', 'en_revision', 'aprobada'))
            )
            FROM public.solicitudes_eliminacion
        ),
        
        'generated_at', current_timestamp
    );
    
    INSERT INTO audit.security_events (
        event_type, event_timestamp, success, metadata
    ) VALUES (
        'CRON_WEEKLY_REPORT', current_timestamp, TRUE, v_resultado
    );
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 7: FUNCIÓN PARA DESBLOQUEAR CUENTAS EXPIRADAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_unlock_expired_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_unlocked INT;
    v_resultado JSONB;
BEGIN
    WITH unlocked AS (
        UPDATE public.usuarios_app
        SET 
            bloqueado_hasta = NULL,
            intentos_fallidos = 0,
            modificado_en = current_timestamp
        WHERE bloqueado_hasta IS NOT NULL
          AND bloqueado_hasta <= current_timestamp
        RETURNING user_id, email
    )
    SELECT COUNT(*) INTO v_unlocked FROM unlocked;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_unlock_expired_accounts',
        'unlocked', v_unlocked,
        'ejecutado_en', current_timestamp
    );
    
    IF v_unlocked > 0 THEN
        INSERT INTO audit.security_events (
            event_type, event_timestamp, success, metadata
        ) VALUES (
            'CRON_ACCOUNTS_UNLOCKED', current_timestamp, TRUE, v_resultado
        );
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 8: FUNCIÓN PARA ALERTAR CONTRASEÑAS ANTIGUAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cron_check_password_age()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_usuarios_alerta INT;
    v_resultado JSONB;
BEGIN
    -- Marcar admins con contraseñas muy antiguas (> 90 días)
    UPDATE public.usuarios_app
    SET 
        require_password_change = TRUE,
        modificado_en = current_timestamp
    WHERE (password_changed_at IS NULL OR password_changed_at < (current_timestamp - INTERVAL '90 days'))
      AND eliminado_en IS NULL
      AND rol = 'administrador'
      AND require_password_change = FALSE;
    
    GET DIAGNOSTICS v_usuarios_alerta = ROW_COUNT;
    
    v_resultado := jsonb_build_object(
        'job', 'cron_check_password_age',
        'admins_alerted', v_usuarios_alerta,
        'threshold_days', 90,
        'ejecutado_en', current_timestamp
    );
    
    IF v_usuarios_alerta > 0 THEN
        INSERT INTO audit.security_events (
            event_type, event_timestamp, success, metadata
        ) VALUES (
            'CRON_PASSWORD_AGE_ALERT', current_timestamp, TRUE, v_resultado
        );
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 9: REGISTRAR JOBS EN pg_cron
-- ============================================================================

-- Eliminar jobs existentes
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname LIKE 'openenergies_%';

-- Job 1: Procesar GDPR - Diariamente a las 2:00 AM
SELECT cron.schedule(
    'openenergies_gdpr_process',
    '0 2 * * *',
    $$SELECT public.cron_procesar_gdpr()$$
);

-- Job 2: Limpiar logs de auditoría - Primer día del mes a las 3:00 AM
SELECT cron.schedule(
    'openenergies_audit_cleanup',
    '0 3 1 * *',
    $$SELECT public.cron_cleanup_audit_logs()$$
);

-- Job 3: Limpiar rate limiting - Cada hora
SELECT cron.schedule(
    'openenergies_rate_limit_cleanup',
    '0 * * * *',
    $$SELECT public.cron_cleanup_rate_limit()$$
);

-- Job 4: Verificación de integridad - Diariamente a las 4:00 AM
SELECT cron.schedule(
    'openenergies_integrity_check',
    '0 4 * * *',
    $$SELECT public.cron_daily_integrity_check()$$
);

-- Job 5: Reporte semanal - Lunes a las 6:00 AM
SELECT cron.schedule(
    'openenergies_weekly_report',
    '0 6 * * 1',
    $$SELECT public.cron_weekly_activity_report()$$
);

-- Job 6: Desbloquear cuentas - Cada 5 minutos
SELECT cron.schedule(
    'openenergies_unlock_accounts',
    '*/5 * * * *',
    $$SELECT public.cron_unlock_expired_accounts()$$
);

-- Job 7: Verificar edad de contraseñas - Diariamente a las 5:00 AM
SELECT cron.schedule(
    'openenergies_password_age',
    '0 5 * * *',
    $$SELECT public.cron_check_password_age()$$
);

-- ============================================================================
-- SECCIÓN 10: VISTA PARA MONITOREAR JOBS
-- ============================================================================

CREATE OR REPLACE VIEW public.vista_cron_jobs AS
SELECT 
    j.jobid,
    j.jobname,
    j.schedule,
    j.command,
    CASE 
        WHEN j.active THEN 'ACTIVO'
        ELSE 'INACTIVO'
    END AS estado,
    (
        SELECT MAX(jr.end_time) 
        FROM cron.job_run_details jr 
        WHERE jr.jobid = j.jobid
    ) AS ultima_ejecucion,
    (
        SELECT jr.status
        FROM cron.job_run_details jr
        WHERE jr.jobid = j.jobid
        ORDER BY jr.end_time DESC
        LIMIT 1
    ) AS ultimo_estado
FROM cron.job j
WHERE j.jobname LIKE 'openenergies_%'
ORDER BY j.jobname;

-- ============================================================================
-- SECCIÓN 11: FUNCIÓN PARA EJECUTAR JOB MANUALMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ejecutar_cron_job(p_job_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden ejecutar jobs manualmente';
    END IF;
    
    CASE p_job_name
        WHEN 'gdpr_process' THEN
            v_resultado := public.cron_procesar_gdpr();
        WHEN 'audit_cleanup' THEN
            v_resultado := public.cron_cleanup_audit_logs();
        WHEN 'rate_limit_cleanup' THEN
            v_resultado := public.cron_cleanup_rate_limit();
        WHEN 'integrity_check' THEN
            v_resultado := public.cron_daily_integrity_check();
        WHEN 'weekly_report' THEN
            v_resultado := public.cron_weekly_activity_report();
        WHEN 'unlock_accounts' THEN
            v_resultado := public.cron_unlock_expired_accounts();
        WHEN 'password_age' THEN
            v_resultado := public.cron_check_password_age();
        ELSE
            RAISE EXCEPTION 'Job no reconocido: %. Opciones: gdpr_process, audit_cleanup, rate_limit_cleanup, integrity_check, weekly_report, unlock_accounts, password_age', p_job_name;
    END CASE;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'CRON_MANUAL_EXECUTION', auth.uid(), current_timestamp, TRUE,
        jsonb_build_object('job_name', p_job_name, 'result', v_resultado)
    );
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- SECCIÓN 12: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.ejecutar_cron_job(TEXT) TO authenticated;
GRANT SELECT ON public.vista_cron_jobs TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar jobs registrados
SELECT * FROM public.vista_cron_jobs;

-- 2. Ver historial de ejecuciones
SELECT 
    j.jobname,
    jr.start_time,
    jr.end_time,
    jr.status,
    jr.return_message
FROM cron.job j
JOIN cron.job_run_details jr ON j.jobid = jr.jobid
WHERE j.jobname LIKE 'openenergies_%'
ORDER BY jr.start_time DESC
LIMIT 20;

-- 3. Ejecutar job manualmente para probar
SELECT public.ejecutar_cron_job('integrity_check');

-- 4. Ver eventos de cron en auditoría
SELECT event_type, event_timestamp, metadata
FROM audit.security_events
WHERE event_type LIKE 'CRON_%'
ORDER BY event_timestamp DESC
LIMIT 10;
*/
