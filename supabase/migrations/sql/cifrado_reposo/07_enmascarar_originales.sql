-- ============================================================================
-- FASE 7: ENMASCARAR DATOS ORIGINALES
-- ============================================================================
-- Descripción: Enmascara los datos en las tablas originales
--              (después de verificar que la migración fue exitosa)
-- IMPORTANTE: Ejecutar SOLO después de verificar que 06_migrar... funcionó
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32
-- ============================================================================

-- ============================================================================
-- 7.0 VERIFICACIÓN PRE-ENMASCARADO
-- ============================================================================
-- Ejecutar esta verificación antes de continuar
DO $$
DECLARE
    v_clientes_total INTEGER;
    v_cifrados_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_clientes_total 
    FROM clientes WHERE eliminado_en IS NULL;
    
    SELECT COUNT(DISTINCT entidad_id) INTO v_cifrados_count 
    FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN PRE-ENMASCARADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Clientes activos: %', v_clientes_total;
    RAISE NOTICE 'Clientes con datos cifrados: %', v_cifrados_count;
    
    IF v_cifrados_count = 0 THEN
        RAISE EXCEPTION 'ERROR: No hay datos cifrados. Ejecutar primero 06_migrar_datos_existentes.sql';
    END IF;
    
    IF v_cifrados_count < (v_clientes_total * 0.5) THEN
        RAISE WARNING 'ADVERTENCIA: Solo % de % clientes tienen datos cifrados. Verificar migración.', 
            v_cifrados_count, v_clientes_total;
    END IF;
    
    RAISE NOTICE '✅ Verificación completada. Procediendo con enmascarado...';
END $$;

-- ============================================================================
-- 7.1 DESHABILITAR TRIGGERS (para evitar re-cifrado durante UPDATE)
-- ============================================================================
ALTER TABLE public.clientes DISABLE TRIGGER trg_cifrar_datos_cliente;
ALTER TABLE public.contratos DISABLE TRIGGER trg_cifrar_datos_contrato;

-- ============================================================================
-- 7.2 ENMASCARAR DATOS EN TABLA CLIENTES
-- ============================================================================
-- DNI: Enmascarar como ****XXXX (últimos 4 caracteres)
UPDATE public.clientes
SET dni = '****' || RIGHT(dni, 4)
WHERE eliminado_en IS NULL
  AND dni IS NOT NULL 
  AND dni NOT LIKE '****%'
  AND dni != 'ANONIMIZADO'
  AND LENGTH(dni) >= 8
  -- Solo si existe el dato cifrado
  AND EXISTS (
      SELECT 1 FROM datos_sensibles_cifrados 
      WHERE entidad_tipo = 'cliente' AND entidad_id = clientes.id AND campo = 'dni'
  );

-- CIF: Enmascarar como ****XXXX
UPDATE public.clientes
SET cif = '****' || RIGHT(cif, 4)
WHERE eliminado_en IS NULL
  AND cif IS NOT NULL 
  AND cif NOT LIKE '****%'
  AND cif != 'ANONIMIZADO'
  AND LENGTH(cif) >= 8
  AND EXISTS (
      SELECT 1 FROM datos_sensibles_cifrados 
      WHERE entidad_tipo = 'cliente' AND entidad_id = clientes.id AND campo = 'cif'
  );

-- EMAIL: NO ENMASCARAR (decisión híbrida - mantener visible)
-- El email ya está cifrado pero permanece visible para operativa diaria

-- TELEFONOS: Enmascarar como ****XXXX
UPDATE public.clientes
SET telefonos = '****' || RIGHT(REGEXP_REPLACE(telefonos, '[^0-9]', '', 'g'), 4)
WHERE eliminado_en IS NULL
  AND telefonos IS NOT NULL 
  AND telefonos NOT LIKE '****%'
  AND LENGTH(telefonos) >= 6
  AND EXISTS (
      SELECT 1 FROM datos_sensibles_cifrados 
      WHERE entidad_tipo = 'cliente' AND entidad_id = clientes.id AND campo = 'telefonos'
  );

-- NUMERO_CUENTA (IBAN): Enmascarar como ES57 **** **** **** 4264
UPDATE public.clientes
SET numero_cuenta = LEFT(REPLACE(numero_cuenta, ' ', ''), 4) 
                    || ' **** **** **** ' 
                    || RIGHT(REPLACE(numero_cuenta, ' ', ''), 4)
WHERE eliminado_en IS NULL
  AND numero_cuenta IS NOT NULL 
  AND numero_cuenta NOT LIKE '****%'
  AND numero_cuenta NOT LIKE 'ES__ ****%'
  AND LENGTH(REPLACE(numero_cuenta, ' ', '')) >= 16
  AND EXISTS (
      SELECT 1 FROM datos_sensibles_cifrados 
      WHERE entidad_tipo = 'cliente' AND entidad_id = clientes.id AND campo = 'iban'
  );

-- ============================================================================
-- 7.3 ENMASCARAR DATOS EN TABLA CONTRATOS
-- ============================================================================
UPDATE public.contratos
SET numero_cuenta = LEFT(REPLACE(numero_cuenta, ' ', ''), 4) 
                    || ' **** **** **** ' 
                    || RIGHT(REPLACE(numero_cuenta, ' ', ''), 4)
WHERE eliminado_en IS NULL
  AND numero_cuenta IS NOT NULL 
  AND numero_cuenta NOT LIKE '****%'
  AND numero_cuenta NOT LIKE 'ES__ ****%'
  AND LENGTH(REPLACE(numero_cuenta, ' ', '')) >= 16
  AND EXISTS (
      SELECT 1 FROM datos_sensibles_cifrados 
      WHERE entidad_tipo = 'contrato' AND entidad_id = contratos.id AND campo = 'iban'
  );

-- ============================================================================
-- 7.4 REHABILITAR TRIGGERS
-- ============================================================================
ALTER TABLE public.clientes ENABLE TRIGGER trg_cifrar_datos_cliente;
ALTER TABLE public.contratos ENABLE TRIGGER trg_cifrar_datos_contrato;

-- ============================================================================
-- VERIFICACIÓN POST-ENMASCARADO
-- ============================================================================

-- Verificar que los datos están enmascarados
SELECT 
    'Clientes con DNI enmascarado' as verificacion,
    COUNT(*) as cantidad
FROM public.clientes 
WHERE eliminado_en IS NULL AND dni LIKE '****%'
UNION ALL
SELECT 
    'Clientes con CIF enmascarado',
    COUNT(*) 
FROM public.clientes 
WHERE eliminado_en IS NULL AND cif LIKE '****%'
UNION ALL
SELECT 
    'Clientes con teléfono enmascarado',
    COUNT(*) 
FROM public.clientes 
WHERE eliminado_en IS NULL AND telefonos LIKE '****%'
UNION ALL
SELECT 
    'Clientes con IBAN enmascarado',
    COUNT(*) 
FROM public.clientes 
WHERE eliminado_en IS NULL AND numero_cuenta LIKE '%****%'
UNION ALL
SELECT 
    'Contratos con IBAN enmascarado',
    COUNT(*) 
FROM public.contratos 
WHERE eliminado_en IS NULL AND numero_cuenta LIKE '%****%';

-- Muestra de datos enmascarados
SELECT id, nombre, dni, cif, email, telefonos, numero_cuenta
FROM public.clientes 
WHERE eliminado_en IS NULL 
LIMIT 10;
