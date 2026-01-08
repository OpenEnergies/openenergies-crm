-- ============================================================================
-- MIGRACIÓN: Restricción de eliminación y anonimización automática de clientes
-- Solo administradores pueden eliminar clientes (soft delete)
-- La anonimización se ejecuta automáticamente al hacer soft delete
-- Fecha: 2026-01-08
-- ============================================================================

-- VERIFICACIÓN PRE-MIGRACIÓN: Asegurar que existen las funciones necesarias
DO $$
BEGIN
    -- Verificar que existe is_admin()
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
        RAISE EXCEPTION 'Función is_admin() no existe. Abortando migración.';
    END IF;
    
    -- Verificar que existe current_user_role()
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_role') THEN
        RAISE EXCEPTION 'Función current_user_role() no existe. Abortando migración.';
    END IF;
    
    -- Verificar que existe la extensión pgcrypto para digest()
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'Extensión pgcrypto no está instalada. Abortando migración.';
    END IF;
    
    RAISE NOTICE 'Verificaciones pre-migración completadas correctamente.';
END $$;

-- 1. Modificar política de UPDATE para que solo admins puedan hacer soft delete
-- Primero eliminamos la política actual
DROP POLICY IF EXISTS cli_update ON public.clientes;

-- Crear nueva política para ADMINISTRADORES (pueden hacer todo incluyendo soft delete)
CREATE POLICY cli_update_admin ON public.clientes
    FOR UPDATE
    TO public
    USING (is_admin())
    WITH CHECK (is_admin());

-- Crear nueva política para COMERCIALES (pueden actualizar pero NO pueden hacer soft delete)
CREATE POLICY cli_update_comercial ON public.clientes
    FOR UPDATE
    TO public
    USING (
        current_user_role() = 'comercial' 
        AND eliminado_en IS NULL  -- Solo pueden ver/editar clientes no eliminados
    )
    WITH CHECK (
        current_user_role() = 'comercial'
        AND eliminado_en IS NULL  -- No pueden establecer eliminado_en (soft delete)
    );

-- 2. Crear función de anonimización automática (sin verificación de permisos, ya que el trigger lo controlará)
CREATE OR REPLACE FUNCTION public.auto_anonimizar_cliente_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
    v_user_id UUID;
    v_hash_id TEXT;
    v_puntos_count INTEGER := 0;
    v_documentos_count INTEGER := 0;
    v_contactos_count INTEGER := 0;
    v_contratos_count INTEGER := 0;
BEGIN
    -- Solo ejecutar si se está marcando como eliminado (eliminado_en pasa de NULL a valor)
    IF OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL THEN
        
        -- Obtener el usuario actual
        v_user_id := auth.uid();
        
        -- Verificar que es administrador (doble seguridad)
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Solo administradores pueden eliminar clientes'
                USING ERRCODE = 'AUTHZ';
        END IF;
        
        -- Generar hash único para referenciar el cliente anonimizado
        v_hash_id := encode(extensions.digest(NEW.id::text || current_timestamp::text, 'sha256'), 'hex');
        
        -- Anonimizar los datos del cliente en el mismo registro NEW
        NEW.nombre := 'CLIENTE_ANONIMIZADO_' || substring(v_hash_id, 1, 8);
        NEW.dni := CASE WHEN OLD.dni IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END;
        NEW.cif := CASE WHEN OLD.cif IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END;
        NEW.email := 'anonimizado_' || substring(v_hash_id, 1, 8) || '@eliminado.gdpr';
        NEW.telefonos := NULL;
        NEW.numero_cuenta := NULL;
        NEW.representante := CASE WHEN OLD.representante IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END;
        NEW.eliminado_por := v_user_id;
        NEW.modificado_por := v_user_id;
        NEW.modificado_en := current_timestamp;
        
        -- Soft delete de contactos_cliente
        UPDATE public.contactos_cliente
        SET
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        GET DIAGNOSTICS v_contactos_count = ROW_COUNT;
        
        -- Anonimizar puntos de suministro (mantener CUPS por obligación legal)
        UPDATE public.puntos_suministro
        SET
            direccion_sum = 'DATOS ELIMINADOS POR GDPR',
            localidad_sum = NULL,
            provincia_sum = NULL,
            direccion_fisc = 'DATOS ELIMINADOS POR GDPR',
            localidad_fisc = NULL,
            provincia_fisc = NULL,
            direccion_post = NULL,
            localidad_post = NULL,
            provincia_post = NULL,
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id,
            modificado_en = current_timestamp,
            modificado_por = v_user_id
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        GET DIAGNOSTICS v_puntos_count = ROW_COUNT;
        
        -- Soft delete de contratos asociados a los puntos del cliente
        UPDATE public.contratos c
        SET
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id,
            modificado_en = current_timestamp,
            modificado_por = v_user_id,
            numero_cuenta = NULL  -- Anonimizar cuenta bancaria del contrato
        FROM public.puntos_suministro ps
        WHERE c.punto_id = ps.id
          AND ps.cliente_id = NEW.id
          AND c.eliminado_en IS NULL;
        GET DIAGNOSTICS v_contratos_count = ROW_COUNT;
        
        -- Soft delete de documentos del cliente
        UPDATE public.documentos
        SET
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id,
            nombre_archivo = 'DOCUMENTO_ELIMINADO_GDPR'
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        GET DIAGNOSTICS v_documentos_count = ROW_COUNT;
        
        -- Anonimizar comparativas del cliente
        UPDATE public.comparativas
        SET
            prospecto_nombre = CASE WHEN prospecto_nombre IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END,
            prospecto_contacto = CASE WHEN prospecto_contacto IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END,
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        
        -- Soft delete de notificaciones del cliente
        UPDATE public.notificaciones
        SET
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id,
            destinatarios_emails = ARRAY['anonimizado@eliminado.gdpr']
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        
        -- Soft delete de facturación del cliente
        UPDATE public.facturacion_clientes
        SET
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        
        -- Eliminar secretos del cliente (IBAN cifrado en vault)
        DELETE FROM public.client_secrets
        WHERE cliente_id = NEW.id;
        
        -- Registrar en auditoría
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, metadata
        ) VALUES (
            'GDPR_AUTO_ANONYMIZATION', v_user_id, current_timestamp, TRUE,
            jsonb_build_object(
                'cliente_id', NEW.id,
                'nombre_original', OLD.nombre,
                'hash_referencia', v_hash_id,
                'registros_anonimizados', jsonb_build_object(
                    'contactos_cliente', v_contactos_count,
                    'puntos_suministro', v_puntos_count,
                    'contratos', v_contratos_count,
                    'documentos', v_documentos_count
                ),
                'trigger', 'auto_anonimizar_cliente_on_delete'
            )
        );
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Crear el trigger (reemplazar el anterior si existe)
DROP TRIGGER IF EXISTS trg_auto_anonimizar_cliente ON public.clientes;

CREATE TRIGGER trg_auto_anonimizar_cliente
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    WHEN (OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL)
    EXECUTE FUNCTION public.auto_anonimizar_cliente_on_delete();

-- 4. Eliminar el trigger handle_soft_delete anterior para clientes (el nuevo se encarga de todo)
DROP TRIGGER IF EXISTS trg_clientes_soft_delete ON public.clientes;

-- 5. Comentarios para documentación
COMMENT ON FUNCTION public.auto_anonimizar_cliente_on_delete() IS 
'Trigger que anonimiza automáticamente todos los datos personales de un cliente cuando se hace soft delete.
Solo administradores pueden ejecutar esta acción (verificado por RLS y por el propio trigger).
Cumple con GDPR Art. 17 (Derecho al olvido) automatizando la anonimización.';

COMMENT ON TRIGGER trg_auto_anonimizar_cliente ON public.clientes IS
'Trigger de anonimización automática GDPR. Se dispara cuando eliminado_en pasa de NULL a un timestamp.';

-- ============================================================================
-- ROLLBACK (ejecutar manualmente si es necesario revertir)
-- ============================================================================
/*
-- Para revertir esta migración, ejecutar:

-- 1. Eliminar las nuevas políticas
DROP POLICY IF EXISTS cli_update_admin ON public.clientes;
DROP POLICY IF EXISTS cli_update_comercial ON public.clientes;

-- 2. Restaurar la política original
CREATE POLICY cli_update ON public.clientes
    FOR UPDATE
    TO public
    USING (current_user_role() IN ('administrador', 'comercial'))
    WITH CHECK (TRUE);

-- 3. Eliminar el nuevo trigger
DROP TRIGGER IF EXISTS trg_auto_anonimizar_cliente ON public.clientes;

-- 4. Restaurar el trigger original
CREATE TRIGGER trg_clientes_soft_delete
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- 5. Eliminar la función (opcional, no afecta si se deja)
DROP FUNCTION IF EXISTS public.auto_anonimizar_cliente_on_delete();
*/