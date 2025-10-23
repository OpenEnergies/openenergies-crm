// src/pages/agenda/EventoFormModal.tsx
import React, { useEffect, useState } from 'react'
import { useForm, SubmitHandler, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'
//import { AgendaEventoForm, AgendaItem } from '@lib/types'
import { useEmpresaId } from '@hooks/useEmpresaId' // ¡Importante para RLS!
import { toast } from 'react-hot-toast'
import { Loader2, Trash2 } from 'lucide-react'
import ConfirmationModal from '@components/ConfirmationModal'

// --- Esquema de Validación con Zod ---
const eventoSchema = z.object({
  titulo: z.string().min(3, { message: 'El título es requerido' }),
  etiqueta: z.string().min(1, { message: 'La etiqueta es requerida' }),
  color: z.string().min(1, { message: 'El color es requerido' }),
  fecha_inicio_fecha: z.string().min(1, { message: 'La fecha de inicio es requerida' }),
  fecha_inicio_hora: z.string().min(1, { message: 'La hora de inicio es requerida' }),
  fecha_fin_fecha: z.string().optional().nullable(),
  fecha_fin_hora: z.string().optional().nullable(),
}).refine(data => {
    // Validación extra: si se pone fecha fin, se debe poner hora fin, y viceversa
    const hasFechaFin = !!data.fecha_fin_fecha;
    const hasHoraFin = !!data.fecha_fin_hora;
    return (hasFechaFin && hasHoraFin) || (!hasFechaFin && !hasHoraFin);
}, {
    message: 'Si especificas una fecha de fin, también debes especificar una hora de fin',
    path: ['fecha_fin_hora'], // O 'fecha_fin_fecha'
});

type AgendaEventoForm = z.infer<typeof eventoSchema>;

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
  // --- (CAMBIO 3: Añadir Función Helper) ---
  // Esta función nos ayuda a separar un ISO string (o null) en partes
  // fecha (YYYY-MM-DD) y hora (HH:mm) para los inputs del formulario.
  const getFechaHoraParts = (isoString: string | null | undefined) => {
    if (!isoString) return { fecha: '', hora: '' };
    try {
      // Usamos Date para que la conversión a partes respete la zona horaria local
      const localDate = new Date(isoString);
      // Comprobamos si la fecha es válida
      if (isNaN(localDate.getTime())) return { fecha: '', hora: '' };

      // Formato YYYY-MM-DD
      const fecha = localDate.getFullYear() + '-' +
                    ('0' + (localDate.getMonth() + 1)).slice(-2) + '-' +
                    ('0' + localDate.getDate()).slice(-2);
      // Formato HH:mm
      const hora = ('0' + localDate.getHours()).slice(-2) + ':' +
                   ('0' + localDate.getMinutes()).slice(-2);
      return { fecha, hora };
    } catch (e) {
      // En caso de error al parsear, devolvemos vacío
      console.error("Error parsing date:", isoString, e);
      return { fecha: '', hora: '' };
    }
  };
  // --- FIN CAMBIO 3 ---

  const initialParts = getFechaHoraParts(fechaSeleccionada);
  const defaultEtiqueta = etiquetas[0] || 'Reunión';
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
    control,
    setValue,
  } = useForm<AgendaEventoForm>({ // <-- Usar el tipo inferido AgendaEventoForm
    resolver: zodResolver(eventoSchema),
    // Cambiamos los defaultValues para usar los nuevos nombres de campo
    defaultValues: {
      titulo: '',
      etiqueta: defaultEtiqueta,
      color: etiquetaColorMap[defaultEtiqueta],
      // Valores iniciales para los campos separados
      fecha_inicio_fecha: initialParts.fecha,
      fecha_inicio_hora: initialParts.hora,
      fecha_fin_fecha: '', // Empezar vacíos
      fecha_fin_hora: '',  // Empezar vacíos
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

  // --- (CAMBIO 5: Efecto para rellenar en Modo Edición) ---
  useEffect(() => {
    if (isEditMode && existingEvento) {
      // Usamos el helper para separar las fechas de la BBDD en partes
      const inicioParts = getFechaHoraParts(existingEvento.fecha_inicio);
      const finParts = getFechaHoraParts(existingEvento.fecha_fin);
      // Actualizamos el reset para usar los nuevos nombres de campo
      reset({
        titulo: existingEvento.titulo,
        etiqueta: existingEvento.etiqueta || defaultEtiqueta, // Usar defaultEtiqueta como fallback
        color: existingEvento.color || etiquetaColorMap[defaultEtiqueta], // Usar color por defecto como fallback
        // Rellenar campos separados
        fecha_inicio_fecha: inicioParts.fecha,
        fecha_inicio_hora: inicioParts.hora,
        fecha_fin_fecha: finParts.fecha,
        fecha_fin_hora: finParts.hora,
      });
    }
    // Aseguramos que defaultEtiqueta esté en las dependencias si se usa en el reset
  }, [existingEvento, isEditMode, reset, defaultEtiqueta]);

  // --- (CAMBIO 6: Mutación para Guardar - Combinar fecha y hora) ---
  const saveMutation = useMutation({
    mutationFn: async (formData: AgendaEventoForm) => {
      // Combinamos fecha y hora en un string reconocible por `new Date()`
      const fecha_inicio_str = `${formData.fecha_inicio_fecha}T${formData.fecha_inicio_hora}:00`;
      let fecha_fin_str: string | null = null;
      if (formData.fecha_fin_fecha && formData.fecha_fin_hora) {
        fecha_fin_str = `${formData.fecha_fin_fecha}T${formData.fecha_fin_hora}:00`;
      }

      // Convertimos a objetos Date para validación y conversión a ISO UTC
      let startDate: Date;
      let endDate: Date | null = null;
      try {
           startDate = new Date(fecha_inicio_str);
           // Validamos si la fecha/hora de inicio es válida
           if (isNaN(startDate.getTime())) throw new Error("Fecha u hora de inicio inválida.");

           if (fecha_fin_str) {
               endDate = new Date(fecha_fin_str);
               // Validamos si la fecha/hora de fin es válida
               if (isNaN(endDate.getTime())) throw new Error("Fecha u hora de fin inválida.");
               // Opcional pero recomendado: Validar que fin sea posterior a inicio
               if (endDate <= startDate) throw new Error("La fecha/hora de fin debe ser posterior a la de inicio.");
           }
      } catch (e: any) {
           console.error("Error al construir fechas:", e);
           // Lanzamos el error específico para mostrarlo al usuario
           throw new Error(e.message || "Formato de fecha u hora inválido.");
      }

      // Creamos el payload final con los nombres originales de la BBDD (fecha_inicio, fecha_fin)
      // y usamos toISOString() para enviar en formato UTC estándar.
      const payload = {
        titulo: formData.titulo,
        etiqueta: formData.etiqueta,
        color: formData.color,
        fecha_inicio: startDate.toISOString(), // <-- Convertido a ISO UTC
        fecha_fin: endDate ? endDate.toISOString() : null, // <-- Convertido a ISO UTC o null
      };

      // La lógica de update/insert no necesita cambiar aquí
      if (isEditMode) {
         const { error } = await supabase.from('agenda_eventos').update(payload).eq('id', id!)
         if (error) throw error
      } else {
         if (!empresaId) throw new Error('No se pudo determinar la empresa del usuario.')
         const { error } = await supabase
           .from('agenda_eventos')
           .insert({ ...payload, empresa_id: empresaId }) // Se añade empresa_id aquí
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

  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
  try {
    (e.currentTarget as HTMLInputElement).showPicker?.();
  } catch {}
};


  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content agenda-modal" onClick={(e) => e.stopPropagation()}>
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
                  <div className="form-row"> {/* Div para dividir en 2 columnas */}
                    {/* Input Fecha Inicio */}
                    <div>
                      <label htmlFor="fecha_inicio_fecha">Fecha Inicio</label>
                      <input
                        id="fecha_inicio_fecha"
                        type="date" // <-- CAMBIO A 'date'
                        {...register('fecha_inicio_fecha')} // <-- CAMBIO DE NOMBRE
                        className="input-fecha" // Clase opcional
                        onClick={openPicker}
                      />
                      {/* Mostrar error específico */}
                      {errors.fecha_inicio_fecha && <span className="error-text">{errors.fecha_inicio_fecha.message}</span>}
                    </div>
                    {/* Input Hora Inicio */}
                    <div>
                      <label htmlFor="fecha_inicio_hora">Hora Inicio</label>
                      <input
                        id="fecha_inicio_hora"
                        type="time" // <-- NUEVO INPUT 'time'
                        step="900" // Opcional: intervalos de 15 min
                        {...register('fecha_inicio_hora')} // <-- NUEVO REGISTRO
                        className="input-hora" // Clase opcional
                        onClick={openPicker}
                      />
                      {/* Mostrar error específico */}
                      {errors.fecha_inicio_hora && <span className="error-text">{errors.fecha_inicio_hora.message}</span>}
                    </div>
                  </div>
                  {/* --- (CAMBIO 8: JSX - Inputs separados para Fecha/Hora Fin) --- */}
                  <div className="form-row"> {/* Otra fila para Fin */}
                     {/* Input Fecha Fin */}
                     <div>
                       <label htmlFor="fecha_fin_fecha">Fecha Fin (opcional)</label>
                       <input
                         id="fecha_fin_fecha"
                         type="date" // <-- CAMBIO A 'date'
                         {...register('fecha_fin_fecha')} // <-- CAMBIO DE NOMBRE
                         className="input-fecha"
                         onClick={openPicker}
                       />
                       {errors.fecha_fin_fecha && <span className="error-text">{errors.fecha_fin_fecha.message}</span>}
                     </div>
                     {/* Input Hora Fin */}
                     <div>
                       <label htmlFor="fecha_fin_hora">Hora Fin (opcional)</label>
                       <input
                         id="fecha_fin_hora"
                         type="time" // <-- NUEVO INPUT 'time'
                         step="900"
                         {...register('fecha_fin_hora')} // <-- NUEVO REGISTRO
                         className="input-hora"
                         onClick={openPicker}
                       />
                       {/* Mostrar error específico */}
                       {errors.fecha_fin_hora && <span className="error-text">{errors.fecha_fin_hora.message}</span>}
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