-- ============================================================
-- Migración: Optimización de consultas para ingesta e·sios
-- Fecha: 2026-01-22
-- Objetivo: Añadir índice parcial para consultas de último día completo
-- ============================================================

-- Índice parcial para obtener último día completo de forma eficiente.
-- Solo indexa filas donde completo=true, reduciendo el tamaño del índice
-- y acelerando las consultas de la Edge Function esios-fetch.
CREATE INDEX IF NOT EXISTS idx_esios_daily_stats_last_complete 
ON market_data.esios_daily_stats (indicator_id, geo_id, fecha DESC) 
WHERE completo = true;

-- Comentario explicativo
COMMENT ON INDEX market_data.idx_esios_daily_stats_last_complete IS 
  'Índice parcial para consultas de último día completo por indicador/geo. Usado por Edge Function esios-fetch para calcular rangos óptimos de ingesta.';
