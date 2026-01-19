-- ============================================================================
-- MIGRACIÓN: Corrección de FKs para permitir eliminación de usuarios
-- ============================================================================
-- OBJETIVO: Permitir eliminar usuarios de auth.users sin violar FKs
-- ALINEACIÓN: Cumple con GDPR, Soft Delete, Auditoría y Trazabilidad
-- 
-- CONTEXTO DE SEGURIDAD:
-- - El sistema usa SOFT DELETE (eliminado_en, eliminado_por)
-- - Existe función anonimizar_comercial() para GDPR
-- - Los campos de auditoría deben preservar trazabilidad con SET NULL
-- - La eliminación física de auth.users es necesaria para que el usuario
--   no pueda hacer login, pero los datos en public se anonimizan
--
-- NORMATIVAS: GDPR Art. 17, ISO 27001 A.8.3.2, SOC 2, NIS2
-- ============================================================================

-- ============================================
-- PARTE 1: CAMPOS DE AUDITORÍA -> SET NULL
-- ============================================
-- Estos campos son para trazabilidad. Cuando se elimina el usuario de auth,
-- los registros de auditoría se mantienen pero el campo pasa a NULL.
-- Esto permite saber que "alguien" realizó la acción aunque ya no exista.

-- vacaciones.creado_por -> ON DELETE SET NULL
ALTER TABLE public.vacaciones 
DROP CONSTRAINT IF EXISTS vacaciones_creado_por_fkey;

ALTER TABLE public.vacaciones 
ADD CONSTRAINT vacaciones_creado_por_fkey 
FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- vacaciones.modificado_por -> ON DELETE SET NULL
ALTER TABLE public.vacaciones 
DROP CONSTRAINT IF EXISTS vacaciones_modificado_por_fkey;

ALTER TABLE public.vacaciones 
ADD CONSTRAINT vacaciones_modificado_por_fkey 
FOREIGN KEY (modificado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- vacaciones.eliminado_por -> ON DELETE SET NULL
ALTER TABLE public.vacaciones 
DROP CONSTRAINT IF EXISTS vacaciones_eliminado_por_fkey;

ALTER TABLE public.vacaciones 
ADD CONSTRAINT vacaciones_eliminado_por_fkey 
FOREIGN KEY (eliminado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- PARTE 2: vacaciones.user_id -> SET NULL (NO CASCADE)
-- ============================================
-- ⚠️ IMPORTANTE: NO usamos CASCADE porque:
-- 1. vacaciones tiene campos de soft delete (eliminado_en, eliminado_por)
-- 2. Debemos preservar el historial de vacaciones para auditoría/RRHH
-- 3. El proceso correcto es: soft delete ANTES de eliminar de auth
--
-- Con SET NULL, si alguien elimina directamente de auth.users (bypassing Edge Function),
-- las vacaciones quedan huérfanas pero no se pierden.

ALTER TABLE public.vacaciones 
DROP CONSTRAINT IF EXISTS vacaciones_user_id_fkey;

ALTER TABLE public.vacaciones 
ADD CONSTRAINT vacaciones_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Hacer user_id nullable para permitir SET NULL
ALTER TABLE public.vacaciones 
ALTER COLUMN user_id DROP NOT NULL;

-- ============================================
-- PARTE 3: client_secrets -> SET NULL
-- ============================================
-- client_secrets NO tiene soft delete (es tabla técnica para vault)
-- Los secretos se eliminan por la función auto_anonimizar_cliente_on_delete()
-- cuando se elimina un cliente, no cuando se elimina un usuario admin.

ALTER TABLE public.client_secrets 
DROP CONSTRAINT IF EXISTS client_secrets_created_by_fkey;

ALTER TABLE public.client_secrets 
ADD CONSTRAINT client_secrets_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.client_secrets 
DROP CONSTRAINT IF EXISTS client_secrets_updated_by_fkey;

ALTER TABLE public.client_secrets 
ADD CONSTRAINT client_secrets_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- PARTE 4: solicitudes_eliminacion -> SET NULL
-- ============================================
-- Esta tabla es de GDPR, nunca debe perder datos.
-- Los campos de quién solicitó/verificó/anonimizó pasan a NULL si
-- el admin que hizo esas acciones ya no existe.

ALTER TABLE public.solicitudes_eliminacion 
DROP CONSTRAINT IF EXISTS solicitudes_eliminacion_solicitado_por_fkey;

ALTER TABLE public.solicitudes_eliminacion 
ADD CONSTRAINT solicitudes_eliminacion_solicitado_por_fkey 
FOREIGN KEY (solicitado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.solicitudes_eliminacion 
DROP CONSTRAINT IF EXISTS solicitudes_eliminacion_verificado_por_fkey;

ALTER TABLE public.solicitudes_eliminacion 
ADD CONSTRAINT solicitudes_eliminacion_verificado_por_fkey 
FOREIGN KEY (verificado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.solicitudes_eliminacion 
DROP CONSTRAINT IF EXISTS solicitudes_eliminacion_anonimizado_por_fkey;

ALTER TABLE public.solicitudes_eliminacion 
ADD CONSTRAINT solicitudes_eliminacion_anonimizado_por_fkey 
FOREIGN KEY (anonimizado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- PARTE 5: Registrar cambio en security_events
-- ============================================
DO $$
BEGIN
    INSERT INTO audit.security_events (
        event_type,
        event_timestamp,
        success,
        metadata
    ) VALUES (
        'MIGRATION_FK_CONSTRAINTS_FIXED',
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'migration', '20260119_fix_user_delete_security_compliant',
            'description', 'FK constraints updated to allow user deletion from auth.users while preserving audit trail',
            'tables_affected', ARRAY['vacaciones', 'client_secrets', 'solicitudes_eliminacion'],
            'compliance', ARRAY['GDPR', 'ISO27001', 'SOC2', 'NIS2']
        )
    );
END $$;

-- ============================================
-- PARTE 6: Función para registrar eliminación de usuarios
-- ============================================
-- Esta función se llama desde el Edge Function manage-user
-- para mantener trazabilidad GDPR cuando se elimina un usuario

CREATE OR REPLACE FUNCTION public.log_user_deletion_event(
    p_deleted_user_id UUID,
    p_deleted_by UUID,
    p_original_email TEXT,
    p_original_rol TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit', 'pg_catalog'
AS $function$
BEGIN
    INSERT INTO audit.security_events (
        event_type,
        user_id,
        email,
        event_timestamp,
        success,
        metadata
    ) VALUES (
        'USER_DELETION_GDPR',
        p_deleted_by,
        p_original_email,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'deleted_user_id', p_deleted_user_id,
            'original_email', p_original_email,
            'original_rol', p_original_rol,
            'deleted_by', p_deleted_by,
            'action', 'soft_delete_and_anonymization',
            'compliance', ARRAY['GDPR Art.17', 'ISO27001 A.8.3.2', 'SOC2', 'NIS2']
        )
    );
END;
$function$;

-- Revocar acceso a usuarios anónimos (seguridad)
REVOKE EXECUTE ON FUNCTION public.log_user_deletion_event FROM anon;
GRANT EXECUTE ON FUNCTION public.log_user_deletion_event TO authenticated;

COMMENT ON FUNCTION public.log_user_deletion_event IS 
'Registra eventos de eliminación de usuarios para cumplimiento GDPR y auditoría.
Llamada desde Edge Function manage-user cuando se elimina un comercial/admin.';
