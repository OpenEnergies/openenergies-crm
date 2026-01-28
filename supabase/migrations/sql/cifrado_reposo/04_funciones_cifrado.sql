-- ============================================================================
-- FASE 4: FUNCIONES DE CIFRADO Y DESCIFRADO
-- ============================================================================
-- Descripción: Funciones para guardar y obtener datos sensibles cifrados
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32, ISO 27001 A.10.1
-- ============================================================================

-- ============================================================================
-- 4.1 FUNCIÓN: Guardar dato sensible cifrado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guardar_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT,
    p_valor TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'private'
AS $$
DECLARE
    v_key TEXT;
    v_user_id UUID;
BEGIN
    -- Validar parámetros
    IF p_valor IS NULL OR p_valor = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Obtener clave de cifrado
    v_key := private.get_encryption_key();
    v_user_id := auth.uid();
    
    -- Insertar o actualizar dato cifrado
    INSERT INTO public.datos_sensibles_cifrados (
        entidad_tipo, 
        entidad_id, 
        campo, 
        valor_cifrado,
        created_by,
        created_at
    )
    VALUES (
        p_entidad_tipo, 
        p_entidad_id, 
        p_campo, 
        extensions.pgp_sym_encrypt(p_valor, v_key),
        v_user_id,
        now()
    )
    ON CONFLICT (entidad_tipo, entidad_id, campo) 
    DO UPDATE SET 
        valor_cifrado = extensions.pgp_sym_encrypt(p_valor, v_key),
        updated_at = now(),
        updated_by = v_user_id;
    
    RETURN TRUE;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error cifrando % para %/%: %', p_campo, p_entidad_tipo, p_entidad_id, SQLERRM;
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.guardar_dato_sensible IS 
'Cifra y almacena un dato sensible. SECURITY DEFINER para acceso a clave de Vault.
Parámetros: tipo_entidad (cliente/contrato), id_entidad, nombre_campo, valor_plano.
GDPR Art. 32.';

-- ============================================================================
-- 4.2 FUNCIÓN: Obtener dato sensible descifrado (solo admins)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.obtener_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'private', 'audit'
AS $$
DECLARE
    v_key TEXT;
    v_resultado TEXT;
    v_user_id UUID;
    v_user_role TEXT;
BEGIN
    v_user_id := auth.uid();
    v_user_role := public.current_user_role();
    
    -- Solo administradores pueden descifrar datos
    IF NOT public.is_admin() THEN
        -- Registrar intento de acceso no autorizado
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'SENSITIVE_DATA_ACCESS_DENIED',
            v_user_id,
            current_timestamp,
            FALSE,
            'Rol no autorizado: ' || COALESCE(v_user_role, 'NULL'),
            jsonb_build_object(
                'entidad_tipo', p_entidad_tipo,
                'entidad_id', p_entidad_id,
                'campo', p_campo
            )
        );
        
        RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden ver datos sensibles descifrados'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener clave de cifrado
    v_key := private.get_encryption_key();
    
    -- Descifrar dato
    SELECT extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT
    INTO v_resultado
    FROM public.datos_sensibles_cifrados
    WHERE entidad_tipo = p_entidad_tipo 
      AND entidad_id = p_entidad_id 
      AND campo = p_campo;
    
    -- Registrar acceso exitoso en auditoría
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'SENSITIVE_DATA_DECRYPTED',
        v_user_id,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'entidad_tipo', p_entidad_tipo,
            'entidad_id', p_entidad_id,
            'campo', p_campo
        )
    );
    
    RETURN v_resultado;
    
EXCEPTION 
    WHEN SQLSTATE 'AUTHZ' THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE WARNING 'Error descifrando % para %/%: %', p_campo, p_entidad_tipo, p_entidad_id, SQLERRM;
        RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.obtener_dato_sensible IS 
'Descifra y retorna un dato sensible. Solo para administradores.
Registra todos los accesos en audit.security_events.
GDPR Art. 32, ISO 27001 A.12.4.';

-- ============================================================================
-- 4.3 FUNCIÓN: Obtener múltiples datos sensibles de una entidad
-- ============================================================================
CREATE OR REPLACE FUNCTION public.obtener_datos_sensibles_entidad(
    p_entidad_tipo TEXT,
    p_entidad_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'private', 'audit'
AS $$
DECLARE
    v_key TEXT;
    v_resultado JSONB := '{}'::JSONB;
    v_user_id UUID;
    r RECORD;
BEGIN
    v_user_id := auth.uid();
    
    -- Solo administradores pueden descifrar datos
    IF NOT public.is_admin() THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'SENSITIVE_DATA_BULK_ACCESS_DENIED',
            v_user_id,
            current_timestamp,
            FALSE,
            'Rol no autorizado',
            jsonb_build_object('entidad_tipo', p_entidad_tipo, 'entidad_id', p_entidad_id)
        );
        
        RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden ver datos sensibles'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    v_key := private.get_encryption_key();
    
    -- Obtener todos los campos cifrados de la entidad
    FOR r IN 
        SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT as valor
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo AND entidad_id = p_entidad_id
    LOOP
        v_resultado := v_resultado || jsonb_build_object(r.campo, r.valor);
    END LOOP;
    
    -- Registrar acceso
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'SENSITIVE_DATA_BULK_DECRYPTED',
        v_user_id,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'entidad_tipo', p_entidad_tipo,
            'entidad_id', p_entidad_id,
            'campos_count', (SELECT COUNT(*) FROM jsonb_object_keys(v_resultado))
        )
    );
    
    RETURN v_resultado;
    
EXCEPTION 
    WHEN SQLSTATE 'AUTHZ' THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE WARNING 'Error obteniendo datos sensibles de %/%: %', p_entidad_tipo, p_entidad_id, SQLERRM;
        RETURN '{}'::JSONB;
END;
$$;

COMMENT ON FUNCTION public.obtener_datos_sensibles_entidad IS 
'Retorna JSONB con todos los campos sensibles descifrados de una entidad.
Solo para administradores. Ejemplo: {"dni": "12345678A", "email": "test@test.com"}
GDPR Art. 32.';

-- ============================================================================
-- 4.4 FUNCIÓN: Verificar si existe dato cifrado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.existe_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo 
          AND entidad_id = p_entidad_id 
          AND campo = p_campo
    );
$$;

COMMENT ON FUNCTION public.existe_dato_sensible IS 
'Verifica si existe un dato cifrado sin necesidad de descifrarlo.';

-- ============================================================================
-- 4.5 FUNCIÓN: Eliminar dato sensible cifrado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.eliminar_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT DEFAULT NULL  -- NULL = eliminar todos los campos de la entidad
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'audit'
AS $$
DECLARE
    v_deleted INTEGER;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Solo administradores pueden eliminar
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden eliminar datos sensibles'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    IF p_campo IS NULL THEN
        -- Eliminar todos los campos de la entidad
        DELETE FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo AND entidad_id = p_entidad_id;
    ELSE
        -- Eliminar campo específico
        DELETE FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo 
          AND entidad_id = p_entidad_id 
          AND campo = p_campo;
    END IF;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    -- Registrar eliminación
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'SENSITIVE_DATA_DELETED',
        v_user_id,
        current_timestamp,
        TRUE,
        jsonb_build_object(
            'entidad_tipo', p_entidad_tipo,
            'entidad_id', p_entidad_id,
            'campo', COALESCE(p_campo, 'ALL'),
            'registros_eliminados', v_deleted
        )
    );
    
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.eliminar_dato_sensible IS 
'Elimina datos sensibles cifrados. Usado en anonimización GDPR Art. 17.
Si campo es NULL, elimina todos los datos de la entidad.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que las funciones existen
SELECT routine_name, security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'guardar_dato_sensible', 
    'obtener_dato_sensible',
    'obtener_datos_sensibles_entidad',
    'existe_dato_sensible',
    'eliminar_dato_sensible'
);
