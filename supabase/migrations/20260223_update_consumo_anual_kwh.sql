-- ============================================================================
-- MIGRACIÓN: Mantener actualizada puntos_suministro.consumo_anual_kwh
-- ============================================================================
-- Estrategia dual:
--   1) Trigger en facturacion_clientes → actualización inmediata al cambiar facturas
--   2) Cron diario → corrige la ventana deslizante de 365 días (facturas que "caducan")
--
-- DECISIÓN: RPC en PostgreSQL (no Edge Function)
-- Justificación:
--   - Operación puramente de agregación/actualización, sin lógica externa
--   - Un solo UPDATE ... FROM con subquery es órdenes de magnitud más eficiente
--     que traer datos a una Edge Function y devolverlos
--   - El patrón de crons existente ya usa llamadas directas a funciones SQL
--   - El índice idx_facturacion_punto_fecha ya cubre el patrón de consulta
--   - Evita latencia de red y serialización JSON innecesarias
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ÍNDICE COVERING: incluye consumo_kwh para evitar heap lookups en el SUM
--    El índice idx_facturacion_punto_fecha ya existe pero sin INCLUDE.
--    Creamos uno nuevo que lo reemplaza con cobertura completa.
--    NOTA: No usamos CONCURRENTLY porque las migraciones corren en transacción.
--    Con ~1100 filas el lock es imperceptible.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facturacion_punto_fecha_consumo
  ON public.facturacion_clientes (punto_id, fecha_emision)
  INCLUDE (consumo_kwh)
  WHERE (eliminado_en IS NULL);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. FUNCIÓN PRINCIPAL: recalcula consumo_anual_kwh para TODOS los puntos
--    - SET-BASED: una sola query, sin loops
--    - SECURITY DEFINER: bypasea RLS (ambas tablas tienen relforcerowsecurity)
--    - IDEMPOTENTE: puede ejecutarse N veces con el mismo resultado
--    - Usa LEFT JOIN para que puntos sin facturas reciban 0
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_consumo_anual_kwh()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filas_actualizadas integer;
BEGIN
  UPDATE puntos_suministro ps
  SET
    consumo_anual_kwh = agg.total_kwh,
    modificado_en     = now()
  FROM (
    -- Agregación por punto: suma consumo de facturas no eliminadas
    -- en los últimos 365 días. COALESCE → 0 si no hay facturas.
    SELECT
      p.id AS punto_id,
      COALESCE(SUM(f.consumo_kwh), 0) AS total_kwh
    FROM puntos_suministro p
    LEFT JOIN facturacion_clientes f
      ON  f.punto_id    = p.id
      AND f.eliminado_en IS NULL
      AND f.fecha_emision >= CURRENT_DATE - INTERVAL '365 days'
    WHERE p.eliminado_en IS NULL
    GROUP BY p.id
  ) agg
  WHERE ps.id = agg.punto_id
    AND ps.eliminado_en IS NULL
    -- Solo actualiza si el valor cambió (evita writes innecesarios y WAL)
    AND ps.consumo_anual_kwh IS DISTINCT FROM agg.total_kwh;

  GET DIAGNOSTICS filas_actualizadas = ROW_COUNT;

  RAISE LOG '[recalcular_consumo_anual_kwh] % puntos actualizados', filas_actualizadas;

  RETURN filas_actualizadas;
END;
$$;

COMMENT ON FUNCTION public.recalcular_consumo_anual_kwh() IS
  'Recalcula consumo_anual_kwh de todos los puntos activos sumando consumo_kwh '
  'de facturas no eliminadas en los últimos 365 días. Idempotente, set-based.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. FUNCIÓN AUXILIAR: recalcula consumo_anual_kwh para UN solo punto
--    Usada por el trigger para actualización inmediata.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_consumo_anual_punto(p_punto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE puntos_suministro
  SET
    consumo_anual_kwh = COALESCE((
      SELECT SUM(f.consumo_kwh)
      FROM facturacion_clientes f
      WHERE f.punto_id     = p_punto_id
        AND f.eliminado_en IS NULL
        AND f.fecha_emision >= CURRENT_DATE - INTERVAL '365 days'
    ), 0),
    modificado_en = now()
  WHERE id = p_punto_id
    AND eliminado_en IS NULL;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: actualización inmediata cuando cambian facturas
--    Se dispara en INSERT, UPDATE (de campos relevantes), DELETE y soft-delete.
--    Recalcula solo el/los punto(s) afectados, no todos.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_recalcular_consumo_anual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- UPDATE que cambia de punto_id → recalcular ambos (antiguo y nuevo)
  IF TG_OP = 'UPDATE' AND OLD.punto_id IS DISTINCT FROM NEW.punto_id THEN
    PERFORM public.recalcular_consumo_anual_punto(OLD.punto_id);
    PERFORM public.recalcular_consumo_anual_punto(NEW.punto_id);
    RETURN NEW;
  END IF;

  -- INSERT o UPDATE normal → recalcular el punto afectado
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalcular_consumo_anual_punto(NEW.punto_id);
    RETURN NEW;
  END IF;

  -- DELETE físico → recalcular el punto del registro eliminado
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_consumo_anual_punto(OLD.punto_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Eliminar trigger existente si lo hubiera
DROP TRIGGER IF EXISTS trg_recalcular_consumo_anual ON public.facturacion_clientes;

-- Crear trigger AFTER para no interferir con la operación principal.
-- Se dispara cuando cambian los campos que afectan al cálculo.
CREATE TRIGGER trg_recalcular_consumo_anual
  AFTER INSERT OR DELETE OR UPDATE OF consumo_kwh, punto_id, fecha_emision, eliminado_en
  ON public.facturacion_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalcular_consumo_anual();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. CRON: ejecutar diariamente a las 00:15 (tras medianoche)
--    Necesario porque la ventana de 365 días se desplaza cada día:
--    facturas que ayer estaban dentro del rango hoy pueden quedar fuera.
--    El trigger NO cubre este caso (no hay evento que lo dispare).
-- ────────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'recalcular_consumo_anual_kwh_diario',   -- nombre del job
  '15 0 * * *',                             -- 00:15 UTC cada día
  'SELECT public.recalcular_consumo_anual_kwh()'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. BACKFILL INICIAL: calcular el valor para todos los puntos existentes
-- ────────────────────────────────────────────────────────────────────────────
SELECT public.recalcular_consumo_anual_kwh();
