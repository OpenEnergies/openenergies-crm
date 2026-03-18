import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { convertImageFileToPngBlob } from '@lib/imageToPng';

const GRUPOS_BUCKET = 'logos_grupos_clientes';

type ClienteRow = {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  grupo_cliente_id: string | null;
};

type PuntoRow = {
  id: string;
  cliente_id: string;
  consumo_anual_kwh: number | null;
  estado?: string | null;
};

function normalizeForSearch(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GrupoClienteBase {
  id: string;
  nombre: string;
  descripcion: string | null;
  logo_path: string | null;
  creado_en: string;
}

export interface GrupoClienteCard extends GrupoClienteBase {
  clientes_count: number;
  puntos_count: number;
  total_kwh: number;
  cliente_nombres: string[];
}

export interface GrupoClienteMember {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  creado_en: string | null;
  puntos_count: number;
  total_kwh: number;
  activo: boolean;
}

export interface GrupoClienteDetail extends GrupoClienteBase {
  clientes_count: number;
  puntos_count: number;
  total_kwh: number;
  cliente_ids: string[];
}

export function getGrupoLogoPublicUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const { data } = supabase.storage.from(GRUPOS_BUCKET).getPublicUrl(logoPath);
  return data.publicUrl;
}

export function useGruposClientes(searchTerm: string) {
  return useQuery({
    queryKey: ['grupos-clientes', searchTerm],
    queryFn: async (): Promise<GrupoClienteCard[]> => {
      const { data: grupos, error: gruposError } = await supabase
        .from('grupos_clientes')
        .select('id, nombre, descripcion, logo_path, creado_en')
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .range(0, 99999);

      if (gruposError) throw gruposError;
      if (!grupos || grupos.length === 0) return [];

      const groupIds = grupos.map((g) => g.id);

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nombre, dni, cif, grupo_cliente_id')
        .in('grupo_cliente_id', groupIds)
        .is('eliminado_en', null)
        .range(0, 99999);

      if (clientesError) throw clientesError;

      const clientRows = (clientes || []) as ClienteRow[];
      const clientIds = clientRows.map((c) => c.id);

      let puntosRows: PuntoRow[] = [];
      if (clientIds.length > 0) {
        const { data: puntos, error: puntosError } = await supabase
          .from('puntos_suministro')
          .select('id, cliente_id, consumo_anual_kwh')
          .in('cliente_id', clientIds)
          .is('eliminado_en', null)
          .range(0, 99999);

        if (puntosError) throw puntosError;
        puntosRows = (puntos || []) as PuntoRow[];
      }

      const puntosByClient = new Map<string, PuntoRow[]>();
      for (const punto of puntosRows) {
        const list = puntosByClient.get(punto.cliente_id) || [];
        list.push(punto);
        puntosByClient.set(punto.cliente_id, list);
      }

      const clientsByGroup = new Map<string, ClienteRow[]>();
      for (const client of clientRows) {
        if (!client.grupo_cliente_id) continue;
        const list = clientsByGroup.get(client.grupo_cliente_id) || [];
        list.push(client);
        clientsByGroup.set(client.grupo_cliente_id, list);
      }

      const normalizedSearch = normalizeForSearch(searchTerm);

      return grupos
        .map((group) => {
          const members = clientsByGroup.get(group.id) || [];
          const puntosCount = members.reduce((acc, member) => acc + (puntosByClient.get(member.id)?.length || 0), 0);
          const totalKwh = members.reduce((acc, member) => {
            const totalMemberKwh = (puntosByClient.get(member.id) || []).reduce((sum, punto) => sum + (Number(punto.consumo_anual_kwh) || 0), 0);
            return acc + totalMemberKwh;
          }, 0);

          return {
            ...group,
            clientes_count: members.length,
            puntos_count: puntosCount,
            total_kwh: totalKwh,
            cliente_nombres: members.map((m) => m.nombre),
          } as GrupoClienteCard;
        })
        .filter((group) => {
          if (!normalizedSearch) return true;
          return (
            normalizeForSearch(group.nombre).includes(normalizedSearch) ||
            normalizeForSearch(group.descripcion).includes(normalizedSearch) ||
            group.cliente_nombres.some((name) => normalizeForSearch(name).includes(normalizedSearch))
          );
        });
    },
  });
}

export function useGrupoClienteDetail(grupoId: string | undefined) {
  return useQuery({
    queryKey: ['grupo-cliente-detail', grupoId],
    queryFn: async (): Promise<GrupoClienteDetail | null> => {
      if (!grupoId) return null;

      const { data: group, error: groupError } = await supabase
        .from('grupos_clientes')
        .select('id, nombre, descripcion, logo_path, creado_en')
        .eq('id', grupoId)
        .is('eliminado_en', null)
        .maybeSingle();

      if (groupError) throw groupError;
      if (!group) return null;

      const { data: clients, error: clientsError } = await supabase
        .from('clientes')
        .select('id')
        .eq('grupo_cliente_id', grupoId)
        .is('eliminado_en', null)
        .range(0, 99999);

      if (clientsError) throw clientsError;

      const clientIds = (clients || []).map((c) => c.id);

      let puntosCount = 0;
      let totalKwh = 0;

      if (clientIds.length > 0) {
        const { data: points, error: pointsError } = await supabase
          .from('puntos_suministro')
          .select('consumo_anual_kwh')
          .in('cliente_id', clientIds)
          .is('eliminado_en', null)
          .range(0, 99999);

        if (pointsError) throw pointsError;

        puntosCount = (points || []).length;
        totalKwh = (points || []).reduce((acc, point) => acc + (Number(point.consumo_anual_kwh) || 0), 0);
      }

      return {
        ...group,
        clientes_count: clientIds.length,
        puntos_count: puntosCount,
        total_kwh: totalKwh,
        cliente_ids: clientIds,
      };
    },
    enabled: !!grupoId,
  });
}

export function useGrupoClienteMembers(grupoId: string | undefined, searchTerm: string) {
  return useQuery({
    queryKey: ['grupo-cliente-members', grupoId, searchTerm],
    queryFn: async (): Promise<GrupoClienteMember[]> => {
      if (!grupoId) return [];

      const { data: clients, error: clientsError } = await supabase
        .from('clientes')
        .select('id, nombre, dni, cif, creado_en')
        .eq('grupo_cliente_id', grupoId)
        .is('eliminado_en', null)
        .order('nombre', { ascending: true })
        .range(0, 99999);

      if (clientsError) throw clientsError;

      const clientRows = (clients || []) as Array<{ id: string; nombre: string; dni: string | null; cif: string | null; creado_en: string | null }>;
      const clientIds = clientRows.map((c) => c.id);

      let pointsByClient = new Map<string, PuntoRow[]>();
      if (clientIds.length > 0) {
        const { data: points, error: pointsError } = await supabase
          .from('puntos_suministro')
          .select('id, cliente_id, consumo_anual_kwh, estado')
          .in('cliente_id', clientIds)
          .is('eliminado_en', null)
          .range(0, 99999);

        if (pointsError) throw pointsError;

        for (const point of (points || []) as PuntoRow[]) {
          const list = pointsByClient.get(point.cliente_id) || [];
          list.push(point);
          pointsByClient.set(point.cliente_id, list);
        }
      }

      const { data: decryptedData } = await supabase.rpc('obtener_dni_cif_clientes', {
        p_limit: 100000,
        p_offset: 0,
      });

      const decryptedRows = Array.isArray(decryptedData)
        ? (decryptedData as Array<{ id?: string; dni?: string | null; cif?: string | null }>)
        : [];

      const decryptedById = new Map<string, { dni: string | null; cif: string | null }>();
      for (const row of decryptedRows) {
        if (!row.id) continue;
        decryptedById.set(row.id, {
          dni: row.dni ?? null,
          cif: row.cif ?? null,
        });
      }

      const normalizedSearch = normalizeForSearch(searchTerm);

      return clientRows
        .map((client) => {
          const points = pointsByClient.get(client.id) || [];
          const decrypted = decryptedById.get(client.id);
          return {
            ...client,
            dni: decrypted?.dni ?? client.dni,
            cif: decrypted?.cif ?? client.cif,
            puntos_count: points.length,
            total_kwh: points.reduce((acc, point) => acc + (Number(point.consumo_anual_kwh) || 0), 0),
            activo: points.some((point) => point.estado === 'Aceptado'),
          } as GrupoClienteMember;
        })
        .filter((client) => {
          if (!normalizedSearch) return true;
          return (
            normalizeForSearch(client.nombre).includes(normalizedSearch) ||
            normalizeForSearch(client.dni).includes(normalizedSearch) ||
            normalizeForSearch(client.cif).includes(normalizedSearch)
          );
        });
    },
    enabled: !!grupoId,
  });
}

export function useBuscarClientesParaGrupo(searchTerm: string, excludeIds: string[] = []) {
  return useQuery({
    queryKey: ['buscar-clientes-grupo', searchTerm, excludeIds],
    queryFn: async () => {
      const term = searchTerm.trim();
      if (term.length < 1) return [] as Array<{ id: string; nombre: string; dni: string | null; cif: string | null; grupo_cliente_id: string | null }>;

      const normalizedTerm = normalizeForSearch(term);

      let query = supabase
        .from('clientes')
        .select('id, nombre, grupo_cliente_id')
        .is('eliminado_en', null)
        .order('nombre', { ascending: true })
        .limit(2000);

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const [{ data: baseData, error: baseError }, { data: decryptedData }] = await Promise.all([
        query,
        supabase.rpc('obtener_dni_cif_clientes', {
          p_limit: 100000,
          p_offset: 0,
        }),
      ]);

      if (baseError) throw baseError;

      const decryptedRows = Array.isArray(decryptedData)
        ? (decryptedData as Array<{ id?: string; dni?: string | null; cif?: string | null }>)
        : [];

      const decryptedById = new Map<string, { dni: string | null; cif: string | null }>();
      for (const row of decryptedRows) {
        if (!row.id) continue;
        decryptedById.set(row.id, {
          dni: row.dni ?? null,
          cif: row.cif ?? null,
        });
      }

      const clients = (baseData || []) as Array<{ id: string; nombre: string; grupo_cliente_id: string | null }>;

      return clients
        .map((row) => ({
          id: row.id,
          nombre: row.nombre,
          grupo_cliente_id: row.grupo_cliente_id,
          dni: decryptedById.get(row.id)?.dni ?? null,
          cif: decryptedById.get(row.id)?.cif ?? null,
        }))
        .filter((row) => {
          return (
            normalizeForSearch(row.nombre).includes(normalizedTerm) ||
            normalizeForSearch(row.dni).includes(normalizedTerm) ||
            normalizeForSearch(row.cif).includes(normalizedTerm)
          );
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 30);
    },
    retry: false,
  });
}

export function useCrearGrupoCliente() {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  return useMutation({
    mutationFn: async ({
      nombre,
      descripcion,
      clienteIds,
      logoFile,
    }: {
      nombre: string;
      descripcion?: string;
      clienteIds: string[];
      logoFile?: File | null;
    }) => {
      const { data: created, error: createError } = await supabase
        .from('grupos_clientes')
        .insert({
          nombre,
          descripcion: descripcion || null,
          creado_por: userId || null,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      const groupId = created.id as string;

      if (logoFile) {
        const pngBlob = await convertImageFileToPngBlob(logoFile);
        const logoPath = `${groupId}.png`;

        const { error: uploadError } = await supabase.storage
          .from(GRUPOS_BUCKET)
          .upload(logoPath, pngBlob, {
            upsert: true,
            contentType: 'image/png',
          });

        if (uploadError) throw uploadError;

        const { error: updateLogoError } = await supabase
          .from('grupos_clientes')
          .update({
            logo_path: logoPath,
            modificado_en: new Date().toISOString(),
            modificado_por: userId || null,
          })
          .eq('id', groupId);

        if (updateLogoError) throw updateLogoError;
      }

      if (clienteIds.length > 0) {
        const { error: assignError } = await supabase
          .from('clientes')
          .update({
            grupo_cliente_id: groupId,
            modificado_en: new Date().toISOString(),
            modificado_por: userId || null,
          })
          .in('id', clienteIds);

        if (assignError) throw assignError;
      }

      return groupId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useActualizarGrupoCliente() {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  return useMutation({
    mutationFn: async ({
      grupoId,
      nombre,
      descripcion,
      logoFile,
      removeLogo,
    }: {
      grupoId: string;
      nombre: string;
      descripcion?: string;
      logoFile?: File | null;
      removeLogo?: boolean;
    }) => {
      const updates: Record<string, unknown> = {
        nombre,
        descripcion: descripcion || null,
        modificado_en: new Date().toISOString(),
        modificado_por: userId || null,
      };

      if (removeLogo) {
        updates.logo_path = null;
      }

      const { error: updateError } = await supabase
        .from('grupos_clientes')
        .update(updates)
        .eq('id', grupoId)
        .is('eliminado_en', null);

      if (updateError) throw updateError;

      if (removeLogo) {
        await supabase.storage.from(GRUPOS_BUCKET).remove([`${grupoId}.png`]);
      }

      if (logoFile) {
        const pngBlob = await convertImageFileToPngBlob(logoFile);
        const logoPath = `${grupoId}.png`;

        const { error: uploadError } = await supabase.storage
          .from(GRUPOS_BUCKET)
          .upload(logoPath, pngBlob, {
            upsert: true,
            contentType: 'image/png',
          });

        if (uploadError) throw uploadError;

        const { error: persistPathError } = await supabase
          .from('grupos_clientes')
          .update({
            logo_path: logoPath,
            modificado_en: new Date().toISOString(),
            modificado_por: userId || null,
          })
          .eq('id', grupoId);

        if (persistPathError) throw persistPathError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['grupos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-detail', vars.grupoId] });
    },
  });
}

export function useAsignarClientesAGrupo() {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  return useMutation({
    mutationFn: async ({ grupoId, clienteIds }: { grupoId: string; clienteIds: string[] }) => {
      if (clienteIds.length === 0) return;

      const { error } = await supabase
        .from('clientes')
        .update({
          grupo_cliente_id: grupoId,
          modificado_en: new Date().toISOString(),
          modificado_por: userId || null,
        })
        .in('id', clienteIds);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-detail', vars.grupoId] });
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-members', vars.grupoId] });
      queryClient.invalidateQueries({ queryKey: ['grupos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useDesasignarClienteDeGrupo() {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  return useMutation({
    mutationFn: async ({ clienteId }: { clienteId: string }) => {
      const { error } = await supabase
        .from('clientes')
        .update({
          grupo_cliente_id: null,
          modificado_en: new Date().toISOString(),
          modificado_por: userId || null,
        })
        .eq('id', clienteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-detail'] });
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-members'] });
      queryClient.invalidateQueries({ queryKey: ['grupos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useEliminarGrupoCliente() {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  return useMutation({
    mutationFn: async ({ grupoId }: { grupoId: string }) => {
      const { error: clearClientsError } = await supabase
        .from('clientes')
        .update({
          grupo_cliente_id: null,
          modificado_en: new Date().toISOString(),
          modificado_por: userId || null,
        })
        .eq('grupo_cliente_id', grupoId);

      if (clearClientsError) throw clearClientsError;

      await supabase.storage.from(GRUPOS_BUCKET).remove([`${grupoId}.png`]);

      const { error: deleteError } = await supabase
        .from('grupos_clientes')
        .update({
          eliminado_en: new Date().toISOString(),
          eliminado_por: userId || null,
          modificado_en: new Date().toISOString(),
          modificado_por: userId || null,
        })
        .eq('id', grupoId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['grupo-cliente-detail'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}
