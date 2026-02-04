-- ============================================================================
-- MIGRACIÓN: Crear schema market_data para datos de e·sios/REData
-- ============================================================================
-- Autor: Antigravity (Arquitecto de Datos)
-- Fecha: 2026-01-21
-- Descripción: Crea el schema y tablas para almacenar datos de mercado 
--              eléctrico (PVPC, SPOT, excedentes FV, etc.) provenientes
--              de la API e·sios/REData.
-- ============================================================================

-- ============================================================================
-- 1. CREAR SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS market_data;

COMMENT ON SCHEMA market_data IS 'Datos de mercado eléctrico provenientes de e·sios/REData para informes de facturación y comparativas';

-- Permisos de uso del schema
GRANT USAGE ON SCHEMA market_data TO authenticated;
GRANT USAGE ON SCHEMA market_data TO service_role;

-- ============================================================================
-- 2. TABLA: esios_indicators (Catálogo de Indicadores)
-- ============================================================================
CREATE TABLE market_data.esios_indicators (
    id              INTEGER PRIMARY KEY,  -- ID oficial de e·sios (ej: 1001)
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    unidad          TEXT NOT NULL DEFAULT '€/MWh',
    granularidad    TEXT NOT NULL DEFAULT 'hora',  -- 'hora', '15min', 'dia'
    geo_id_default  INTEGER DEFAULT 8741,  -- Península por defecto
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    modificado_en   TIMESTAMPTZ
);

COMMENT ON TABLE market_data.esios_indicators IS 'Catálogo de indicadores de e·sios que se van a ingestar';
COMMENT ON COLUMN market_data.esios_indicators.id IS 'ID oficial del indicador en e·sios (ej: 1001 = PVPC 2.0TD)';
COMMENT ON COLUMN market_data.esios_indicators.granularidad IS 'Granularidad temporal: hora, 15min o dia';
COMMENT ON COLUMN market_data.esios_indicators.geo_id_default IS 'Zona geográfica por defecto (8741 = Península)';

-- Datos iniciales: indicadores seleccionados
INSERT INTO market_data.esios_indicators (id, nombre, descripcion, unidad, granularidad) VALUES
    (1001, 'PVPC 2.0TD', 'Precio voluntario pequeño consumidor tarifa 2.0TD', '€/MWh', 'hora'),
    (1002, 'Periodo Tarifario PVPC 2.0TD', 'Período tarifario vigente por hora (P1/P2/P3)', 'periodo', 'hora'),
    (1739, 'Precio Excedentes FV PVPC', 'Precio energía excedentaria autoconsumo PVPC', '€/MWh', 'hora'),
    (1727, 'Precio MIC', 'Mercado intradiario continuo - precio medio', '€/MWh', 'hora'),
    (600, 'Precio SPOT Diario', 'Precio de casación del mercado diario', '€/MWh', 'hora');

-- ============================================================================
-- 3. TABLA: esios_geos (Catálogo de Zonas Geográficas)
-- ============================================================================
CREATE TABLE market_data.esios_geos (
    id              INTEGER PRIMARY KEY,  -- ID oficial de e·sios
    nombre          TEXT NOT NULL,
    codigo_iso      TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE market_data.esios_geos IS 'Catálogo de zonas geográficas de e·sios';
COMMENT ON COLUMN market_data.esios_geos.id IS 'ID oficial de la zona en e·sios';

-- Datos iniciales: zonas geográficas españolas
INSERT INTO market_data.esios_geos (id, nombre, codigo_iso) VALUES
    (8741, 'Península', 'ES'),
    (8742, 'Canarias', 'ES-CN'),
    (8743, 'Baleares', 'ES-IB'),
    (8744, 'Ceuta', 'ES-CE'),
    (8745, 'Melilla', 'ES-ML');

-- ============================================================================
-- 4. TABLA: esios_values (Datos Crudos - Serie Temporal)
-- ============================================================================
CREATE TABLE market_data.esios_values (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    indicator_id    INTEGER NOT NULL REFERENCES market_data.esios_indicators(id),
    geo_id          INTEGER NOT NULL REFERENCES market_data.esios_geos(id),
    datetime_utc    TIMESTAMPTZ NOT NULL,  -- Fecha/hora en UTC (dato original de la API)
    datetime_local  TIMESTAMPTZ NOT NULL,  -- Fecha/hora en Europe/Madrid (para consultas)
    value           NUMERIC(12,4) NOT NULL, -- Valor numérico (€/MWh, etc.)
    value_text      TEXT,  -- Para indicadores categóricos (ej: 'P1', 'P2', 'P3')
    
    -- Metadatos de la API
    api_updated_at  TIMESTAMPTZ,  -- values_updated_at de la respuesta de la API
    
    -- Auditoría
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint único: evita duplicados por indicador + zona + fecha/hora
    CONSTRAINT esios_values_unique UNIQUE (indicator_id, geo_id, datetime_utc)
);

COMMENT ON TABLE market_data.esios_values IS 'Serie temporal de valores horarios de indicadores e·sios (datos crudos)';
COMMENT ON COLUMN market_data.esios_values.datetime_utc IS 'Timestamp UTC exacto del valor (clave de unicidad)';
COMMENT ON COLUMN market_data.esios_values.datetime_local IS 'Timestamp en Europe/Madrid para facilitar consultas por fecha local';
COMMENT ON COLUMN market_data.esios_values.value IS 'Valor numérico en la unidad del indicador (normalmente €/MWh)';
COMMENT ON COLUMN market_data.esios_values.value_text IS 'Valor textual para indicadores categóricos (ej: período tarifario P1/P2/P3)';
COMMENT ON COLUMN market_data.esios_values.api_updated_at IS 'Timestamp de última actualización según la API e·sios';

-- Índices para consultas típicas
CREATE INDEX idx_esios_values_datetime_local ON market_data.esios_values(datetime_local);
CREATE INDEX idx_esios_values_indicator_date ON market_data.esios_values(indicator_id, datetime_local);
CREATE INDEX idx_esios_values_date_range ON market_data.esios_values(indicator_id, geo_id, datetime_local);

-- ============================================================================
-- 5. TABLA: esios_daily_stats (Agregados Diarios)
-- ============================================================================
CREATE TABLE market_data.esios_daily_stats (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    indicator_id    INTEGER NOT NULL REFERENCES market_data.esios_indicators(id),
    geo_id          INTEGER NOT NULL REFERENCES market_data.esios_geos(id),
    fecha           DATE NOT NULL,  -- Día en hora local (Europe/Madrid)
    
    -- Métricas estadísticas diarias
    valor_medio     NUMERIC(12,4),
    valor_min       NUMERIC(12,4),
    valor_max       NUMERIC(12,4),
    hora_min        SMALLINT,  -- 0-23: hora del valor mínimo
    hora_max        SMALLINT,  -- 0-23: hora del valor máximo
    desviacion_std  NUMERIC(12,4),
    
    -- Métricas por período tarifario (para tarifa 2.0TD)
    media_p1        NUMERIC(12,4),  -- Punta: 10-14, 18-22 L-V
    media_p2        NUMERIC(12,4),  -- Llano: 8-10, 14-18, 22-24 L-V
    media_p3        NUMERIC(12,4),  -- Valle: 0-8 L-V, todo fin de semana
    
    -- Control de completitud
    num_valores     SMALLINT NOT NULL DEFAULT 0,  -- Nº de horas con dato (esperado: 24)
    completo        BOOLEAN GENERATED ALWAYS AS (num_valores >= 24) STORED,
    
    -- Auditoría
    calculado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT esios_daily_stats_unique UNIQUE (indicator_id, geo_id, fecha)
);

COMMENT ON TABLE market_data.esios_daily_stats IS 'Estadísticas diarias precalculadas por indicador y zona';
COMMENT ON COLUMN market_data.esios_daily_stats.hora_min IS 'Hora del día (0-23) con el valor mínimo';
COMMENT ON COLUMN market_data.esios_daily_stats.hora_max IS 'Hora del día (0-23) con el valor máximo';
COMMENT ON COLUMN market_data.esios_daily_stats.media_p1 IS 'Media del período punta (10-14, 18-22 L-V)';
COMMENT ON COLUMN market_data.esios_daily_stats.media_p2 IS 'Media del período llano (8-10, 14-18, 22-24 L-V)';
COMMENT ON COLUMN market_data.esios_daily_stats.media_p3 IS 'Media del período valle (0-8 L-V, todo sábado/domingo)';
COMMENT ON COLUMN market_data.esios_daily_stats.completo IS 'TRUE si tiene las 24 horas del día';

-- Índices para consultas de informes
CREATE INDEX idx_esios_daily_stats_fecha ON market_data.esios_daily_stats(fecha);
CREATE INDEX idx_esios_daily_stats_indicator_fecha ON market_data.esios_daily_stats(indicator_id, fecha);

-- ============================================================================
-- 6. TABLA: ingestion_jobs (Control de Trabajos de Ingestión)
-- ============================================================================
CREATE TABLE market_data.ingestion_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            TEXT NOT NULL,  -- 'manual', 'scheduled', 'backfill'
    indicator_ids   INTEGER[] NOT NULL,  -- Array de IDs de indicadores a procesar
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    geo_id          INTEGER NOT NULL DEFAULT 8741,
    
    -- Estado y progreso
    estado          TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
    progreso        JSONB DEFAULT '{"dias_procesados": 0, "dias_total": 0}'::jsonb,
    error_message   TEXT,
    
    -- Auditoría
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_por      UUID REFERENCES auth.users(id),
    iniciado_en     TIMESTAMPTZ,
    completado_en   TIMESTAMPTZ
);

COMMENT ON TABLE market_data.ingestion_jobs IS 'Registro de trabajos de ingestión de datos e·sios';
COMMENT ON COLUMN market_data.ingestion_jobs.tipo IS 'Tipo de trabajo: manual, scheduled (cron), backfill (histórico)';
COMMENT ON COLUMN market_data.ingestion_jobs.estado IS 'Estado del job: pending, running, completed, failed';

CREATE INDEX idx_ingestion_jobs_estado ON market_data.ingestion_jobs(estado);
CREATE INDEX idx_ingestion_jobs_creado ON market_data.ingestion_jobs(creado_en DESC);

-- ============================================================================
-- 7. TABLA: ingestion_log (Detalle de Ejecuciones)
-- ============================================================================
CREATE TABLE market_data.ingestion_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id          UUID REFERENCES market_data.ingestion_jobs(id) ON DELETE CASCADE,
    indicator_id    INTEGER NOT NULL,
    fecha           DATE NOT NULL,
    geo_id          INTEGER NOT NULL,
    
    -- Resultado
    exito           BOOLEAN NOT NULL,
    registros_insertados    INTEGER DEFAULT 0,
    registros_actualizados  INTEGER DEFAULT 0,
    api_response_status     INTEGER,
    error_message   TEXT,
    
    -- Timestamp de la API (para detectar actualizaciones)
    api_values_updated_at TIMESTAMPTZ,
    
    -- Auditoría
    ejecutado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE market_data.ingestion_log IS 'Log detallado de cada ejecución de ingesta por indicador/fecha';
COMMENT ON COLUMN market_data.ingestion_log.api_values_updated_at IS 'Timestamp de última actualización según la API, para detectar cambios';

CREATE INDEX idx_ingestion_log_job ON market_data.ingestion_log(job_id);
CREATE INDEX idx_ingestion_log_fecha ON market_data.ingestion_log(indicator_id, fecha);

-- ============================================================================
-- 8. FUNCIÓN: Recalcular Estadísticas Diarias
-- ============================================================================
CREATE OR REPLACE FUNCTION market_data.recalculate_daily_stats(
    p_fecha_inicio DATE,
    p_fecha_fin DATE,
    p_indicator_id INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = market_data, public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO market_data.esios_daily_stats (
        indicator_id, geo_id, fecha,
        valor_medio, valor_min, valor_max,
        hora_min, hora_max, desviacion_std,
        num_valores, calculado_en
    )
    SELECT 
        v.indicator_id,
        v.geo_id,
        v.datetime_local::date AS fecha,
        ROUND(AVG(v.value)::numeric, 4) AS valor_medio,
        MIN(v.value) AS valor_min,
        MAX(v.value) AS valor_max,
        (ARRAY_AGG(EXTRACT(HOUR FROM v.datetime_local)::smallint ORDER BY v.value ASC))[1] AS hora_min,
        (ARRAY_AGG(EXTRACT(HOUR FROM v.datetime_local)::smallint ORDER BY v.value DESC))[1] AS hora_max,
        ROUND(STDDEV_POP(v.value)::numeric, 4) AS desviacion_std,
        COUNT(*)::smallint AS num_valores,
        NOW()
    FROM market_data.esios_values v
    WHERE v.datetime_local::date BETWEEN p_fecha_inicio AND p_fecha_fin
      AND (p_indicator_id IS NULL OR v.indicator_id = p_indicator_id)
    GROUP BY v.indicator_id, v.geo_id, v.datetime_local::date
    ON CONFLICT (indicator_id, geo_id, fecha)
    DO UPDATE SET
        valor_medio = EXCLUDED.valor_medio,
        valor_min = EXCLUDED.valor_min,
        valor_max = EXCLUDED.valor_max,
        hora_min = EXCLUDED.hora_min,
        hora_max = EXCLUDED.hora_max,
        desviacion_std = EXCLUDED.desviacion_std,
        num_valores = EXCLUDED.num_valores,
        calculado_en = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION market_data.recalculate_daily_stats IS 'Recalcula estadísticas diarias para un rango de fechas. Usa UPSERT para ser idempotente.';

-- ============================================================================
-- 9. FUNCIÓN: Verificar Horas Faltantes
-- ============================================================================
CREATE OR REPLACE FUNCTION market_data.check_missing_hours(
    p_fecha DATE,
    p_indicator_id INTEGER DEFAULT 1001,
    p_geo_id INTEGER DEFAULT 8741
)
RETURNS TABLE(missing_hour INTEGER)
LANGUAGE sql
STABLE
AS $$
    WITH expected_hours AS (
        SELECT generate_series(0, 23) AS hora
    ),
    actual_hours AS (
        SELECT EXTRACT(HOUR FROM datetime_local)::integer AS hora
        FROM market_data.esios_values
        WHERE indicator_id = p_indicator_id
          AND geo_id = p_geo_id
          AND datetime_local::date = p_fecha
    )
    SELECT e.hora
    FROM expected_hours e
    LEFT JOIN actual_hours a ON e.hora = a.hora
    WHERE a.hora IS NULL
    ORDER BY e.hora;
$$;

COMMENT ON FUNCTION market_data.check_missing_hours IS 'Devuelve las horas faltantes (0-23) para un día/indicador/zona específicos';

-- ============================================================================
-- 10. FUNCIÓN: Verificar si una fecha ya fue ingestada exitosamente
-- ============================================================================
CREATE OR REPLACE FUNCTION market_data.is_date_ingested(
    p_fecha DATE,
    p_indicator_id INTEGER,
    p_geo_id INTEGER DEFAULT 8741
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM market_data.ingestion_log
        WHERE indicator_id = p_indicator_id
          AND geo_id = p_geo_id
          AND fecha = p_fecha
          AND exito = TRUE
    );
$$;

COMMENT ON FUNCTION market_data.is_date_ingested IS 'Verifica si una fecha ya fue ingestada exitosamente para evitar peticiones redundantes';

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE market_data.esios_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data.esios_geos ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data.esios_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data.esios_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data.ingestion_log ENABLE ROW LEVEL SECURITY;

-- Catálogos: lectura pública para autenticados
CREATE POLICY "esios_indicators_select"
ON market_data.esios_indicators FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "esios_geos_select"
ON market_data.esios_geos FOR SELECT
TO authenticated
USING (TRUE);

-- Datos de mercado: lectura pública para autenticados (son datos regulados, públicos)
CREATE POLICY "esios_values_select"
ON market_data.esios_values FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "esios_daily_stats_select"
ON market_data.esios_daily_stats FOR SELECT
TO authenticated
USING (TRUE);

-- Escritura de datos: solo administradores
CREATE POLICY "esios_values_insert_admin"
ON market_data.esios_values FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "esios_values_update_admin"
ON market_data.esios_values FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "esios_daily_stats_insert_admin"
ON market_data.esios_daily_stats FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "esios_daily_stats_update_admin"
ON market_data.esios_daily_stats FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Jobs de ingestión: solo administradores pueden ver y crear
CREATE POLICY "ingestion_jobs_all_admin"
ON market_data.ingestion_jobs FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "ingestion_log_all_admin"
ON market_data.ingestion_log FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Permisos para service_role (Edge Functions)
-- Service role bypasses RLS, pero necesita permisos de tabla
GRANT ALL ON ALL TABLES IN SCHEMA market_data TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA market_data TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA market_data TO service_role;

-- Permisos para authenticated
GRANT SELECT ON market_data.esios_indicators TO authenticated;
GRANT SELECT ON market_data.esios_geos TO authenticated;
GRANT SELECT ON market_data.esios_values TO authenticated;
GRANT SELECT ON market_data.esios_daily_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON market_data.ingestion_jobs TO authenticated;
GRANT SELECT, INSERT ON market_data.ingestion_log TO authenticated;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
