-- RLS para public.grupos_clientes: acceso solo administradores
-- y políticas de storage para bucket logos_grupos_clientes.

-- =========================
-- public.grupos_clientes
-- =========================
alter table public.grupos_clientes enable row level security;

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS grp_cli_select_admin ON public.grupos_clientes;
DROP POLICY IF EXISTS grp_cli_insert_admin ON public.grupos_clientes;
DROP POLICY IF EXISTS grp_cli_update_admin ON public.grupos_clientes;
DROP POLICY IF EXISTS grp_cli_delete_admin ON public.grupos_clientes;

-- Solo admin puede consultar grupos no eliminados
create policy grp_cli_select_admin
  on public.grupos_clientes
  for select
  to authenticated
  using (
    eliminado_en is null
    and is_admin()
  );

-- Solo admin puede crear grupos
create policy grp_cli_insert_admin
  on public.grupos_clientes
  for insert
  to authenticated
  with check (is_admin());

-- Solo admin puede editar grupos
create policy grp_cli_update_admin
  on public.grupos_clientes
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Solo admin puede eliminar grupos
create policy grp_cli_delete_admin
  on public.grupos_clientes
  for delete
  to authenticated
  using (is_admin());

-- ====================================
-- storage.objects: logos_grupos_clientes
-- ====================================
DROP POLICY IF EXISTS "logos_grupos_clientes select (authed)" ON storage.objects;
DROP POLICY IF EXISTS "logos_grupos_clientes insert (admin)" ON storage.objects;
DROP POLICY IF EXISTS "logos_grupos_clientes update (admin)" ON storage.objects;
DROP POLICY IF EXISTS "logos_grupos_clientes delete (admin)" ON storage.objects;

create policy "logos_grupos_clientes select (authed)"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'logos_grupos_clientes');

create policy "logos_grupos_clientes insert (admin)"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos_grupos_clientes'
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.user_id = auth.uid()
        and ua.rol = 'administrador'::public.rol_usuario
    )
  );

create policy "logos_grupos_clientes update (admin)"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'logos_grupos_clientes'
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.user_id = auth.uid()
        and ua.rol = 'administrador'::public.rol_usuario
    )
  )
  with check (
    bucket_id = 'logos_grupos_clientes'
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.user_id = auth.uid()
        and ua.rol = 'administrador'::public.rol_usuario
    )
  );

create policy "logos_grupos_clientes delete (admin)"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'logos_grupos_clientes'
    and exists (
      select 1
      from public.usuarios_app ua
      where ua.user_id = auth.uid()
        and ua.rol = 'administrador'::public.rol_usuario
    )
  );
