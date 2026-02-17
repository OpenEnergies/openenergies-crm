-- Migration: Fix MIBGAS and ESIOS permissions for service_role
-- Reason: Edge Function needs to read market data for comparative reports
-- Problem: Tables had RLS enabled but NO GRANT SELECT permissions

-- STEP 1: Grant SELECT permissions on both tables
GRANT SELECT ON market_data.mibgas_indexes_daily TO authenticated, service_role, anon;
GRANT SELECT ON market_data.esios_daily_stats TO authenticated, service_role, anon;

-- STEP 2: Update RLS policies to allow access
DROP POLICY IF EXISTS "mibgas_indexes_select" ON market_data.mibgas_indexes_daily;
CREATE POLICY "mibgas_indexes_select_all"
  ON market_data.mibgas_indexes_daily
  FOR SELECT
  TO authenticated, service_role, anon
  USING (true);

DROP POLICY IF EXISTS "esios_daily_stats_select" ON market_data.esios_daily_stats;
CREATE POLICY "esios_daily_stats_select_all"
  ON market_data.esios_daily_stats
  FOR SELECT
  TO authenticated, service_role, anon
  USING (true);
