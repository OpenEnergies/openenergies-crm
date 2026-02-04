-- ============================================================================
-- MIGRACIÓN: Actualizar esquema de informes_mercado
-- ============================================================================
-- Autor: Sistema CRM
-- Fecha: 2026-02-04
-- Descripción: Simplifica los tipos de informe y elimina el concepto de tipo
--              de energía. Los informes ahora son del cliente entero.
--              Solo permite dos tipos: Auditoría Energética y Auditoría Comparativa.
--              Cambia la relación de múltiples clientes a un solo cliente.
-- ============================================================================

-- ============================================================================
-- 1. ACTUALIZAR ENUM: tipo_informe_mercado
-- ============================================================================
-- Primero, necesitamos crear el nuevo tipo
DO $$ BEGIN
    CREATE TYPE public.tipo_informe_mercado_new AS ENUM ('auditoria', 'comparativa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Actualizar la columna para usar el nuevo tipo
-- Mapeo: 'mercado' -> 'comparativa', 'seguimiento' -> 'auditoria'
ALTER TABLE public.informes_mercado 
  ALTER COLUMN tipo_informe TYPE public.tipo_informe_mercado_new 
  USING (
    CASE tipo_informe::text
      WHEN 'auditoria' THEN 'auditoria'::public.tipo_informe_mercado_new
      WHEN 'mercado' THEN 'comparativa'::public.tipo_informe_mercado_new
      WHEN 'seguimiento' THEN 'auditoria'::public.tipo_informe_mercado_new
      ELSE 'auditoria'::public.tipo_informe_mercado_new
    END
  );

-- Eliminar el tipo antiguo
DROP TYPE IF EXISTS public.tipo_informe_mercado CASCADE;

-- Renombrar el nuevo tipo
ALTER TYPE public.tipo_informe_mercado_new RENAME TO tipo_informe_mercado;

COMMENT ON TYPE public.tipo_informe_mercado IS 'Tipos de informe: auditoría energética o comparativa con mercado';

-- ============================================================================
-- 2. ELIMINAR tipo_energia_informe (ya no es necesario)
-- ============================================================================
-- Los informes ahora son del cliente entero, sin distinción de tipo de energía

-- Eliminar columna tipo_energia de la tabla
ALTER TABLE public.informes_mercado 
  DROP COLUMN IF EXISTS tipo_energia;

-- Eliminar el enum tipo_energia_informe
DROP TYPE IF EXISTS public.tipo_energia_informe CASCADE;

-- ============================================================================
-- 3. CAMBIAR RELACIÓN DE MÚLTIPLES CLIENTES A UN SOLO CLIENTE
-- ============================================================================
-- Agregar nueva columna cliente_id (UUID único)
ALTER TABLE public.informes_mercado 
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE;

-- Migrar datos: tomar el primer cliente del array cliente_ids si existe
UPDATE public.informes_mercado
  SET cliente_id = (cliente_ids[1])
  WHERE cliente_ids IS NOT NULL AND array_length(cliente_ids, 1) > 0;

-- Hacer la columna NOT NULL (después de migrar datos)
ALTER TABLE public.informes_mercado 
  ALTER COLUMN cliente_id SET NOT NULL;

-- Eliminar la columna antigua cliente_ids y su índice
DROP INDEX IF EXISTS idx_informes_mercado_cliente_ids;
ALTER TABLE public.informes_mercado 
  DROP COLUMN IF EXISTS cliente_ids;

-- Crear índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_informes_mercado_cliente_id ON public.informes_mercado(cliente_id);

-- Actualizar comentarios
COMMENT ON COLUMN public.informes_mercado.cliente_id IS 'UUID del cliente al que pertenece el informe';

-- ============================================================================
-- 4. ACTUALIZAR RLS POLICIES (si es necesario)
-- ============================================================================
-- Las políticas RLS pueden necesitar actualización para usar cliente_id en lugar de cliente_ids
-- Esto depende de las políticas existentes

-- Verificar y recrear políticas si es necesario
DO $$
BEGIN
    -- Política de SELECT: los usuarios pueden ver informes de su empresa
    DROP POLICY IF EXISTS informes_mercado_select ON public.informes_mercado;
    CREATE POLICY informes_mercado_select ON public.informes_mercado
        FOR SELECT
        USING (
            empresa_id IN (
                SELECT empresa_id 
                FROM public.usuarios 
                WHERE id = auth.uid()
            )
        );

    -- Política de INSERT: los usuarios pueden crear informes para su empresa
    DROP POLICY IF EXISTS informes_mercado_insert ON public.informes_mercado;
    CREATE POLICY informes_mercado_insert ON public.informes_mercado
        FOR INSERT
        WITH CHECK (
            empresa_id IN (
                SELECT empresa_id 
                FROM public.usuarios 
                WHERE id = auth.uid()
            )
        );

    -- Política de UPDATE: los usuarios pueden actualizar informes de su empresa
    DROP POLICY IF EXISTS informes_mercado_update ON public.informes_mercado;
    CREATE POLICY informes_mercado_update ON public.informes_mercado
        FOR UPDATE
        USING (
            empresa_id IN (
                SELECT empresa_id 
                FROM public.usuarios 
                WHERE id = auth.uid()
            )
        );

    -- Política de DELETE: los usuarios pueden eliminar informes de su empresa
    DROP POLICY IF EXISTS informes_mercado_delete ON public.informes_mercado;
    CREATE POLICY informes_mercado_delete ON public.informes_mercado
        FOR DELETE
        USING (
            empresa_id IN (
                SELECT empresa_id 
                FROM public.usuarios 
                WHERE id = auth.uid()
            )
        );
END $$;

-- ============================================================================
-- RESUMEN DE CAMBIOS
-- ============================================================================
-- ✅ tipo_informe_mercado: Solo 'auditoria' y 'comparativa'
-- ✅ tipo_energia_informe: ELIMINADO (los informes son del cliente entero)
-- ✅ cliente_ids (array): ELIMINADO
-- ✅ cliente_id (UUID único): AÑADIDO
-- ✅ Índices actualizados
-- ✅ RLS policies actualizadas
