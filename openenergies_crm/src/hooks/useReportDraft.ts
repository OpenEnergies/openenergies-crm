// openenergies_crm/src/hooks/useReportDraft.ts
// Hook para gestión y persistencia del ReportDraft

import { useState, useCallback, useEffect } from 'react';

import type { ReportDraft, NarrativeSection } from '@lib/reportDraftTypes';
import { generateReportDraft, buildFinalReportPayload } from '@lib/reportDraftGenerator';
import type { AuditoriaEnergeticaData } from '@lib/informesTypes';
import type { UUID } from '@lib/types';
import toast from 'react-hot-toast';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const reportDraftKeys = {
  all: ['report-draft'] as const,
  draft: (clienteId: string, fechaInicio: string, fechaFin: string) =>
    [...reportDraftKeys.all, { clienteId, fechaInicio, fechaFin }] as const,
};

// ============================================================================
// TIPOS
// ============================================================================

interface UseReportDraftOptions {
  clienteId: UUID;
  clienteNombre: string;
  puntoIds: UUID[];
  fechaInicio: string;
  fechaFin: string;
  titulo: string;
  auditoriaData: AuditoriaEnergeticaData | null;
  enabled?: boolean;
}

interface UseReportDraftReturn {
  draft: ReportDraft | null;
  isLoading: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: Error | null;

  // Acciones
  updateNarrativeSection: (
    sectionKey: keyof ReportDraft['narrativa'],
    texto: string
  ) => void;
  toggleRecomendaciones: (enabled: boolean) => void;
  updateRecomendacionesText: (texto: string) => void;
  saveDraft: () => Promise<void>;
  regenerateDraft: () => void;
  getFinalPayload: () => ReturnType<typeof buildFinalReportPayload> | null;
}



// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useReportDraft(options: UseReportDraftOptions): UseReportDraftReturn {
  const {
    clienteId,
    clienteNombre,
    puntoIds,
    fechaInicio,
    fechaFin,
    titulo,
    auditoriaData,
    enabled = true,
  } = options;

  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // -------------------------------------------------------------------------
  // GENERAR DRAFT SIEMPRE FRESCO (sin localStorage)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled || !auditoriaData || !clienteId) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Siempre generar nuevo draft desde datos calculados
      const newDraft = generateReportDraft(auditoriaData, {
        clienteId,
        clienteNombre,
        puntoIds,
        fechaInicio,
        fechaFin,
        titulo,
      });

      setDraft(newDraft);
    } catch (err) {
      console.error('Error generating draft:', err);
      setError(err instanceof Error ? err : new Error('Error generando draft'));
    } finally {
      setIsGenerating(false);
    }
  }, [auditoriaData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo, enabled]);



  // -------------------------------------------------------------------------
  // ACTUALIZAR SECCIÓN NARRATIVA
  // -------------------------------------------------------------------------

  const updateNarrativeSection = useCallback((
    sectionKey: keyof ReportDraft['narrativa'],
    texto: string
  ) => {
    if (!draft) return;

    const updatedDraft: ReportDraft = {
      ...draft,
      narrativa: {
        ...draft.narrativa,
        [sectionKey]: {
          ...draft.narrativa[sectionKey],
          texto_editado: texto,
          estado: 'edited' as const,
        },
      },
    };

    setDraft(updatedDraft);
  }, [draft]);

  // -------------------------------------------------------------------------
  // TOGGLE RECOMENDACIONES
  // -------------------------------------------------------------------------

  const toggleRecomendaciones = useCallback((enabled: boolean) => {
    if (!draft) return;

    const updatedDraft: ReportDraft = {
      ...draft,
      recomendaciones_enabled: enabled,
    };

    setDraft(updatedDraft);
  }, [draft]);

  // -------------------------------------------------------------------------
  // ACTUALIZAR TEXTO DE RECOMENDACIONES
  // -------------------------------------------------------------------------

  const updateRecomendacionesText = useCallback((texto: string) => {
    if (!draft) return;

    const updatedDraft: ReportDraft = {
      ...draft,
      recomendaciones_text: texto,
    };

    setDraft(updatedDraft);
  }, [draft]);

  // -------------------------------------------------------------------------
  // GUARDAR (solo en memoria)
  // -------------------------------------------------------------------------

  const saveDraft = useCallback(async () => {
    if (!draft) return;

    setIsSaving(true);

    try {
      const updated = {
        ...draft,
        metadata: {
          ...draft.metadata,
          actualizado_at: new Date().toISOString(),
          version: draft.metadata.version + 1,
        },
      };

      setDraft(updated);
      toast.success('Borrador guardado');
    } catch (err) {
      console.error('Error saving draft:', err);
      toast.error('Error al guardar borrador');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [draft]);

  // -------------------------------------------------------------------------
  // REGENERAR DRAFT
  // -------------------------------------------------------------------------

  const regenerateDraft = useCallback(() => {
    if (!auditoriaData) return;

    setIsGenerating(true);

    try {
      const newDraft = generateReportDraft(auditoriaData, {
        clienteId,
        clienteNombre,
        puntoIds,
        fechaInicio,
        fechaFin,
        titulo,
      });

      setDraft(newDraft);
      toast.success('Contenido regenerado');
    } catch (err) {
      console.error('Error regenerating draft:', err);
      toast.error('Error al regenerar contenido');
    } finally {
      setIsGenerating(false);
    }
  }, [auditoriaData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo]);

  // -------------------------------------------------------------------------
  // OBTENER PAYLOAD FINAL
  // -------------------------------------------------------------------------

  const getFinalPayload = useCallback(() => {
    if (!draft) return null;
    return buildFinalReportPayload(draft);
  }, [draft]);



  // -------------------------------------------------------------------------
  // RETURN
  // -------------------------------------------------------------------------

  return {
    draft,
    isLoading: isGenerating && !draft,
    isGenerating,
    isSaving,
    error,
    updateNarrativeSection,
    toggleRecomendaciones,
    updateRecomendacionesText,
    saveDraft,
    regenerateDraft,
    getFinalPayload,
  };
}


