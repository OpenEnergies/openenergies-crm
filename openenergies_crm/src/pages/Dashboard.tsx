import { useSession } from '@hooks/useSession';
import { Link } from '@tanstack/react-router';

// Un pequeño componente para las tarjetas de acción
function ActionCard({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link to={to} className="card-link">
      <div className="card action-card">
        <h3>{title} &rarr;</h3>
        <p>{description}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { rol, nombre } = useSession();

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

      <div className="dashboard-grid">
        {/* Mostramos tarjetas según el rol del usuario */}
        {(rol === 'administrador' || rol === 'comercializadora') && (
          <ActionCard
            to="/app/usuarios"
            title="Gestionar Usuarios"
            description="Invita, edita y gestiona los accesos de tu equipo."
          />
        )}
        
        {(rol === 'administrador' || rol === 'comercializadora' || rol === 'comercial') && (
          <ActionCard
            to="/app/clientes"
            title="Ver Clientes"
            description="Consulta y administra tu cartera de clientes."
          />
        )}

        <ActionCard
          to="/app/puntos"
          title="Puntos de Suministro"
          description="Accede al listado de todos los CUPS disponibles."
        />

        <ActionCard
          to="/app/contratos"
          title="Contratos"
          description="Revisa los contratos activos y gestiona las renovaciones."
        />

        <ActionCard
          to="/app/documentos"
          title="Documentos"
          description="Busca y descarga facturas, contratos y otros archivos."
        />
      </div>
    </div>
  );
}
