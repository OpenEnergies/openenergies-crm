-- =========================================================
-- MIGRACIÓN: Corregir get_agenda_items y agregar FK vacaciones->usuarios_app
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Agregar FK de vacaciones.user_id -> usuarios_app.user_id
ALTER TABLE public.vacaciones
ADD CONSTRAINT vacaciones_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.usuarios_app(user_id)
ON DELETE CASCADE;

-- 2. Agregar FK de vacaciones.empresa_id -> empresas.id
ALTER TABLE public.vacaciones
ADD CONSTRAINT vacaciones_empresa_id_fkey
FOREIGN KEY (empresa_id) REFERENCES public.empresas(id)
ON DELETE CASCADE;

-- 3. Recrear la función get_agenda_items para devolver los campos esperados por el frontend
DROP FUNCTION IF EXISTS public.get_agenda_items(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_agenda_items(
    fecha_query_inicio TIMESTAMPTZ,
    fecha_query_fin TIMESTAMPTZ
)
RETURNS TABLE(
    id UUID,
    titulo TEXT,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    color TEXT,
    etiqueta TEXT,
    tipo_evento TEXT,
    es_editable BOOLEAN,
    cliente_id_relacionado UUID,
    creador_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_empresa_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Validar rango de fechas (prevenir consultas excesivas)
    IF fecha_query_fin - fecha_query_inicio > INTERVAL '1 year' THEN
        RAISE EXCEPTION 'El rango de fechas no puede exceder 1 año'
            USING ERRCODE = 'INVLD';
    END IF;
    
    SELECT rol::TEXT, u.empresa_id 
    INTO v_user_role, v_empresa_id
    FROM public.usuarios_app u
    WHERE u.user_id = v_user_id
      AND u.eliminado_en IS NULL;
    
    -- Administradores ven todos los eventos
    IF v_user_role = 'administrador' THEN
        RETURN QUERY
        SELECT 
            e.id,
            e.titulo,
            e.fecha_inicio,
            e.fecha_fin,
            e.color,
            e.etiqueta,
            'evento'::TEXT AS tipo_evento,
            (e.user_id = v_user_id) AS es_editable,
            NULL::UUID AS cliente_id_relacionado,
            e.creado_por_nombre AS creador_nombre
        FROM public.agenda_eventos e
        WHERE e.fecha_inicio >= fecha_query_inicio
          AND e.fecha_inicio <= fecha_query_fin
        ORDER BY e.fecha_inicio;
    
    -- Comerciales ven sus propios eventos y los de su empresa
    ELSIF v_user_role = 'comercial' THEN
        RETURN QUERY
        SELECT 
            e.id,
            e.titulo,
            e.fecha_inicio,
            e.fecha_fin,
            e.color,
            e.etiqueta,
            'evento'::TEXT AS tipo_evento,
            (e.user_id = v_user_id) AS es_editable,
            NULL::UUID AS cliente_id_relacionado,
            e.creado_por_nombre AS creador_nombre
        FROM public.agenda_eventos e
        WHERE e.fecha_inicio >= fecha_query_inicio
          AND e.fecha_inicio <= fecha_query_fin
          AND (
              e.user_id = v_user_id
              OR e.empresa_id = v_empresa_id
          )
        ORDER BY e.fecha_inicio;
    
    -- Otros usuarios solo ven sus propios eventos
    ELSE
        RETURN QUERY
        SELECT 
            e.id,
            e.titulo,
            e.fecha_inicio,
            e.fecha_fin,
            e.color,
            e.etiqueta,
            'evento'::TEXT AS tipo_evento,
            (e.user_id = v_user_id) AS es_editable,
            NULL::UUID AS cliente_id_relacionado,
            e.creado_por_nombre AS creador_nombre
        FROM public.agenda_eventos e
        WHERE e.fecha_inicio >= fecha_query_inicio
          AND e.fecha_inicio <= fecha_query_fin
          AND e.user_id = v_user_id
        ORDER BY e.fecha_inicio;
    END IF;
END;
$$;

-- 4. Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_agenda_items(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- =========================================================
-- VERIFICACIÓN
-- =========================================================
-- SELECT * FROM get_agenda_items(NOW() - INTERVAL '1 month', NOW() + INTERVAL '1 month');
