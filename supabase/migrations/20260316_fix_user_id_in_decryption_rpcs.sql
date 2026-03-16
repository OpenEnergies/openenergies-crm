-- Fix decryption RPCs: usuarios_app uses user_id (not id)
-- Also make decrypt loops resilient to malformed legacy ciphertext rows.

CREATE OR REPLACE FUNCTION public.obtener_dni_cif_cliente(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'extensions'
AS $$
DECLARE
    v_user_id UUID;
    v_user_rol TEXT;
    v_key TEXT;
    v_resultado JSONB := '{}'::JSONB;
    r RECORD;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'P0001';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.clientes
        WHERE id = p_cliente_id
          AND eliminado_en IS NULL
    ) THEN
        RETURN jsonb_build_object('error', 'Cliente no encontrado');
    END IF;

    v_key := private.get_encryption_key();

    FOR r IN
        SELECT campo, valor_cifrado
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = 'cliente'
          AND entidad_id = p_cliente_id
          AND campo IN ('dni', 'cif')
    LOOP
        BEGIN
            v_resultado := v_resultado || jsonb_build_object(
                r.campo,
                extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT
            );
        EXCEPTION WHEN OTHERS THEN
            -- Skip malformed ciphertext rows instead of aborting the RPC
            NULL;
        END;
    END LOOP;

    RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_dni_cif_clientes(
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
    v_datos JSONB;
    r RECORD;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'P0001';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0001';
    END IF;

    v_key := private.get_encryption_key();

    FOR v_cliente IN
        SELECT id
        FROM public.clientes
        WHERE eliminado_en IS NULL
        ORDER BY nombre
        LIMIT p_limit
        OFFSET p_offset
    LOOP
        v_datos := jsonb_build_object('id', v_cliente.id);

        FOR r IN
            SELECT campo, valor_cifrado
            FROM public.datos_sensibles_cifrados
            WHERE entidad_tipo = 'cliente'
              AND entidad_id = v_cliente.id
              AND campo IN ('dni', 'cif')
        LOOP
            BEGIN
                v_datos := v_datos || jsonb_build_object(
                    r.campo,
                    extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT
                );
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END LOOP;

        v_clientes := v_clientes || v_datos;
    END LOOP;

    RETURN v_clientes;
END;
$$;

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
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'P0001';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id
      AND eliminado_en IS NULL;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Cliente no encontrado');
    END IF;

    v_key := private.get_encryption_key();

    FOR r IN
        SELECT campo, valor_cifrado
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = 'cliente'
          AND entidad_id = p_cliente_id
    LOOP
        BEGIN
            CASE r.campo
                WHEN 'dni' THEN v_dni := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                WHEN 'cif' THEN v_cif := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                WHEN 'email' THEN v_email := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                WHEN 'telefonos' THEN v_telefonos := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                WHEN 'iban' THEN v_iban := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
            END CASE;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;

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
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'P0001';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'P0001';
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
        v_dni := NULL; v_cif := NULL; v_email := NULL; v_telefonos := NULL; v_iban := NULL;

        FOR r IN
            SELECT campo, valor_cifrado
            FROM public.datos_sensibles_cifrados
            WHERE entidad_tipo = 'cliente'
              AND entidad_id = v_cliente.id
        LOOP
            BEGIN
                CASE r.campo
                    WHEN 'dni' THEN v_dni := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                    WHEN 'cif' THEN v_cif := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                    WHEN 'email' THEN v_email := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                    WHEN 'telefonos' THEN v_telefonos := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                    WHEN 'iban' THEN v_iban := extensions.pgp_sym_decrypt(r.valor_cifrado, v_key)::TEXT;
                END CASE;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
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
