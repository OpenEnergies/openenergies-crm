-- ============================================================================
-- FASE 8: INTEGRACIÓN CON SISTEMA DE ANONIMIZACIÓN GDPR
-- ============================================================================
-- Descripción: Integra el cifrado con el sistema existente de soft delete,
--              anonimización y solicitudes de eliminación GDPR
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 17 (Derecho al olvido), Art. 32 (Seguridad)
-- ============================================================================

-- ============================================================================
-- 8.1 FUNCIÓN: Limpiar datos cifrados de un cliente (GDPR Art. 17)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.limpiar_datos_cifrados_cliente(p_cliente_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'audit'
AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Eliminar todos los datos cifrados del cliente
    DELETE FROM public.datos_sensibles_cifrados 
    WHERE entidad_tipo = 'cliente' AND entidad_id = p_cliente_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    -- También eliminar datos de contratos asociados al cliente
    DELETE FROM public.datos_sensibles_cifrados 
    WHERE entidad_tipo = 'contrato' 
    AND entidad_id IN (
        SELECT c.id FROM public.contratos c
        JOIN public.puntos_suministro ps ON c.punto_id = ps.id
        WHERE ps.cliente_id = p_cliente_id
    );
    
    -- Registrar en auditoría de seguridad
    INSERT INTO audit.security_events (
        event_type, 
        user_id, 
        event_timestamp, 
        success, 
        metadata
    ) VALUES (
        'ENCRYPTED_DATA_PURGED_GDPR',
        v_user_id,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'registros_eliminados', v_deleted,
            'motivo', 'Anonimización GDPR Art. 17'
        )
    );
    
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.limpiar_datos_cifrados_cliente IS 
'Elimina todos los datos cifrados de un cliente y sus contratos asociados.
Usado en anonimización GDPR Art. 17 (derecho al olvido).
Se ejecuta automáticamente al hacer soft delete de un cliente.';

-- ============================================================================
-- 8.2 MODIFICAR TRIGGER DE ANONIMIZACIÓN EXISTENTE
-- ============================================================================
-- Añadir llamada a limpiar_datos_cifrados_cliente en el trigger existente

CREATE OR REPLACE FUNCTION public.auto_anonimizar_cliente_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
    v_user_id UUID;
    v_hash_id TEXT;
    v_puntos_count INTEGER := 0;
    v_documentos_count INTEGER := 0;
    v_contactos_count INTEGER := 0;
    v_contratos_count INTEGER := 0;
    v_cifrados_eliminados INTEGER := 0;
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
        
        -- =====================================================================
        -- NUEVO: Eliminar datos cifrados ANTES de anonimizar
        -- =====================================================================
        v_cifrados_eliminados := public.limpiar_datos_cifrados_cliente(NEW.id);
        
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
            numero_cuenta = NULL  -- Limpiar cuenta bancaria del contrato
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
            prospecto_contacto = NULL,
            eliminado_en = current_timestamp,
            eliminado_por = v_user_id,
            modificado_en = current_timestamp,
            modificado_por = v_user_id
        WHERE cliente_id = NEW.id
          AND eliminado_en IS NULL;
        
        -- Registrar en auditoría
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, metadata
        ) VALUES (
            'CLIENT_ANONYMIZED_GDPR',
            v_user_id,
            current_timestamp,
            TRUE,
            jsonb_build_object(
                'cliente_id', NEW.id,
                'hash_referencia', substring(v_hash_id, 1, 16),
                'puntos_anonimizados', v_puntos_count,
                'contratos_eliminados', v_contratos_count,
                'documentos_eliminados', v_documentos_count,
                'contactos_eliminados', v_contactos_count,
                'datos_cifrados_eliminados', v_cifrados_eliminados
            )
        );
        
        RAISE NOTICE 'Cliente % anonimizado. Puntos: %, Contratos: %, Docs: %, Contactos: %, Cifrados: %',
            NEW.id, v_puntos_count, v_contratos_count, v_documentos_count, 
            v_contactos_count, v_cifrados_eliminados;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_anonimizar_cliente_on_delete() IS 
'Anonimiza automáticamente todos los datos de un cliente al hacer soft delete.
Incluye limpieza de datos cifrados en datos_sensibles_cifrados.
GDPR Art. 17 (Derecho al olvido), Art. 32 (Seguridad del tratamiento).';

-- ============================================================================
-- 8.3 ASEGURAR QUE EL TRIGGER EXISTE
-- ============================================================================
DROP TRIGGER IF EXISTS trg_auto_anonimizar_cliente ON public.clientes;

CREATE TRIGGER trg_auto_anonimizar_cliente
    BEFORE UPDATE OF eliminado_en ON public.clientes
    FOR EACH ROW
    WHEN (OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL)
    EXECUTE FUNCTION public.auto_anonimizar_cliente_on_delete();

-- ============================================================================
-- 8.4 ACTUALIZAR FUNCIÓN DE SOLICITUDES DE ELIMINACIÓN (si existe)
-- ============================================================================
-- Esta función se usa cuando se procesa una solicitud de eliminación GDPR

CREATE OR REPLACE FUNCTION public.procesar_solicitud_eliminacion_gdpr(
    p_solicitud_id UUID,
    p_accion TEXT  -- 'aprobar' o 'rechazar'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'audit'
AS $$
DECLARE
    v_user_id UUID;
    v_solicitud RECORD;
    v_cliente_id UUID;
    v_resultado JSONB;
BEGIN
    v_user_id := auth.uid();
    
    -- Solo admins pueden procesar
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden procesar solicitudes GDPR'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener solicitud
    SELECT * INTO v_solicitud
    FROM public.solicitudes_eliminacion
    WHERE id = p_solicitud_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada: %', p_solicitud_id;
    END IF;
    
    IF p_accion = 'aprobar' THEN
        -- Buscar cliente asociado
        IF v_solicitud.tipo_usuario = 'cliente' THEN
            SELECT id INTO v_cliente_id
            FROM public.clientes
            WHERE id = v_solicitud.usuario_id::UUID
              AND eliminado_en IS NULL;
            
            IF v_cliente_id IS NOT NULL THEN
                -- Hacer soft delete (esto dispara auto_anonimizar_cliente_on_delete)
                UPDATE public.clientes
                SET 
                    eliminado_en = current_timestamp,
                    eliminado_por = v_user_id
                WHERE id = v_cliente_id;
            END IF;
        END IF;
        
        -- Actualizar solicitud
        UPDATE public.solicitudes_eliminacion
        SET 
            estado = 'anonimizado_total',
            fecha_anonimizado_total = current_timestamp,
            anonimizado_por = v_user_id,
            modificado_en = current_timestamp,
            notas = COALESCE(notas, '') || E'\n[' || current_timestamp || '] Aprobada por admin.'
        WHERE id = p_solicitud_id;
        
        v_resultado := jsonb_build_object(
            'success', TRUE,
            'accion', 'aprobada',
            'cliente_anonimizado', v_cliente_id
        );
    ELSE
        -- Rechazar
        UPDATE public.solicitudes_eliminacion
        SET 
            estado = 'rechazado',
            verificado_por = v_user_id,
            verificado_en = current_timestamp,
            modificado_en = current_timestamp
        WHERE id = p_solicitud_id;
        
        v_resultado := jsonb_build_object('success', TRUE, 'accion', 'rechazada');
    END IF;
    
    -- Auditar
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_REQUEST_PROCESSED',
        v_user_id,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'solicitud_id', p_solicitud_id,
            'accion', p_accion,
            'resultado', v_resultado
        )
    );
    
    RETURN v_resultado;
END;
$$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar funciones
SELECT routine_name, security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'limpiar_datos_cifrados_cliente',
    'auto_anonimizar_cliente_on_delete',
    'procesar_solicitud_eliminacion_gdpr'
);

-- Verificar trigger
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_auto_anonimizar_cliente';
