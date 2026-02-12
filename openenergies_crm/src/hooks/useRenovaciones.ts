// src/hooks/useRenovaciones.ts
// Hook para gestionar operaciones de renovación de contratos
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { useSession } from './useSession';

// Types for renovation operations
export interface ContratoRenovacion {
  id: string;
  punto_id: string;
  comercializadora_id: string;
  estado: string;
  fecha_activacion: string | null;
  fecha_renovacion: string | null;
  pendiente_fecha: boolean;
  nombre_carpeta_renovacion_pendiente_fecha: string | null;
  puntos_suministro: {
    cups: string;
    direccion_sum: string | null;
    clientes: { id: string; nombre: string } | null;
  } | null;
  comercializadoras: { id: string; nombre: string } | null;
}

export interface CarpetaRenovacion {
  nombre_carpeta: string;
  cantidad_contratos: number;
  comercializadora_ids: string[];
  fecha_creacion: string;
}

export interface RenovacionResult {
  contratos_actualizados: number;
  success: boolean;
  message: string;
}

// Estados de contrato válidos para renovación
const ESTADOS_RENOVACION = ['En curso', 'Contratado', 'Pendiente renovacion'];

// Fetch contratos para renovación (NO pendientes de fecha)
async function fetchContratosParaRenovacion(
  daysToExpiry: number
): Promise<ContratoRenovacion[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysToExpiry);
  const todayISO = today.toISOString().split('T')[0];
  const futureDateISO = futureDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('contratos')
    .select(`
      id,
      punto_id,
      comercializadora_id,
      estado,
      fecha_activacion,
      fecha_renovacion,
      pendiente_fecha,
      nombre_carpeta_renovacion_pendiente_fecha,
      puntos_suministro (
        cups,
        direccion_sum,
        clientes ( id, nombre )
      ),
      comercializadoras:empresas!contratos_comercializadora_id_fkey ( id, nombre )
    `)
    .gte('fecha_renovacion', todayISO)
    .lte('fecha_renovacion', futureDateISO)
    .eq('pendiente_fecha', false)
    .is('nombre_carpeta_renovacion_pendiente_fecha', null)
    .is('eliminado_en', null)
    .in('estado', ESTADOS_RENOVACION)
    .order('fecha_renovacion', { ascending: true });

  if (error) throw error;
  return data as unknown as ContratoRenovacion[];
}

// Fetch contratos pendientes de fecha
async function fetchContratosPendientesFecha(): Promise<ContratoRenovacion[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select(`
      id,
      punto_id,
      comercializadora_id,
      estado,
      fecha_activacion,
      fecha_renovacion,
      pendiente_fecha,
      nombre_carpeta_renovacion_pendiente_fecha,
      puntos_suministro (
        cups,
        direccion_sum,
        clientes ( id, nombre )
      ),
      comercializadoras:empresas!contratos_comercializadora_id_fkey ( id, nombre )
    `)
    .eq('pendiente_fecha', true)
    .not('nombre_carpeta_renovacion_pendiente_fecha', 'is', null)
    .is('eliminado_en', null)
    .order('nombre_carpeta_renovacion_pendiente_fecha', { ascending: true });

  if (error) throw error;
  return data as unknown as ContratoRenovacion[];
}

// Fetch carpetas de renovación pendiente
async function fetchCarpetasRenovacion(): Promise<CarpetaRenovacion[]> {
  const { data, error } = await supabase.rpc('get_carpetas_renovacion_pendiente');
  if (error) throw error;
  return data as CarpetaRenovacion[];
}

// Fetch comercializadoras
async function fetchComercializadoras(): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tipo', 'comercializadora')
    .is('eliminado_en', null)
    .order('nombre');

  if (error) throw error;
  return data || [];
}

// Verificar si nombre de carpeta existe
async function checkCarpetaExiste(nombre: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_carpeta_renovacion_existe', {
    p_nombre: nombre,
  });
  if (error) throw error;
  return data as boolean;
}

// Hook principal
export function useRenovaciones(daysToExpiry: number) {
  const queryClient = useQueryClient();
  const { userId } = useSession();

  // Query para contratos disponibles para renovación
  const contratosQuery = useQuery({
    queryKey: ['contratos-renovacion', daysToExpiry],
    queryFn: () => fetchContratosParaRenovacion(daysToExpiry),
    refetchOnWindowFocus: false,
    enabled: daysToExpiry > 0,
  });

  // Query para contratos pendientes de fecha
  const contratosPendientesQuery = useQuery({
    queryKey: ['contratos-pendientes-fecha'],
    queryFn: fetchContratosPendientesFecha,
    refetchOnWindowFocus: false,
  });

  // Query para carpetas de renovación
  const carpetasQuery = useQuery({
    queryKey: ['carpetas-renovacion'],
    queryFn: fetchCarpetasRenovacion,
    refetchOnWindowFocus: false,
  });

  // Query para comercializadoras
  const comercializadorasQuery = useQuery({
    queryKey: ['comercializadoras'],
    queryFn: fetchComercializadoras,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutation para renovar contratos con fechas
  const renovarConFechasMutation = useMutation({
    mutationFn: async ({
      contratoIds,
      comercializadoraId,
      fechaActivacion,
      fechaRenovacion,
    }: {
      contratoIds: string[];
      comercializadoraId: string;
      fechaActivacion: string;
      fechaRenovacion: string;
    }) => {
      const { data, error } = await supabase.rpc('renovar_contratos_con_fechas', {
        p_contrato_ids: contratoIds,
        p_comercializadora_id: comercializadoraId,
        p_fecha_activacion: fechaActivacion,
        p_fecha_renovacion: fechaRenovacion,
        p_user_id: userId,
      });
      if (error) throw error;
      return data[0] as RenovacionResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['contratos-renovacion'] });
        queryClient.invalidateQueries({ queryKey: ['contratos-pendientes-fecha'] });
        queryClient.invalidateQueries({ queryKey: ['carpetas-renovacion'] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al renovar: ${error.message}`);
    },
  });

  // Mutation para marcar contratos como pendientes de fecha
  const renovarPendienteFechaMutation = useMutation({
    mutationFn: async ({
      contratoIds,
      comercializadoraId,
      nombreCarpeta,
    }: {
      contratoIds: string[];
      comercializadoraId: string;
      nombreCarpeta: string;
    }) => {
      const { data, error } = await supabase.rpc('renovar_contratos_pendiente_fecha', {
        p_contrato_ids: contratoIds,
        p_comercializadora_id: comercializadoraId,
        p_nombre_carpeta: nombreCarpeta,
        p_user_id: userId,
      });
      if (error) throw error;
      return data[0] as RenovacionResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['contratos-renovacion'] });
        queryClient.invalidateQueries({ queryKey: ['contratos-pendientes-fecha'] });
        queryClient.invalidateQueries({ queryKey: ['carpetas-renovacion'] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al marcar pendientes: ${error.message}`);
    },
  });

  // Mutation para completar renovación de contratos seleccionados
  const completarRenovacionMutation = useMutation({
    mutationFn: async ({
      contratoIds,
      fechaActivacion,
      fechaRenovacion,
    }: {
      contratoIds: string[];
      fechaActivacion: string;
      fechaRenovacion: string;
    }) => {
      const { data, error } = await supabase.rpc('completar_renovacion_contratos_seleccionados', {
        p_contrato_ids: contratoIds,
        p_fecha_activacion: fechaActivacion,
        p_fecha_renovacion: fechaRenovacion,
        p_user_id: userId,
      });
      if (error) throw error;
      return data[0] as RenovacionResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['contratos-renovacion'] });
        queryClient.invalidateQueries({ queryKey: ['contratos-pendientes-fecha'] });
        queryClient.invalidateQueries({ queryKey: ['carpetas-renovacion'] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al completar renovación: ${error.message}`);
    },
  });

  // Helper para verificar nombre de carpeta
  const verificarNombreCarpeta = useCallback(async (nombre: string): Promise<boolean> => {
    try {
      return await checkCarpetaExiste(nombre);
    } catch (error) {
      console.error('Error verificando carpeta:', error);
      return false;
    }
  }, []);

  // Actualizar estado de contrato inline
  const actualizarEstadoContrato = useCallback(
    async (contratoId: string, nuevoEstado: string) => {
      try {
        const { error } = await supabase
          .from('contratos')
          .update({ estado: nuevoEstado, modificado_en: new Date().toISOString(), modificado_por: userId })
          .eq('id', contratoId);

        if (error) throw error;
        toast.success('Estado actualizado');
        queryClient.invalidateQueries({ queryKey: ['contratos-renovacion'] });
      } catch (error: any) {
        toast.error(`Error: ${error.message}`);
      }
    },
    [queryClient, userId]
  );

  return {
    // Queries
    contratos: contratosQuery.data ?? [],
    isLoadingContratos: contratosQuery.isLoading,
    isErrorContratos: contratosQuery.isError,
    
    contratosPendientes: contratosPendientesQuery.data ?? [],
    isLoadingPendientes: contratosPendientesQuery.isLoading,
    isErrorPendientes: contratosPendientesQuery.isError,
    
    carpetas: carpetasQuery.data ?? [],
    isLoadingCarpetas: carpetasQuery.isLoading,
    
    comercializadoras: comercializadorasQuery.data ?? [],
    isLoadingComercializadoras: comercializadorasQuery.isLoading,

    // Mutations
    renovarConFechas: renovarConFechasMutation.mutateAsync,
    isRenovando: renovarConFechasMutation.isPending,
    
    renovarPendienteFecha: renovarPendienteFechaMutation.mutateAsync,
    isPendienteando: renovarPendienteFechaMutation.isPending,
    
    completarRenovacion: completarRenovacionMutation.mutateAsync,
    isCompletando: completarRenovacionMutation.isPending,

    // Helpers
    verificarNombreCarpeta,
    actualizarEstadoContrato,
    
    // Refetch
    refetch: () => {
      contratosQuery.refetch();
      contratosPendientesQuery.refetch();
      carpetasQuery.refetch();
    },
  };
}

export default useRenovaciones;
