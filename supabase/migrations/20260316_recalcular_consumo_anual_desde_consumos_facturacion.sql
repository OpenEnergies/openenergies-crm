-- Recalculate annual consumption per point from consumos_facturacion
-- using the last year window based on consumos_facturacion.mes.

CREATE OR REPLACE FUNCTION public.recalcular_consumo_anual_kwh()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  filas_actualizadas integer;
BEGIN
  UPDATE puntos_suministro ps
  SET
    consumo_anual_kwh = agg.total_kwh,
    modificado_en = now()
  FROM (
    SELECT
      p.id AS punto_id,
      COALESCE(SUM(cf.consumo_kwh), 0) AS total_kwh
    FROM puntos_suministro p
    LEFT JOIN consumos_facturacion cf
      ON cf.punto_id = p.id
      AND cf.eliminado_en IS NULL
      AND cf.mes >= (CURRENT_DATE - INTERVAL '1 year')::date
      AND cf.mes <= CURRENT_DATE
    WHERE p.eliminado_en IS NULL
    GROUP BY p.id
  ) agg
  WHERE ps.id = agg.punto_id
    AND ps.eliminado_en IS NULL
    AND ps.consumo_anual_kwh IS DISTINCT FROM agg.total_kwh;

  GET DIAGNOSTICS filas_actualizadas = ROW_COUNT;

  RAISE LOG '[recalcular_consumo_anual_kwh] % puntos actualizados (fuente: consumos_facturacion.mes ultimo ano)', filas_actualizadas;

  RETURN filas_actualizadas;
END;
$$;
