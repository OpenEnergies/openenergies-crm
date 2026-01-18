// src/pages/agenda/EventoFormModal.tsx
import React, { useEffect, useState } from 'react'
import { useForm, SubmitHandler, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { useEmpresaId } from '@hooks/useEmpresaId'
import { toast } from 'react-hot-toast'
import { Loader2, Trash2, X, Calendar, Clock, Palette, Tag } from 'lucide-react'
import ConfirmationModal from '@components/ConfirmationModal'
import { etiquetaColorMap, etiquetasSeleccionables } from '@lib/agendaConstants';
import { isQuarterHour } from '@components/form/QuarterHourSelect';

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, '0');
  const m = ((i % 4) * 15).toString().padStart(2, '0');
  return { value: `${h}:${m}`, label: `${h}:${m}` };
});

interface ParsedDates {
  startDate: Date;
  endDate: Date | null;
}

function parseDateStrings(fechaInicioStr: string, fechaFinStr: string | null): ParsedDates {
  const startDate = new Date(fechaInicioStr);
  if (Number.isNaN(startDate.getTime())) {
    throw new TypeError('Fecha u hora de inicio inválida.');
  }

  let endDate: Date | null = null;
  if (fechaFinStr) {
    endDate = new Date(fechaFinStr);
    if (Number.isNaN(endDate.getTime())) {
      throw new TypeError('Fecha u hora de fin inválida.');
    }
    if (endDate <= startDate) {
      throw new RangeError('La fecha/hora de fin debe ser posterior a la de inicio.');
    }
  }

  return { startDate, endDate };
}

function buildDateString(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00`;
}

const eventoSchema = z.object({
  titulo: z.string().min(3, { message: 'El título es requerido' }),
  etiqueta: z.string().min(1, { message: 'La etiqueta es requerida' }),
  color: z.string().min(1, { message: 'El color es requerido' }),
  fecha_inicio_fecha: z.string().min(1, { message: 'La fecha de inicio es requerida' }),
  fecha_inicio_hora: z.string().min(1, { message: 'La hora de inicio es requerida' })
    .refine(isQuarterHour, { message: 'Solo cuartos de hora (00, 15, 30, 45)' }),
  fecha_fin_fecha: z.string().optional().nullable(),
  fecha_fin_hora: z.string().optional().nullable()
    .refine(val => !val || isQuarterHour(val), { message: 'Solo cuartos de hora (00, 15, 30, 45)' }),
}).refine(data => {
  const hasFechaFin = !!data.fecha_fin_fecha;
  const hasHoraFin = !!data.fecha_fin_hora;
  return (hasFechaFin && hasHoraFin) || (!hasFechaFin && !hasHoraFin);
}, {
  message: 'Si especificas una fecha de fin, también debes especificar una hora de fin',
  path: ['fecha_fin_hora'],
});

type AgendaEventoForm = z.infer<typeof eventoSchema>;

type EventoFormModalProps = {
  id: string | null
  fechaSeleccionada?: string | null
  onClose: () => void
}

export default function EventoFormModal({ id, fechaSeleccionada, onClose }: Readonly<EventoFormModalProps>) {
  const queryClient = useQueryClient()
  const { empresaId } = useEmpresaId()
  const isEditMode = Boolean(id)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: existingEvento, isLoading: isLoadingEvento } = useQuery({
    queryKey: ['agendaEvento', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_eventos')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: isEditMode,
  })

  const getFechaHoraParts = (isoString: string | null | undefined) => {
    if (!isoString) return { fecha: '', hora: '' };
    try {
      const localDate = new Date(isoString);
      if (Number.isNaN(localDate.getTime())) return { fecha: '', hora: '' };

      const fecha = localDate.getFullYear() + '-' +
        ('0' + (localDate.getMonth() + 1)).slice(-2) + '-' +
        ('0' + localDate.getDate()).slice(-2);
      const hora = ('0' + localDate.getHours()).slice(-2) + ':' +
        ('0' + localDate.getMinutes()).slice(-2);
      return { fecha, hora };
    } catch (e) {
      console.error("Error parsing date:", isoString, e);
      return { fecha: '', hora: '' };
    }
  };

  const initialParts = getFechaHoraParts(fechaSeleccionada);
  const defaultEtiqueta = etiquetasSeleccionables[0] || 'Reunión';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
    control,
    setValue,
  } = useForm<AgendaEventoForm>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      titulo: '',
      etiqueta: defaultEtiqueta,
      color: etiquetaColorMap[defaultEtiqueta],
      fecha_inicio_fecha: initialParts.fecha,
      fecha_inicio_hora: initialParts.hora,
      fecha_fin_fecha: '',
      fecha_fin_hora: '',
    },
  });

  const watchedEtiqueta = useWatch({ control, name: 'etiqueta' });

  useEffect(() => {
    if (watchedEtiqueta && etiquetaColorMap[watchedEtiqueta]) {
      if (!dirtyFields.color) {
        setValue('color', etiquetaColorMap[watchedEtiqueta], { shouldDirty: false });
      }
    }
  }, [watchedEtiqueta, setValue, dirtyFields]);

  useEffect(() => {
    if (isEditMode && existingEvento) {
      const inicioParts = getFechaHoraParts(existingEvento.fecha_inicio);
      const finParts = getFechaHoraParts(existingEvento.fecha_fin);
      reset({
        titulo: existingEvento.titulo,
        etiqueta: existingEvento.etiqueta || defaultEtiqueta,
        color: existingEvento.color || etiquetaColorMap[defaultEtiqueta],
        fecha_inicio_fecha: inicioParts.fecha,
        fecha_inicio_hora: inicioParts.hora,
        fecha_fin_fecha: finParts.fecha,
        fecha_fin_hora: finParts.hora,
      });
    }
  }, [existingEvento, isEditMode, reset, defaultEtiqueta]);

  const saveMutation = useMutation({
    mutationFn: async (formData: AgendaEventoForm) => {
      const fechaInicioStr = buildDateString(formData.fecha_inicio_fecha, formData.fecha_inicio_hora);
      const fechaFinStr = (formData.fecha_fin_fecha && formData.fecha_fin_hora)
        ? buildDateString(formData.fecha_fin_fecha, formData.fecha_fin_hora)
        : null;

      const { startDate, endDate } = parseDateStrings(fechaInicioStr, fechaFinStr);

      const payload = {
        titulo: formData.titulo,
        etiqueta: formData.etiqueta,
        color: formData.color,
        fecha_inicio: startDate.toISOString(),
        fecha_fin: endDate?.toISOString() ?? null,
      };

      if (isEditMode) {
        const { error } = await supabase.from('agenda_eventos').update(payload).eq('id', id!);
        if (error) throw error;
      } else {
        if (!empresaId) throw new Error('No se pudo determinar la empresa del usuario.');
        const { error } = await supabase
          .from('agenda_eventos')
          .insert({ ...payload, empresa_id: empresaId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditMode ? 'Evento actualizado' : 'Evento creado')
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
      onClose()
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('agenda_eventos').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Evento eliminado')
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
      onClose()
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  const onSubmit: SubmitHandler<AgendaEventoForm> = (data) => {
    saveMutation.mutate(data)
  }

  const handleDelete = () => {
    if (isEditMode) {
      deleteMutation.mutate()
    }
  }

  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      (e.currentTarget as HTMLInputElement).showPicker?.();
    } catch { }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-modal w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-fenix-700/30">
          <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500 flex items-center gap-2">
            <Calendar className="text-fenix-600 dark:text-fenix-400" />
            {isEditMode ? 'Editar Evento' : 'Crear Evento'}
          </h2>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                type="button"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                title="Eliminar Evento"
                onClick={() => setIsDeleting(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <form id="evento-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isLoadingEvento ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-fenix-400 w-8 h-8" />
              </div>
            ) : (
              <>
                {/* Título */}
                <div className="space-y-2">
                  <label htmlFor="titulo" className="text-sm font-bold text-primary uppercase tracking-tight">Título del evento</label>
                  <input
                    id="titulo"
                    {...register('titulo')}
                    className="glass-input w-full"
                    placeholder="Ej: Reunión con cliente"
                  />
                  {errors.titulo && <span className="text-sm text-red-400 mt-1">{errors.titulo.message}</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Etiqueta */}
                  <div className="space-y-2">
                    <label htmlFor="etiqueta" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                      <Tag size={16} /> Etiqueta
                    </label>
                    <div className="relative">
                      <select
                        id="etiqueta"
                        {...register('etiqueta')}
                        className="glass-input w-full appearance-none cursor-pointer"
                      >
                        {etiquetasSeleccionables.map((et) => (
                          <option key={et} value={et}>{et}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.etiqueta && <span className="text-sm text-red-400 mt-1">{errors.etiqueta.message}</span>}
                  </div>

                  {/* Color */}
                  <div className="space-y-2">
                    <label htmlFor="color" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                      <Palette size={16} /> Color
                    </label>
                    <input type="hidden" id="color" {...register('color')} />
                    <div className="flex items-center p-3 rounded-lg bg-bg-intermediate border border-primary/20">
                      <span
                        className="w-8 h-8 rounded-full shadow-lg ring-2 ring-white/20 transition-colors duration-300"
                        style={{ backgroundColor: watchedEtiqueta ? etiquetaColorMap[watchedEtiqueta] : '#ccc' }}
                      ></span>
                    </div>
                    {errors.color && <span className="text-sm text-red-400 mt-1">{errors.color.message}</span>}
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:bg-fenix-700/30 my-6"></div>

                {/* Fecha Inicio */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} /> Inicio
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-secondary">Fecha</label>
                      <input
                        type="date"
                        {...register('fecha_inicio_fecha')}
                        className="glass-input w-full cursor-pointer"
                        onClick={openPicker}
                      />
                      {errors.fecha_inicio_fecha && <span className="text-xs text-red-400">{errors.fecha_inicio_fecha.message}</span>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-secondary">Hora</label>
                      <Controller
                        name="fecha_inicio_hora"
                        control={control}
                        render={({ field }) => (
                          <div className="relative">
                            <select
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="glass-input w-full appearance-none cursor-pointer"
                            >
                              <option value="">Seleccionar...</option>
                              {TIME_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      />
                      {errors.fecha_inicio_hora && <span className="text-xs text-red-400">{errors.fecha_inicio_hora.message}</span>}
                    </div>
                  </div>
                </div>

                {/* Fecha Fin */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-fenix-700/30">
                  <h3 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={16} /> Fin <span className="text-xs normal-case font-normal text-secondary">(Opcional)</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-secondary">Fecha</label>
                      <input
                        type="date"
                        {...register('fecha_fin_fecha')}
                        className="glass-input w-full cursor-pointer"
                        onClick={openPicker}
                      />
                      {errors.fecha_fin_fecha && <span className="text-xs text-red-400">{errors.fecha_fin_fecha.message}</span>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-secondary">Hora</label>
                      <Controller
                        name="fecha_fin_hora"
                        control={control}
                        render={({ field }) => (
                          <div className="relative">
                            <select
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="glass-input w-full appearance-none cursor-pointer"
                            >
                              <option value="">Seleccionar...</option>
                              {TIME_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      />
                      {errors.fecha_fin_hora && <span className="text-xs text-red-400">{errors.fecha_fin_hora.message}</span>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-fenix-700/30 bg-bg-intermediate/50 dark:bg-bg-tertiary flex items-center justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            onClick={onClose}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="evento-form"
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium shadow-lg shadow-fenix-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={!isDirty || saveMutation.isPending || isLoadingEvento}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : 'Guardar Evento'}
          </button>
        </div>
      </div>

      {isDeleting && (
        <ConfirmationModal
          isOpen={isDeleting}
          title="Eliminar Evento"
          message={`¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={handleDelete}
          onClose={() => setIsDeleting(false)}
          isConfirming={deleteMutation.isPending}
          confirmButtonClass="danger"
        />
      )}
    </div>
  )
}

