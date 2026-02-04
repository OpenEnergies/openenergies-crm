-- ============================================================================
-- MIGRACIÓN: Refactorizar sistema de informes con tabla informes_targets
-- ============================================================================
-- Autor: Sistema CRM
-- Fecha: 2026-02-04
-- Descripción: Elimina empresa_id de informes, migra punto_ids a tabla relacional
--              informes_targets, y ajusta RLS para seguridad sin empresa_id.
-- 
-- CAMBIOS PRINCIPALES:
-- 1. Crear tabla informes_targets (informe_id + punto_id)
-- 2. Backfill: migrar datos de punto_ids a informes_targets
-- 3. Eliminar empresa_id de informes_mercado
-- 4. Eliminar punto_ids de informes_mercado
-- 5. Migrar rango_fechas jsonb → fecha_inicio/fecha_fin
-- 6. Ajustar RLS policies para funcionar sin empresa_id
-- 7. Actualizar funciones RPC afectadas
-- ============================================================================

-- ============================================================================
-- PASO 1: CREAR TABLA informes_targets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.informes_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    informe_id UUID NOT NULL REFERENCES public.informes_mercado(id) ON DELETE CASCADE,
    punto_id UUID NOT NULL REFERENCES public.puntos_suministro(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Evitar duplicados
    CONSTRAINT unique_informe_punto UNIQUE(informe_id, punto_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_informes_targets_informe ON public.informes_targets(informe_id);
CREATE INDEX IF NOT EXISTS idx_informes_targets_punto ON public.informes_targets(punto_id);

COMMENT ON TABLE public.informes_targets IS 'Relación Many-to-Many entre informes y puntos de suministro';
COMMENT ON COLUMN public.informes_targets.informe_id IS 'UUID del informe';
COMMENT ON COLUMN public.informes_targets.punto_id IS 'UUID del punto de suministro incluido en el informe';

-- ============================================================================
-- PASO 2: AGREGAR COLUMNAS NUEVAS (si no existen)
-- ============================================================================

DO $$ 
BEGIN
    -- Agregar cliente_id (singular) si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'informes_mercado' 
        AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE public.informes_mercado ADD COLUMN cliente_id UUID;
    END IF;

    -- Agregar fecha_inicio si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'informes_mercado' 
        AND column_name = 'fecha_inicio'
    ) THEN
        ALTER TABLE public.informes_mercado ADD COLUMN fecha_inicio DATE;
    END IF;

    -- Agregar fecha_fin si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'informes_mercado' 
        AND column_name = 'fecha_fin'
    ) THEN
        ALTER TABLE public.informes_mercado ADD COLUMN fecha_fin DATE;
    END IF;
END $$;

-- Índice para la nueva columna cliente_id
CREATE INDEX IF NOT EXISTS idx_informes_mercado_cliente_id ON public.informes_mercado(cliente_id);

-- ============================================================================
-- PASO 3: BACKFILL DE DATOS
-- ============================================================================

-- 3.1: Migrar cliente_ids[0] → cliente_id (tomar el primer cliente del array)
UPDATE public.informes_mercado
SET cliente_id = cliente_ids[1]
WHERE cliente_id IS NULL 
  AND cliente_ids IS NOT NULL 
  AND array_length(cliente_ids, 1) > 0;

-- 3.2: Migrar rango_fechas → fecha_inicio/fecha_fin
UPDATE public.informes_mercado
SET 
    fecha_inicio = (rango_fechas->>'start')::DATE,
    fecha_fin = (rango_fechas->>'end')::DATE
WHERE rango_fechas IS NOT NULL 
  AND fecha_inicio IS NULL;

-- 3.3: Hacer NOT NULL las nuevas columnas (después del backfill)
ALTER TABLE public.informes_mercado 
    ALTER COLUMN cliente_id SET NOT NULL;

ALTER TABLE public.informes_mercado 
    ALTER COLUMN fecha_inicio SET NOT NULL;

ALTER TABLE public.informes_mercado 
    ALTER COLUMN fecha_fin SET NOT NULL;

-- 3.4: Backfill de punto_ids → informes_targets
-- Insertar un registro por cada punto_id en el array
DO $$
DECLARE
    r RECORD;
    punto UUID;
BEGIN
    FOR r IN 
        SELECT id, punto_ids 
        FROM public.informes_mercado 
        WHERE punto_ids IS NOT NULL AND array_length(punto_ids, 1) > 0
    LOOP
        FOREACH punto IN ARRAY r.punto_ids
        LOOP
            -- Insertar solo si el punto existe (validación)
            IF EXISTS (SELECT 1 FROM public.puntos_suministro WHERE id = punto) THEN
                INSERT INTO public.informes_targets (informe_id, punto_id)
                VALUES (r.id, punto)
                ON CONFLICT (informe_id, punto_id) DO NOTHING;
            ELSE
                RAISE NOTICE 'Punto inexistente % en informe %, omitiendo', punto, r.id;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- PASO 4: ELIMINAR COLUMNAS ANTIGUAS
-- ============================================================================

-- 4.1: Eliminar índices relacionados con empresa_id, cliente_ids y punto_ids
DROP INDEX IF EXISTS public.idx_informes_mercado_empresa;
DROP INDEX IF EXISTS public.idx_informes_mercado_cliente_ids;
DROP INDEX IF EXISTS public.idx_informes_mercado_punto_ids;

-- 4.2: Eliminar columnas
-- NOTA: DROP COLUMN empresa_id se hace DESPUÉS de eliminar todas las políticas
-- que dependían de él (ver PASO 5)
ALTER TABLE public.informes_mercado DROP COLUMN IF EXISTS cliente_ids;
ALTER TABLE public.informes_mercado DROP COLUMN IF EXISTS punto_ids;
ALTER TABLE public.informes_mercado DROP COLUMN IF EXISTS rango_fechas;

-- ============================================================================
-- PASO 5: AJUSTAR RLS POLICIES (sin empresa_id)
-- ============================================================================

-- La seguridad ahora se basa en:
-- - creado_por (el usuario que creó el informe)
-- - cliente_id del informe → puntos_suministro.cliente_id → clientes.empresa_id → usuarios_app.empresa_id

-- 5.1: DROP políticas antiguas de informes_mercado de forma robusta
-- Eliminar todas las políticas existentes sin IF EXISTS para asegurar que se eliminan todas
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Obtener todas las políticas que existen en la tabla
    FOR policy_name IN
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'informes_mercado' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_name) || ' ON public.informes_mercado';
        RAISE NOTICE 'Dropped policy: %', policy_name;
    END LOOP;
END $$;

-- 5.2: Crear nuevas políticas basadas en creado_por y cliente_id
CREATE POLICY informes_mercado_select_own
    ON public.informes_mercado
    FOR SELECT
    TO authenticated
    USING (
        -- El usuario creó el informe
        creado_por = auth.uid()
        OR
        -- O el cliente del informe pertenece a la empresa del usuario
        EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id = informes_mercado.cliente_id
              )
        )
    );

CREATE POLICY informes_mercado_insert_own
    ON public.informes_mercado
    FOR INSERT
    TO authenticated
    WITH CHECK (
        creado_por = auth.uid()
        AND
        -- El cliente pertenece a la empresa del usuario
        EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id = cliente_id
              )
        )
    );

CREATE POLICY informes_mercado_update_own
    ON public.informes_mercado
    FOR UPDATE
    TO authenticated
    USING (
        creado_por = auth.uid()
        OR
        -- Admin de la empresa del cliente
        EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.rol = 'administrador'
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id = informes_mercado.cliente_id
              )
        )
    );

CREATE POLICY informes_mercado_delete_own
    ON public.informes_mercado
    FOR DELETE
    TO authenticated
    USING (
        creado_por = auth.uid()
        OR
        -- Admin de la empresa del cliente
        EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.rol = 'administrador'
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id = informes_mercado.cliente_id
              )
        )
    );

-- ============================================================================
-- PASO 5.3: AHORA ELIMINAR LA COLUMNA empresa_id (después de limpiar políticas)
-- ============================================================================

ALTER TABLE public.informes_mercado DROP COLUMN IF EXISTS empresa_id;

-- ============================================================================
-- PASO 6: RLS PARA informes_targets
-- ============================================================================

ALTER TABLE public.informes_targets ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver targets si pueden ver el informe
CREATE POLICY informes_targets_select
    ON public.informes_targets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.informes_mercado i
            WHERE i.id = informes_targets.informe_id
              AND (
                  i.creado_por = auth.uid()
                  OR
                  EXISTS (
                      SELECT 1 
                      FROM public.usuarios_app u
                      WHERE u.user_id = auth.uid()
                        AND u.empresa_id = (
                            SELECT empresa_id FROM public.clientes 
                            WHERE id = i.cliente_id
                        )
                  )
              )
        )
    );

-- Los usuarios pueden insertar targets solo si crearon el informe
CREATE POLICY informes_targets_insert
    ON public.informes_targets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.informes_mercado i
            WHERE i.id = informe_id
              AND i.creado_por = auth.uid()
        )
    );

-- Los usuarios pueden eliminar targets solo si crearon el informe
CREATE POLICY informes_targets_delete
    ON public.informes_targets
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.informes_mercado i
            WHERE i.id = informe_id
              AND i.creado_por = auth.uid()
        )
    );

-- ============================================================================
-- PASO 7: ACTUALIZAR RLS DE STORAGE (sin empresa_id)
-- ============================================================================

-- Storage policies: la ruta ahora es cliente_id/... en vez de empresa_id/...
-- Eliminar políticas antiguas
DROP POLICY IF EXISTS informes_mercado_storage_select ON storage.objects;
DROP POLICY IF EXISTS informes_mercado_storage_insert ON storage.objects;
DROP POLICY IF EXISTS informes_mercado_storage_update ON storage.objects;
DROP POLICY IF EXISTS informes_mercado_storage_delete ON storage.objects;

-- Nueva política SELECT: basada en cliente_id
CREATE POLICY informes_mercado_storage_select
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'informes-mercado'
        AND (
            -- El primer segmento de la ruta es el cliente_id
            -- El usuario tiene acceso si el cliente pertenece a su empresa
            EXISTS (
                SELECT 1 
                FROM public.usuarios_app u
                WHERE u.user_id = auth.uid()
                  AND u.empresa_id = (
                      SELECT empresa_id FROM public.clientes 
                      WHERE id::text = (storage.foldername(name))[1]
                  )
            )
        )
    );

-- Nueva política INSERT
CREATE POLICY informes_mercado_storage_insert
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'informes-mercado'
        AND EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id::text = (storage.foldername(name))[1]
              )
        )
    );

-- Nueva política UPDATE
CREATE POLICY informes_mercado_storage_update
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'informes-mercado'
        AND EXISTS (
            SELECT 1 
            FROM public.usuarios_app u
            WHERE u.user_id = auth.uid()
              AND u.empresa_id = (
                  SELECT empresa_id FROM public.clientes 
                  WHERE id::text = (storage.foldername(name))[1]
              )
        )
    );

-- Nueva política DELETE (solo admins)
CREATE POLICY informes_mercado_storage_delete
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'informes-mercado'
        AND EXISTS (
            SELECT 1 FROM public.usuarios_app 
            WHERE user_id = auth.uid() AND rol = 'administrador'
        )
    );

-- ============================================================================
-- PASO 8: ACTUALIZAR FUNCIONES RPC
-- ============================================================================

-- 8.1: DROP de la versión anterior de get_informe_facturacion_data (con firma antigua)
DROP FUNCTION IF EXISTS public.get_informe_facturacion_data(UUID[], UUID[], DATE, DATE);

-- 8.2: Crear nueva versión con firma actualizada (cliente_id singular)
CREATE OR REPLACE FUNCTION public.get_informe_facturacion_data(
    p_cliente_id UUID,
    p_punto_ids UUID[],
    p_fecha_inicio DATE,
    p_fecha_fin DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Verificar que el usuario pertenece a la empresa del cliente
    IF NOT EXISTS (
        SELECT 1 
        FROM public.usuarios_app u
        WHERE u.user_id = auth.uid()
          AND u.empresa_id = (
              SELECT empresa_id FROM public.clientes 
              WHERE id = p_cliente_id
          )
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para acceder a este cliente';
    END IF;

    SELECT jsonb_build_object(
        'resumen', (
            SELECT jsonb_build_object(
                'total_facturas', COUNT(*)::INTEGER,
                'importe_total', COALESCE(SUM(f.importe_total), 0)::NUMERIC(12,2),
                'consumo_total_kwh', COALESCE(SUM(f.consumo_total_kwh), 0)::NUMERIC(12,2),
                'precio_medio_kwh', CASE 
                    WHEN COALESCE(SUM(f.consumo_total_kwh), 0) > 0 
                    THEN (SUM(f.importe_total) / SUM(f.consumo_total_kwh))::NUMERIC(10,6)
                    ELSE 0 
                END
            )
            FROM public.facturacion_clientes f
            WHERE f.punto_id = ANY(p_punto_ids)
            AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin
        ),
        'por_mes', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'mes', mes,
                    'importe', importe,
                    'consumo', consumo
                ) ORDER BY mes
            ), '[]'::jsonb)
            FROM (
                SELECT 
                    DATE_TRUNC('month', f.fecha_emision)::DATE as mes,
                    SUM(f.importe_total)::NUMERIC(12,2) as importe,
                    SUM(f.consumo_total_kwh)::NUMERIC(12,2) as consumo
                FROM public.facturacion_clientes f
                WHERE f.punto_id = ANY(p_punto_ids)
                AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin
                GROUP BY DATE_TRUNC('month', f.fecha_emision)
            ) sub
        ),
        'por_punto', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'punto_id', punto_id,
                    'cups', cups,
                    'importe_total', importe,
                    'consumo_total', consumo
                )
            ), '[]'::jsonb)
            FROM (
                SELECT 
                    p.id as punto_id,
                    p.cups as cups,
                    SUM(f.importe_total)::NUMERIC(12,2) as importe,
                    SUM(f.consumo_total_kwh)::NUMERIC(12,2) as consumo
                FROM public.puntos_suministro p
                LEFT JOIN public.facturacion_clientes f ON f.punto_id = p.id
                    AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin
                WHERE p.id = ANY(p_punto_ids)
                GROUP BY p.id, p.cups
            ) sub
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_informe_facturacion_data(UUID, UUID[], DATE, DATE) IS 'Obtiene datos agregados de facturación para un cliente y sus puntos';

-- ============================================================================
-- PASO 9: ELIMINAR COLUMNA tipo_energia Y SU ENUM (ya no se usa)
-- ============================================================================

-- 9.1: Eliminar columna tipo_energia si existe
ALTER TABLE public.informes_mercado DROP COLUMN IF EXISTS tipo_energia;

-- 9.2: Eliminar el enum tipo_energia_informe si existe
DROP TYPE IF EXISTS public.tipo_energia_informe CASCADE;

-- ============================================================================
-- PASO 10: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON public.informes_targets TO authenticated;

-- ============================================================================
-- PASO 11: ACTUALIZAR COMENTARIOS DE TABLA
-- ============================================================================

COMMENT ON COLUMN public.informes_mercado.fecha_inicio IS 'Fecha de inicio del período de análisis';
COMMENT ON COLUMN public.informes_mercado.fecha_fin IS 'Fecha de fin del período de análisis';
COMMENT ON TABLE public.informes_mercado IS 'Informes de auditoría energética - los puntos se gestionan en informes_targets';

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
-- VERIFICACIONES POST-MIGRACIÓN:
-- 1. SELECT COUNT(*) FROM informes_targets; -- Debe haber registros
-- 2. SELECT * FROM informes_mercado LIMIT 1; -- No debe tener empresa_id, punto_ids, rango_fechas
-- 3. Verificar que las políticas funcionan correctamente
-- ============================================================================
