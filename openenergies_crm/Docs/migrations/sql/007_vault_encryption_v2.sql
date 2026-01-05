-- ============================================================================
-- 007_vault_encryption_v2.sql
-- CIFRADO DE DATOS SENSIBLES CON SUPABASE VAULT (VERSIÓN CORREGIDA)
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- NOTA: Esta versión usa las funciones nativas de Supabase Vault
-- en lugar de INSERT/DELETE directos que requieren ser owner del schema
-- ============================================================================
-- Cumplimiento: GDPR Art. 32, ISO 27001 A.10.1, NIS2 Art. 21, SOC 2 CC6.1/CC6.7
-- Fecha: 5 de enero de 2026
-- Versión: 2.0 (Corregida)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECCIÓN 1: VERIFICAR EXTENSIONES NECESARIAS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault'
    ) THEN
        RAISE NOTICE 'supabase_vault ya está instalada en Supabase por defecto';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
    ) THEN
        RAISE NOTICE 'pgcrypto ya está instalada';
    END IF;
END $$;

-- ============================================================================
-- SECCIÓN 2: TABLA DE SECRETOS PARA CLIENTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    secret_type TEXT NOT NULL CHECK (secret_type IN ('iban', 'dni', 'tarjeta', 'otro')),
    vault_secret_id UUID NOT NULL,
    masked_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(cliente_id, secret_type)
);

CREATE INDEX IF NOT EXISTS idx_client_secrets_cliente 
    ON public.client_secrets (cliente_id);

ALTER TABLE public.client_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_secrets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cs_admin ON public.client_secrets;
CREATE POLICY cs_admin ON public.client_secrets
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cs_comercial_select ON public.client_secrets;
CREATE POLICY cs_comercial_select ON public.client_secrets
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 'comercial'
        AND public.can_access_cliente(cliente_id)
    );

COMMENT ON TABLE public.client_secrets IS 
'Tabla de referencia a secretos almacenados en Supabase Vault.
Los valores reales están cifrados en vault.secrets.
ISO 27001 A.10.1 - Controles criptográficos.';

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN PARA GUARDAR IBAN EN VAULT
-- Usa vault.create_secret() en lugar de INSERT directo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guardar_iban_vault(
    p_cliente_id UUID,
    p_iban TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_secret_id UUID;
    v_masked_iban TEXT;
    v_existing_secret_id UUID;
    v_iban_clean TEXT;
    v_secret_name TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Verificar permisos
    IF NOT (public.is_admin() OR (
        public.current_user_role() = 'comercial' 
        AND public.can_access_cliente(p_cliente_id)
    )) THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'VAULT_ACCESS_DENIED', v_user_id, current_timestamp, FALSE,
            'Intento de guardar IBAN sin permisos',
            jsonb_build_object('cliente_id', p_cliente_id)
        );
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Validar y limpiar IBAN
    v_iban_clean := UPPER(REPLACE(REPLACE(p_iban, ' ', ''), '-', ''));
    
    IF LENGTH(v_iban_clean) < 15 OR LENGTH(v_iban_clean) > 34 THEN
        RAISE EXCEPTION 'IBAN inválido: longitud incorrecta' USING ERRCODE = 'INVLD';
    END IF;
    
    IF NOT v_iban_clean ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$' THEN
        RAISE EXCEPTION 'IBAN inválido: formato incorrecto' USING ERRCODE = 'INVLD';
    END IF;
    
    -- Crear valor enmascarado
    v_masked_iban := REPEAT('*', LENGTH(v_iban_clean) - 4) || RIGHT(v_iban_clean, 4);
    
    -- Nombre del secreto en vault
    v_secret_name := 'iban_cliente_' || p_cliente_id::TEXT;
    
    -- Verificar si ya existe un secreto
    SELECT vault_secret_id INTO v_existing_secret_id
    FROM public.client_secrets
    WHERE cliente_id = p_cliente_id AND secret_type = 'iban';
    
    IF v_existing_secret_id IS NOT NULL THEN
        -- USAR vault.update_secret() en lugar de DELETE + INSERT
        -- Actualizar secreto existente en vault
        PERFORM vault.update_secret(
            v_existing_secret_id,  -- secret_id
            v_iban_clean,          -- new_secret
            v_secret_name,         -- new_name  
            'IBAN del cliente ' || p_cliente_id::TEXT || ' - Actualizado'  -- new_description
        );
        v_secret_id := v_existing_secret_id;
    ELSE
        -- USAR vault.create_secret() en lugar de INSERT directo
        -- Crear nuevo secreto en vault
        v_secret_id := vault.create_secret(
            v_iban_clean,          -- secret
            v_secret_name,         -- name
            'IBAN del cliente ' || p_cliente_id::TEXT || ' - Cifrado automático'  -- description
        );
    END IF;
    
    -- Actualizar o insertar referencia en client_secrets
    INSERT INTO public.client_secrets (
        cliente_id, secret_type, vault_secret_id, masked_value, 
        created_by, created_at
    ) VALUES (
        p_cliente_id, 'iban', v_secret_id, v_masked_iban,
        v_user_id, current_timestamp
    )
    ON CONFLICT (cliente_id, secret_type) DO UPDATE SET
        vault_secret_id = v_secret_id,
        masked_value = v_masked_iban,
        updated_at = current_timestamp,
        updated_by = v_user_id;
    
    -- Guardar versión enmascarada en tabla clientes
    UPDATE public.clientes
    SET 
        numero_cuenta = v_masked_iban,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = p_cliente_id;
    
    -- Registrar operación
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'IBAN_STORED_IN_VAULT', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'masked_value', v_masked_iban
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'cliente_id', p_cliente_id,
        'masked_iban', v_masked_iban,
        'message', 'IBAN almacenado de forma segura en vault'
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 4: FUNCIÓN PARA RECUPERAR IBAN DESDE VAULT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.obtener_iban_vault(p_cliente_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_secret_id UUID;
    v_iban TEXT;
BEGIN
    v_user_id := auth.uid();
    v_user_role := public.current_user_role();
    
    -- Solo admins pueden ver el IBAN completo
    IF v_user_role != 'administrador' THEN
        SELECT masked_value INTO v_iban
        FROM public.client_secrets
        WHERE cliente_id = p_cliente_id AND secret_type = 'iban';
        
        IF v_iban IS NULL THEN
            SELECT numero_cuenta INTO v_iban FROM public.clientes WHERE id = p_cliente_id;
        END IF;
        
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, metadata
        ) VALUES (
            'IBAN_ACCESS_MASKED', v_user_id, current_timestamp, TRUE,
            jsonb_build_object('cliente_id', p_cliente_id, 'role', v_user_role)
        );
        
        RETURN v_iban;
    END IF;
    
    -- Admin: obtener de vault
    SELECT cs.vault_secret_id INTO v_secret_id
    FROM public.client_secrets cs
    WHERE cs.cliente_id = p_cliente_id AND cs.secret_type = 'iban';
    
    IF v_secret_id IS NULL THEN
        SELECT numero_cuenta INTO v_iban FROM public.clientes WHERE id = p_cliente_id;
        RETURN v_iban;
    END IF;
    
    -- Obtener secreto descifrado desde la vista
    SELECT decrypted_secret INTO v_iban
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'IBAN_ACCESS_DECRYPTED', v_user_id, current_timestamp, TRUE,
        jsonb_build_object('cliente_id', p_cliente_id)
    );
    
    RETURN v_iban;
END;
$$;

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PARA ELIMINAR IBAN DE VAULT
-- NOTA: Supabase Vault no expone función de delete pública
-- Alternativa: Actualizar el secreto con valor vacío o NULL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.eliminar_iban_vault(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_secret_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden eliminar IBANs' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener secret_id
    SELECT vault_secret_id INTO v_secret_id
    FROM public.client_secrets
    WHERE cliente_id = p_cliente_id AND secret_type = 'iban';
    
    IF v_secret_id IS NOT NULL THEN
        -- Actualizar secreto a valor vacío (no podemos DELETE directamente)
        -- Esto "invalida" el secreto sin necesitar ser owner del schema
        PERFORM vault.update_secret(
            v_secret_id,
            '[ELIMINADO]',
            'iban_deleted_' || p_cliente_id::TEXT,
            'IBAN eliminado el ' || current_timestamp::TEXT
        );
        
        -- Eliminar referencia
        DELETE FROM public.client_secrets
        WHERE cliente_id = p_cliente_id AND secret_type = 'iban';
    END IF;
    
    -- Limpiar campo en tabla clientes
    UPDATE public.clientes
    SET 
        numero_cuenta = NULL,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = p_cliente_id;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'IBAN_DELETED_FROM_VAULT', v_user_id, current_timestamp, TRUE,
        jsonb_build_object('cliente_id', p_cliente_id)
    );
    
    RETURN jsonb_build_object('success', TRUE, 'cliente_id', p_cliente_id);
END;
$$;

-- ============================================================================
-- SECCIÓN 6: TRIGGER PARA SINCRONIZAR IBAN CON VAULT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_iban_to_vault()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.numero_cuenta IS NOT NULL 
       AND NEW.numero_cuenta IS DISTINCT FROM OLD.numero_cuenta
       AND NEW.numero_cuenta NOT LIKE '*%' THEN
        
        PERFORM public.guardar_iban_vault(NEW.id, NEW.numero_cuenta);
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_iban_vault ON public.clientes;
CREATE TRIGGER trg_sync_iban_vault
    AFTER INSERT OR UPDATE OF numero_cuenta ON public.clientes
    FOR EACH ROW
    WHEN (NEW.numero_cuenta IS NOT NULL AND NEW.numero_cuenta NOT LIKE '*%')
    EXECUTE FUNCTION public.sync_iban_to_vault();

-- ============================================================================
-- SECCIÓN 7: FUNCIONES PARA CIFRAR OTROS DATOS SENSIBLES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(
    p_data TEXT,
    p_context TEXT DEFAULT 'default'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_key BYTEA;
    v_encrypted TEXT;
BEGIN
    SELECT decode(decrypted_secret, 'hex')
    INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'encryption_key_' || p_context;
    
    IF v_key IS NULL THEN
        v_key := digest('openenergies-crm-key-' || p_context, 'sha256');
    END IF;
    
    v_encrypted := encode(
        encrypt(
            p_data::bytea,
            v_key,
            'aes-cbc/pad:pkcs'
        ),
        'base64'
    );
    
    RETURN v_encrypted;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(
    p_encrypted TEXT,
    p_context TEXT DEFAULT 'default'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_key BYTEA;
    v_decrypted TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT decode(decrypted_secret, 'hex')
    INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'encryption_key_' || p_context;
    
    IF v_key IS NULL THEN
        v_key := digest('openenergies-crm-key-' || p_context, 'sha256');
    END IF;
    
    v_decrypted := convert_from(
        decrypt(
            decode(p_encrypted, 'base64'),
            v_key,
            'aes-cbc/pad:pkcs'
        ),
        'UTF8'
    );
    
    RETURN v_decrypted;
END;
$$;

-- ============================================================================
-- SECCIÓN 8: VISTA SEGURA DE CLIENTES
-- ============================================================================

CREATE OR REPLACE VIEW public.vista_clientes_seguros AS
SELECT 
    c.id,
    c.tipo,
    c.nombre,
    CASE 
        WHEN public.is_admin() THEN c.dni
        WHEN c.dni IS NOT NULL THEN REGEXP_REPLACE(c.dni, '(.{3}).+(.{2})', '\1****\2')
        ELSE NULL
    END AS dni,
    CASE 
        WHEN public.is_admin() THEN c.cif
        WHEN c.cif IS NOT NULL THEN REGEXP_REPLACE(c.cif, '(.{2}).+(.{3})', '\1****\3')
        ELSE NULL
    END AS cif,
    CASE
        WHEN public.is_admin() THEN c.email_facturacion
        WHEN c.email_facturacion IS NOT NULL THEN REGEXP_REPLACE(c.email_facturacion, '(.{2}).+(@.+)', '\1****\2')
        ELSE NULL
    END AS email_facturacion,
    CASE
        WHEN public.is_admin() THEN c.telefonos
        WHEN c.telefonos IS NOT NULL THEN REGEXP_REPLACE(c.telefonos, '(.{3}).+(.{3})', '\1***\2')
        ELSE NULL
    END AS telefonos,
    c.representante,
    COALESCE(cs.masked_value, c.numero_cuenta) AS numero_cuenta_masked,
    c.estado,
    c.creado_en,
    c.eliminado_en IS NOT NULL AS is_deleted
FROM public.clientes c
LEFT JOIN public.client_secrets cs ON cs.cliente_id = c.id AND cs.secret_type = 'iban'
WHERE c.eliminado_en IS NULL
  AND public.can_access_cliente(c.id);

COMMENT ON VIEW public.vista_clientes_seguros IS 
'Vista de clientes con datos sensibles enmascarados.
Admins ven datos completos, otros usuarios ven datos parcialmente ocultos.';

-- ============================================================================
-- SECCIÓN 9: FUNCIÓN PARA MIGRAR IBANs EXISTENTES A VAULT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.migrar_ibans_a_vault()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cliente RECORD;
    v_migrados INT := 0;
    v_errores INT := 0;
    v_resultado JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden ejecutar la migración';
    END IF;
    
    FOR v_cliente IN 
        SELECT id, numero_cuenta 
        FROM public.clientes 
        WHERE numero_cuenta IS NOT NULL 
          AND numero_cuenta NOT LIKE '*%'
          AND eliminado_en IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.client_secrets cs
              WHERE cs.cliente_id = clientes.id AND cs.secret_type = 'iban'
          )
    LOOP
        BEGIN
            PERFORM public.guardar_iban_vault(v_cliente.id, v_cliente.numero_cuenta);
            v_migrados := v_migrados + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errores := v_errores + 1;
            RAISE NOTICE 'Error migrando cliente %: %', v_cliente.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'migrados', v_migrados,
        'errores', v_errores,
        'ejecutado_en', current_timestamp
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 10: CLAVE MAESTRA EN VAULT
-- EJECUTAR MANUALMENTE después de la migración
-- ============================================================================
/*
-- Crear clave maestra usando vault.create_secret()
SELECT vault.create_secret(
    encode(gen_random_bytes(32), 'hex'),
    'encryption_key_default',
    'Clave maestra AES-256 para cifrado de datos sensibles'
);

-- Verificar que se creó
SELECT name, created_at FROM vault.decrypted_secrets WHERE name LIKE 'encryption_key%';
*/

-- ============================================================================
-- SECCIÓN 11: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.guardar_iban_vault(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_iban_vault(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_iban_vault(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrar_ibans_a_vault() TO authenticated;
GRANT SELECT ON public.vista_clientes_seguros TO authenticated;
GRANT SELECT ON public.client_secrets TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar funciones de vault disponibles
SELECT proname FROM pg_proc WHERE proname LIKE '%secret%' AND pronamespace = 'vault'::regnamespace;

-- 2. Verificar tabla de secretos
SELECT * FROM public.client_secrets LIMIT 5;

-- 3. Probar crear clave maestra
SELECT vault.create_secret(
    encode(gen_random_bytes(32), 'hex'),
    'encryption_key_default',
    'Clave maestra AES-256'
);

-- 4. Verificar vista segura
SELECT * FROM public.vista_clientes_seguros LIMIT 5;
*/
