// src/pages/agenda/AgendaPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import FullCalendar from '@fullcalendar/react'
import type { EventMountArg } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es';
import { Calendar as CalendarIcon, List, Loader2, Plus, CalendarPlus, Trash2 } from 'lucide-react'
import { supabase } from '@lib/supabase'
import { AgendaItem } from '@lib/types'
import EventoFormModal from './EventoFormModal'
import ConfirmationModal from '@components/ConfirmationModal'
import AgendaListView from './AgendaListView'
import { toast } from 'react-hot-toast'
import { clsx } from '@lib/utils';
import { etiquetaColorMap } from '@lib/agendaConstants';
// --- Importar useSession ---
import { useSession } from '@hooks/useSession'

function AgendaLegend() {
  const legendItems = Object.entries(etiquetaColorMap);
  return (
    <div className="agenda-legend">
      {legendItems.map(([label, color]) => (
        <div key={label} className="legend-item">
          <span className="legend-color-dot" style={{ backgroundColor: color }} aria-hidden="true"></span>
          <span className="legend-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const { rol } = useSession() // <-- Obtenemos el rol
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

  const handleDeleteRequest = (id: string) => { setEventToDeleteId(id) }
  const confirmDelete = () => { if (eventToDeleteId) deleteMutationList.mutate(eventToDeleteId) }

  // 1. Query para traer items y FILTRAR según rol
  const { data: agendaItems, isLoading } = useQuery({
    queryKey: ['agendaItems', viewRange.inicio, viewRange.fin, rol], // Añadimos rol a la key
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
    select: (data) => {
      // --- MODIFICACIÓN: FILTRADO DE RENOVACIONES PARA COMERCIALES ---
      const itemsToProcess = rol === 'comercial' 
        ? data.filter(item => item.tipo_evento !== 'renovacion') // Filtra fuera las renovaciones
        : data;
      // -------------------------------------------------------------

      return itemsToProcess.map((item: AgendaItem) => ({
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
      }));
    }
  })

  const handleEventClick = (clickInfo: any) => {
    const { es_editable, tipo_evento, cliente_id } = clickInfo.event.extendedProps
    if (tipo_evento === 'renovacion') {
      if (cliente_id) navigate({ to: '/app/clientes/$id', params: { id: cliente_id } })
      else toast.error('Error: No se encontró el cliente de esta renovación.')
      return
    }
    if (es_editable) {
      setSelectedEventId(clickInfo.event.id)
      setSelectedDate(null)
      setIsModalOpen(true)
    } else {
      alert(`Evento (solo lectura): ${clickInfo.event.title}`)
    }
  }

  const handleDateSelect = (selectInfo: any) => {
    const startStr = new Date(selectInfo.start).toISOString().slice(0, 16)
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
    <div className="card agenda-page-container" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      <div className="page-header">
        <h2>Agenda</h2>
        <div className="page-actions" style={{ display: 'flex', gap: '1rem' }}>
          <div className="view-toggle-buttons">
            <button
              className={clsx('icon-button', viewMode === 'calendar' && 'active')}
              onClick={() => setViewMode('calendar')}
              title="Vista Calendario"
            >
              <CalendarIcon size={20} />
            </button>
            <button
              className={clsx('icon-button', viewMode === 'list' && 'active')}
              onClick={() => setViewMode('list')}
              title="Vista Lista"
            >
              <List size={20} />
            </button>
          </div>
          <button
            className="create-event-button"
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            onClick={() => {
              setSelectedEventId(null)
              setSelectedDate(null)
              setIsModalOpen(true)
            }}
          >
            <CalendarPlus size={18} />
          </button>
        </div>
      </div>

      <AgendaLegend />

      {(isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Loader2 className="animate-spin" /> Cargando agenda...
        </div>
      )}
      
      <div style={{
          display: viewMode === 'calendar' ? 'block' : 'none',
          flexGrow: 1,
          overflow: 'auto',
          marginTop: '1.5rem',
          opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.5 : 1,
          minHeight: '400px'
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
          editable={true}
          eventDrop={handleEventDrop}
          height="auto"
          locale={esLocale}
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          noEventsText="No hay eventos para mostrar."
          eventContent={(arg) => {
            const etiqueta = arg.event.extendedProps?.etiqueta || '';
            const creador  = arg.event.extendedProps?.creadorNombre || '';
            const tipo     = arg.event.extendedProps?.tipo_evento || 'evento';
            const escapeHtml = (str: string) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const title = escapeHtml(arg.event.title ?? '');
            let creatorHtml = '';
            if (tipo === 'evento' && creador) {
               creatorHtml = `<span class="fc-event-creator">(${escapeHtml(creador.split(' ')[0])})</span>`;
            }
            return {
              html: `
                <div class="fc-event-main-content" data-etiqueta="${escapeHtml(etiqueta)}">
                  ${title} ${creatorHtml}
                </div>
              `
            };
          }}
          eventDidMount={(arg: EventMountArg) => {
            const eventEl = arg.el;
            const backgroundColor = arg.event.backgroundColor;
            const borderColor = arg.event.borderColor;
            if (backgroundColor) eventEl.style.backgroundColor = backgroundColor;
            if (borderColor) eventEl.style.borderColor = borderColor;
          }}
          eventClassNames={(arg) => {
            const tipo = arg.event.extendedProps?.tipo_evento as string | undefined;
            const bg = (arg.event.backgroundColor || '').toLowerCase();
            const darkSet = new Set(['#64748b', '#8b5cf6', '#dc2626']);
            const classes: string[] = [];
            if (tipo === 'renovacion' || darkSet.has(bg)) {
              classes.push('fc-dark');
            }
            return classes;
          }}
        />
      </div>

      <div style={{
          display: viewMode === 'list' ? 'flex' : 'none',
          flexDirection: 'column',
          flexGrow: 1,
          marginTop: '1.5rem',
          opacity: (isLoading || updateEventDateMutation.isPending || deleteMutationList.isPending) ? 0.5 : 1,
          overflowY: 'auto'
         }}>
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