// src/pages/dashboard/widgets/ProximosEventosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Loader2, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from '@hooks/useSession';

type ProximoEvento = {
  id: string;
  titulo: string;
  fecha_inicio: string;
  etiqueta?: string | null;
};

async function fetchProximosEventos(userId: string | null, rol: string | null): Promise<ProximoEvento[]> {
  const hoy = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('agenda_eventos')
    .select('id, titulo, fecha_inicio, etiqueta')
    .gte('fecha_inicio', hoy)
    .order('fecha_inicio', { ascending: true })
    .limit(10);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching próximos eventos:", error);
    throw new Error(error.message);
  }

  let eventos = (data as ProximoEvento[]) || [];

  // Filtrar renovaciones para comerciales
  if (rol === 'comercial') {
    eventos = eventos.filter(e => e.etiqueta !== 'Renovación');
  }

  return eventos.slice(0, 5);
}

export default function ProximosEventosWidget() {
  const { userId, rol } = useSession();

  const { data: eventos, isLoading, isError } = useQuery({
    queryKey: ['proximosEventosDashboard', userId, rol],
    queryFn: () => fetchProximosEventos(userId, rol),
  });

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-fenix-500/20 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-fenix-500" />
        </div>
        <h3 className="text-base font-semibold text-white">Próximos Eventos</h3>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-fenix-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400 text-center py-4">Error al cargar eventos.</p>
      )}

      {/* Empty */}
      {!isLoading && !isError && eventos && eventos.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No hay eventos próximos.</p>
      )}

      {/* Content */}
      {!isLoading && !isError && eventos && eventos.length > 0 && (
        <ul className="space-y-3">
          {eventos.map(evento => (
            <li
              key={evento.id}
              className="flex items-center justify-between pb-3 border-b border-bg-intermediate last:border-0"
            >
              <span className="text-sm font-medium text-gray-200 truncate pr-3">
                {evento.titulo}
              </span>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {format(parseISO(evento.fecha_inicio), 'dd MMM HH:mm', { locale: es })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Footer link */}
      <Link
        to="/app/agenda"
        className="flex items-center justify-end gap-1 mt-4 text-sm text-fenix-400 hover:text-fenix-300 transition-colors cursor-pointer"
      >
        Ver agenda <ArrowRight size={14} />
      </Link>
    </div>
  );
}