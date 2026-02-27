-- =====================================================
-- MIGRACIÓN: Añadir campos codigo y direccion a agrupaciones_puntos
-- Fecha: 2026-02-27
-- Descripción:
--   - codigo: identificador único de agrupación por cliente (UNIQUE por cliente)
--   - direccion: dirección de la agrupación
-- =====================================================

-- 1. Añadir columna codigo (text, unique por cliente)
ALTER TABLE public.agrupaciones_puntos
  ADD COLUMN IF NOT EXISTS codigo TEXT;

-- 2. Añadir columna direccion (text, nullable)
ALTER TABLE public.agrupaciones_puntos
  ADD COLUMN IF NOT EXISTS direccion TEXT;

-- 3. Índice único compuesto: codigo es único por cliente (excluyendo eliminados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_agrupaciones_codigo_cliente
  ON public.agrupaciones_puntos (cliente_id, codigo)
  WHERE eliminado_en IS NULL AND codigo IS NOT NULL;
