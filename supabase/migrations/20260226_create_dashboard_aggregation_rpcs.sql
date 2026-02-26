-- Migration: Create server-side aggregation RPCs for dashboard KPIs
-- These replace client-side counting/summing that was limited by PostgREST's default 1000 row limit.
-- Once applied, update the dashboard widgets to use supabase.rpc() instead of fetching + aggregating.

-- RPC: Sum of consumo_anual_kwh for puntos with active contracts
CREATE OR REPLACE FUNCTION public.get_energia_gestionada_kwh()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(ps.consumo_anual_kwh), 0)
  FROM puntos_suministro ps
  INNER JOIN contratos c ON c.punto_id = ps.id
  WHERE c.estado = 'En curso'
    AND c.eliminado_en IS NULL;
$$;

-- RPC: Count of puntos_suministro grouped by estado
CREATE OR REPLACE FUNCTION public.get_puntos_estado_counts()
RETURNS TABLE(estado text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ps.estado::text AS estado, COUNT(*) AS count
  FROM puntos_suministro ps
  GROUP BY ps.estado;
$$;

-- RPC: Count of contratos grouped by estado
CREATE OR REPLACE FUNCTION public.get_contratos_estado_counts()
RETURNS TABLE(estado text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.estado::text AS estado, COUNT(*) AS count
  FROM contratos c
  WHERE c.eliminado_en IS NULL
  GROUP BY c.estado;
$$;
