// src/pages/dashboard/widgets/ProximosEventosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from '@hooks/useSession';

type ProximoEvento = {
  id: string;
  titulo: string;
  fecha_inicio: string;
  etiqueta?: string | null; // <-- Añadido para filtrar
};

async function fetchProximosEventos(userId: string | null, rol: string | null): Promise<ProximoEvento[]> {
  const hoy = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('agenda_eventos')
    .select('id, titulo, fecha_inicio, etiqueta') // <-- Pedimos etiqueta
    .gte('fecha_inicio', hoy)
    .order('fecha_inicio', { ascending: true })
    .limit(10); // Pedimos un poco más por si filtramos

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching próximos eventos:", error);
    throw new Error(error.message);
  }

  let eventos = (data as ProximoEvento[]) || [];

  // --- MODIFICACIÓN: Filtrar renovaciones para comerciales ---
  if (rol === 'comercial') {
    eventos = eventos.filter(e => e.etiqueta !== 'Renovación');
  }
  // ----------------------------------------------------------

  // Devolvemos solo los 5 primeros tras el filtro
  return eventos.slice(0, 5);
}

export default function ProximosEventosWidget() {
  const { userId, rol } = useSession();

  const { data: eventos, isLoading, isError } = useQuery({
    queryKey: ['proximosEventosDashboard', userId, rol],
    queryFn: () => fetchProximosEventos(userId, rol),
  });

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <CalendarDays size={20} /> Próximos Eventos
      </h3>
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {isError && (
        <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar eventos.</p>
      )}
      {!isLoading && !isError && eventos && eventos.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay eventos próximos.</p>
      )}
      {!isLoading && !isError && eventos && eventos.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {eventos.map(evento => (
            <li key={evento.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '0.5rem' }}>
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {evento.titulo}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                {format(parseISO(evento.fecha_inicio), 'dd MMM HH:mm', { locale: es })}
              </span>
            </li>
          ))}
          <li style={{ textAlign: 'right', marginTop: '0.5rem' }}>
            <Link to="/app/agenda" style={{ fontSize: '0.9rem' }}>Ver agenda completa &rarr;</Link>
          </li>
        </ul>
      )}
    </div>
  );
}