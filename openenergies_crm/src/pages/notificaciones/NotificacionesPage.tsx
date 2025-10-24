// src/pages/notificaciones/NotificacionesPage.tsx

export default function NotificacionesPage() {
  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Notificaciones</h2>
        {/* Aquí podrías añadir acciones en el futuro */}
      </div>

      <div className="card">
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Aún no hay notificaciones para mostrar.
        </p>
        {/* Aquí iría la lógica para mostrar las notificaciones */}
      </div>
    </div>
  );
}