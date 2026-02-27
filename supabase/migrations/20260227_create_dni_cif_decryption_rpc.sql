-- Migration: Fix DNI/CIF decryption for comercial role
-- Problem: obtener_cliente_completo and obtener_clientes_completos call
-- obtener_datos_sensibles_entidad which requires is_admin().
-- Solution: Replace those functions to do their own decryption for admin+comercial,
-- bypassing obtener_datos_sensibles_entidad. PostgREST already knows these functions
-- so modifying their bodies takes effect immediately (no schema reload needed).

-- ============================================================
-- 1. obtener_cliente_completo: single client with decrypted data
-- ============================================================
CREATE OR REPLACE FUNCTION public.obtener_cliente_completo(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'extensions'
AS $$
DECLARE
    v_cliente RECORD;
    v_resultado JSONB;
    v_user_id UUID;
    v_user_rol TEXT;
    v_key TEXT;
    v_dni TEXT;
    v_cif TEXT;
    v_email TEXT;
    v_telefonos TEXT;
    v_iban TEXT;
    r RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Get user role
    SELECT rol INTO v_user_rol FROM public.usuarios WHERE id = v_user_id;
    
    -- Only admin and comercial can call this
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Get base client data
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id
      AND eliminado_en IS NULL;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Cliente no encontrado');
    END IF;
    
    -- Decrypt sensitive fields directly (bypassing obtener_datos_sensibles_entidad which is admin-only)
    v_key := private.get_encryption_key();
    
    FOR r IN 
        SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT as valor
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = 'cliente'
          AND entidad_id = p_cliente_id
    LOOP
        CASE r.campo
            WHEN 'dni' THEN v_dni := r.valor;
            WHEN 'cif' THEN v_cif := r.valor;
            WHEN 'email' THEN v_email := r.valor;
            WHEN 'telefonos' THEN v_telefonos := r.valor;
            WHEN 'iban' THEN v_iban := r.valor;
        END CASE;
    END LOOP;
    
    -- Build result: admin gets all fields, comercial gets only dni/cif
    IF v_user_rol = 'administrador' THEN
        v_resultado := jsonb_build_object(
            'id', v_cliente.id,
            'nombre', v_cliente.nombre,
            'tipo', v_cliente.tipo,
            'dni', COALESCE(v_dni, v_cliente.dni),
            'cif', COALESCE(v_cif, v_cliente.cif),
            'email', COALESCE(v_email, v_cliente.email),
            'telefonos', COALESCE(v_telefonos, v_cliente.telefonos),
            'numero_cuenta', COALESCE(v_iban, v_cliente.numero_cuenta),
            'representante', v_cliente.representante,
            'creado_en', v_cliente.creado_en,
            'creado_por', v_cliente.creado_por,
            'modificado_en', v_cliente.modificado_en
        );
    ELSE
        -- Comercial: only decrypt dni/cif, keep other fields as-is from clientes table
        v_resultado := jsonb_build_object(
            'id', v_cliente.id,
            'nombre', v_cliente.nombre,
            'tipo', v_cliente.tipo,
            'dni', COALESCE(v_dni, v_cliente.dni),
            'cif', COALESCE(v_cif, v_cliente.cif),
            'email', v_cliente.email,
            'telefonos', v_cliente.telefonos,
            'numero_cuenta', v_cliente.numero_cuenta,
            'representante', v_cliente.representante,
            'creado_en', v_cliente.creado_en,
            'creado_por', v_cliente.creado_por,
            'modificado_en', v_cliente.modificado_en
        );
    END IF;
    
    RETURN v_resultado;
END;
$$;

-- ============================================================
-- 2. obtener_clientes_completos: batch decryption
-- ============================================================
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
    v_user_rol TEXT;
    v_key TEXT;
    v_clientes JSONB := '[]'::JSONB;
    v_cliente RECORD;
    v_cliente_json JSONB;
    v_dni TEXT;
    v_cif TEXT;
    v_email TEXT;
    v_telefonos TEXT;
    v_iban TEXT;
    r RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Get user role
    SELECT rol INTO v_user_rol FROM public.usuarios WHERE id = v_user_id;
    
    -- Only admin and comercial can call this
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    v_key := private.get_encryption_key();
    
    FOR v_cliente IN 
        SELECT *
        FROM public.clientes
        WHERE eliminado_en IS NULL
        ORDER BY nombre
        LIMIT p_limit
        OFFSET p_offset
    LOOP
        -- Reset vars
        v_dni := NULL; v_cif := NULL; v_email := NULL; v_telefonos := NULL; v_iban := NULL;
        
        -- Decrypt sensitive fields
        FOR r IN 
            SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT as valor
            FROM public.datos_sensibles_cifrados
            WHERE entidad_tipo = 'cliente'
              AND entidad_id = v_cliente.id
        LOOP
            CASE r.campo
                WHEN 'dni' THEN v_dni := r.valor;
                WHEN 'cif' THEN v_cif := r.valor;
                WHEN 'email' THEN v_email := r.valor;
                WHEN 'telefonos' THEN v_telefonos := r.valor;
                WHEN 'iban' THEN v_iban := r.valor;
            END CASE;
        END LOOP;
        
        IF v_user_rol = 'administrador' THEN
            v_cliente_json := jsonb_build_object(
                'id', v_cliente.id,
                'nombre', v_cliente.nombre,
                'tipo', v_cliente.tipo,
                'dni', COALESCE(v_dni, v_cliente.dni),
                'cif', COALESCE(v_cif, v_cliente.cif),
                'email', COALESCE(v_email, v_cliente.email),
                'telefonos', COALESCE(v_telefonos, v_cliente.telefonos),
                'numero_cuenta', COALESCE(v_iban, v_cliente.numero_cuenta),
                'representante', v_cliente.representante,
                'creado_en', v_cliente.creado_en
            );
        ELSE
            -- Comercial: only dni/cif decrypted
            v_cliente_json := jsonb_build_object(
                'id', v_cliente.id,
                'nombre', v_cliente.nombre,
                'tipo', v_cliente.tipo,
                'dni', COALESCE(v_dni, v_cliente.dni),
                'cif', COALESCE(v_cif, v_cliente.cif),
                'email', v_cliente.email,
                'telefonos', v_cliente.telefonos,
                'numero_cuenta', v_cliente.numero_cuenta,
                'representante', v_cliente.representante,
                'creado_en', v_cliente.creado_en
            );
        END IF;
        
        v_clientes := v_clientes || v_cliente_json;
    END LOOP;
    
    RETURN v_clientes;
END;
$$;
