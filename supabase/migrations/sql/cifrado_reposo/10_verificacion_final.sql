-- ============================================================================
-- SCRIPT DE VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Descripción: Ejecutar después de completar todas las fases para verificar
--              que el sistema de cifrado funciona correctamente
-- Fecha: 28 Enero 2026
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR INFRAESTRUCTURA
-- ============================================================================
SELECT '=== 1. INFRAESTRUCTURA ===' as seccion;

-- 1.1 Schema private existe
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ Schema private existe' 
         ELSE '❌ Schema private NO existe' END as verificacion
FROM information_schema.schemata 
WHERE schema_name = 'private';

-- 1.2 Clave maestra en Vault
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ Clave maestra en Vault existe' 
         ELSE '❌ Clave maestra NO existe' END as verificacion
FROM vault.secrets 
WHERE name = 'encryption_key_datos_sensibles';

-- 1.3 Función get_encryption_key
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ Función get_encryption_key existe' 
         ELSE '❌ Función get_encryption_key NO existe' END as verificacion
FROM information_schema.routines 
WHERE routine_schema = 'private' AND routine_name = 'get_encryption_key';

-- ============================================================================
-- 2. VERIFICAR TABLA DE DATOS CIFRADOS
-- ============================================================================
SELECT '=== 2. TABLA DATOS CIFRADOS ===' as seccion;

-- 2.1 Tabla existe
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ Tabla datos_sensibles_cifrados existe' 
         ELSE '❌ Tabla NO existe' END as verificacion
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'datos_sensibles_cifrados';

-- 2.2 RLS habilitado
SELECT 
    '✅ RLS: ' || 
    CASE WHEN relrowsecurity THEN 'Habilitado' ELSE 'DESHABILITADO' END ||
    ' | Forzado: ' ||
    CASE WHEN relforcerowsecurity THEN 'Sí' ELSE 'No' END as verificacion
FROM pg_class 
WHERE relname = 'datos_sensibles_cifrados';

-- 2.3 Conteo de registros
SELECT 
    entidad_tipo,
    campo,
    COUNT(*) as registros
FROM datos_sensibles_cifrados
GROUP BY entidad_tipo, campo
ORDER BY entidad_tipo, campo;

-- ============================================================================
-- 3. VERIFICAR FUNCIONES DE CIFRADO
-- ============================================================================
SELECT '=== 3. FUNCIONES DE CIFRADO ===' as seccion;

SELECT 
    routine_name,
    CASE WHEN security_type = 'DEFINER' THEN '✅ SECURITY DEFINER' 
         ELSE '⚠️ ' || security_type END as seguridad
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'guardar_dato_sensible',
    'obtener_dato_sensible',
    'obtener_datos_sensibles_entidad',
    'existe_dato_sensible',
    'eliminar_dato_sensible',
    'limpiar_datos_cifrados_cliente'
)
ORDER BY routine_name;

-- ============================================================================
-- 4. VERIFICAR TRIGGERS
-- ============================================================================
SELECT '=== 4. TRIGGERS ===' as seccion;

SELECT 
    tgname as trigger_name,
    tgrelid::regclass as tabla,
    CASE tgenabled 
        WHEN 'O' THEN '✅ Habilitado'
        WHEN 'D' THEN '❌ Deshabilitado'
        ELSE tgenabled::text
    END as estado
FROM pg_trigger
WHERE tgname IN (
    'trg_cifrar_datos_cliente',
    'trg_cifrar_datos_contrato',
    'trg_auto_anonimizar_cliente'
);

-- ============================================================================
-- 5. VERIFICAR DATOS ENMASCARADOS
-- ============================================================================
SELECT '=== 5. DATOS ENMASCARADOS ===' as seccion;

SELECT 
    'DNI enmascarados' as tipo,
    COUNT(*) as cantidad
FROM clientes 
WHERE eliminado_en IS NULL AND dni LIKE '****%'
UNION ALL
SELECT 'CIF enmascarados', COUNT(*) 
FROM clientes WHERE eliminado_en IS NULL AND cif LIKE '****%'
UNION ALL
SELECT 'Teléfonos enmascarados', COUNT(*) 
FROM clientes WHERE eliminado_en IS NULL AND telefonos LIKE '****%'
UNION ALL
SELECT 'IBAN clientes enmascarados', COUNT(*) 
FROM clientes WHERE eliminado_en IS NULL AND numero_cuenta LIKE '%****%'
UNION ALL
SELECT 'IBAN contratos enmascarados', COUNT(*) 
FROM contratos WHERE eliminado_en IS NULL AND numero_cuenta LIKE '%****%';

-- ============================================================================
-- 6. TEST FUNCIONAL
-- ============================================================================
SELECT '=== 6. TEST FUNCIONAL ===' as seccion;

-- NOTA: El test de descifrado requiere ejecutarse desde el frontend con un usuario admin autenticado
-- Aquí solo verificamos que los datos cifrados existen y son válidos

SELECT 
    'Test de integridad' as test,
    CASE 
        WHEN COUNT(*) > 0 AND MIN(LENGTH(valor_cifrado::text)) > 50 
        THEN '✅ Datos cifrados tienen formato válido'
        ELSE '⚠️ Verificar datos cifrados'
    END as resultado
FROM datos_sensibles_cifrados
WHERE entidad_tipo = 'cliente' AND campo = 'dni';

-- ============================================================================
-- 7. VERIFICAR AUDITORÍA
-- ============================================================================
SELECT '=== 7. AUDITORÍA ===' as seccion;

SELECT 
    event_type,
    COUNT(*) as eventos,
    MAX(event_timestamp) as ultimo_evento
FROM audit.security_events
WHERE event_type IN (
    'SENSITIVE_DATA_DECRYPTED',
    'SENSITIVE_DATA_ACCESS_DENIED',
    'SENSITIVE_DATA_DELETED',
    'ENCRYPTED_DATA_PURGED_GDPR',
    'IBAN_ACCESS_DECRYPTED',
    'IBAN_STORED_IN_VAULT'
)
GROUP BY event_type
ORDER BY ultimo_evento DESC;

-- ============================================================================
-- 8. RESUMEN FINAL
-- ============================================================================
SELECT '=== 8. RESUMEN FINAL ===' as seccion;

SELECT 
    (SELECT COUNT(*) FROM datos_sensibles_cifrados) as total_datos_cifrados,
    (SELECT COUNT(DISTINCT entidad_id) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente') as clientes_con_datos_cifrados,
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL) as clientes_activos_total,
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND dni LIKE '****%') as clientes_dni_enmascarado;
