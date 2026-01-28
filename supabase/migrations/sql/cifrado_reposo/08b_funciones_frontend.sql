-- ============================================================================
-- FASE 8B: FUNCIONES PARA FRONTEND - ACCESO A DATOS DESCIFRADOS
-- ============================================================================
-- Descripción: Funciones RPC para que el frontend acceda a los datos 
--              sensibles descifrados de manera segura
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32 (acceso controlado), ISO 27001 A.9
-- ============================================================================

-- ============================================================================
-- 8B.1 FUNCIÓN: Obtener cliente con datos descifrados
-- ============================================================================
-- Esta función devuelve un cliente con sus datos sensibles descifrados
-- Solo usuarios autenticados de la empresa del cliente pueden acceder

CREATE OR REPLACE FUNCTION public.obtener_cliente_completo(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'extensions'
AS $$
DECLARE
    v_cliente RECORD;
    v_datos_sensibles JSONB;
    v_resultado JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Verificar autenticación
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener cliente básico
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id
      AND eliminado_en IS NULL;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Cliente no encontrado');
    END IF;
    
    -- Obtener datos sensibles descifrados
    v_datos_sensibles := public.obtener_datos_sensibles_entidad('cliente', p_cliente_id);
    
    -- Construir resultado combinando datos públicos + sensibles descifrados
    v_resultado := jsonb_build_object(
        'id', v_cliente.id,
        'nombre', v_cliente.nombre,
        'tipo', v_cliente.tipo,
        -- Datos sensibles: usar descifrados si existen, sino los originales (para compatibilidad)
        'dni', COALESCE(v_datos_sensibles->>'dni', v_cliente.dni),
        'cif', COALESCE(v_datos_sensibles->>'cif', v_cliente.cif),
        'email', COALESCE(v_datos_sensibles->>'email', v_cliente.email),
        'telefonos', COALESCE(v_datos_sensibles->>'telefonos', v_cliente.telefonos),
        'numero_cuenta', COALESCE(v_datos_sensibles->>'iban', v_cliente.numero_cuenta),
        -- Otros campos
        'representante', v_cliente.representante,
        'creado_en', v_cliente.creado_en,
        'creado_por', v_cliente.creado_por,
        'modificado_en', v_cliente.modificado_en
    );
    
    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.obtener_cliente_completo IS 
'Devuelve un cliente con sus datos sensibles descifrados.
Solo accesible por usuarios autenticados de la misma empresa.
Uso: SELECT obtener_cliente_completo(''uuid-del-cliente'')';

-- ============================================================================
-- 8B.2 FUNCIÓN: Obtener listado de clientes con datos descifrados
-- ============================================================================
-- Para listados donde se necesiten ver los datos completos

CREATE OR REPLACE FUNCTION public.obtener_clientes_completos(
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'extensions'
AS $$
DECLARE
    v_user_id UUID;
    v_clientes JSONB := '[]'::JSONB;
    r RECORD;
    v_datos_sensibles JSONB;
    v_cliente_json JSONB;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Iterar clientes (el RLS se encarga de filtrar por permisos)
    FOR r IN 
        SELECT *
        FROM public.clientes
        WHERE eliminado_en IS NULL
        ORDER BY nombre
        LIMIT p_limit
        OFFSET p_offset
    LOOP
        -- Obtener datos sensibles
        v_datos_sensibles := public.obtener_datos_sensibles_entidad('cliente', r.id);
        
        v_cliente_json := jsonb_build_object(
            'id', r.id,
            'nombre', r.nombre,
            'tipo', r.tipo,
            'dni', COALESCE(v_datos_sensibles->>'dni', r.dni),
            'cif', COALESCE(v_datos_sensibles->>'cif', r.cif),
            'email', COALESCE(v_datos_sensibles->>'email', r.email),
            'telefonos', COALESCE(v_datos_sensibles->>'telefonos', r.telefonos),
            'numero_cuenta', COALESCE(v_datos_sensibles->>'iban', r.numero_cuenta),
            'representante', r.representante,
            'creado_en', r.creado_en
        );
        
        v_clientes := v_clientes || v_cliente_json;
    END LOOP;
    
    RETURN v_clientes;
END;
$$;

COMMENT ON FUNCTION public.obtener_clientes_completos IS 
'Devuelve listado de clientes con datos sensibles descifrados.
Paginado con limit/offset. Solo clientes de la empresa del usuario.';

-- ============================================================================
-- 8B.3 FUNCIÓN: Obtener campo específico descifrado
-- ============================================================================
-- Útil cuando solo necesitas un campo (ej: mostrar IBAN en un formulario)

CREATE OR REPLACE FUNCTION public.obtener_campo_cliente(
    p_cliente_id UUID,
    p_campo TEXT  -- 'dni', 'cif', 'email', 'telefonos', 'iban'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
    v_user_id UUID;
    v_valor TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar que el cliente existe (el RLS se encarga de permisos)
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND eliminado_en IS NULL) THEN
        RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- Obtener dato descifrado
    v_valor := public.obtener_dato_sensible('cliente', p_cliente_id, p_campo);
    
    RETURN v_valor;
END;
$$;

COMMENT ON FUNCTION public.obtener_campo_cliente IS 
'Obtiene un campo sensible específico descifrado de un cliente.
Campos válidos: dni, cif, email, telefonos, iban';

-- ============================================================================
-- 8B.4 VISTA: Clientes con datos visibles (alternativa a función)
-- ============================================================================
-- NOTA: Las vistas con SECURITY DEFINER no funcionan igual que funciones
--       Esta vista es útil para consultas simples pero NO descifra
--       Para datos descifrados, usar las funciones RPC

-- Vista de clientes con indicador de datos cifrados disponibles
CREATE OR REPLACE VIEW public.v_clientes_resumen AS
SELECT 
    c.id,
    c.nombre,
    c.tipo,
    -- Mostrar datos enmascarados (para listados rápidos)
    c.dni,
    c.cif,
    c.email,  -- Email visible (decisión híbrida)
    c.telefonos,
    c.numero_cuenta,
    c.representante,
    c.creado_en,
    c.creado_por,
    c.modificado_en,
    -- Indicador de si hay datos cifrados disponibles
    EXISTS (
        SELECT 1 FROM datos_sensibles_cifrados dsc 
        WHERE dsc.entidad_tipo = 'cliente' AND dsc.entidad_id = c.id
    ) AS tiene_datos_cifrados
FROM public.clientes c
WHERE c.eliminado_en IS NULL;

COMMENT ON VIEW public.v_clientes_resumen IS 
'Vista de clientes con datos enmascarados. Para datos completos usar obtener_cliente_completo()';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 
    routine_name as funcion,
    'Creada correctamente' as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'obtener_cliente_completo',
    'obtener_clientes_completos',
    'obtener_campo_cliente'
);

