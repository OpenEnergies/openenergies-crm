-- ============================================================================
-- Fix storage RLS policies for informes-mercado bucket
-- ============================================================================
-- PROBLEMA: Las políticas SELECT/DELETE solo permiten ruta 'informes/auditoria/...'
--           pero informes comparativos usan 'informes/comparativa/...'
--           Esto causa errores 400 al crear signed URLs desde el frontend.
-- SOLUCIÓN: Ampliar las políticas para aceptar CUALQUIER subfolder dentro de 'informes/'
-- ============================================================================

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS informes_mercado_storage_select ON storage.objects;

-- Create permissive SELECT policy that covers both auditoria and comparativa paths
CREATE POLICY informes_mercado_storage_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'informes-mercado'
    AND (storage.foldername(name))[1] = 'informes'
    AND EXISTS (
      SELECT 1 FROM public.informes_mercado im
      WHERE im.id = ((storage.foldername(name))[3])::uuid
        AND (im.creado_por = auth.uid() OR public.can_access_cliente(im.cliente_id))
    )
  );

-- Drop the restrictive DELETE policy
DROP POLICY IF EXISTS informes_mercado_storage_modify ON storage.objects;

-- Recreate permissive DELETE policy
CREATE POLICY informes_mercado_storage_modify ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'informes-mercado'
    AND (storage.foldername(name))[1] = 'informes'
    AND EXISTS (
      SELECT 1 FROM public.informes_mercado im
      WHERE im.id = ((storage.foldername(name))[3])::uuid
        AND (im.creado_por = auth.uid() OR public.can_access_cliente(im.cliente_id))
    )
  );
