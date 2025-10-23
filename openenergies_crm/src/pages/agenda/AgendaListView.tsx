// src/pages/agenda/AgendaListView.tsx
import React from 'react'
import { AgendaItem } from '@lib/types' // Usamos el tipo ya formateado
import { format, parseISO, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale' // Para formato español
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'react-hot-toast'
import { Calendar, Clock, Tag, Edit2, Trash2, FileText } from 'lucide-react' // Iconos

// Props que recibe el componente
type AgendaListViewProps = {
  items: any[] // Son los eventos ya formateados por AgendaPage (formato FullCalendar)
  isLoading: boolean
  onEdit: (id: string) => void // Función para abrir el modal de edición
  onDelete: (id: string) => void // Función para iniciar el borrado
}

// Solo necesitamos la propiedad 'start' para la ordenación
type FormattedAgendaItem = {
  start: string;
  // Puedes añadir otras propiedades si las necesitas, pero 'start' es suficiente aquí
  [key: string]: any; // Permite otras propiedades sin definirlas todas
};


// Helper para agrupar eventos por día
// --- (2) USAR EL NUEVO TIPO EN LA FIRMA ---
const groupItemsByDay = (items: FormattedAgendaItem[]) => {
  if (!items) return {};

  return items.reduce((acc, item) => {
    const dateKey = startOfDay(parseISO(item.start)).toISOString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    // Ordenamos los eventos dentro de cada día por hora de inicio
    // --- (3) AÑADIR TIPOS A 'a' y 'b' ---
    acc[dateKey].sort((a: FormattedAgendaItem, b: FormattedAgendaItem) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    // --- FIN DE CAMBIO ---
    return acc;
  }, {} as Record<string, FormattedAgendaItem[]>); // <-- También usar el tipo aquí
};

export default function AgendaListView({ items, isLoading, onEdit, onDelete }: AgendaListViewProps) {
  const navigate = useNavigate()
  const groupedItems = groupItemsByDay(items)
  const sortedDays = Object.keys(groupedItems).sort() // Ordenamos los días cronológicamente

  // Iconos/Emojis por etiqueta (puedes personalizarlos)
  const etiquetaIconMap: Record<string, React.ReactNode> = {
    'Reunión': <Calendar size={16} className="text-muted" />,
    'Tarea': <FileText size={16} className="text-muted" />, // Ejemplo, usa el icono que prefieras
    'Llamada': <Clock size={16} className="text-muted" />, // Ejemplo
    'Recordatorio': <Tag size={16} className="text-muted" />, // Ejemplo
    'Personal': <Tag size={16} className="text-muted" />, // Ejemplo
    'Renovación': <FileText size={16} className="text-danger" />, // Icono distinto para renovaciones
  }

  // Navegar a cliente al hacer clic en renovación
  const handleRenovacionClick = (clienteId: string | null) => {
    if (clienteId) {
      navigate({ to: '/app/clientes/$id', params: { id: clienteId } })
    } else {
      toast.error('Error: No se encontró el cliente de esta renovación.')
    }
  }

  if (isLoading) {
    return <div className="card">Cargando lista...</div> // O un spinner
  }

  if (sortedDays.length === 0) {
    return <div className="card text-center text-muted">No hay eventos ni renovaciones en este rango.</div>
  }

  return (
    <div className="agenda-list-view">
      {sortedDays.map((dateKey) => {
        const dayItems = groupedItems[dateKey]
        const dayDate = parseISO(dateKey)
        const isToday = isSameDay(dayDate, new Date())

        return (
          <div key={dateKey} className="agenda-day-group">
            {/* Cabecera del Día */}
            <h3 className={`agenda-day-header ${isToday ? 'today' : ''}`}>
              {isToday ? 'Hoy, ' : ''}
              {format(dayDate, 'EEEE, d \'de\' MMMM', { locale: es })}
            </h3>

            {/* Lista de Eventos/Renovaciones del Día */}
            <ul className="agenda-item-list">
              {dayItems?.map((item) => (
                <li key={item.id} className="agenda-item">
                  {/* Indicador de Color */}
                  <span
                    className="item-color-dot"
                    style={{ backgroundColor: item.color || '#ccc' }}
                  ></span>

                  {/* Hora */}
                  <span className="item-time">
                    {format(parseISO(item.start), 'HH:mm')}
                    {item.end && ` - ${format(parseISO(item.end), 'HH:mm')}`}
                  </span>

                  {/* Icono/Emoji */}
                  <span className="item-icon">
                    {etiquetaIconMap[item.extendedProps?.etiqueta || ''] || <Tag size={16} />}
                  </span>

                  {/* Título y Etiqueta */}
                  <div className="item-details">
                    <span className="item-title">{item.title}</span>
                    {item.extendedProps?.etiqueta && (
                      <span className="item-tag">{item.extendedProps.etiqueta}</span>
                    )}
                    {/* Aquí podrías añadir un campo para 'Notas' si lo incluyes en la BBDD */}
                  </div>

                  {/* Acciones */}
                  <div className="item-actions">
                    {item.extendedProps?.tipo_evento === 'renovacion' ? (
                      <button
                        className="icon-button secondary small"
                        title="Ir a Ficha Cliente"
                        onClick={() => handleRenovacionClick(item.extendedProps?.cliente_id)}
                      >
                        <FileText size={16} /> {/* O un icono de 'ver' */}
                      </button>
                    ) : item.extendedProps?.es_editable ? (
                      <>
                        <button
                          className="icon-button secondary small"
                          title="Editar Evento"
                          onClick={() => onEdit(item.id)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-button danger small"
                          title="Eliminar Evento"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : null /* No mostrar acciones si no es editable */}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}