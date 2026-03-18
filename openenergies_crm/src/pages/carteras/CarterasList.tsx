import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { BriefcaseBusiness, Loader2, Plus, Search, Users, Zap } from 'lucide-react';
import { EmptyState } from '@components/EmptyState';
import { useGruposClientes, getGrupoLogoPublicUrl } from '@hooks/useGruposClientes';
import CrearGrupoClienteModal from '@components/grupos-clientes/CrearGrupoClienteModal';

export default function CarterasList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  const { data: grupos = [], isLoading } = useGruposClientes(searchTerm);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <BriefcaseBusiness className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Carteras de clientes</h1>
            <p className="text-sm text-secondary">Gestion de grupos de clientes</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cartera o por sociedad"
              className="glass-input w-full pl-9"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 cursor-pointer"
          >
            <Plus size={16} />
            Nueva cartera
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="glass-card h-44" />
          ))}
        </div>
      )}

      {!isLoading && grupos.length === 0 && (
        <EmptyState
          icon={<BriefcaseBusiness size={40} className="text-fenix-500/60" />}
          title="Sin carteras"
          description={searchTerm ? 'No hay carteras para ese criterio de busqueda.' : 'Crea la primera cartera para agrupar clientes.'}
        />
      )}

      {!isLoading && grupos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {grupos.map((group) => {
            const logoUrl = getGrupoLogoPublicUrl(group.logo_path);
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => navigate({ to: '/app/carteras-clientes/$id', params: { id: group.id } })}
                className="glass-card text-left p-5 hover:ring-2 hover:ring-fenix-500/30 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-bg-intermediate/70 border border-fenix-500/20 flex items-center justify-center overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt={group.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <BriefcaseBusiness className="w-6 h-6 text-fenix-500/60" />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">{group.clientes_count}</div>
                    <div className="text-[11px] uppercase tracking-wider text-secondary font-medium">Sociedades</div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-primary mb-1 line-clamp-1">{group.nombre}</h3>
                <p className="text-sm text-secondary line-clamp-2 min-h-[40px]">{group.descripcion || 'Sin descripcion'}</p>

                <div className="mt-4 pt-3 border-t border-fenix-500/10 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-secondary">
                    <Users size={14} />
                    <span>{group.puntos_count} puntos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary font-mono">
                    <Zap size={14} />
                    <span>{group.total_kwh.toLocaleString('es-ES')} kWh</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CrearGrupoClienteModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(groupId) => navigate({ to: '/app/carteras-clientes/$id', params: { id: groupId } })}
      />
    </div>
  );
}
