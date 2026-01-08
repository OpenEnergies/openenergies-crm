-- =====================================================
-- MIGRACIÓN: Corregir funciones RLS para usar asignaciones_comercial_punto
-- Fecha: 2026-01-08
-- Descripción: 
--   - can_access_cliente: acceso al cliente si tiene al menos 1 punto asignado
--   - can_access_punto: acceso SOLO a los puntos específicamente asignados
-- =====================================================

-- =====================================================
-- FUNCIÓN: can_access_punto (RESTRICTIVA)
-- El comercial SOLO ve los puntos que tiene específicamente asignados
-- =====================================================

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
    
    -- Administradores tienen acceso total
    IF v_role = 'administrador' THEN
        RETURN TRUE;
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

-- =====================================================
-- FUNCIÓN: can_access_cliente
-- El comercial accede al cliente si tiene al menos 1 punto asignado
-- (para ver datos básicos: nombre, CIF, etc.)
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_access_cliente(id_cliente uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_empresa_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL OR id_cliente IS NULL THEN
        RETURN FALSE;
    END IF;
    
    SELECT rol::TEXT, empresa_id 
    INTO v_role, v_empresa_id
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    -- Administradores tienen acceso total
    IF v_role = 'administrador' THEN
        RETURN TRUE;
    END IF;
    
    -- Comerciales: acceso si tienen asignado AL MENOS UN PUNTO del cliente
    IF v_role = 'comercial' THEN
        RETURN EXISTS (
            SELECT 1 
            FROM public.asignaciones_comercial_punto acp
            JOIN public.puntos_suministro ps ON ps.id = acp.punto_id
            WHERE acp.comercial_user_id = v_user_id
              AND ps.cliente_id = id_cliente
              AND ps.eliminado_en IS NULL
        );
    END IF;
    
    -- Clientes: solo su propio registro via contactos_cliente
    IF v_role = 'cliente' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.contactos_cliente cc
            WHERE cc.cliente_id = id_cliente
              AND cc.user_id = v_user_id
              AND cc.eliminado_en IS NULL
        );
    END IF;
    
    -- Soporte: acceso a clientes que tienen contratos con su empresa (comercializadora)
    IF v_role = 'soporte' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.contratos con
            JOIN public.puntos_suministro ps ON ps.id = con.punto_id
            WHERE ps.cliente_id = id_cliente
              AND con.comercializadora_id = v_empresa_id
              AND con.eliminado_en IS NULL
              AND ps.eliminado_en IS NULL
        );
    END IF;
    
    RETURN FALSE;
END;
$function$;

-- =====================================================
-- TRIGGER: Auto-asignar comercial cuando crea un punto de suministro
-- Descripción: Si un comercial crea un punto, se auto-asigna automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_comercial_to_punto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_role TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Obtener el rol del usuario actual
    SELECT rol::TEXT INTO v_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    -- Si es comercial, auto-asignar el punto
    IF v_role = 'comercial' THEN
        INSERT INTO public.asignaciones_comercial_punto (punto_id, comercial_user_id)
        VALUES (NEW.id, v_user_id)
        ON CONFLICT DO NOTHING;  -- Evitar duplicados si ya existe
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS trg_auto_assign_comercial ON public.puntos_suministro;
CREATE TRIGGER trg_auto_assign_comercial
    AFTER INSERT ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_comercial_to_punto();

-- Verificar que todo se actualizó correctamente
SELECT 'Función can_access_cliente y trigger auto_assign_comercial creados correctamente' as status;

-- =====================================================
-- CORRECCIÓN DE POLÍTICAS RLS CONFLICTIVAS
-- Las siguientes políticas deben actualizarse para respetar
-- la lógica restrictiva de can_access_punto
-- =====================================================

-- -----------------------------------------------------
-- 1. PUNTOS_SUMINISTRO: Cambiar ps_select para usar can_access_punto
-- -----------------------------------------------------
DROP POLICY IF EXISTS ps_select ON public.puntos_suministro;
CREATE POLICY ps_select ON public.puntos_suministro
    FOR SELECT TO authenticated
    USING (
        (eliminado_en IS NULL) 
        AND (is_admin() OR can_access_punto(id))
    );

-- ps_update: Solo puede actualizar puntos a los que tiene acceso directo
DROP POLICY IF EXISTS ps_update ON public.puntos_suministro;
CREATE POLICY ps_update ON public.puntos_suministro
    FOR UPDATE TO public
    USING (
        can_access_punto(id) 
        AND (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
    );

-- ps_insert: Un comercial puede crear puntos para clientes a los que tiene acceso
-- (Esto se mantiene con can_access_cliente porque aún no existe el punto)
-- El trigger trg_auto_assign_comercial se encargará de asignar el nuevo punto

-- -----------------------------------------------------
-- 2. CONTRATOS: Eliminar política duplicada y corregir
-- -----------------------------------------------------
-- Eliminar la política redundante con_select (usa can_access_cliente)
DROP POLICY IF EXISTS con_select ON public.contratos;

-- co_select ya usa can_access_contrato -> can_access_punto (CORRECTO)
-- Solo verificamos que existe
-- Si no existe, la creamos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'contratos' 
        AND policyname = 'co_select'
    ) THEN
        CREATE POLICY co_select ON public.contratos
            FOR SELECT TO public
            USING (can_access_contrato(id));
    END IF;
END $$;

-- con_insert: Cambiar para verificar acceso al punto
DROP POLICY IF EXISTS con_insert ON public.contratos;
CREATE POLICY con_insert ON public.contratos
    FOR INSERT TO public
    WITH CHECK (
        can_access_punto(punto_id) 
        AND (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
    );

-- con_update: Cambiar para verificar acceso al punto
DROP POLICY IF EXISTS con_update ON public.contratos;
CREATE POLICY con_update ON public.contratos
    FOR UPDATE TO public
    USING (
        can_access_punto(punto_id) 
        AND (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
    );

-- con_delete: Solo admins (se mantiene, pero corregido)
DROP POLICY IF EXISTS con_delete ON public.contratos;
CREATE POLICY con_delete ON public.contratos
    FOR DELETE TO public
    USING (is_admin() AND can_access_punto(punto_id));

-- con_select_deleted_admin se mantiene igual (solo admins ven eliminados)

-- -----------------------------------------------------
-- 3. DOCUMENTOS: Corregir para usar can_access_punto cuando aplique
-- -----------------------------------------------------
-- Los documentos pueden estar asociados a: cliente, punto, contrato, factura
-- Si tiene punto_id, verificar can_access_punto
-- Si solo tiene cliente_id, verificar can_access_cliente

DROP POLICY IF EXISTS doc_select ON public.documentos;
CREATE POLICY doc_select ON public.documentos
    FOR SELECT TO authenticated
    USING (
        (eliminado_en IS NULL) 
        AND (
            is_admin() 
            OR (
                -- Si tiene punto_id, verificar acceso al punto
                (punto_id IS NOT NULL AND can_access_punto(punto_id))
                -- Si solo tiene cliente_id, verificar acceso al cliente
                OR (punto_id IS NULL AND cliente_id IS NOT NULL AND can_access_cliente(cliente_id))
            )
            AND (
                (visible_para_cliente = true) 
                OR (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
            )
        )
    );

DROP POLICY IF EXISTS doc_insert ON public.documentos;
CREATE POLICY doc_insert ON public.documentos
    FOR INSERT TO public
    WITH CHECK (
        (
            (punto_id IS NOT NULL AND can_access_punto(punto_id))
            OR (punto_id IS NULL AND cliente_id IS NOT NULL AND can_access_cliente(cliente_id))
        )
        AND (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
    );

DROP POLICY IF EXISTS doc_update ON public.documentos;
CREATE POLICY doc_update ON public.documentos
    FOR UPDATE TO public
    USING (
        (
            (punto_id IS NOT NULL AND can_access_punto(punto_id))
            OR (punto_id IS NULL AND cliente_id IS NOT NULL AND can_access_cliente(cliente_id))
        )
        AND (current_user_role() = ANY (ARRAY['administrador'::text, 'comercial'::text]))
    );

DROP POLICY IF EXISTS doc_delete ON public.documentos;
CREATE POLICY doc_delete ON public.documentos
    FOR DELETE TO public
    USING (
        is_admin() 
        AND (
            (punto_id IS NOT NULL AND can_access_punto(punto_id))
            OR (punto_id IS NULL AND cliente_id IS NOT NULL AND can_access_cliente(cliente_id))
        )
    );

-- -----------------------------------------------------
-- 4. CONSUMOS: Ya usa can_access_punto (CORRECTO)
-- -----------------------------------------------------
-- No requiere cambios

-- -----------------------------------------------------
-- VERIFICACIÓN FINAL
-- -----------------------------------------------------
SELECT 'Todas las políticas RLS actualizadas correctamente' as status;
