// src/pages/clientes/ClienteActividad.tsx
// Página de Actividad - Preparada para futura implementación

import { Activity } from 'lucide-react';

export default function ClienteActividad() {

  return (
    <div className="card">
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '3rem',
        textAlign: 'center',
        color: 'var(--muted)'
      }}>
        <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--fg)' }}>Actividad del Cliente</h3>
        <p style={{ margin: 0, maxWidth: '400px' }}>
          Esta sección mostrará el historial de actividad y eventos relacionados con el cliente.
          <br /><br />
          <em>Próximamente disponible.</em>
        </p>
      </div>
    </div>
  );
}

