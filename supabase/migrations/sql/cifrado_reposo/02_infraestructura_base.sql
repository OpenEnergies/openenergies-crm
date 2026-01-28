-- ============================================================================
-- FASE 2: INFRAESTRUCTURA BASE
-- ============================================================================
-- Descripción: Crea schema private y función get_encryption_key
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32, ISO 27001 A.10.1
-- ============================================================================

-- 2.1 Crear schema private si no existe
CREATE SCHEMA IF NOT EXISTS private;

-- 2.2 Revocar accesos públicos al schema private
REVOKE ALL ON SCHEMA private FROM public;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- 2.3 Otorgar acceso solo a roles de servicio
GRANT USAGE ON SCHEMA private TO postgres;
GRANT USAGE ON SCHEMA private TO service_role;

-- 2.4 Comentario del schema
COMMENT ON SCHEMA private IS 'Schema privado para funciones de seguridad. 
Solo accesible por postgres y service_role. GDPR Art. 32 / ISO 27001 A.10.1';

-- ============================================================================
-- 2.5 Función para obtener la clave de cifrado desde Vault
-- ============================================================================
-- SECURITY DEFINER: Ejecuta con permisos del owner (postgres)
-- Esto permite que funciones llamadas por usuarios normales puedan 
-- acceder a la clave, pero NUNCA directamente.

CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_key TEXT;
BEGIN
    -- Obtener la clave descifrada desde la vista de Vault
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets 
    WHERE name = 'encryption_key_datos_sensibles';
    
    -- Verificar que la clave existe
    IF v_key IS NULL THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: Clave de cifrado no encontrada en Vault. 
Ejecutar primero 01_crear_clave_vault.sql'
            USING ERRCODE = 'P0001';
    END IF;
    
    RETURN v_key;
END;
$$;

-- 2.6 Revocar acceso directo a la función
REVOKE ALL ON FUNCTION private.get_encryption_key() FROM public;
REVOKE ALL ON FUNCTION private.get_encryption_key() FROM anon;
REVOKE ALL ON FUNCTION private.get_encryption_key() FROM authenticated;

-- Solo el owner (postgres) y service_role pueden ejecutarla directamente
-- Las funciones SECURITY DEFINER en public pueden usarla internamente
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO postgres;
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO service_role;

COMMENT ON FUNCTION private.get_encryption_key() IS 
'Obtiene la clave maestra de cifrado desde Vault. 
SECURITY DEFINER para permitir acceso controlado. 
NUNCA exponer directamente. GDPR Art. 32.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que el schema existe
SELECT schema_name, schema_owner 
FROM information_schema.schemata 
WHERE schema_name = 'private';

-- Verificar que la función existe y tiene SECURITY DEFINER
SELECT 
    routine_name,
    routine_schema,
    security_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines 
WHERE routine_schema = 'private' 
AND routine_name = 'get_encryption_key';

-- Test de la función (solo ejecutar como postgres/service_role)
-- SELECT LENGTH(private.get_encryption_key()) as key_length;
