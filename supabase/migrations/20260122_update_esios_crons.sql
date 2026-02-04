-- ============================================================
-- Migración: Actualizar horarios de crons de ingesta e·sios
-- Fecha: 2026-01-22
-- Objetivo: Ajustar crons a 2h después de publicación + fallbacks
-- ============================================================

-- Nota: Las horas de pg_cron son en UTC
-- En invierno (CET): UTC+1, en verano (CEST): UTC+2
-- Para simplificar, usamos horas que funcionan razonablemente en ambos casos

-- ============================================================
-- 1. MIC (indicadores 1727, 1739) - Publica D-1 ~05:00
--    Cron: 07:00 UTC = 08:00 CET (3h margen)
-- ============================================================
SELECT cron.unschedule('esios_mic_ingest');
SELECT cron.schedule(
  'esios_mic_ingest',
  '0 7 * * *',
  $$SELECT market_data.cron_esios_ingest_incremental('mic', 7, 14, 60);$$
);

-- ============================================================
-- 2. SPOT (indicador 600) - Publica D+1 ~14:00
--    Cron: 16:00 UTC = 17:00 CET (2h margen)
-- ============================================================
SELECT cron.unschedule('esios_spot_ingest');
SELECT cron.schedule(
  'esios_spot_ingest',
  '0 16 * * *',
  $$SELECT market_data.cron_esios_ingest_incremental('spot', 7, 14, 90);$$
);

-- ============================================================
-- 3. PVPC (indicadores 1001, 1002, 1739) - Publica D+1 ~20:20
--    Cron: 22:00 UTC = 23:00 CET (2h margen)
-- ============================================================
SELECT cron.unschedule('esios_pvpc_ingest');
SELECT cron.schedule(
  'esios_pvpc_ingest',
  '0 22 * * *',
  $$SELECT market_data.cron_esios_ingest_incremental('pvpc', 7, 14, 90);$$
);

-- ============================================================
-- 4. CATCHUP AM - Fallback mañana (cubre fallos nocturnos)
--    Cron: 10:00 UTC = 11:00 CET
-- ============================================================
SELECT cron.unschedule('esios_catchup_am');
SELECT cron.schedule(
  'esios_catchup_am',
  '0 10 * * *',
  $$SELECT market_data.cron_esios_ingest_incremental('all', 7, 30, 120);$$
);

-- ============================================================
-- 5. CATCHUP PM - Fallback tarde (cubre fallos de mediodía)
--    Cron: 18:00 UTC = 19:00 CET
-- ============================================================
-- Primero intentar eliminar por si existe
SELECT cron.unschedule('esios_catchup_pm') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'esios_catchup_pm'
);
SELECT cron.schedule(
  'esios_catchup_pm',
  '0 18 * * *',
  $$SELECT market_data.cron_esios_ingest_incremental('all', 7, 30, 120);$$
);

-- ============================================================
-- Resumen de horarios (Europe/Madrid en invierno CET):
-- ============================================================
-- | Job            | UTC   | CET   | Indicadores  | Publica |
-- |----------------|-------|-------|--------------|---------|
-- | mic_ingest     | 07:00 | 08:00 | 1727, 1739   | ~05:00  |
-- | catchup_am     | 10:00 | 11:00 | all          | fallback|
-- | spot_ingest    | 16:00 | 17:00 | 600          | ~14:00  |
-- | catchup_pm     | 18:00 | 19:00 | all          | fallback|
-- | pvpc_ingest    | 22:00 | 23:00 | 1001,1002    | ~20:20  |
