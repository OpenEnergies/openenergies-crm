-- ============================================================================
-- Función para descifrar datos sensibles desde Edge Functions (service_role)
-- ============================================================================
-- PROBLEMA: obtener_datos_sensibles_entidad requiere is_admin() → auth.uid().
--           Con service_role_key, auth.uid() es NULL → la función falla.
-- SOLUCIÓN: Esta función permite a Edge Functions (vía service_role) descifrar
--           datos sin requerir contexto de autenticación de usuario.
-- SEGURIDAD: Solo service_role puede ejecutarla.
-- ============================================================================

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
    -- Obtener clave de cifrado (accesible via SECURITY DEFINER)
    v_key := private.get_encryption_key();
    
    -- Descifrar todos los campos de la entidad
    FOR r IN 
        SELECT campo, extensions.pgp_sym_decrypt(valor_cifrado, v_key)::TEXT as valor
        FROM public.datos_sensibles_cifrados
        WHERE entidad_tipo = p_entidad_tipo AND entidad_id = p_entidad_id
    LOOP
        v_resultado := v_resultado || jsonb_build_object(r.campo, r.valor);
    END LOOP;
    
    RETURN v_resultado;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error descifrando datos para %/%: %', p_entidad_tipo, p_entidad_id, SQLERRM;
    RETURN '{}'::JSONB;
END;
$$;

-- Solo service_role puede ejecutar esta función (Edge Functions)
REVOKE EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.descifrar_datos_informe(TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.descifrar_datos_informe IS 
'Descifra datos sensibles para uso en Edge Functions (service_role).
No requiere auth.uid() ni is_admin(). Solo llamable por service_role.
Uso: SELECT descifrar_datos_informe(''cliente'', ''uuid-del-cliente'')';
