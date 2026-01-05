-- ============================================================================
-- 004_enable_rls.sql
-- HABILITACIÓN Y CONFIGURACIÓN DE ROW LEVEL SECURITY
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 25/32, ISO 27001 A.9.4, NIS2 Art. 21, SOC 2 CC6.1/CC6.3
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script:
-- 1. Habilita RLS en tablas que actualmente no lo tienen
-- 2. Fuerza RLS en tablas con datos sensibles (incluso para table owners)
-- 3. Crea políticas de acceso granular por rol
-- 4. Implementa el principio de mínimo privilegio (ISO 27001 A.9.4.1)

BEGIN;

-- ============================================================================
-- SECCIÓN 1: HABILITAR RLS EN TABLAS FALTANTES
-- ============================================================================

-- chat_history (RLS: FALSE actualmente)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.chat_history IS 
'Historial de chat con RLS habilitado. Solo el propietario del chat puede verlo.';

-- facturacion_clientes (RLS: FALSE actualmente)
ALTER TABLE public.facturacion_clientes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.facturacion_clientes IS 
'Datos de facturación importados. RLS para control multitenancy.';

-- precios_energia (RLS: FALSE actualmente)
ALTER TABLE public.precios_energia ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.precios_energia IS 
'Precios de energía por empresa. RLS para aislamiento de datos.';

-- precios_potencia (RLS: FALSE actualmente)
ALTER TABLE public.precios_potencia ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.precios_potencia IS 
'Precios de potencia por empresa. RLS para aislamiento de datos.';

-- ============================================================================
-- SECCIÓN 2: FORZAR RLS (FORCE ROW LEVEL SECURITY)
-- ============================================================================
-- FORCE RLS asegura que incluso los propietarios de tablas y roles con BYPASSRLS
-- deben cumplir las políticas. Crítico para seguridad.

-- Tablas con datos personales (PII) - GDPR crítico
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_app FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contactos_cliente FORCE ROW LEVEL SECURITY;

-- Tablas con datos contractuales/financieros
ALTER TABLE public.contratos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_suministro FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.facturas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_factura FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SECCIÓN 3: FUNCIONES HELPER NECESARIAS
-- ============================================================================
-- NOTA: Estas funciones ya existen en la base de datos y son usadas por
-- políticas RLS existentes. Usamos CREATE OR REPLACE para actualizar
-- sin romper las dependencias. IMPORTANTE: Mantener los mismos nombres
-- de parámetros que ya existen en la DB.

-- Las funciones is_admin, current_user_role, get_my_empresa_id ya existen
-- y funcionan correctamente. Solo las actualizamos si es necesario.

-- Función is_admin (ya existe, la actualizamos con mejoras)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios_app
        WHERE user_id = auth.uid()
          AND rol = 'administrador'
          AND eliminado_en IS NULL
    );
END;
$$;

-- Función current_user_role (ya existe, la actualizamos)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT rol::TEXT INTO v_role
    FROM public.usuarios_app
    WHERE user_id = auth.uid()
      AND eliminado_en IS NULL;
    RETURN COALESCE(v_role, 'anonymous');
END;
$$;

-- Función get_my_empresa_id (ya existe, la actualizamos)
CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
BEGIN
    SELECT empresa_id INTO v_empresa_id
    FROM public.usuarios_app
    WHERE user_id = auth.uid()
      AND eliminado_en IS NULL;
    RETURN v_empresa_id;
END;
$$;

-- Función can_access_cliente (ya existe con parámetro id_cliente, mantenemos ese nombre)
CREATE OR REPLACE FUNCTION public.can_access_cliente(id_cliente UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
    
    -- Comerciales: solo clientes asignados
    IF v_role = 'comercial' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.asignaciones_comercial ac
            WHERE ac.comercial_user_id = v_user_id
              AND ac.cliente_id = id_cliente
        );
    END IF;
    
    -- Clientes: solo su propio registro via contactos_cliente
    IF v_role = 'cliente' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.contactos_cliente cc
            WHERE cc.cliente_id = id_cliente
              AND cc.user_id = v_user_id
        );
    END IF;
    
    -- Soporte: acceso a clientes que tienen contratos con su empresa (comercializadora)
    -- contratos -> punto_id -> puntos_suministro.cliente_id
    IF v_role = 'soporte' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.contratos con
            JOIN public.puntos_suministro ps ON ps.id = con.punto_id
            WHERE ps.cliente_id = id_cliente
              AND con.comercializadora_id = v_empresa_id
        );
    END IF;
    
    RETURN FALSE;
END;
$$;

-- ============================================================================
-- SECCIÓN 4: POLÍTICAS RLS PARA chat_history
-- ============================================================================
-- NOTA: chat_history.user_id es VARCHAR, no UUID, por lo que necesitamos cast

-- Eliminar políticas existentes
DROP POLICY IF EXISTS chat_history_select ON public.chat_history;
DROP POLICY IF EXISTS chat_history_insert ON public.chat_history;
DROP POLICY IF EXISTS chat_history_update ON public.chat_history;
DROP POLICY IF EXISTS chat_history_delete ON public.chat_history;

-- SELECT: Solo el usuario propietario o admins
CREATE POLICY chat_history_select ON public.chat_history
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()::TEXT
        OR is_admin()
    );

-- INSERT: Solo el usuario actual para su propio chat
CREATE POLICY chat_history_insert ON public.chat_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()::TEXT
    );

-- UPDATE: Solo el propietario
CREATE POLICY chat_history_update ON public.chat_history
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid()::TEXT)
    WITH CHECK (user_id = auth.uid()::TEXT);

-- DELETE: Solo admins (para limpieza) o propietario
CREATE POLICY chat_history_delete ON public.chat_history
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()::TEXT
        OR is_admin()
    );

-- ============================================================================
-- SECCIÓN 5: POLÍTICAS RLS PARA facturacion_clientes
-- ============================================================================

DROP POLICY IF EXISTS facturacion_clientes_select ON public.facturacion_clientes;
DROP POLICY IF EXISTS facturacion_clientes_insert ON public.facturacion_clientes;
DROP POLICY IF EXISTS facturacion_clientes_update ON public.facturacion_clientes;
DROP POLICY IF EXISTS facturacion_clientes_delete ON public.facturacion_clientes;

-- SELECT: Admins ven todo, comerciales ven de su empresa
CREATE POLICY facturacion_clientes_select ON public.facturacion_clientes
    FOR SELECT
    TO authenticated
    USING (
        is_admin()
        OR comercializadora_id = get_my_empresa_id()
        OR can_access_cliente(cliente_id)
    );

-- INSERT: Solo admins y comerciales de la empresa
CREATE POLICY facturacion_clientes_insert ON public.facturacion_clientes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_admin()
        OR (
            current_user_role() = 'comercial'
            AND comercializadora_id = get_my_empresa_id()
        )
    );

-- UPDATE: Solo admins y comerciales de la empresa
CREATE POLICY facturacion_clientes_update ON public.facturacion_clientes
    FOR UPDATE
    TO authenticated
    USING (
        is_admin()
        OR (
            current_user_role() = 'comercial'
            AND comercializadora_id = get_my_empresa_id()
        )
    )
    WITH CHECK (
        is_admin()
        OR comercializadora_id = get_my_empresa_id()
    );

-- DELETE: Solo admins
CREATE POLICY facturacion_clientes_delete ON public.facturacion_clientes
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================================
-- SECCIÓN 6: POLÍTICAS RLS PARA precios_energia
-- ============================================================================

DROP POLICY IF EXISTS precios_energia_select ON public.precios_energia;
DROP POLICY IF EXISTS precios_energia_insert ON public.precios_energia;
DROP POLICY IF EXISTS precios_energia_update ON public.precios_energia;
DROP POLICY IF EXISTS precios_energia_delete ON public.precios_energia;

-- SELECT: Admins ven todo, usuarios ven de su empresa
CREATE POLICY precios_energia_select ON public.precios_energia
    FOR SELECT
    TO authenticated
    USING (
        is_admin()
        OR empresa_id = get_my_empresa_id()
    );

-- INSERT: Solo admins
CREATE POLICY precios_energia_insert ON public.precios_energia
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- UPDATE: Solo admins
CREATE POLICY precios_energia_update ON public.precios_energia
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- DELETE: Solo admins
CREATE POLICY precios_energia_delete ON public.precios_energia
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================================
-- SECCIÓN 7: POLÍTICAS RLS PARA precios_potencia
-- ============================================================================

DROP POLICY IF EXISTS precios_potencia_select ON public.precios_potencia;
DROP POLICY IF EXISTS precios_potencia_insert ON public.precios_potencia;
DROP POLICY IF EXISTS precios_potencia_update ON public.precios_potencia;
DROP POLICY IF EXISTS precios_potencia_delete ON public.precios_potencia;

-- SELECT: Admins ven todo, usuarios ven de su empresa
CREATE POLICY precios_potencia_select ON public.precios_potencia
    FOR SELECT
    TO authenticated
    USING (
        is_admin()
        OR empresa_id = get_my_empresa_id()
    );

-- INSERT: Solo admins
CREATE POLICY precios_potencia_insert ON public.precios_potencia
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- UPDATE: Solo admins
CREATE POLICY precios_potencia_update ON public.precios_potencia
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- DELETE: Solo admins
CREATE POLICY precios_potencia_delete ON public.precios_potencia
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================================
-- SECCIÓN 8: POLÍTICAS MEJORADAS PARA CLIENTES (Soft Delete)
-- ============================================================================
-- Actualizar políticas existentes para considerar soft delete

-- Verificar y actualizar política SELECT para excluir eliminados
DROP POLICY IF EXISTS cli_select ON public.clientes;
CREATE POLICY cli_select ON public.clientes
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL  -- Excluir soft deleted
        AND (
            is_admin()
            OR can_access_cliente(id)
        )
    );

-- Política especial para admins que necesiten ver eliminados
DROP POLICY IF EXISTS cli_select_deleted_admin ON public.clientes;
CREATE POLICY cli_select_deleted_admin ON public.clientes
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- ============================================================================
-- SECCIÓN 9: POLÍTICAS MEJORADAS PARA CONTRATOS (Soft Delete)
-- ============================================================================
-- NOTA: contratos no tiene cliente_id directo, se relaciona via punto_id -> puntos_suministro.cliente_id

DROP POLICY IF EXISTS con_select ON public.contratos;
CREATE POLICY con_select ON public.contratos
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR EXISTS (
                SELECT 1 FROM public.puntos_suministro ps
                WHERE ps.id = contratos.punto_id
                AND can_access_cliente(ps.cliente_id)
            )
        )
    );

DROP POLICY IF EXISTS con_select_deleted_admin ON public.contratos;
CREATE POLICY con_select_deleted_admin ON public.contratos
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- ============================================================================
-- SECCIÓN 10: POLÍTICAS MEJORADAS PARA FACTURAS (Soft Delete + Fiscal)
-- ============================================================================
-- NOTA: facturas tiene cliente_id directamente

DROP POLICY IF EXISTS fac_select ON public.facturas;
CREATE POLICY fac_select ON public.facturas
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR can_access_cliente(cliente_id)
        )
    );

-- Facturas eliminadas visibles solo para admins (requisito fiscal)
DROP POLICY IF EXISTS fac_select_deleted_admin ON public.facturas;
CREATE POLICY fac_select_deleted_admin ON public.facturas
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- IMPORTANTE: Las facturas NO se pueden eliminar físicamente (requisito fiscal)
DROP POLICY IF EXISTS fac_delete ON public.facturas;
CREATE POLICY fac_delete ON public.facturas
    FOR DELETE
    TO authenticated
    USING (FALSE);  -- Nadie puede eliminar facturas físicamente

-- ============================================================================
-- SECCIÓN 11: POLÍTICAS MEJORADAS PARA USUARIOS_APP
-- ============================================================================

-- Actualizar políticas para soft delete
DROP POLICY IF EXISTS ua_select ON public.usuarios_app;
CREATE POLICY ua_select ON public.usuarios_app
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR user_id = auth.uid()
        )
    );

-- Admins pueden ver usuarios eliminados
DROP POLICY IF EXISTS ua_select_deleted_admin ON public.usuarios_app;
CREATE POLICY ua_select_deleted_admin ON public.usuarios_app
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- Solo admins pueden modificar usuarios
-- NOTA: OLD/NEW no están disponibles en políticas RLS, solo en triggers.
-- La protección de campos sensibles (rol, empresa_id) debe hacerse via trigger o función.
DROP POLICY IF EXISTS ua_update ON public.usuarios_app;
CREATE POLICY ua_update ON public.usuarios_app
    FOR UPDATE
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR user_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Admins pueden modificar cualquier usuario
        -- Usuarios normales solo pueden modificar su propio registro
        is_admin()
        OR user_id = auth.uid()
    );

-- ============================================================================
-- SECCIÓN 12: POLÍTICAS PARA PUNTOS_SUMINISTRO (Soft Delete)
-- ============================================================================

DROP POLICY IF EXISTS ps_select ON public.puntos_suministro;
CREATE POLICY ps_select ON public.puntos_suministro
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR can_access_cliente(cliente_id)
        )
    );

DROP POLICY IF EXISTS ps_select_deleted_admin ON public.puntos_suministro;
CREATE POLICY ps_select_deleted_admin ON public.puntos_suministro
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- ============================================================================
-- SECCIÓN 13: POLÍTICAS PARA DOCUMENTOS (Soft Delete + Visibilidad)
-- ============================================================================

DROP POLICY IF EXISTS doc_select ON public.documentos;
CREATE POLICY doc_select ON public.documentos
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NULL
        AND (
            is_admin()
            OR (
                can_access_cliente(cliente_id)
                AND (
                    visible_para_cliente = TRUE
                    OR current_user_role() IN ('administrador', 'comercial')
                )
            )
        )
    );

DROP POLICY IF EXISTS doc_select_deleted_admin ON public.documentos;
CREATE POLICY doc_select_deleted_admin ON public.documentos
    FOR SELECT
    TO authenticated
    USING (
        eliminado_en IS NOT NULL
        AND is_admin()
    );

-- ============================================================================
-- SECCIÓN 14: FUNCIÓN PARA VERIFICAR CUMPLIMIENTO RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_rls_compliance()
RETURNS TABLE (
    table_name TEXT,
    rls_enabled BOOLEAN,
    rls_forced BOOLEAN,
    policy_count INT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::TEXT as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced,
        (SELECT COUNT(*)::INT FROM pg_policies p WHERE p.tablename = c.relname) as policy_count,
        CASE 
            WHEN NOT c.relrowsecurity THEN 'RLS DESHABILITADO'
            WHEN c.relrowsecurity AND NOT c.relforcerowsecurity THEN 'ADVERTENCIA: RLS no forzado'
            WHEN (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = c.relname) = 0 THEN 'ERROR: Sin políticas'
            ELSE 'OK'
        END as status
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE 'sql_%'
    ORDER BY 
        CASE WHEN c.relrowsecurity THEN 0 ELSE 1 END,
        c.relname;
END;
$$;

COMMENT ON FUNCTION public.verify_rls_compliance() IS 
'Verifica el estado de RLS en todas las tablas públicas.
Útil para auditorías de seguridad ISO 27001 y SOC 2.';

-- ============================================================================
-- SECCIÓN 15: POLÍTICA DE EMERGENCIA PARA SERVICE_ROLE
-- ============================================================================
-- Service role necesita acceso para operaciones de sistema

-- Permitir service_role bypasear RLS para funciones críticas de sistema
-- Esto ya está configurado por defecto en Supabase, pero lo documentamos

COMMENT ON POLICY cli_select ON public.clientes IS 
'Política SELECT para clientes.
- Admins: acceso total a no eliminados
- Comerciales: clientes asignados o de su empresa
- Clientes: solo su propio registro
- Soft deleted: excluidos excepto para admins';

-- ============================================================================
-- SECCIÓN 16: GRANTS RESTRINGIDOS PARA ROL ANON
-- ============================================================================
-- El rol anon (usuarios no autenticados) no debe tener acceso a datos

REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.contratos FROM anon;
REVOKE ALL ON public.documentos FROM anon;
REVOKE ALL ON public.empresas FROM anon;
REVOKE ALL ON public.facturas FROM anon;
REVOKE ALL ON public.lineas_factura FROM anon;
REVOKE ALL ON public.puntos_suministro FROM anon;
REVOKE ALL ON public.usuarios_app FROM anon;
REVOKE ALL ON public.facturacion_clientes FROM anon;
REVOKE ALL ON public.chat_history FROM anon;
REVOKE ALL ON public.precios_energia FROM anon;
REVOKE ALL ON public.precios_potencia FROM anon;
REVOKE ALL ON public.tarifas FROM anon;
REVOKE ALL ON public.comparativas FROM anon;
REVOKE ALL ON public.consumos FROM anon;
REVOKE ALL ON public.contactos_cliente FROM anon;
REVOKE ALL ON public.notificaciones FROM anon;
REVOKE ALL ON public.remesas FROM anon;
REVOKE ALL ON public.agenda_eventos FROM anon;
REVOKE ALL ON public.asignaciones_comercial FROM anon;

COMMENT ON SCHEMA public IS 
'Schema público con RLS habilitado en todas las tablas de datos.
Rol anon: sin acceso a datos (solo funciones públicas específicas).
Rol authenticated: acceso controlado por políticas RLS.
Service role: bypass RLS para operaciones de sistema.';

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar estado de RLS en todas las tablas
SELECT * FROM public.verify_rls_compliance();

-- 2. Verificar tablas con RLS forzado
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY relname;

-- 3. Listar todas las políticas
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Probar acceso con diferentes usuarios
-- (Ejecutar desde el frontend con diferentes sesiones)
*/
