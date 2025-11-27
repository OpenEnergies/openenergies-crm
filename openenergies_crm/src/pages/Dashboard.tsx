// src/pages/Dashboard.tsx
import { useSession } from '@hooks/useSession';
import ChatWidget from '@features/chat/ChatWidget';
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';
import UltimosClientesWidget from './dashboard/widgets/UltimosClientesWidget';
import ResumenUsuariosWidget from './dashboard/widgets/ResumenUsuariosWidget';
import ResumenEmpresasWidget from './dashboard/widgets/ResumenEmpresasWidget';
import MisClientesAsignadosWidget from './dashboard/widgets/MisClientesAsignadosWidget';
import EstadoMisClientesWidget from './dashboard/widgets/EstadoMisClientesWidget';

export default function Dashboard() {
  const { rol, nombre, apellidos } = useSession();

  const canChat = rol === 'administrador';
  
  // --- VISIBILIDAD DE WIDGETS ---
  const canSeeAgendaWidget = rol === 'administrador' || rol === 'comercial';
  const canSeeRenovacionesWidget = rol === 'administrador'; 
  const canSeeClientesWidget = rol === 'administrador';
  const canSeeUsuariosWidget = rol === 'administrador';
  const canSeeEmpresasWidget = rol === 'administrador';
  const canSeeMisClientesWidget = rol === 'administrador' || 'comercial';
  const canSeeEstadoMisClientesWidget = false; // Desactivado para todos (incluso comercial)
  // ------------------------------

  return (
    <div className="grid">
      <div>
        <h2 style={{ margin: 0 }}>
          {nombre ? apellidos ? `Bienvenido ${nombre} ${apellidos}` : `Bienvenido ${nombre}` : 'Bienvenido'} al CRM de Open Energies
        </h2>
        <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
          Gestiona tus clientes y actividad diaria.
        </p>
      </div>

      <div className="dashboard-widget-grid">
        {/* Próximos Eventos (Filtrado internamente para comercial) */}
        {canSeeAgendaWidget && (
          <ProximosEventosWidget />
        )}
        
        {/* Mis Clientes (Solo comercial) */}
        {canSeeMisClientesWidget && (
          <MisClientesAsignadosWidget />
        )}

        {/* Solo Administrador */}
        {canSeeRenovacionesWidget && (
          <ContratosPorVencerWidget />
        )}
        {canSeeClientesWidget && (
          <UltimosClientesWidget />
        )}
        {canSeeUsuariosWidget && (
          <ResumenUsuariosWidget />
        )}
        {canSeeEmpresasWidget && (
          <ResumenEmpresasWidget />
        )}
        
        {/* Desactivado */}
        {canSeeEstadoMisClientesWidget && (
          <EstadoMisClientesWidget />
        )}
      </div>

      {canChat && <ChatWidget />}
    </div>
  );
}