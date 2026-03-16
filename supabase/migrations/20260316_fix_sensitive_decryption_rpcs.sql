-- Ensure decryption RPCs use usuarios_app and tighten decryption permissions.

-- ---------------------------------------------------------------------------
-- 1) Fix role lookup in DNI/CIF RPCs (usuarios_app is the canonical user table)
-- ---------------------------------------------------------------------------
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
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
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
        SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT AS valor
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = 'cliente'
          AND entidad_id = p_cliente_id
          AND campo IN ('dni', 'cif')
    LOOP
        v_resultado := v_resultado || jsonb_build_object(r.campo, r.valor);
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
        RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = 'AUTHZ';
    END IF;

    SELECT rol INTO v_user_rol FROM public.usuarios_app WHERE user_id = v_user_id;
    IF v_user_rol NOT IN ('administrador', 'comercial') THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
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
            SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT AS valor
            FROM public.datos_sensibles_cifrados
            WHERE entidad_tipo = 'cliente'
              AND entidad_id = v_cliente.id
              AND campo IN ('dni', 'cif')
        LOOP
            v_datos := v_datos || jsonb_build_object(r.campo, r.valor);
        END LOOP;

        v_clientes := v_clientes || v_datos;
    END LOOP;

    RETURN v_clientes;
END;
$$;

-- Keep callable from authenticated users; internal role checks still apply.
GRANT EXECUTE ON FUNCTION public.obtener_dni_cif_cliente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_dni_cif_clientes(INTEGER, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Harden report decryption RPC to service_role only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.descifrar_datos_informe(
    p_entidad_tipo TEXT,
    p_entidad_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'private'
AS $$
DECLARE
    v_key TEXT;
    v_resultado JSONB := '{}'::JSONB;
    r RECORD;
BEGIN
    -- This RPC is intended for Edge Functions using service_role only.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Acceso denegado: Solo service_role puede descifrar datos de informe'
            USING ERRCODE = 'AUTHZ';
    END IF;

    v_key := private.get_encryption_key();

    FOR r IN
        SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT AS valor
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo
          AND entidad_id = p_entidad_id
    LOOP
        v_resultado := v_resultado || jsonb_build_object(r.campo, r.valor);
    END LOOP;

    RETURN v_resultado;
EXCEPTION
    WHEN SQLSTATE 'AUTHZ' THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE WARNING 'Error descifrando datos para %/%: %', p_entidad_tipo, p_entidad_id, SQLERRM;
        RETURN '{}'::JSONB;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) TO service_role;
