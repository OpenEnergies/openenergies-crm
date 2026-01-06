// src/pages/notificaciones/NotificacionesPage.tsx
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useNotifications, AppNotification } from '@hooks/useNotifications'; // Importa el hook y el tipo
import { Loader2, Inbox, Check } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

// Componente para un solo item de notificación
function NotificationItem({ notification, onMarkAsRead }: { notification: AppNotification; onMarkAsRead: (id: string) => void }) {
  const timeAgo = formatDistanceToNow(new Date(notification.creada_en), { addSuffix: true, locale: es });
  
  // Determina a dónde enlazar
  let linkTo = '/app/notificaciones'; // Link por defecto
  if (notification.tipo === 'contrato_renovacion' && notification.contrato_id) {
    linkTo = `/app/contratos/${notification.contrato_id}`;
  } else if (notification.tipo === 'agenda_recordatorio') {
    // Enlazamos a la página de la agenda.
    // El hook useNotifications mostrará un toast en tiempo real,
    // y este enlace permite al usuario ir a la página de la agenda.
    linkTo = '/app/agenda';
    
    // NOTA: Tu router actual no tiene una ruta para un evento específico (ej. /app/agenda/[id]).
    // Si en el futuro la creas, podrías usar:
    // if (notification.agenda_evento_id) {
    //   linkTo = `/app/agenda/${notification.agenda_evento_id}`;
    // }
  }
  
  return (
    <li className="notification-item">
      <Link to={linkTo} className="notification-link">
        <div className="notification-content">
          <strong>{notification.asunto}</strong>
          <p>{notification.cuerpo}</p>
          <small>{timeAgo}</small>
        </div>
      </Link>
      {!notification.leida && (
        <button
          className="icon-button secondary small notification-read-button"
          title="Marcar como leída"
          onClick={() => onMarkAsRead(notification.id)}
        >
          <Check size={16} />
        </button>
      )}
    </li>
  );
}


export default function NotificacionesPage() {
  const { notifications, isLoading, isError, unreadCount } = useNotifications();
  const queryClient = useQueryClient();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const markAsReadMutation = async (notificationId: string) => {
    setMarkingId(notificationId);
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', notificationId);
        
      if (error) throw error;
      
      // Refrescamos la query para actualizar el contador y la lista
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e: any) {
      toast.error(`Error al marcar: ${e.message}`);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="page-layout">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Notificaciones ({unreadCount} no leídas)</h2>
        {/* Aquí podrías añadir "Marcar todas como leídas" */}
      </div>

      <div className="card">
        {isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={24} /> Cargando...
          </div>
        )}
        {isError && (
          <div className="error-text" style={{ padding: '2rem', textAlign: 'center' }}>
            Error al cargar las notificaciones.
          </div>
        )}
        {!isLoading && !isError && notifications.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            <Inbox size={40} style={{ marginBottom: '1rem' }} />
            <p>No tienes notificaciones no leídas.</p>
            {/* Aquí podrías añadir un enlace a "Ver todas" */}
          </div>
        )}
        {!isLoading && !isError && notifications.length > 0 && (
          <ul className="notification-list">
            {notifications.map(notif => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onMarkAsRead={markAsReadMutation}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
