// src/pages/agenda/EventoFormModal.tsx
import React, { useEffect, useState } from 'react'
import { useForm, SubmitHandler, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
import { AgendaEventoForm, AgendaItem } from '@lib/types'
import { useEmpresaId } from '@hooks/useEmpresaId' // ¡Importante para RLS!
import { toast } from 'react-hot-toast'
import { Loader2, Trash2 } from 'lucide-react'
import ConfirmationModal from '@components/ConfirmationModal'

// --- Esquema de Validación con Zod ---
const eventoSchema = z.object({
  titulo: z.string().min(3, { message: 'El título es requerido' }),
  etiqueta: z.string().min(1, { message: 'La etiqueta es requerida' }),
  color: z.string().min(1, { message: 'El color es requerido' }),
  fecha_inicio: z.string().min(1, { message: 'La fecha de inicio es requerida' }),
  fecha_fin: z.string().nullable().optional(),
})

// --- (NUEVO) Mapeo de Etiqueta a Color ---
const etiquetaColorMap: Record<string, string> = {
  'Reunión': '#2BB673', // Verde
  'Tarea': '#2E87E5', // Azul
  'Llamada': '#f39b03', // Naranja (Aviso)
  'Recordatorio': '#8B5CF6', // Morado (nuevo color, añade a :root si quieres)
  'Personal': '#64748b', // Gris (Muted)
  'Renovación': '#DC2626', // Rojo (Aunque no se crea desde aquí)
};
const etiquetas = Object.keys(etiquetaColorMap).filter(et => et !== 'Renovación'); // Lista de etiquetas creables
// --- Propiedades del Componente ---
type EventoFormModalProps = {
  id: string | null // null = Modo Creación, string = Modo Edición
  fechaSeleccionada?: string | null // Para pre-rellenar al crear
  onClose: () => void
}

export default function EventoFormModal({ id, fechaSeleccionada, onClose }: EventoFormModalProps) {
  const queryClient = useQueryClient()
  const { empresaId } = useEmpresaId() // Obtenemos la empresa_id del usuario actual
  const isEditMode = Boolean(id)
  const [isDeleting, setIsDeleting] = useState(false)

  // --- Query para cargar datos en Modo Edición ---
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
    enabled: isEditMode, // Solo se ejecuta si estamos en modo edición
  })

  // --- Configuración del Formulario ---
  const defaultEtiqueta = etiquetas[0] || 'Reunión';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
    control, // <-- Necesario para Controller
    setValue, // <-- Necesario para actualizar color
  } = useForm<AgendaEventoForm>({
    resolver: zodResolver(eventoSchema),
    defaultValues: {
      titulo: '',
      etiqueta: defaultEtiqueta,
      color: etiquetaColorMap[defaultEtiqueta],
      fecha_inicio: fechaSeleccionada ? fechaSeleccionada.slice(0, 16) : '',
      fecha_fin: '',
    },
  });

  // --- (NUEVO) Observar cambios en la etiqueta ---
  const watchedEtiqueta = useWatch({ control, name: 'etiqueta' });

  // --- (NUEVO) Efecto para actualizar el color cuando cambia la etiqueta ---
  useEffect(() => {
    if (watchedEtiqueta && etiquetaColorMap[watchedEtiqueta]) {
      // --- CORRECTO: Check specific field ---
      if (!dirtyFields.color) { 
      // --- FIN CORRECTO ---
         // Only update color automatically if the user hasn't manually changed it
         setValue('color', etiquetaColorMap[watchedEtiqueta], { shouldDirty: false });
      }
    }
    // Make sure 'isDirty' object itself is in the dependency array if you use it directly
  }, [watchedEtiqueta, setValue, dirtyFields]);

  // --- Efecto para rellenar el formulario en Modo Edición ---
  useEffect(() => {
    if (isEditMode && existingEvento) {
      reset({
        titulo: existingEvento.titulo,
        etiqueta: existingEvento.etiqueta || 'Reunión',
        color: existingEvento.color || '#2E87E5',
        // Formateamos la fecha para el input 'datetime-local' (YYYY-MM-DDTHH:mm)
        fecha_inicio: existingEvento.fecha_inicio
          ? new Date(existingEvento.fecha_inicio).toISOString().slice(0, 16)
          : '',
        fecha_fin: existingEvento.fecha_fin
          ? new Date(existingEvento.fecha_fin).toISOString().slice(0, 16)
          : '',
      })
    }
  }, [existingEvento, isEditMode, reset])

  // --- Mutación para Guardar (Crear o Actualizar) ---
  const saveMutation = useMutation({
    mutationFn: async (formData: AgendaEventoForm) => {
      const payload = {
        ...formData,
        fecha_fin: formData.fecha_fin || null, // Asegurar null si está vacío
      }

      if (isEditMode) {
        // --- ACTUALIZAR ---
        const { error } = await supabase.from('agenda_eventos').update(payload).eq('id', id!)
        if (error) throw error
      } else {
        // --- CREAR ---
        if (!empresaId) throw new Error('No se pudo determinar la empresa del usuario.')
        const { error } = await supabase
          .from('agenda_eventos')
          .insert({ ...payload, empresa_id: empresaId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(isEditMode ? 'Evento actualizado' : 'Evento creado')
      // ¡Invalidamos la query de la agenda para que el calendario se refresque!
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
      onClose()
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    },
  })

  // --- Mutación para Eliminar ---
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

  // --- Manejadores ---
  const onSubmit: SubmitHandler<AgendaEventoForm> = (data) => {
    saveMutation.mutate(data)
  }

  const handleDelete = () => {
    if (isEditMode) {
      deleteMutation.mutate()
    }
  }
  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="card" style={{ padding: 0 }}>
            {/* --- Cabecera del Modal --- */}
            <div className="page-header" style={{ padding: '1.5rem', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
              <h2>{isEditMode ? 'Editar Evento' : 'Crear Evento'}</h2>
              {isEditMode && (
                <button
                  className="icon-button danger"
                  title="Eliminar Evento"
                  onClick={() => setIsDeleting(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            {/* --- Formulario --- */}
            <form onSubmit={handleSubmit(onSubmit)}>
              {isLoadingEvento ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
              ) : (
                <div style={{ padding: '1.5rem', display: 'grid', gap: '1.5rem' }}>
                  {/* --- Título --- */}
                  <div className="input-icon-wrapper">
                    <label htmlFor="titulo">Título</label>
                    <input id="titulo" {...register('titulo')} />
                    {errors.titulo && <span className="error-text">{errors.titulo.message}</span>}
                  </div>

                  {/* --- Fila: Etiqueta y Color --- */}
                  <div className="form-row">
                    <div>
                      <label htmlFor="etiqueta">Etiqueta</label>
                      <select id="etiqueta" {...register('etiqueta')}>
                        {etiquetas.map((et) => (
                          <option key={et} value={et}>{et}</option>
                        ))}
                      </select>
                      {errors.etiqueta && <span className="error-text">{errors.etiqueta.message}</span>}
                    </div>
                    <div>
                       <label>Color</label>
                       {/* Input oculto para guardar el valor */}
                       <input type="hidden" {...register('color')} />
                       {/* Indicador visual del color */}
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         padding: '0.65rem 0.8rem',
                         border: '1px solid var(--border-color)',
                         borderRadius: '0.5rem',
                         background: 'var(--bg-card)',
                         height: '43px' // Misma altura que otros inputs
                       }}>
                         <span style={{
                           width: '20px',
                           height: '20px',
                           borderRadius: '50%',
                           backgroundColor: watchedEtiqueta ? etiquetaColorMap[watchedEtiqueta] : '#ccc',
                           display: 'inline-block',
                           marginRight: '0.5rem'
                         }}></span>
                         <span style={{ color: 'var(--muted)' }}>
                           {watchedEtiqueta ? `(${etiquetaColorMap[watchedEtiqueta]})` : ''}
                         </span>
                       </div>
                       {errors.color && <span className="error-text">{errors.color.message}</span>}
                     </div>
                  </div>

                  {/* --- Fila: Fechas --- */}
                  <div className="form-row">
                    <div>
                      <label htmlFor="fecha_inicio">Fecha de Inicio</label>
                      <input
                        id="fecha_inicio"
                        type="datetime-local"
                        {...register('fecha_inicio')}
                      />
                      {errors.fecha_inicio && <span className="error-text">{errors.fecha_inicio.message}</span>}
                    </div>
                    <div>
                      <label htmlFor="fecha_fin">Fecha de Fin (opcional)</label>
                      <input
                        id="fecha_fin"
                        type="datetime-local"
                        {...register('fecha_fin')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- Pie del Modal (Botones) --- */}
              <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={onClose}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || saveMutation.isPending || isLoadingEvento}
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* --- Modal de Confirmación para Borrar --- */}
      {isDeleting && (
        <ConfirmationModal
          isOpen={isDeleting} // <--- AÑADIR ESTA LÍNEA
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
    </>
  )
}