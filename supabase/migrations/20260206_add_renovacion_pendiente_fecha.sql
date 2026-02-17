-- ============================================================================
-- MIGRACIÓN: Sistema de Renovaciones con Pendientes de Fecha
-- ============================================================================
-- Autor: Sistema CRM
-- Fecha: 2026-02-06
-- Descripción: Añade soporte para flujo de renovaciones en bloque con opción
--              de agregar fechas posteriormente. Incluye nuevas columnas,
--              restricciones de integridad y optimización con índices.
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR NUEVAS COLUMNAS
-- ============================================================================

-- Columna para marcar contratos pendientes de fecha de renovación
ALTER TABLE public.contratos
ADD COLUMN IF NOT EXISTS pendiente_fecha boolean NOT NULL DEFAULT false;

-- Columna para agrupar contratos pendientes en carpetas/lotes
ALTER TABLE public.contratos
ADD COLUMN IF NOT EXISTS nombre_carpeta_renovacion_pendiente_fecha text NULL;

COMMENT ON COLUMN public.contratos.pendiente_fecha IS 
  'Indica si el contrato está pendiente de asignar fecha de activación y renovación en flujo de renovación masiva';

COMMENT ON COLUMN public.contratos.nombre_carpeta_renovacion_pendiente_fecha IS 
  'Nombre de la carpeta/lote de renovación pendiente. Solo aplica cuando pendiente_fecha = true';

-- ============================================================================
-- 2. RESTRICCIÓN DE INTEGRIDAD: pendiente_fecha <-> nombre_carpeta
-- ============================================================================
-- Regla:
--   - Si pendiente_fecha = true  => nombre_carpeta_renovacion_pendiente_fecha NO puede ser NULL
--   - Si pendiente_fecha = false => nombre_carpeta_renovacion_pendiente_fecha DEBE ser NULL

-- Usamos un CHECK constraint para esto
ALTER TABLE public.contratos
ADD CONSTRAINT chk_pendiente_fecha_carpeta_integridad CHECK (
  (pendiente_fecha = true AND nombre_carpeta_renovacion_pendiente_fecha IS NOT NULL)
  OR
  (pendiente_fecha = false AND nombre_carpeta_renovacion_pendiente_fecha IS NULL)
);

-- ============================================================================
-- 3. ÍNDICES PARA OPTIMIZAR CONSULTAS DE RENOVACIONES
-- ============================================================================

-- Índice para filtrar por fecha_renovacion (ya puede existir, usamos IF NOT EXISTS simulado)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'contratos' 
    AND indexname = 'idx_contratos_fecha_renovacion'
  ) THEN
    CREATE INDEX idx_contratos_fecha_renovacion 
    ON public.contratos(fecha_renovacion)
    WHERE eliminado_en IS NULL;
  END IF;
END $$;

-- Índice para filtrar contratos pendientes de fecha
CREATE INDEX IF NOT EXISTS idx_contratos_pendiente_fecha 
ON public.contratos(pendiente_fecha)
WHERE eliminado_en IS NULL AND pendiente_fecha = true;

-- Índice para filtrar por nombre de carpeta de renovación pendiente
CREATE INDEX IF NOT EXISTS idx_contratos_carpeta_renovacion
ON public.contratos(nombre_carpeta_renovacion_pendiente_fecha)
WHERE eliminado_en IS NULL AND nombre_carpeta_renovacion_pendiente_fecha IS NOT NULL;

-- Índice compuesto para consultas de renovaciones pendientes por carpeta
CREATE INDEX IF NOT EXISTS idx_contratos_renovacion_pendiente_completo
ON public.contratos(pendiente_fecha, nombre_carpeta_renovacion_pendiente_fecha, fecha_renovacion)
WHERE eliminado_en IS NULL;

-- ============================================================================
-- 4. FUNCIÓN AUXILIAR: Validar unicidad de nombre de carpeta (soft)
-- ============================================================================
-- Nota: No usamos constraint único porque puede haber NULLs válidos
-- La validación de unicidad se hace en la aplicación antes de insertar

-- Función para verificar si un nombre de carpeta ya existe
CREATE OR REPLACE FUNCTION public.check_carpeta_renovacion_existe(p_nombre text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contratos
    WHERE nombre_carpeta_renovacion_pendiente_fecha = p_nombre
    AND eliminado_en IS NULL
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.check_carpeta_renovacion_existe IS 
  'Verifica si ya existe una carpeta de renovación pendiente con el nombre dado';

-- ============================================================================
-- 5. RPC: Obtener carpetas de renovación pendiente con conteos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_carpetas_renovacion_pendiente()
RETURNS TABLE (
  nombre_carpeta text,
  cantidad_contratos bigint,
  comercializadora_ids uuid[],
  fecha_creacion timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    c.nombre_carpeta_renovacion_pendiente_fecha AS nombre_carpeta,
    COUNT(*)::bigint AS cantidad_contratos,
    ARRAY_AGG(DISTINCT c.comercializadora_id) AS comercializadora_ids,
    MIN(c.modificado_en) AS fecha_creacion
  FROM public.contratos c
  WHERE c.pendiente_fecha = true
    AND c.nombre_carpeta_renovacion_pendiente_fecha IS NOT NULL
    AND c.eliminado_en IS NULL
  GROUP BY c.nombre_carpeta_renovacion_pendiente_fecha
  ORDER BY MIN(c.modificado_en) DESC;
$$;

COMMENT ON FUNCTION public.get_carpetas_renovacion_pendiente IS 
  'Obtiene todas las carpetas de renovación pendiente con sus conteos y metadatos';

-- ============================================================================
-- 6. RPC: Renovar contratos en bloque con fechas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.renovar_contratos_con_fechas(
  p_contrato_ids uuid[],
  p_comercializadora_id uuid,
  p_fecha_activacion date,
  p_fecha_renovacion date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  contratos_actualizados integer,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validar que hay contratos
  IF array_length(p_contrato_ids, 1) IS NULL OR array_length(p_contrato_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0, false, 'No se proporcionaron contratos para renovar'::text;
    RETURN;
  END IF;

  -- Actualizar contratos
  UPDATE public.contratos
  SET 
    comercializadora_id = p_comercializadora_id,
    fecha_activacion = p_fecha_activacion,
    fecha_renovacion = p_fecha_renovacion,
    pendiente_fecha = false,
    nombre_carpeta_renovacion_pendiente_fecha = NULL,
    modificado_en = now(),
    modificado_por = p_user_id
  WHERE id = ANY(p_contrato_ids)
    AND eliminado_en IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT 
    v_count, 
    true, 
    format('Se renovaron %s contratos correctamente', v_count)::text;
END;
$$;

COMMENT ON FUNCTION public.renovar_contratos_con_fechas IS 
  'Renueva contratos en bloque asignando comercializadora y fechas de activación/renovación';

-- ============================================================================
-- 7. RPC: Marcar contratos como pendientes de fecha
-- ============================================================================

CREATE OR REPLACE FUNCTION public.renovar_contratos_pendiente_fecha(
  p_contrato_ids uuid[],
  p_comercializadora_id uuid,
  p_nombre_carpeta text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  contratos_actualizados integer,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_carpeta_existe boolean;
BEGIN
  -- Validar que hay contratos
  IF array_length(p_contrato_ids, 1) IS NULL OR array_length(p_contrato_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0, false, 'No se proporcionaron contratos para renovar'::text;
    RETURN;
  END IF;

  -- Validar nombre de carpeta
  IF p_nombre_carpeta IS NULL OR trim(p_nombre_carpeta) = '' THEN
    RETURN QUERY SELECT 0, false, 'El nombre de carpeta es obligatorio'::text;
    RETURN;
  END IF;

  -- Verificar unicidad del nombre de carpeta
  SELECT public.check_carpeta_renovacion_existe(trim(p_nombre_carpeta)) INTO v_carpeta_existe;
  IF v_carpeta_existe THEN
    RETURN QUERY SELECT 0, false, format('Ya existe una carpeta con el nombre "%s"', trim(p_nombre_carpeta))::text;
    RETURN;
  END IF;

  -- Actualizar contratos
  UPDATE public.contratos
  SET 
    comercializadora_id = p_comercializadora_id,
    pendiente_fecha = true,
    nombre_carpeta_renovacion_pendiente_fecha = trim(p_nombre_carpeta),
    modificado_en = now(),
    modificado_por = p_user_id
  WHERE id = ANY(p_contrato_ids)
    AND eliminado_en IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT 
    v_count, 
    true, 
    format('Se marcaron %s contratos como pendientes de fecha en carpeta "%s"', v_count, trim(p_nombre_carpeta))::text;
END;
$$;

COMMENT ON FUNCTION public.renovar_contratos_pendiente_fecha IS 
  'Marca contratos como pendientes de fecha de renovación, agrupándolos en una carpeta';

-- ============================================================================
-- 8. RPC: Completar renovación de carpeta pendiente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.completar_renovacion_carpeta(
  p_nombre_carpeta text,
  p_fecha_activacion date,
  p_fecha_renovacion date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  contratos_actualizados integer,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validar nombre de carpeta
  IF p_nombre_carpeta IS NULL OR trim(p_nombre_carpeta) = '' THEN
    RETURN QUERY SELECT 0, false, 'El nombre de carpeta es obligatorio'::text;
    RETURN;
  END IF;

  -- Actualizar contratos de la carpeta
  UPDATE public.contratos
  SET 
    fecha_activacion = p_fecha_activacion,
    fecha_renovacion = p_fecha_renovacion,
    pendiente_fecha = false,
    nombre_carpeta_renovacion_pendiente_fecha = NULL,
    modificado_en = now(),
    modificado_por = p_user_id
  WHERE nombre_carpeta_renovacion_pendiente_fecha = trim(p_nombre_carpeta)
    AND pendiente_fecha = true
    AND eliminado_en IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, false, format('No se encontraron contratos en la carpeta "%s"', trim(p_nombre_carpeta))::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    v_count, 
    true, 
    format('Se completó la renovación de %s contratos de la carpeta "%s"', v_count, trim(p_nombre_carpeta))::text;
END;
$$;

COMMENT ON FUNCTION public.completar_renovacion_carpeta IS 
  'Completa la renovación de todos los contratos de una carpeta pendiente asignando fechas';

-- ============================================================================
-- 9. RPC: Completar renovación de contratos específicos de carpeta
-- ============================================================================

CREATE OR REPLACE FUNCTION public.completar_renovacion_contratos_seleccionados(
  p_contrato_ids uuid[],
  p_fecha_activacion date,
  p_fecha_renovacion date,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  contratos_actualizados integer,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validar que hay contratos
  IF array_length(p_contrato_ids, 1) IS NULL OR array_length(p_contrato_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0, false, 'No se proporcionaron contratos'::text;
    RETURN;
  END IF;

  -- Actualizar contratos seleccionados
  UPDATE public.contratos
  SET 
    fecha_activacion = p_fecha_activacion,
    fecha_renovacion = p_fecha_renovacion,
    pendiente_fecha = false,
    nombre_carpeta_renovacion_pendiente_fecha = NULL,
    modificado_en = now(),
    modificado_por = p_user_id
  WHERE id = ANY(p_contrato_ids)
    AND pendiente_fecha = true
    AND eliminado_en IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT 
    v_count, 
    true, 
    format('Se completó la renovación de %s contratos', v_count)::text;
END;
$$;

COMMENT ON FUNCTION public.completar_renovacion_contratos_seleccionados IS 
  'Completa la renovación de contratos específicos que estaban pendientes de fecha';

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
