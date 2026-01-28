-- ============================================================================
-- FASE 6: MIGRAR DATOS EXISTENTES
-- ============================================================================
-- Descripción: Migra los datos sensibles actuales (en texto plano) a cifrado
-- Incluye migración de los 2 IBANs en vault.secrets antiguo
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32
-- 
-- IMPORTANTE: Este script NO modifica los datos originales en clientes/contratos
--             Solo COPIA los datos a la tabla datos_sensibles_cifrados
--             El enmascarado se hace en el script 07
-- ============================================================================

-- ============================================================================
-- 6.0 VERIFICACIONES PREVIAS (SEGURIDAD)
-- ============================================================================
DO $$
DECLARE
    v_key_exists BOOLEAN;
    v_tabla_existe BOOLEAN;
    v_registros_existentes INTEGER;
    v_clientes_a_migrar INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIONES PREVIAS DE SEGURIDAD';
    RAISE NOTICE '========================================';
    
    -- 1. Verificar que existe la clave en Vault
    SELECT EXISTS (
        SELECT 1 FROM vault.secrets WHERE name = 'encryption_key_datos_sensibles'
    ) INTO v_key_exists;
    
    IF NOT v_key_exists THEN
        RAISE EXCEPTION '❌ ERROR: No existe la clave encryption_key_datos_sensibles en Vault. Ejecutar primero 01_crear_clave_vault.sql';
    END IF;
    RAISE NOTICE '✅ Clave de cifrado encontrada en Vault';
    
    -- 2. Verificar que existe la tabla datos_sensibles_cifrados
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'datos_sensibles_cifrados'
    ) INTO v_tabla_existe;
    
    IF NOT v_tabla_existe THEN
        RAISE EXCEPTION '❌ ERROR: No existe la tabla datos_sensibles_cifrados. Ejecutar primero 03_tabla_datos_cifrados.sql';
    END IF;
    RAISE NOTICE '✅ Tabla datos_sensibles_cifrados existe';
    
    -- 3. Verificar si ya hay datos migrados (para evitar duplicados)
    SELECT COUNT(*) INTO v_registros_existentes FROM datos_sensibles_cifrados;
    IF v_registros_existentes > 0 THEN
        RAISE NOTICE '⚠️ ADVERTENCIA: Ya existen % registros en datos_sensibles_cifrados', v_registros_existentes;
        RAISE NOTICE '   Los nuevos registros se insertarán con ON CONFLICT DO NOTHING';
    END IF;
    
    -- 4. Contar clientes a migrar
    SELECT COUNT(*) INTO v_clientes_a_migrar 
    FROM clientes WHERE eliminado_en IS NULL;
    RAISE NOTICE '📊 Clientes activos a procesar: %', v_clientes_a_migrar;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verificaciones OK. Procediendo con migración...';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 6.1 DESHABILITAR TEMPORALMENTE EL TRIGGER (para evitar doble cifrado)
-- ============================================================================
ALTER TABLE public.clientes DISABLE TRIGGER trg_cifrar_datos_cliente;
ALTER TABLE public.contratos DISABLE TRIGGER trg_cifrar_datos_contrato;

-- ============================================================================
-- 6.2 MIGRAR DATOS EXISTENTES DE CLIENTES
-- ============================================================================
-- NOTA: Este bloque solo COPIA datos a la nueva tabla, NO modifica clientes
DO $$
DECLARE
    r RECORD;
    v_migrados INTEGER := 0;
    v_errores INTEGER := 0;
    v_key TEXT;
    v_dni_count INTEGER := 0;
    v_cif_count INTEGER := 0;
    v_email_count INTEGER := 0;
    v_tel_count INTEGER := 0;
    v_iban_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIO MIGRACIÓN DE DATOS DE CLIENTES';
    RAISE NOTICE '========================================';
    
    -- Obtener clave una sola vez
    v_key := private.get_encryption_key();
    
    IF v_key IS NULL THEN
        RAISE EXCEPTION '❌ ERROR: No se pudo obtener la clave de cifrado';
    END IF;
    
    FOR r IN 
        SELECT id, dni, cif, email, telefonos, numero_cuenta, nombre
        FROM public.clientes 
        WHERE eliminado_en IS NULL
        ORDER BY creado_en
    LOOP
        BEGIN
            -- Migrar DNI si existe y no está enmascarado
            IF r.dni IS NOT NULL 
               AND r.dni NOT LIKE '****%' 
               AND r.dni != 'ANONIMIZADO'
               AND LENGTH(r.dni) >= 8 THEN
                INSERT INTO public.datos_sensibles_cifrados 
                    (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
                VALUES (
                    'cliente', 
                    r.id, 
                    'dni', 
                    extensions.pgp_sym_encrypt(r.dni, v_key),
                    now()
                )
                ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
                
                IF FOUND THEN v_dni_count := v_dni_count + 1; END IF;
            END IF;
            
            -- Migrar CIF si existe y no está enmascarado
            IF r.cif IS NOT NULL 
               AND r.cif NOT LIKE '****%' 
               AND r.cif != 'ANONIMIZADO'
               AND LENGTH(r.cif) >= 8 THEN
                INSERT INTO public.datos_sensibles_cifrados 
                    (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
                VALUES (
                    'cliente', 
                    r.id, 
                    'cif', 
                    extensions.pgp_sym_encrypt(r.cif, v_key),
                    now()
                )
                ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
                
                IF FOUND THEN v_cif_count := v_cif_count + 1; END IF;
            END IF;
            
            -- Migrar Email (siempre, si existe y es válido)
            IF r.email IS NOT NULL 
               AND r.email NOT LIKE '%@eliminado.gdpr'
               AND r.email ~ '^[^@]+@[^@]+\.[^@]+$' THEN
                INSERT INTO public.datos_sensibles_cifrados 
                    (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
                VALUES (
                    'cliente', 
                    r.id, 
                    'email', 
                    extensions.pgp_sym_encrypt(r.email, v_key),
                    now()
                )
                ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
                
                IF FOUND THEN v_email_count := v_email_count + 1; END IF;
            END IF;
            
            -- Migrar Teléfonos si existe y no está enmascarado
            IF r.telefonos IS NOT NULL 
               AND r.telefonos NOT LIKE '****%'
               AND LENGTH(r.telefonos) >= 6 THEN
                INSERT INTO public.datos_sensibles_cifrados 
                    (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
                VALUES (
                    'cliente', 
                    r.id, 
                    'telefonos', 
                    extensions.pgp_sym_encrypt(r.telefonos, v_key),
                    now()
                )
                ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
                
                IF FOUND THEN v_tel_count := v_tel_count + 1; END IF;
            END IF;
            
            -- Migrar IBAN (numero_cuenta) si existe y no está enmascarado
            IF r.numero_cuenta IS NOT NULL 
               AND r.numero_cuenta NOT LIKE '****%'
               AND r.numero_cuenta NOT LIKE 'ES__ ****%'
               AND LENGTH(REPLACE(r.numero_cuenta, ' ', '')) >= 16 THEN
                INSERT INTO public.datos_sensibles_cifrados 
                    (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
                VALUES (
                    'cliente', 
                    r.id, 
                    'iban', 
                    extensions.pgp_sym_encrypt(r.numero_cuenta, v_key),
                    now()
                )
                ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
                
                IF FOUND THEN v_iban_count := v_iban_count + 1; END IF;
            END IF;
            
            v_migrados := v_migrados + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errores := v_errores + 1;
            RAISE WARNING '⚠️ Error migrando cliente % (%): %', r.id, r.nombre, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '----------------------------------------';
    RAISE NOTICE 'RESUMEN MIGRACIÓN CLIENTES:';
    RAISE NOTICE '  Clientes procesados: %', v_migrados;
    RAISE NOTICE '  DNIs cifrados: %', v_dni_count;
    RAISE NOTICE '  CIFs cifrados: %', v_cif_count;
    RAISE NOTICE '  Emails cifrados: %', v_email_count;
    RAISE NOTICE '  Teléfonos cifrados: %', v_tel_count;
    RAISE NOTICE '  IBANs cifrados: %', v_iban_count;
    RAISE NOTICE '  Errores: %', v_errores;
    RAISE NOTICE '----------------------------------------';
    
    IF v_errores > 0 THEN
        RAISE WARNING '⚠️ Hubo % errores durante la migración. Revisar logs.', v_errores;
    ELSE
        RAISE NOTICE '✅ Migración de clientes completada sin errores';
    END IF;
END $$;

-- ============================================================================
-- 6.3 MIGRAR DATOS EXISTENTES DE CONTRATOS (IBAN)
-- ============================================================================
-- NOTA: Según la verificación, actualmente hay 0 contratos con IBAN en texto plano
--       Este bloque existe por si en el futuro hay datos
DO $$
DECLARE
    r RECORD;
    v_migrados INTEGER := 0;
    v_key TEXT;
BEGIN
    RAISE NOTICE 'Migrando IBANs de contratos...';
    
    v_key := private.get_encryption_key();
    
    FOR r IN 
        SELECT id, numero_cuenta
        FROM public.contratos 
        WHERE eliminado_en IS NULL
        AND numero_cuenta IS NOT NULL
        AND numero_cuenta NOT LIKE '****%'
        AND numero_cuenta NOT LIKE 'ES__ ****%'
        AND LENGTH(REPLACE(numero_cuenta, ' ', '')) >= 16
    LOOP
        INSERT INTO public.datos_sensibles_cifrados 
            (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
        VALUES (
            'contrato', 
            r.id, 
            'iban', 
            extensions.pgp_sym_encrypt(r.numero_cuenta, v_key),
            now()
        )
        ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
        
        IF FOUND THEN v_migrados := v_migrados + 1; END IF;
    END LOOP;
    
    IF v_migrados = 0 THEN
        RAISE NOTICE 'ℹ️ No hay IBANs de contratos para migrar (todos están vacíos o ya enmascarados)';
    ELSE
        RAISE NOTICE '✅ Contratos con IBAN migrados: %', v_migrados;
    END IF;
END $$;

-- ============================================================================
-- 6.4 MIGRAR DATOS DESDE VAULT.SECRETS ANTIGUO (los 2 IBANs existentes)
-- ============================================================================
DO $$
DECLARE
    r RECORD;
    v_cliente_id UUID;
    v_iban TEXT;
    v_key TEXT;
    v_migrados INTEGER := 0;
BEGIN
    RAISE NOTICE 'Migrando IBANs desde vault.secrets antiguo...';
    
    v_key := private.get_encryption_key();
    
    FOR r IN 
        SELECT s.id, s.name, ds.decrypted_secret as iban
        FROM vault.secrets s
        JOIN vault.decrypted_secrets ds ON s.id = ds.id
        WHERE s.name LIKE 'iban_cliente_%'
    LOOP
        -- Extraer cliente_id del nombre (formato: iban_cliente_<uuid>)
        v_cliente_id := REPLACE(r.name, 'iban_cliente_', '')::UUID;
        v_iban := r.iban;
        
        -- Verificar que el cliente existe
        IF EXISTS (SELECT 1 FROM public.clientes WHERE id = v_cliente_id) THEN
            -- Insertar en nueva tabla si no existe
            INSERT INTO public.datos_sensibles_cifrados 
                (entidad_tipo, entidad_id, campo, valor_cifrado, created_at)
            VALUES (
                'cliente', 
                v_cliente_id, 
                'iban', 
                extensions.pgp_sym_encrypt(v_iban, v_key),
                now()
            )
            ON CONFLICT (entidad_tipo, entidad_id, campo) DO NOTHING;
            
            v_migrados := v_migrados + 1;
            RAISE NOTICE 'Migrado IBAN de vault para cliente: %', v_cliente_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'IBANs migrados desde vault antiguo: %', v_migrados;
END $$;

-- ============================================================================
-- 6.5 REHABILITAR TRIGGERS
-- ============================================================================
ALTER TABLE public.clientes ENABLE TRIGGER trg_cifrar_datos_cliente;
ALTER TABLE public.contratos ENABLE TRIGGER trg_cifrar_datos_contrato;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Contar registros migrados por tipo
SELECT 
    '📊 RESUMEN DE DATOS CIFRADOS' as seccion,
    entidad_tipo,
    campo,
    COUNT(*) as registros_cifrados
FROM public.datos_sensibles_cifrados
GROUP BY entidad_tipo, campo
ORDER BY entidad_tipo, campo;

-- Comparar con datos originales (lo que había vs lo que se migró)
SELECT 
    '📋 COMPARACIÓN: Datos originales vs Cifrados' as seccion,
    'clientes' as tabla,
    'dni' as campo,
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND dni IS NOT NULL AND dni NOT LIKE 'ANONIMO-%') as originales,
    (SELECT COUNT(*) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente' AND campo = 'dni') as cifrados
UNION ALL
SELECT 
    '',
    'clientes',
    'cif',
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND cif IS NOT NULL AND cif NOT LIKE 'ANONIMO-%'),
    (SELECT COUNT(*) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente' AND campo = 'cif')
UNION ALL
SELECT 
    '',
    'clientes',
    'email',
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND email IS NOT NULL AND email NOT LIKE '%@eliminado.gdpr'),
    (SELECT COUNT(*) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente' AND campo = 'email')
UNION ALL
SELECT 
    '',
    'clientes',
    'telefonos',
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND telefonos IS NOT NULL AND telefonos NOT LIKE '****%'),
    (SELECT COUNT(*) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente' AND campo = 'telefonos')
UNION ALL
SELECT 
    '',
    'clientes',
    'iban',
    (SELECT COUNT(*) FROM clientes WHERE eliminado_en IS NULL AND numero_cuenta IS NOT NULL AND numero_cuenta NOT LIKE '****%' AND LENGTH(REPLACE(numero_cuenta, ' ', '')) >= 16),
    (SELECT COUNT(*) FROM datos_sensibles_cifrados WHERE entidad_tipo = 'cliente' AND campo = 'iban');

-- Verificar total
SELECT 
    '✅ TOTAL REGISTROS CIFRADOS' as resultado,
    COUNT(*) as cantidad
FROM public.datos_sensibles_cifrados;

-- IMPORTANTE: Verificar antes de continuar
SELECT '⚠️ IMPORTANTE: Revisa los resultados arriba antes de ejecutar 07_enmascarar_originales.sql' as aviso;
