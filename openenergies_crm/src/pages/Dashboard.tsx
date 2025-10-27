import { useSession } from '@hooks/useSession';
// import { Link } from '@tanstack/react-router';
// import { canSeeModule } from '@lib/permissions';
import ChatWidget from '@features/chat/ChatWidget';
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';
import UltimosClientesWidget from './dashboard/widgets/UltimosClientesWidget';
import ResumenUsuariosWidget from './dashboard/widgets/ResumenUsuariosWidget';
import ResumenEmpresasWidget from './dashboard/widgets/ResumenEmpresasWidget';
import MisClientesAsignadosWidget from './dashboard/widgets/MisClientesAsignadosWidget';
import EstadoMisClientesWidget from './dashboard/widgets/EstadoMisClientesWidget';

// Un pequeño componente para las tarjetas de acción
//function ActionCard({ to, title, description }: { to: string; title: string; description: string }) {
//  return (
//    <Link to={to} className="card-link">
//      <div className="card action-card">
//        <h3>{title} &rarr;</h3>
//        <p>{description}</p>
//      </div>
//    </Link>
//  );
//}

export default function Dashboard() {
  const { rol, nombre } = useSession();

  const canChat = rol === 'administrador' || rol === 'comercial';
  const canSeeAgendaWidget = rol === 'administrador' || rol === 'comercial';
  const canSeeRenovacionesWidget = rol === 'administrador' || rol === 'comercial';
  const canSeeClientesWidget = rol === 'administrador' || rol === 'comercial';
  const canSeeUsuariosWidget = rol === 'administrador';
  const canSeeEmpresasWidget = rol === 'administrador';
  const canSeeMisClientesWidget = rol === 'comercial';
  const canSeeEstadoMisClientesWidget = rol === 'comercial';

  return (
    <div className="grid">
      <div>
        {/* --- ¡MENSAJE PERSONALIZADO! --- */}
        <h2 style={{ margin: 0 }}>
          {/* Si tenemos el nombre, lo mostramos. Si no, un saludo genérico. */}
          {nombre ? `Bienvenido, ${nombre}` : 'Bienvenido'} al CRM de Open Energies
        </h2>
        <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
          Gestiona tus clientes, contratos y documentos desde un único lugar.
        </p>
      </div>

      <div className="dashboard-widget-grid">
        {/* Widget de Próximos Eventos */}
        {canSeeAgendaWidget && (
          <ProximosEventosWidget />
        )}
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
        {canSeeMisClientesWidget && (
          <MisClientesAsignadosWidget />
        )}
        {canSeeEstadoMisClientesWidget && (
          <EstadoMisClientesWidget />
        )}

        {/* --- Aquí irán los futuros widgets --- */}
        {/* <OtroWidget /> */}
        {/* <OtroWidgetMas /> */}
        {/* ... hasta 6 widgets ... */}

      </div>

      {/*<div className="dashboard-grid">
        {/* Usamos la función canSeeModule para cada tarjeta 
        
        {canSeeModule(rol ?? 'cliente', 'usuarios') && (
          <ActionCard
            to="/app/usuarios"
            title="Gestionar Usuarios"
            description="Invita, edita y gestiona los accesos de tu equipo."
          />
        )}
        
        {canSeeModule(rol ?? 'cliente', 'clientes') && (
          <ActionCard
            to="/app/clientes"
            title="Ver Clientes"
            description="Consulta y administra tu cartera de clientes."
          />
        )}

        {/* --- ¡AQUÍ ESTÁ LA CORRECCIÓN! --- *
        {canSeeModule(rol ?? 'cliente', 'puntos') && (
          <ActionCard
            to="/app/puntos"
            title="Puntos de Suministro"
            description="Accede al listado de todos los CUPS disponibles."
          />
        )}

        {canSeeModule(rol ?? 'cliente', 'contratos') && (
          <ActionCard
            to="/app/contratos"
            title="Contratos"
            description="Revisa los contratos activos y gestiona las renovaciones."
          />
        )}

        {canSeeModule(rol ?? 'cliente', 'documentos') && (
          <ActionCard
            to="/app/documentos"
            title="Documentos"
            description="Busca y descarga facturas, contratos y otros archivos."
          />
        )}
      </div>

      {/* Floating chat widget */}
      {canChat && <ChatWidget />}
    </div>
  );
}
