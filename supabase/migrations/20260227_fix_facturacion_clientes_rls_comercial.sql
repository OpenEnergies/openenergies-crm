-- ============================================================================
-- Migración: Ocultar datos de puntos soft-deleted para no-admins
-- Fecha: 2026-02-27
-- 
-- PROBLEMA:
-- 1) La función can_access_punto() no comprueba eliminado_en del punto
--    para el rol 'comercial' ni 'soporte'. Esto permite que tablas que
--    usan can_access_punto (facturacion_clientes, contratos) sigan
--    devolviendo datos de puntos soft-deleted.
-- 2) La política SELECT de facturacion_clientes era demasiado permisiva
--    (comercializadora_id = empresa O can_access_cliente), mostrando
--    facturas de puntos no asignados al comercial.
--
-- SOLUCIÓN:
-- A) Actualizar can_access_punto para rechazar puntos con eliminado_en
--    si el usuario no es admin. Efecto cascada a todas las políticas
--    que la llaman (facturacion_clientes, contratos, etc.).
-- B) Restringir la política SELECT de facturacion_clientes a
--    is_admin() OR can_access_punto(punto_id).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE A: Actualizar can_access_punto para filtrar puntos soft-deleted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access_punto(pid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_cliente_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL OR pid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Obtener rol del usuario
    SELECT rol::TEXT INTO v_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;

    -- Administradores tienen acceso total (incluye puntos eliminados)
    IF v_role = 'administrador' THEN
        RETURN TRUE;
    END IF;

    -- Para TODOS los roles no-admin: si el punto está soft-deleted, denegar
    IF EXISTS (
        SELECT 1 FROM public.puntos_suministro
        WHERE id = pid AND eliminado_en IS NOT NULL
    ) THEN
        RETURN FALSE;
    END IF;

    -- Comerciales: SOLO acceso a puntos específicamente asignados
    IF v_role = 'comercial' THEN
        RETURN EXISTS (
            SELECT 1
            FROM public.asignaciones_comercial_punto acp
            WHERE acp.punto_id = pid
              AND acp.comercial_user_id = v_user_id
        );
    END IF;

    -- Clientes: acceso a puntos de su cliente asociado
    IF v_role = 'cliente' THEN
        SELECT cliente_id INTO v_cliente_id
        FROM public.puntos_suministro
        WHERE id = pid AND eliminado_en IS NULL;

        RETURN EXISTS (
            SELECT 1 FROM public.contactos_cliente cc
            WHERE cc.cliente_id = v_cliente_id
              AND cc.user_id = v_user_id
              AND cc.eliminado_en IS NULL
        );
    END IF;

    -- Soporte: acceso a puntos con contratos de su comercializadora
    IF v_role = 'soporte' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.contratos con
            JOIN public.usuarios_app ua ON ua.user_id = v_user_id
            WHERE con.punto_id = pid
              AND con.comercializadora_id = ua.empresa_id
              AND con.eliminado_en IS NULL
              AND ua.eliminado_en IS NULL
        );
    END IF;

    RETURN FALSE;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE B: Restringir política SELECT de facturacion_clientes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Eliminar la política SELECT actual
DROP POLICY IF EXISTS facturacion_clientes_select ON public.facturacion_clientes;

-- 2. Crear nueva política SELECT alineada con can_access_punto
CREATE POLICY facturacion_clientes_select ON public.facturacion_clientes
    FOR SELECT
    TO authenticated
    USING (
        is_admin()
        OR can_access_punto(punto_id)
    );

-- Nota: las políticas INSERT, UPDATE, DELETE no cambian.
-- INSERT/UPDATE ya requieren is_admin() o (comercial + misma empresa).
-- DELETE solo admins.
