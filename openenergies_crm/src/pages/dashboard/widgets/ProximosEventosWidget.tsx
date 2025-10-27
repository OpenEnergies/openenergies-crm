// src/pages/dashboard/widgets/ProximosEventosWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from '@hooks/useSession'; // Para filtrar por comercial si es necesario

// Tipo simplificado para los eventos del widget
type ProximoEvento = {
  id: string;
  titulo: string;
  fecha_inicio: string; // ISO String
};

// Función para obtener los próximos eventos
async function fetchProximosEventos(userId: string | null, rol: string | null): Promise<ProximoEvento[]> {
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let query = supabase
    .from('agenda_eventos')
    .select('id, titulo, fecha_inicio')
    .gte('fecha_inicio', hoy) // Desde hoy en adelante
    .order('fecha_inicio', { ascending: true }) // Los más cercanos primero
    .limit(5); // Mostramos los próximos 5

  // Si el usuario es 'comercial', filtramos por sus eventos creados
  // (Asegúrate de que la tabla agenda_eventos tenga una columna user_id o similar)
  // if (rol === 'comercial' && userId) {
  //   query = query.eq('user_id', userId); // Descomenta y ajusta si tienes user_id
  // }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching próximos eventos:", error);
    throw new Error(error.message);
  }
  return (data as ProximoEvento[]) || [];
}

export default function ProximosEventosWidget() {
  const { userId, rol } = useSession(); // Obtenemos el usuario actual

  const { data: eventos, isLoading, isError } = useQuery({
    queryKey: ['proximosEventosDashboard', userId, rol], // La key depende del usuario/rol
    queryFn: () => fetchProximosEventos(userId, rol),
  });

  return (
    <div className="card"> {/* Usamos la clase card para el estilo base */}
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
          {/* Enlace para ver toda la agenda */}
          <li style={{ textAlign: 'right', marginTop: '0.5rem' }}>
            <Link to="/app/agenda" style={{ fontSize: '0.9rem' }}>Ver agenda completa &rarr;</Link>
          </li>
        </ul>
      )}
    </div>
  );
}