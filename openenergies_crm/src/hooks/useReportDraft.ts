// openenergies_crm/src/hooks/useReportDraft.ts
// Hook para gestión y persistencia del ReportDraft

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
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
// STORAGE KEYS
// ============================================================================

function getDraftStorageKey(clienteId: string, fechaInicio: string, fechaFin: string): string {
  return `report-draft-${clienteId}-${fechaInicio}-${fechaFin}`;
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

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = getDraftStorageKey(clienteId, fechaInicio, fechaFin);

  // -------------------------------------------------------------------------
  // CARGAR DRAFT EXISTENTE O GENERAR NUEVO
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled || !auditoriaData || !clienteId) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Intentar cargar draft guardado
      const savedDraft = localStorage.getItem(storageKey);

      if (savedDraft) {
        const parsed = JSON.parse(savedDraft) as ReportDraft;
        // Verificar que coincide con los parámetros actuales
        if (
          parsed.metadata.cliente_id === clienteId &&
          parsed.metadata.fecha_inicio === fechaInicio &&
          parsed.metadata.fecha_fin === fechaFin &&
          JSON.stringify(parsed.metadata.punto_ids.sort()) === JSON.stringify(puntoIds.sort()) &&
          parsed.metadata.version === 2
        ) {
          setDraft(parsed);
          setIsGenerating(false);
          return;
        }
      }

      // No hay draft válido, generar nuevo
      const newDraft = generateReportDraft(auditoriaData, {
        clienteId,
        clienteNombre,
        puntoIds,
        fechaInicio,
        fechaFin,
        titulo,
      });

      setDraft(newDraft);

      // Guardar en localStorage
      localStorage.setItem(storageKey, JSON.stringify(newDraft));

    } catch (err) {
      console.error('Error loading/generating draft:', err);
      setError(err instanceof Error ? err : new Error('Error generando draft'));
    } finally {
      setIsGenerating(false);
    }
  }, [auditoriaData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo, enabled, storageKey]);

  // -------------------------------------------------------------------------
  // GUARDAR CON DEBOUNCE
  // -------------------------------------------------------------------------

  const debouncedSave = useCallback((draftToSave: ReportDraft) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const updated = {
          ...draftToSave,
          metadata: {
            ...draftToSave.metadata,
            actualizado_at: new Date().toISOString(),
            version: draftToSave.metadata.version + 1,
          },
        };
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.error('Error saving draft:', err);
      }
    }, 1000); // 1 segundo de debounce
  }, [storageKey]);

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
    debouncedSave(updatedDraft);
  }, [draft, debouncedSave]);

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
    debouncedSave(updatedDraft);
  }, [draft, debouncedSave]);

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
    debouncedSave(updatedDraft);
  }, [draft, debouncedSave]);

  // -------------------------------------------------------------------------
  // GUARDAR INMEDIATAMENTE
  // -------------------------------------------------------------------------

  const saveDraft = useCallback(async () => {
    if (!draft) return;

    setIsSaving(true);

    try {
      // Cancelar debounce pendiente
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const updated = {
        ...draft,
        metadata: {
          ...draft.metadata,
          actualizado_at: new Date().toISOString(),
          version: draft.metadata.version + 1,
        },
      };

      localStorage.setItem(storageKey, JSON.stringify(updated));
      setDraft(updated);

      toast.success('Borrador guardado');
    } catch (err) {
      console.error('Error saving draft:', err);
      toast.error('Error al guardar borrador');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [draft, storageKey]);

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
      localStorage.setItem(storageKey, JSON.stringify(newDraft));

      toast.success('Contenido regenerado');
    } catch (err) {
      console.error('Error regenerating draft:', err);
      toast.error('Error al regenerar contenido');
    } finally {
      setIsGenerating(false);
    }
  }, [auditoriaData, clienteId, clienteNombre, puntoIds, fechaInicio, fechaFin, titulo, storageKey]);

  // -------------------------------------------------------------------------
  // OBTENER PAYLOAD FINAL
  // -------------------------------------------------------------------------

  const getFinalPayload = useCallback(() => {
    if (!draft) return null;
    return buildFinalReportPayload(draft);
  }, [draft]);

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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

// ============================================================================
// HOOK PARA LIMPIAR DRAFTS ANTIGUOS
// ============================================================================

export function useCleanupOldDrafts() {
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('report-draft-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const draft = JSON.parse(data) as ReportDraft;
              const updatedAt = new Date(draft.metadata.actualizado_at).getTime();
              if (now - updatedAt > maxAge) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // Draft corrupto, eliminar
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      if (keysToRemove.length > 0) {
        console.log(`Cleaned up ${keysToRemove.length} old report drafts`);
      }
    } catch (err) {
      console.error('Error cleaning up old drafts:', err);
    }
  }, []);
}
