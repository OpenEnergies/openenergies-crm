// src/pages/agenda/AgendaPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'; // <-- Importar idioma español
import { Calendar as CalendarIcon, List, Loader2, Plus, PlusCircle, Trash2 } from 'lucide-react'
import { supabase } from '@lib/supabase'
import { AgendaItem } from '@lib/types'
import EventoFormModal from './EventoFormModal'
import ConfirmationModal from '@components/ConfirmationModal' // <-- (3) Importar ConfirmationModal
import AgendaListView from './AgendaListView'
import { toast } from 'react-hot-toast'
import { clsx } from '@lib/utils';

// Componente de página principal
export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  

  // Este estado guardará el rango visible del calendario
  const [viewRange, setViewRange] = useState(() => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59).toISOString()
    return { inicio, fin }
  })

  // --- (5) ESTADO Y LÓGICA PARA BORRADO DESDE LA LISTA ---
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null)

  const deleteMutationList = useMutation({ // Mutación separada o reutilizar la del modal
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agenda_eventos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Evento eliminado')
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
      setEventToDeleteId(null) // Cerrar modal de confirmación
    },
    onError: (error) => {
      toast.error(`Error al eliminar: ${error.message}`)
      setEventToDeleteId(null)
    },
  })

  const handleDeleteRequest = (id: string) => {
    setEventToDeleteId(id) // Abre el modal de confirmación
  }

  const confirmDelete = () => {
    if (eventToDeleteId) {
      deleteMutationList.mutate(eventToDeleteId)
    }
  }

  // 1. Query para traer TODOS los items (eventos + renovaciones)
  const { data: agendaItems, isLoading } = useQuery({
    // Usamos viewRange en la queryKey. Cuando cambie, TanStack refetcheará
    queryKey: ['agendaItems', viewRange.inicio, viewRange.fin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agenda_items', {
        fecha_query_inicio: viewRange.inicio,
        fecha_query_fin: viewRange.fin,
      })
      if (error) throw new Error(error.message)
      return data as AgendaItem[]
    },
    retry: false,                // 👈 evita reintentos en 400
    refetchOnWindowFocus: false,
    select: (data) =>
      data.map((item) => ({
        id: item.id,
        title: item.titulo,
        start: item.fecha_inicio,
        end: item.fecha_fin ?? undefined,
        color: item.color || (item.tipo_evento === 'renovacion' ? '#DC2626' : '#2E87E5'),
        borderColor: item.color || (item.tipo_evento === 'renovacion' ? '#DC2626' : '#2E87E5'),
        extendedProps: {
          etiqueta: item.etiqueta,
          tipo_evento: item.tipo_evento,
          es_editable: item.es_editable,
          cliente_id: item.cliente_id_relacionado,
        },
      })),
  })

  

  // 2. Manejador de clic en un evento (Actualizado)
  const handleEventClick = (clickInfo: any) => {
    const { es_editable, tipo_evento, cliente_id } = clickInfo.event.extendedProps

    if (tipo_evento === 'renovacion') {
      // ¡Ahora navegamos a la ficha del cliente!
      if (cliente_id) {
        navigate({ to: '/app/clientes/$id', params: { id: cliente_id } })
      } else {
        toast.error('Error: No se encontró el cliente de esta renovación.')
      }
      return
    }

    if (es_editable) {
      // Abrir modal en modo edición
      setSelectedEventId(clickInfo.event.id)
      setSelectedDate(null)
      setIsModalOpen(true)
    } else {
      // Evento de otro comercial (solo admin lo ve)
      alert(`Evento (solo lectura): ${clickInfo.event.title}`)
    }
  }

  // --- (5) NUEVO MANEJADOR: Clic en un día/hora vacíos ---
  const handleDateSelect = (selectInfo: any) => {
    // Formateamos la fecha/hora seleccionada
    const startStr = new Date(selectInfo.start).toISOString().slice(0, 16)
    
    setSelectedEventId(null) // Modo creación
    setSelectedDate(startStr) // Pre-rellenamos la fecha
    setIsModalOpen(true)
  }
  
  // --- (6) NUEVO MANEJADOR: Cuando el usuario cambia de mes/semana ---
  const handleDatesSet = (dateInfo: any) => {
    // Actualizamos el estado viewRange, lo que disparará un refetch del useQuery
    setViewRange({
      inicio: dateInfo.start.toISOString(),
      fin: dateInfo.end.toISOString()
    })
  }

  // --- (8) NUEVO: Mutación para Drag-and-Drop ---
  const updateEventDateMutation = useMutation({
    mutationFn: async ({ eventId, start, end }: { eventId: string; start: string; end: string | null }) => {
      const { error } = await supabase
        .from('agenda_eventos')
        .update({ fecha_inicio: start, fecha_fin: end })
        .eq('id', eventId)
        
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Evento actualizado')
      // Refrescamos la agenda
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
    },
    onError: (error) => {
      toast.error(`Error al mover: ${error.message}`)
      // Revertimos el cambio visual si falla
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
    },
  })

  // --- (9) NUEVO: Manejador para Drag-and-Drop ---
  const handleEventDrop = (dropInfo: any) => {
    const { es_editable, tipo_evento } = dropInfo.event.extendedProps
    
    // No permitir arrastrar renovaciones
    if (tipo_evento === 'renovacion' || !es_editable) {
      toast.error('Las renovaciones no se pueden mover.')
      dropInfo.revert() // Deshace el cambio visual
      return
    }

    // Llamamos a la mutación para guardar el cambio
    updateEventDateMutation.mutate({
      eventId: dropInfo.event.id,
      start: dropInfo.event.start.toISOString(),
      end: dropInfo.event.end ? dropInfo.event.end.toISOString() : null,
    })
  }

  // --- (6) NUEVA FUNCIÓN PARA ABRIR MODAL DESDE LA LISTA ---
  const handleEditRequest = (id: string) => {
    setSelectedEventId(id)
    setSelectedDate(null)
    setIsModalOpen(true)
  }

  return (
    <div className="card">
      {/* --- CABECERA DE LA PÁGINA --- */}
      <div className="page-header">
        <h2>Agenda</h2>
        <div className="page-actions" style={{ display: 'flex', gap: '1rem' }}>
          
          <div className="view-toggle-buttons"> {/* <-- Envolver en un div */}
            <button
              // --- CAMBIO ---
              className={clsx('icon-button', viewMode === 'calendar' && 'active')}
              // --- FIN CAMBIO ---
              onClick={() => setViewMode('calendar')}
              title="Vista Calendario"
            >
              <CalendarIcon size={20} />
            </button>
            <button
              // --- CAMBIO ---
              className={clsx('icon-button', viewMode === 'list' && 'active')}
              // --- FIN CAMBIO ---
              onClick={() => setViewMode('list')}
              title="Vista Lista"
            >
              <List size={20} />
            </button>
          </div>

          {/* Botón de crear evento */}
          <button
            // --- CAMBIO: Añadir clase y ajustar estilo ---
            className="create-event-button"
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} // Más pequeño
            // --- FIN CAMBIO ---
            onClick={() => {
              setSelectedEventId(null)
              setSelectedDate(null)
              setIsModalOpen(true)
            }}
          >
            <PlusCircle size={18} style={{ marginRight: '0.5rem' }} /> {/* Icono cambiado */}
            Crear Evento
          </button>
        </div>
      </div>

      {/* --- ÁREA de CONTENIDO --- */}
      {(isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) && ( // <-- (10) Añadir estado de carga de la mutación
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Loader2 className="animate-spin" /> Cargando agenda...
        </div>
      )}
      
      {/* Contenedor para que el calendario se pinte */}
      <div style={{ display: viewMode === 'calendar' ? 'block' : 'none', marginTop: '1.5rem',
                    opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.5 : 1 // <-- (12) Opacidad mientras carga
                  }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={agendaItems || []}
          eventClick={handleEventClick}
          selectable={true}
          select={handleDateSelect}
          datesSet={handleDatesSet}
          editable={true} // <-- (13) PERMITIR ARRASTRAR
          eventDrop={handleEventDrop} // <-- (14) MANEJADOR DE ARRASTRE
          height="auto"
          locale={esLocale}
          buttonText={{
             today:    'Hoy',
             month:    'Mes',
             week:     'Semana',
             day:      'Día',
          }}
          noEventsText="No hay eventos para mostrar."
          eventContent={(arg) => {
            // --- USA ESTA VERSIÓN ---
            const etiqueta = arg.event.extendedProps?.etiqueta || '';

            const escapeHtml = (str: string) =>
              String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            const title = escapeHtml(arg.event.title ?? '');

            // Devuelve directamente el HTML con el data-attribute
            return { html: `<div data-etiqueta="${escapeHtml(etiqueta)}">${title}</div>` };
            // --- FIN DE LA VERSIÓN CORRECTA ---
          }}
        />
      </div>

      <div style={{ display: viewMode === 'list' ? 'block' : 'none', marginTop: '1.5rem',
                    opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.5 : 1
                  }}>
        <AgendaListView
          items={agendaItems || []}
          isLoading={isLoading}
          onEdit={handleEditRequest} // <-- Pasar función para editar
          onDelete={handleDeleteRequest} // <-- Pasar función para borrar
        />
      </div>
      
      {/* --- (10) RENDERIZAR EL MODAL --- */}
      {isModalOpen && (
        <EventoFormModal
          id={selectedEventId}
          fechaSeleccionada={selectedDate}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* --- (9) MODAL DE CONFIRMACIÓN PARA BORRADO DESDE LISTA --- */}
      {eventToDeleteId && (
         <ConfirmationModal
           isOpen={!!eventToDeleteId}
           title="Eliminar Evento"
           message="¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer."
           confirmText="Eliminar"
           cancelText="Cancelar"
           onConfirm={confirmDelete}
           onClose={() => setEventToDeleteId(null)}
           isConfirming={deleteMutationList.isPending}
           confirmButtonClass="danger"
         />
       )}
    </div>
  )
}