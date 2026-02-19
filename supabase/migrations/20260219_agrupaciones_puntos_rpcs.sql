-- =====================================================
-- MIGRACIÓN: RPCs para gestionar agrupaciones de puntos
-- Fecha: 2026-02-19
-- Descripción:
--   Los clientes no pueden hacer UPDATE en puntos_suministro (RLS ps_update
--   solo permite administrador/comercial). Se crean RPCs con SECURITY DEFINER
--   para que los clientes asignen/desasignen puntos a agrupaciones de forma segura.
-- =====================================================

-- =====================================================
-- 1. asignar_puntos_agrupacion
--    Asigna un array de puntos a una agrupación.
--    Verifica que:
--      - El usuario es cliente del cliente_id de la agrupación
--      - Los puntos pertenecen al mismo cliente
--      - Los puntos no están ya asignados a otra agrupación
-- =====================================================
CREATE OR REPLACE FUNCTION public.asignar_puntos_agrupacion(
    p_agrupacion_id UUID,
    p_punto_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
    v_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    -- Obtener el cliente_id de la agrupación y verificar que pertenece al usuario
    SELECT ap.cliente_id INTO v_cliente_id
    FROM public.agrupaciones_puntos ap
    WHERE ap.id = p_agrupacion_id
      AND ap.eliminado_en IS NULL;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Agrupación no encontrada';
    END IF;

    -- Verificar que el usuario es contacto de este cliente
    IF NOT EXISTS (
        SELECT 1 FROM public.contactos_cliente cc
        WHERE cc.cliente_id = v_cliente_id
          AND cc.user_id = v_user_id
          AND cc.eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'No autorizado para esta agrupación';
    END IF;

    -- Verificar que TODOS los puntos pertenecen al mismo cliente y no están asignados
    SELECT COUNT(*) INTO v_count
    FROM public.puntos_suministro ps
    WHERE ps.id = ANY(p_punto_ids)
      AND ps.cliente_id = v_cliente_id
      AND ps.agrupacion_id IS NULL
      AND ps.eliminado_en IS NULL;

    IF v_count <> array_length(p_punto_ids, 1) THEN
        RAISE EXCEPTION 'Algunos puntos no son válidos, no pertenecen al cliente o ya están asignados';
    END IF;

    -- Asignar los puntos a la agrupación
    UPDATE public.puntos_suministro
    SET agrupacion_id = p_agrupacion_id
    WHERE id = ANY(p_punto_ids)
      AND cliente_id = v_cliente_id
      AND agrupacion_id IS NULL
      AND eliminado_en IS NULL;
END;
$function$;


-- =====================================================
-- 2. desasignar_punto_agrupacion
--    Quita un punto de su agrupación (pone agrupacion_id = NULL).
--    Verifica pertenencia al cliente.
-- =====================================================
CREATE OR REPLACE FUNCTION public.desasignar_punto_agrupacion(
    p_punto_id UUID,
    p_agrupacion_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    -- Obtener el cliente_id de la agrupación
    SELECT ap.cliente_id INTO v_cliente_id
    FROM public.agrupaciones_puntos ap
    WHERE ap.id = p_agrupacion_id
      AND ap.eliminado_en IS NULL;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Agrupación no encontrada';
    END IF;

    -- Verificar que el usuario es contacto de este cliente
    IF NOT EXISTS (
        SELECT 1 FROM public.contactos_cliente cc
        WHERE cc.cliente_id = v_cliente_id
          AND cc.user_id = v_user_id
          AND cc.eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    -- Desasignar
    UPDATE public.puntos_suministro
    SET agrupacion_id = NULL
    WHERE id = p_punto_id
      AND cliente_id = v_cliente_id
      AND agrupacion_id = p_agrupacion_id
      AND eliminado_en IS NULL;
END;
$function$;


-- =====================================================
-- 3. desasignar_todos_puntos_agrupacion
--    Quita TODOS los puntos de una agrupación (para uso antes de eliminar).
--    Verifica pertenencia al cliente.
-- =====================================================
CREATE OR REPLACE FUNCTION public.desasignar_todos_puntos_agrupacion(
    p_agrupacion_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    -- Obtener el cliente_id de la agrupación
    SELECT ap.cliente_id INTO v_cliente_id
    FROM public.agrupaciones_puntos ap
    WHERE ap.id = p_agrupacion_id
      AND ap.eliminado_en IS NULL;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Agrupación no encontrada';
    END IF;

    -- Verificar que el usuario es contacto de este cliente
    IF NOT EXISTS (
        SELECT 1 FROM public.contactos_cliente cc
        WHERE cc.cliente_id = v_cliente_id
          AND cc.user_id = v_user_id
          AND cc.eliminado_en IS NULL
    ) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    -- Desasignar todos los puntos de esta agrupación
    UPDATE public.puntos_suministro
    SET agrupacion_id = NULL
    WHERE agrupacion_id = p_agrupacion_id
      AND cliente_id = v_cliente_id
      AND eliminado_en IS NULL;
END;
$function$;


-- Grants
GRANT EXECUTE ON FUNCTION public.asignar_puntos_agrupacion(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desasignar_punto_agrupacion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desasignar_todos_puntos_agrupacion(UUID) TO authenticated;
