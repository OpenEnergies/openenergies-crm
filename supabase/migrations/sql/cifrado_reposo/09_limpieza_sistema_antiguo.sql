-- ============================================================================
-- FASE 9: LIMPIEZA DEL SISTEMA ANTIGUO
-- ============================================================================
-- Descripción: Elimina funciones, triggers y tablas obsoletas del sistema
--              de cifrado anterior (vault directo por IBAN)
-- IMPORTANTE: Ejecutar SOLO después de verificar que todo funciona
-- Fecha: 28 Enero 2026
-- ============================================================================

-- ============================================================================
-- 9.1 VERIFICACIÓN PREVIA
-- ============================================================================
DO $$
DECLARE
    v_datos_cifrados INTEGER;
    v_clientes_enmascarados INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_datos_cifrados FROM datos_sensibles_cifrados;
    
    SELECT COUNT(*) INTO v_clientes_enmascarados 
    FROM clientes 
    WHERE eliminado_en IS NULL 
    AND (dni LIKE '****%' OR cif LIKE '****%' OR telefonos LIKE '****%' OR numero_cuenta LIKE '%****%');
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN PRE-LIMPIEZA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Datos cifrados en nueva tabla: %', v_datos_cifrados;
    RAISE NOTICE 'Clientes con datos enmascarados: %', v_clientes_enmascarados;
    
    IF v_datos_cifrados = 0 THEN
        RAISE EXCEPTION 'ERROR: No hay datos en datos_sensibles_cifrados. NO ejecutar limpieza.';
    END IF;
    
    IF v_clientes_enmascarados = 0 THEN
        RAISE EXCEPTION 'ERROR: No hay clientes con datos enmascarados. Verificar migración antes de limpiar.';
    END IF;
    
    RAISE NOTICE '✅ Verificación OK. Procediendo con limpieza...';
END $$;

-- ============================================================================
-- 9.2 ELIMINAR TABLA client_secrets (vacía y sin uso)
-- ============================================================================
-- Primero eliminar políticas RLS
DROP POLICY IF EXISTS "Enable read/write for admin and comercial" ON public.client_secrets;

-- Luego eliminar la tabla
DROP TABLE IF EXISTS public.client_secrets CASCADE;

-- ============================================================================
-- 9.3 ELIMINAR FUNCIONES ANTIGUAS DE VAULT
-- ============================================================================

-- Función guardar_iban_vault (antigua, usaba vault directo)
DROP FUNCTION IF EXISTS public.guardar_iban_vault(UUID, TEXT);

-- Función leer_iban_vault (antigua)
DROP FUNCTION IF EXISTS public.leer_iban_vault(UUID);

-- Función obtener_iban_vault (antigua, para clientes)
DROP FUNCTION IF EXISTS public.obtener_iban_vault(UUID);

-- Función eliminar_iban_vault (antigua)
DROP FUNCTION IF EXISTS public.eliminar_iban_vault(UUID);

-- Función sync_iban_to_vault (antigua, trigger function)
DROP FUNCTION IF EXISTS public.sync_iban_to_vault() CASCADE;

-- Función migrar_ibans_a_vault (antigua, migración)
DROP FUNCTION IF EXISTS public.migrar_ibans_a_vault();

-- Funciones genéricas de cifrado si existen y no se usan
DROP FUNCTION IF EXISTS public.encrypt_sensitive_data(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.decrypt_sensitive_data(TEXT, TEXT);

-- ============================================================================
-- 9.4 SECRETOS EN VAULT
-- ============================================================================
-- Los IBANs antiguos (iban_cliente_*) ya fueron eliminados manualmente desde el Dashboard
-- Los secretos restantes (Service role key, supabase url, encryption_key_datos_sensibles) 
-- deben permanecer intactos

-- ============================================================================
-- 9.5 COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================
DO $$
BEGIN
    EXECUTE format(
        'COMMENT ON TABLE public.datos_sensibles_cifrados IS %L',
        'Almacén centralizado de datos PII cifrados con AES-256 (pgcrypto).
Reemplaza el sistema anterior de vault.secrets individuales.
GDPR Art. 32: Cifrado de datos personales.
ISO 27001 A.10.1: Controles criptográficos.
SOC 2 CC6.7: Cifrado en reposo.
NIS2: Medidas técnicas de seguridad.
Migrado: ' || current_timestamp::text
    );
END $$;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================
DO $$
DECLARE
    v_funciones_eliminadas INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'LIMPIEZA COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Tabla client_secrets eliminada';
    RAISE NOTICE '✅ Funciones antiguas eliminadas:';
    RAISE NOTICE '   - guardar_iban_vault';
    RAISE NOTICE '   - leer_iban_vault';
    RAISE NOTICE '   - obtener_iban_vault';
    RAISE NOTICE '   - eliminar_iban_vault';
    RAISE NOTICE '   - sync_iban_to_vault';
    RAISE NOTICE '   - migrar_ibans_a_vault';
    RAISE NOTICE '✅ Secretos individuales en vault marcados obsoletos';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'NUEVO SISTEMA ACTIVO:';
    RAISE NOTICE '  - Tabla: datos_sensibles_cifrados';
    RAISE NOTICE '  - Clave: vault.encryption_key_datos_sensibles';
    RAISE NOTICE '  - Funciones:';
    RAISE NOTICE '    * guardar_dato_sensible()';
    RAISE NOTICE '    * obtener_dato_sensible()';
    RAISE NOTICE '    * obtener_datos_sensibles_entidad()';
    RAISE NOTICE '    * eliminar_dato_sensible()';
    RAISE NOTICE '  - Triggers:';
    RAISE NOTICE '    * trg_cifrar_datos_cliente (clientes)';
    RAISE NOTICE '    * trg_cifrar_datos_contrato (contratos)';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que las funciones antiguas ya no existen
SELECT routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'guardar_iban_vault',
    'leer_iban_vault',
    'obtener_iban_vault',
    'eliminar_iban_vault',
    'sync_iban_to_vault',
    'migrar_ibans_a_vault'
);
-- Debe retornar 0 filas

-- Verificar que client_secrets no existe
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'client_secrets';
-- Debe retornar 0 filas

-- Estado final del nuevo sistema
SELECT 
    'datos_sensibles_cifrados' as tabla,
    COUNT(*) as registros_totales,
    COUNT(DISTINCT entidad_id) as entidades_unicas
FROM datos_sensibles_cifrados;
