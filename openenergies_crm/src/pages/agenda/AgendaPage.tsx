// src/pages/agenda/AgendaPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import FullCalendar from '@fullcalendar/react'
import type { EventMountArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es';
import { Calendar as CalendarIcon, List, Loader2, CalendarPlus, Umbrella, Plus } from 'lucide-react'
import { supabase } from '@lib/supabase'
import { AgendaItem } from '@lib/types'
import EventoFormModal from './EventoFormModal'
import ConfirmationModal from '@components/ConfirmationModal'
import AgendaListView from './AgendaListView'
import { toast } from 'react-hot-toast'
import { clsx } from '@lib/utils';
import { etiquetaColorMap } from '@lib/agendaConstants';

function AgendaLegend() {
  const legendItems = Object.entries(etiquetaColorMap);

  return (
    <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-bg-intermediate border border-bg-intermediate mt-6">
      <span className="text-sm font-medium text-gray-400 mr-2">Leyenda:</span>
      {legendItems.map(([label, color]) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          ></span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [viewRange, setViewRange] = useState(() => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString()
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59).toISOString()
    return { inicio, fin }
  })

  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null)

  const deleteMutationList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agenda_eventos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Evento eliminado')
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
      setEventToDeleteId(null)
    },
    onError: (error) => {
      toast.error(`Error al eliminar: ${error.message}`)
      setEventToDeleteId(null)
    },
  })

  const handleDeleteRequest = (id: string) => {
    setEventToDeleteId(id)
  }

  const confirmDelete = () => {
    if (eventToDeleteId) {
      deleteMutationList.mutate(eventToDeleteId)
    }
  }

  const { data: agendaItems, isLoading } = useQuery({
    queryKey: ['agendaItems', viewRange.inicio, viewRange.fin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agenda_items', {
        fecha_query_inicio: viewRange.inicio,
        fecha_query_fin: viewRange.fin,
      })
      if (error) throw new Error(error.message)
      return data as AgendaItem[]
    },
    retry: false,
    refetchOnWindowFocus: false,
    select: (data) =>
      data.map((item: AgendaItem) => ({
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
          source: item.tipo_evento === 'renovacion' ? 'renovacion' : 'crm',
          creadorNombre: item.creador_nombre || null,
        },
      })),
  })

  const handleEventClick = (clickInfo: any) => {
    const { es_editable, tipo_evento, cliente_id } = clickInfo.event.extendedProps

    if (tipo_evento === 'renovacion') {
      if (cliente_id) {
        navigate({ to: '/app/clientes/$id', params: { id: cliente_id } })
      } else {
        toast.error('Error: No se encontró el cliente de esta renovación.')
      }
      return
    }

    if (es_editable) {
      setSelectedEventId(clickInfo.event.id)
      setSelectedDate(null)
      setIsModalOpen(true)
    } else {
      toast('Evento de otro usuario (solo lectura)', { icon: '🔒' })
    }
  }

  const handleDateSelect = (selectInfo: any) => {
    // Use the selected date with 12:00 as default time
    const selectedDate = new Date(selectInfo.start);
    selectedDate.setHours(12, 0, 0, 0);
    const startStr = selectedDate.toISOString().slice(0, 16);
    setSelectedEventId(null)
    setSelectedDate(startStr)
    setIsModalOpen(true)
  }

  const handleDatesSet = (dateInfo: any) => {
    setViewRange({
      inicio: dateInfo.start.toISOString(),
      fin: dateInfo.end.toISOString()
    })
  }

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
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
    },
    onError: (error) => {
      toast.error(`Error al mover: ${error.message}`)
      queryClient.invalidateQueries({ queryKey: ['agendaItems'] })
    },
  })

  const handleEventDrop = (dropInfo: any) => {
    const { es_editable, tipo_evento } = dropInfo.event.extendedProps

    if (tipo_evento === 'renovacion' || !es_editable) {
      toast.error('Las renovaciones no se pueden mover.')
      dropInfo.revert()
      return
    }

    updateEventDateMutation.mutate({
      eventId: dropInfo.event.id,
      start: dropInfo.event.start.toISOString(),
      end: dropInfo.event.end ? dropInfo.event.end.toISOString() : null,
    })
  }

  const handleEditRequest = (id: string) => {
    setSelectedEventId(id)
    setSelectedDate(null)
    setIsModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-white">
          Agenda
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="p-1 rounded-lg bg-bg-intermediate border border-bg-intermediate flex items-center">
            <button
              className={clsx(
                "p-2 rounded-md transition-all",
                viewMode === 'calendar' ? "bg-fenix-500 text-white shadow-lg cursor-pointer" : "text-gray-400 hover:text-white hover:bg-fenix-500/8 cursor-pointer"
              )}
              onClick={() => setViewMode('calendar')}
              title="Vista Calendario"
            >
              <CalendarIcon size={20} />
            </button>
            <button
              className={clsx(
                "p-2 rounded-md transition-all",
                viewMode === 'list' ? "bg-fenix-500 text-white shadow-lg cursor-pointer" : "text-gray-400 hover:text-white hover:bg-fenix-500/8 cursor-pointer"
              )}
              onClick={() => setViewMode('list')}
              title="Vista Lista"
            >
              <List size={20} />
            </button>
          </div>

          <div className="h-8 w-px bg-bg-intermediate hidden sm:block"></div>

          <Link
            to="/app/agenda/vacaciones"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bg-intermediate hover:bg-fenix-500/8 text-gray-300 hover:text-white border border-bg-intermediate transition-colors cursor-pointer"
          >
            <Umbrella size={18} />
            <span className="hidden sm:inline">Vacaciones</span>
          </Link>

          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white shadow-lg shadow-fenix-500/20 transition-all transform hover:scale-105 cursor-pointer"
            onClick={() => {
              setSelectedEventId(null)
              setSelectedDate(null)
              setIsModalOpen(true)
            }}
          >
            <CalendarPlus size={18} />
            <span className="font-medium">Nuevo Evento</span>
          </button>
        </div>
      </div>

      <AgendaLegend />

      {(isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-fenix-400 mr-2" />
          <span className="text-gray-400">Actualizando agenda...</span>
        </div>
      )}

      {/* Calendar View */}
      <div
        className={clsx(
          "glass-card p-6 flex-grow overflow-hidden transition-all duration-300",
          viewMode === 'calendar' ? 'block' : 'hidden'
        )}
        style={{ opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.7 : 1 }}
      >
        <style>{`
          .fc {
            --fc-border-color: rgba(255, 255, 255, 0.1);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: transparent;
            --fc-list-event-hover-bg-color: rgba(255, 255, 255, 0.1);
            --fc-today-bg-color: rgba(16, 185, 129, 0.15);
            color: #e2e8f0;
          }
          .fc-theme-standard td, .fc-theme-standard th { border-color: var(--fc-border-color); }
          .fc-theme-standard .fc-scrollgrid { border-color: var(--fc-border-color); }
          .fc-col-header-cell { background-color: rgba(0,0,0,0.3); text-transform: uppercase; font-size: 0.75rem; padding: 8px 0; }
          .fc-daygrid-day { background-color: transparent !important; }
          .fc-daygrid-day-frame { background-color: transparent !important; }
          .fc-daygrid-day-number { color: #94a3b8; font-weight: 500; padding: 8px !important; }
          .fc-day-today { background-color: rgba(16, 185, 129, 0.1) !important; }
          .fc-day-today .fc-daygrid-day-number { color: #10b981 !important; font-weight: 700; }
          .fc-event { border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2); border-radius: 4px; }
          .fc-event, .fc-event-main, .fc-event-title, .fc-daygrid-event, .fc-h-event, .fc-event-main-frame { color: white !important; font-weight: 600 !important; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
          .fc-event-main { padding: 2px 6px; font-size: 0.8rem; }
          .fc-daygrid-dot-event .fc-event-title { color: white !important; font-weight: 600 !important; }
          .fc-timegrid-event .fc-event-main { color: white !important; font-weight: 600 !important; }
          .fc-button-primary { background-color: rgba(255,255,255,0.1) !important; border: 1px solid rgba(255,255,255,0.15) !important; color: #e2e8f0 !important; text-transform: capitalize; font-weight: 500; }
          .fc-button-primary:hover { background-color: rgba(255,255,255,0.2) !important; }
          .fc-button-active { background-color: #f59e0b !important; border-color: #f59e0b !important; color: white !important; }
          .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 600; color: #e2e8f0; }
          .fc-daygrid-day-events { margin-top: 4px; }
          .fc-daygrid-event-harness { margin-bottom: 2px; }
          .fc-day-other .fc-daygrid-day-number { color: #4b5563 !important; }
          .fc-popover { background-color: #1f2937 !important; border-color: rgba(255,255,255,0.1) !important; }
          .fc-popover-header { background-color: rgba(0,0,0,0.3) !important; color: #e2e8f0 !important; }
        `}</style>
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
          editable={true}
          eventDrop={handleEventDrop}
          height="auto"
          locale={esLocale}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
          }}
          noEventsText="No hay eventos para mostrar."
          eventContent={(arg) => {
            const etiqueta = arg.event.extendedProps?.etiqueta || '';
            const creador = arg.event.extendedProps?.creadorNombre || '';
            const tipo = arg.event.extendedProps?.tipo_evento || 'evento';

            const escapeHtml = (str: string) =>
              String(str)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

            const title = escapeHtml(arg.event.title ?? '');

            let creatorHtml = '';
            if (tipo === 'evento' && creador) {
              creatorHtml = `<span class="opacity-70 ml-1 text-[0.7em]">(${escapeHtml(creador.split(' ')[0])})</span>`;
            }

            return {
              html: `
                <div class="px-1 overflow-hidden text-ellipsis whitespace-nowrap" data-etiqueta="${escapeHtml(etiqueta)}">
                  ${title} ${creatorHtml}
                </div>
              `
            };
          }}
          eventDidMount={(arg: EventMountArg) => {
            const eventEl = arg.el;
            const backgroundColor = arg.event.backgroundColor;
            const borderColor = arg.event.borderColor;

            if (backgroundColor) {
              eventEl.style.backgroundColor = backgroundColor;
            }
            if (borderColor) {
              eventEl.style.borderColor = borderColor;
            }
          }}
        />
      </div>

      {/* List View */}
      <div
        className={clsx(
          "flex-grow transition-all duration-300",
          viewMode === 'list' ? 'flex flex-col' : 'hidden'
        )}
        style={{ opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.7 : 1 }}
      >
        <AgendaListView
          items={agendaItems || []}
          isLoading={isLoading}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
        />
      </div>

      {isModalOpen && (
        <EventoFormModal
          id={selectedEventId}
          fechaSeleccionada={selectedDate}
          onClose={() => setIsModalOpen(false)}
        />
      )}

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

