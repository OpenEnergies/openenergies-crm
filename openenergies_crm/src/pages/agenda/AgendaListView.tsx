// src/pages/agenda/AgendaListView.tsx
import React from 'react'
import { format, parseISO, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNavigate } from '@tanstack/react-router'
import { Calendar, Clock, Tag, Edit2, Trash2, FileText, ArrowRight } from 'lucide-react'

type AgendaListViewProps = {
  items: any[]
  isLoading: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

type FormattedAgendaItem = {
  start: string;
  [key: string]: any;
};

const groupItemsByDay = (items: FormattedAgendaItem[]) => {
  if (!items) return {};

  return items.reduce((acc, item) => {
    const dateKey = startOfDay(parseISO(item.start)).toISOString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    acc[dateKey].sort((a: FormattedAgendaItem, b: FormattedAgendaItem) =>
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    return acc;
  }, {} as Record<string, FormattedAgendaItem[]>);
};

export default function AgendaListView({ items, isLoading, onEdit, onDelete }: AgendaListViewProps) {
  const navigate = useNavigate()
  const groupedItems = groupItemsByDay(items)
  const sortedDays = Object.keys(groupedItems).sort()

  const etiquetaIconMap: Record<string, React.ReactNode> = {
    'Reunión': <Calendar size={16} className="text-blue-400" />,
    'Tarea': <FileText size={16} className="text-emerald-400" />,
    'Llamada': <Clock size={16} className="text-amber-400" />,
    'Recordatorio': <Tag size={16} className="text-purple-400" />,
    'Personal': <Tag size={16} className="text-pink-400" />,
    'Renovación': <FileText size={16} className="text-red-400" />,
  }

  const handleRenovacionClick = (clienteId: string | null) => {
    if (clienteId) {
      navigate({ to: '/app/clientes/$id', params: { id: clienteId } })
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400">Cargando lista...</div>
  }

  if (sortedDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Calendar size={48} className="mb-4 opacity-50" />
        <p>No hay eventos ni renovaciones en este rango.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {sortedDays.map((dateKey) => {
        const dayItems = groupedItems[dateKey]
        const dayDate = parseISO(dateKey)
        const isToday = isSameDay(dayDate, new Date())

        return (
          <div key={dateKey} className="space-y-4">
            {/* Cabecera del Día */}
            <div className="flex items-center gap-4">
              <h3 className={`text-lg font-semibold ${isToday ? 'text-fenix-400' : 'text-white'}`}>
                {isToday && <span className="mr-2 px-2 py-0.5 rounded text-xs bg-fenix-500/20 text-fenix-400 font-bold uppercase tracking-wider">Hoy</span>}
                {format(dayDate, 'EEEE, d \'de\' MMMM', { locale: es })}
              </h3>
              <div className="h-px bg-bg-intermediate flex-1"></div>
            </div>

            {/* Lista de Eventos */}
            <ul className="space-y-3">
              {dayItems?.map((item) => (
                <li
                  key={item.id}
                  className="glass-card group flex items-start sm:items-center gap-4 p-4 hover:border-white/20 transition-all border border-bg-intermediate bg-bg-intermediate"
                >
                  <div className="flex items-center gap-3 min-w-[120px]">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-lg"
                      style={{ backgroundColor: item.color || '#ccc' }}
                    ></span>
                    <span className="text-gray-400 font-mono text-sm whitespace-nowrap">
                      {format(parseISO(item.start), 'HH:mm')}
                      {item.end && ` - ${format(parseISO(item.end), 'HH:mm')}`}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-bg-intermediate border border-bg-intermediate hidden sm:flex">
                    {etiquetaIconMap[item.extendedProps?.etiqueta || ''] || <Tag size={16} className="text-gray-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate pr-4">{item.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {item.extendedProps?.etiqueta && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-bg-intermediate text-gray-400">
                          {item.extendedProps.etiqueta}
                        </span>
                      )}
                      {item.extendedProps?.tipo_evento === 'evento' && item.extendedProps?.creadorNombre && (
                        <span className="text-xs text-gray-500">
                          · Creado por {item.extendedProps.creadorNombre.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.extendedProps?.tipo_evento === 'renovacion' ? (
                      <button
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                        title="Ir a Ficha Cliente"
                        onClick={() => handleRenovacionClick(item.extendedProps?.cliente_id)}
                      >
                        <ArrowRight size={18} />
                      </button>
                    ) : item.extendedProps?.es_editable ? (
                      <>
                        <button
                          className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                          title="Editar"
                          onClick={() => onEdit(item.id)}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Eliminar"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    ) : null}
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

