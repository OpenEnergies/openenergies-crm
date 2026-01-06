// src/pages/Dashboard.tsx
import { useSession } from '@hooks/useSession';
import ProximosEventosWidget from './dashboard/widgets/ProximosEventosWidget';
import ContratosPorVencerWidget from './dashboard/widgets/ContratosPorVencerWidget';
import UltimosClientesWidget from './dashboard/widgets/UltimosClientesWidget';
import ResumenUsuariosWidget from './dashboard/widgets/ResumenUsuariosWidget';
import ResumenEmpresasWidget from './dashboard/widgets/ResumenEmpresasWidget';
import MisClientesAsignadosWidget from './dashboard/widgets/MisClientesAsignadosWidget';
import EstadoMisClientesWidget from './dashboard/widgets/EstadoMisClientesWidget';

export default function Dashboard() {
  const { rol, nombre, apellidos } = useSession();

  // --- VISIBILIDAD DE WIDGETS ---
  const isAdmin = rol === 'administrador';
  const isComercial = rol === 'comercial';
  const canSeeAgendaWidget = isAdmin || isComercial;
  const canSeeRenovacionesWidget = isAdmin;
  const canSeeClientesWidget = isAdmin;
  const canSeeUsuariosWidget = isAdmin;
  const canSeeEmpresasWidget = isAdmin;
  const canSeeMisClientesWidget = isComercial;
  const canSeeEstadoMisClientesWidget = isComercial;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fenix-500">
            {nombre ? `Bienvenido, ${nombre}${apellidos ? ` ${apellidos}` : ''}` : 'Bienvenido'}
          </h1>
          <p className="text-fenix-500/70 text-sm sm:text-base">
            Gestiona tus clientes, contratos y documentos desde un único lugar.
          </p>
        </div>
      </div>

      {/* Main Widgets Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {/* Agenda Widget */}
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

        {/* Estado Mis Clientes (comercial) */}
        {canSeeEstadoMisClientesWidget && (
          <EstadoMisClientesWidget />
        )}
      </div>
    </div>
  );
}