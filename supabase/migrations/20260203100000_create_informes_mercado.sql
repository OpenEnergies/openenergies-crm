-- ============================================================================
-- MIGRACIÓN: Crear tabla informes_mercado y Storage bucket
-- ============================================================================
-- Autor: Sistema CRM
-- Fecha: 2026-02-03
-- Descripción: Crea la infraestructura para el módulo de Informes de Mercado
--              que permite generar reportes de auditoría y situación de mercado
--              para múltiples clientes y puntos de suministro.
-- ============================================================================

-- ============================================================================
-- 1. CREAR ENUM PARA TIPO DE INFORME
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE public.tipo_informe_mercado AS ENUM ('auditoria', 'mercado', 'seguimiento');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE public.tipo_informe_mercado IS 'Tipos de informe de mercado disponibles';

-- ============================================================================
-- 2. CREAR ENUM PARA TIPO DE ENERGÍA
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE public.tipo_energia_informe AS ENUM ('electricidad', 'gas', 'ambos');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE public.tipo_energia_informe IS 'Tipos de energía para filtros de informe';

-- ============================================================================
-- 3. CREAR TABLA: informes_mercado
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.informes_mercado (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datos básicos del informe
    titulo              TEXT NOT NULL,
    tipo_informe        public.tipo_informe_mercado NOT NULL DEFAULT 'mercado',
    tipo_energia        public.tipo_energia_informe NOT NULL DEFAULT 'electricidad',
    
    -- Rango de fechas del análisis (JSONB: { "start": "2025-01-01", "end": "2025-12-31" })
    rango_fechas        JSONB NOT NULL,
    
    -- Relaciones Many-to-Many implícitas mediante arrays
    cliente_ids         UUID[] NOT NULL DEFAULT '{}',
    punto_ids           UUID[] NOT NULL DEFAULT '{}',
    
    -- Configuración de parámetros del informe (gráficos seleccionados, textos personalizados)
    -- Estructura esperada:
    -- {
    --   "graficos_seleccionados": ["evolucion_pool", "mapa_calor", "mix_generacion"],
    --   "resumen_ejecutivo": { "coste_total": "...", "consumo_total": "...", "ahorro_potencial": "..." },
    --   "analisis_mercado": "Texto del análisis...",
    --   "incidencias": { "excesos_potencia": true, "energia_reactiva": false },
    --   "recomendaciones": {
    --     "sin_inversion": ["Ajustar potencia contratada", "..."],
    --     "con_inversion": ["Instalar paneles solares", "..."]
    --   },
    --   "conclusion_tipo": "favorable" | "informativa",
    --   "precio_medio_pagado": 0.12,
    --   "precio_medio_mercado": 0.10
    -- }
    parametros_config   JSONB NOT NULL DEFAULT '{}',
    
    -- Ruta del PDF generado en Storage
    ruta_storage        TEXT,
    
    -- Auditoría
    creado_por          UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ,
    
    -- Estado del informe
    estado              TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'generando', 'completado', 'error'))
);

COMMENT ON TABLE public.informes_mercado IS 'Informes de mercado generados con soporte Many-to-Many para clientes y puntos';
COMMENT ON COLUMN public.informes_mercado.cliente_ids IS 'Array de UUIDs de clientes incluidos en el informe';
COMMENT ON COLUMN public.informes_mercado.punto_ids IS 'Array de UUIDs de puntos de suministro incluidos en el informe';
COMMENT ON COLUMN public.informes_mercado.parametros_config IS 'Configuración completa del informe: gráficos, textos, incidencias y recomendaciones';
COMMENT ON COLUMN public.informes_mercado.rango_fechas IS 'Rango de fechas del análisis en formato { start, end }';
COMMENT ON COLUMN public.informes_mercado.ruta_storage IS 'Ruta del PDF generado en el bucket informes-mercado';

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_informes_mercado_empresa ON public.informes_mercado(empresa_id);
CREATE INDEX IF NOT EXISTS idx_informes_mercado_creado_por ON public.informes_mercado(creado_por);
CREATE INDEX IF NOT EXISTS idx_informes_mercado_creado_en ON public.informes_mercado(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_informes_mercado_tipo ON public.informes_mercado(tipo_informe);
CREATE INDEX IF NOT EXISTS idx_informes_mercado_estado ON public.informes_mercado(estado);

-- Índices GIN para búsqueda en arrays (Many-to-Many)
CREATE INDEX IF NOT EXISTS idx_informes_mercado_cliente_ids ON public.informes_mercado USING GIN(cliente_ids);
CREATE INDEX IF NOT EXISTS idx_informes_mercado_punto_ids ON public.informes_mercado USING GIN(punto_ids);

-- ============================================================================
-- 4. HABILITAR ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.informes_mercado ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden ver informes de su empresa
CREATE POLICY "informes_mercado_select_empresa"
    ON public.informes_mercado
    FOR SELECT
    TO authenticated
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_app WHERE user_id = auth.uid()
        )
    );

-- Política: Los usuarios autenticados pueden crear informes en su empresa
CREATE POLICY "informes_mercado_insert_empresa"
    ON public.informes_mercado
    FOR INSERT
    TO authenticated
    WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_app WHERE user_id = auth.uid()
        )
        AND creado_por = auth.uid()
    );

-- Política: Los usuarios pueden actualizar sus propios informes o si son admin
CREATE POLICY "informes_mercado_update_own"
    ON public.informes_mercado
    FOR UPDATE
    TO authenticated
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_app WHERE user_id = auth.uid()
        )
        AND (
            creado_por = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.usuarios_app 
                WHERE user_id = auth.uid() AND rol = 'administrador'
            )
        )
    );

-- Política: Solo admins o el creador pueden eliminar
CREATE POLICY "informes_mercado_delete_own"
    ON public.informes_mercado
    FOR DELETE
    TO authenticated
    USING (
        creado_por = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.usuarios_app 
            WHERE user_id = auth.uid() AND rol = 'administrador'
        )
    );

-- ============================================================================
-- 5. CREAR STORAGE BUCKET: informes-mercado
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'informes-mercado',
    'informes-mercado',
    false,  -- Bucket privado
    52428800,  -- 50MB max
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. POLÍTICAS DE STORAGE PARA EL BUCKET
-- ============================================================================

-- Política: Usuarios autenticados pueden leer archivos de informes de su empresa
CREATE POLICY "informes_mercado_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'informes-mercado'
        AND (storage.foldername(name))[1] IN (
            SELECT empresa_id::text FROM public.usuarios_app WHERE user_id = auth.uid()
        )
    );

-- Política: Usuarios autenticados pueden subir archivos a su carpeta de empresa
CREATE POLICY "informes_mercado_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'informes-mercado'
        AND (storage.foldername(name))[1] IN (
            SELECT empresa_id::text FROM public.usuarios_app WHERE user_id = auth.uid()
        )
    );

-- Política: Usuarios autenticados pueden actualizar archivos de su empresa
CREATE POLICY "informes_mercado_storage_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'informes-mercado'
        AND (storage.foldername(name))[1] IN (
            SELECT empresa_id::text FROM public.usuarios_app WHERE user_id = auth.uid()
        )
    );

-- Política: Solo admins pueden eliminar archivos
CREATE POLICY "informes_mercado_storage_delete"
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
-- 7. FUNCIÓN RPC PARA OBTENER DATOS AGREGADOS DE FACTURACIÓN
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_informe_facturacion_data(
    p_cliente_ids UUID[],
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
    -- Verificar que el usuario pertenece a la empresa de los clientes
    IF NOT EXISTS (
        SELECT 1 FROM public.clientes c
        JOIN public.usuarios_app u ON c.empresa_id = u.empresa_id
        WHERE c.id = ANY(p_cliente_ids) AND u.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para acceder a estos clientes';
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
            FROM public.facturas f
            WHERE (
                f.cliente_id = ANY(p_cliente_ids)
                OR f.punto_id = ANY(p_punto_ids)
            )
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
                FROM public.facturas f
                WHERE (
                    f.cliente_id = ANY(p_cliente_ids)
                    OR f.punto_id = ANY(p_punto_ids)
                )
                AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin
                GROUP BY DATE_TRUNC('month', f.fecha_emision)
            ) sub
        ),
        'por_cliente', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'cliente_id', cliente_id,
                    'cliente_nombre', cliente_nombre,
                    'importe_total', importe,
                    'consumo_total', consumo
                )
            ), '[]'::jsonb)
            FROM (
                SELECT 
                    c.id as cliente_id,
                    c.nombre as cliente_nombre,
                    SUM(f.importe_total)::NUMERIC(12,2) as importe,
                    SUM(f.consumo_total_kwh)::NUMERIC(12,2) as consumo
                FROM public.clientes c
                LEFT JOIN public.facturas f ON f.cliente_id = c.id
                    AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin
                WHERE c.id = ANY(p_cliente_ids)
                GROUP BY c.id, c.nombre
            ) sub
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_informe_facturacion_data IS 'Obtiene datos agregados de facturación para generación de informes de mercado';

-- ============================================================================
-- 8. FUNCIÓN RPC PARA OBTENER DATOS DE MERCADO AGREGADOS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_informe_market_data(
    p_fecha_inicio DATE,
    p_fecha_fin DATE,
    p_indicator_ids INTEGER[] DEFAULT ARRAY[600, 1001]  -- SPOT y PVPC por defecto
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'estadisticas_diarias', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'indicator_id', indicator_id,
                    'indicator_nombre', (SELECT nombre FROM market_data.esios_indicators WHERE id = indicator_id),
                    'fecha', fecha,
                    'valor_medio', valor_medio,
                    'valor_min', valor_min,
                    'valor_max', valor_max,
                    'media_p1', media_p1,
                    'media_p2', media_p2,
                    'media_p3', media_p3
                ) ORDER BY indicator_id, fecha
            ), '[]'::jsonb)
            FROM market_data.esios_daily_stats
            WHERE indicator_id = ANY(p_indicator_ids)
            AND fecha BETWEEN p_fecha_inicio AND p_fecha_fin
        ),
        'resumen_periodo', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'indicator_id', indicator_id,
                    'indicator_nombre', (SELECT nombre FROM market_data.esios_indicators WHERE id = sub.indicator_id),
                    'media_periodo', media,
                    'minimo_periodo', minimo,
                    'maximo_periodo', maximo,
                    'volatilidad', volatilidad
                )
            ), '[]'::jsonb)
            FROM (
                SELECT 
                    indicator_id,
                    AVG(valor_medio)::NUMERIC(12,4) as media,
                    MIN(valor_min)::NUMERIC(12,4) as minimo,
                    MAX(valor_max)::NUMERIC(12,4) as maximo,
                    STDDEV(valor_medio)::NUMERIC(12,4) as volatilidad
                FROM market_data.esios_daily_stats
                WHERE indicator_id = ANY(p_indicator_ids)
                AND fecha BETWEEN p_fecha_inicio AND p_fecha_fin
                GROUP BY indicator_id
            ) sub
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_informe_market_data IS 'Obtiene datos de mercado agregados para generación de informes';

-- ============================================================================
-- 9. GRANT PERMISOS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.informes_mercado TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_informe_facturacion_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_informe_market_data TO authenticated;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
