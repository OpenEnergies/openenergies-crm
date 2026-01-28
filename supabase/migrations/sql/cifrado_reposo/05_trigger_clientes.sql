-- ============================================================================
-- FASE 5: TRIGGER AUTOMÁTICO PARA CIFRAR CLIENTES
-- ============================================================================
-- Descripción: Trigger que cifra automáticamente datos sensibles en INSERT/UPDATE
-- Decisión: Email se mantiene visible pero se cifra copia (híbrido)
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32, ISO 27001 A.10.1
-- ============================================================================

-- ============================================================================
-- 5.1 FUNCIÓN TRIGGER: Cifrar datos sensibles de clientes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_cifrar_datos_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_dni_changed BOOLEAN := FALSE;
    v_cif_changed BOOLEAN := FALSE;
    v_email_changed BOOLEAN := FALSE;
    v_tel_changed BOOLEAN := FALSE;
    v_iban_changed BOOLEAN := FALSE;
BEGIN
    -- =========================================================================
    -- DETECTAR CAMBIOS EN CAMPOS SENSIBLES
    -- =========================================================================
    
    -- DNI: Cifrar si existe, ha cambiado, y no es texto anonimizado/enmascarado
    v_dni_changed := (
        NEW.dni IS NOT NULL 
        AND NEW.dni IS DISTINCT FROM OLD.dni 
        AND NEW.dni NOT LIKE '****%'
        AND NEW.dni != 'ANONIMIZADO'
        AND LENGTH(NEW.dni) >= 8  -- DNI/NIE válido
    );
    
    -- CIF: Similar al DNI
    v_cif_changed := (
        NEW.cif IS NOT NULL 
        AND NEW.cif IS DISTINCT FROM OLD.cif 
        AND NEW.cif NOT LIKE '****%'
        AND NEW.cif != 'ANONIMIZADO'
        AND LENGTH(NEW.cif) >= 8
    );
    
    -- Email: Cifrar copia pero MANTENER VISIBLE (decisión híbrida)
    v_email_changed := (
        NEW.email IS NOT NULL 
        AND NEW.email IS DISTINCT FROM OLD.email 
        AND NEW.email NOT LIKE '%@eliminado.gdpr'  -- No cifrar emails anonimizados
        AND NEW.email ~ '^[^@]+@[^@]+\.[^@]+$'  -- Formato email básico
    );
    
    -- Teléfonos: Cifrar si existe y ha cambiado
    v_tel_changed := (
        NEW.telefonos IS NOT NULL 
        AND NEW.telefonos IS DISTINCT FROM OLD.telefonos 
        AND NEW.telefonos NOT LIKE '****%'
        AND LENGTH(NEW.telefonos) >= 6
    );
    
    -- IBAN (numero_cuenta): Cifrar si existe y ha cambiado
    v_iban_changed := (
        NEW.numero_cuenta IS NOT NULL 
        AND NEW.numero_cuenta IS DISTINCT FROM OLD.numero_cuenta 
        AND NEW.numero_cuenta NOT LIKE '****%'
        AND NEW.numero_cuenta NOT LIKE 'ES__ ****%'  -- Ya enmascarado
        AND LENGTH(REPLACE(NEW.numero_cuenta, ' ', '')) >= 16
    );
    
    -- =========================================================================
    -- CIFRAR Y ENMASCARAR
    -- =========================================================================
    
    -- DNI: Cifrar y enmascarar
    IF v_dni_changed THEN
        PERFORM public.guardar_dato_sensible('cliente', NEW.id, 'dni', NEW.dni);
        -- Enmascarar: ****678A (últimos 4 caracteres visibles)
        NEW.dni := '****' || RIGHT(NEW.dni, 4);
    END IF;
    
    -- CIF: Cifrar y enmascarar
    IF v_cif_changed THEN
        PERFORM public.guardar_dato_sensible('cliente', NEW.id, 'cif', NEW.cif);
        -- Enmascarar: ****1606
        NEW.cif := '****' || RIGHT(NEW.cif, 4);
    END IF;
    
    -- Email: Cifrar copia pero MANTENER VISIBLE (híbrido)
    IF v_email_changed THEN
        PERFORM public.guardar_dato_sensible('cliente', NEW.id, 'email', NEW.email);
        -- NO enmascarar - email se mantiene visible para operativa
    END IF;
    
    -- Teléfonos: Cifrar y enmascarar
    IF v_tel_changed THEN
        PERFORM public.guardar_dato_sensible('cliente', NEW.id, 'telefonos', NEW.telefonos);
        -- Enmascarar: ****7270 (últimos 4 dígitos)
        NEW.telefonos := '****' || RIGHT(REGEXP_REPLACE(NEW.telefonos, '[^0-9]', '', 'g'), 4);
    END IF;
    
    -- IBAN: Cifrar y enmascarar
    IF v_iban_changed THEN
        PERFORM public.guardar_dato_sensible('cliente', NEW.id, 'iban', NEW.numero_cuenta);
        -- Enmascarar: ES57 **** **** **** 4264 (primeros 4 y últimos 4)
        NEW.numero_cuenta := LEFT(REPLACE(NEW.numero_cuenta, ' ', ''), 4) 
                             || ' **** **** **** ' 
                             || RIGHT(REPLACE(NEW.numero_cuenta, ' ', ''), 4);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_cifrar_datos_cliente() IS 
'Trigger function que cifra automáticamente datos sensibles de clientes.
DNI, CIF, teléfono, IBAN se enmascaran. Email se cifra pero permanece visible (híbrido).
GDPR Art. 32: Cifrado de datos personales.';

-- ============================================================================
-- 5.2 ELIMINAR TRIGGER ANTIGUO (si existe)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_iban_vault ON public.clientes;

-- ============================================================================
-- 5.3 CREAR NUEVO TRIGGER
-- ============================================================================
CREATE TRIGGER trg_cifrar_datos_cliente
    BEFORE INSERT OR UPDATE OF dni, cif, email, telefonos, numero_cuenta
    ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cifrar_datos_cliente();

COMMENT ON TRIGGER trg_cifrar_datos_cliente ON public.clientes IS 
'Cifra automáticamente datos PII al insertar/actualizar clientes.
Campos afectados: dni, cif, email, telefonos, numero_cuenta.
GDPR Art. 32.';

-- ============================================================================
-- 5.4 TRIGGER SIMILAR PARA CONTRATOS (numero_cuenta/IBAN)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_cifrar_datos_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- IBAN en contratos
    IF NEW.numero_cuenta IS NOT NULL 
       AND NEW.numero_cuenta IS DISTINCT FROM OLD.numero_cuenta 
       AND NEW.numero_cuenta NOT LIKE '****%'
       AND NEW.numero_cuenta NOT LIKE 'ES__ ****%'
       AND LENGTH(REPLACE(NEW.numero_cuenta, ' ', '')) >= 16 THEN
        
        PERFORM public.guardar_dato_sensible('contrato', NEW.id, 'iban', NEW.numero_cuenta);
        NEW.numero_cuenta := LEFT(REPLACE(NEW.numero_cuenta, ' ', ''), 4) 
                             || ' **** **** **** ' 
                             || RIGHT(REPLACE(NEW.numero_cuenta, ' ', ''), 4);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cifrar_datos_contrato
    BEFORE INSERT OR UPDATE OF numero_cuenta
    ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cifrar_datos_contrato();

COMMENT ON TRIGGER trg_cifrar_datos_contrato ON public.contratos IS 
'Cifra automáticamente IBAN al insertar/actualizar contratos. GDPR Art. 32.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar triggers activos
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid, true) as definition
FROM pg_trigger
WHERE tgname IN ('trg_cifrar_datos_cliente', 'trg_cifrar_datos_contrato');
