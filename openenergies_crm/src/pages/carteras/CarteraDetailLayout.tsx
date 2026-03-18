import { Link, Outlet, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Edit, Trash2, Users, Zap, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '@components/ConfirmationModal';
import EditarGrupoClienteModal from '../../components/grupos-clientes/EditarGrupoClienteModal';
import {
  getGrupoLogoPublicUrl,
  useEliminarGrupoCliente,
  useGrupoClienteDetail,
} from '@hooks/useGruposClientes';

export default function CarteraDetailLayout() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const location = useLocation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: grupo, isLoading } = useGrupoClienteDetail(id);
  const deleteMutation = useEliminarGrupoCliente();

  const basePath = `/app/carteras-clientes/${id}`;
  const navLinks = useMemo(
    () => [
      { path: `${basePath}/global`, label: 'Global' },
      { path: `${basePath}/sociedades`, label: 'Sociedades' },
      { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
      { path: `${basePath}/contratos`, label: 'Contratos' },
      { path: `${basePath}/facturas`, label: 'Facturas' },
      { path: `${basePath}/actividad`, label: 'Actividad' },
    ],
    [basePath],
  );

  const logoUrl = getGrupoLogoPublicUrl(grupo?.logo_path);

  const handleDelete = async () => {
    if (!grupo) return;
    try {
      await deleteMutation.mutateAsync({ grupoId: grupo.id });
      toast.success('Cartera eliminada correctamente');
      navigate({ to: '/app/carteras-clientes' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar la cartera';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-bg-intermediate/60" />
        <div className="glass-card p-6 h-36" />
        <div className="glass-card p-3 h-12" />
      </div>
    );
  }

  if (!grupo) {
    return (
      <div className="glass-card p-6 text-secondary">
        No se encontro la cartera solicitada.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => {
          if (window.history.length > 2) {
            window.history.back();
            return;
          }
          navigate({ to: '/app/carteras-clientes' });
        }}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fenix-500/20 to-fenix-600/20 flex items-center justify-center overflow-hidden ring-1 ring-fenix-500/20">
              {logoUrl ? (
                <div className="w-full h-full bg-white flex items-center justify-center p-1.5">
                  <img src={logoUrl} alt={grupo.nombre} className="w-full h-full object-contain" />
                </div>
              ) : (
                <BriefcaseBusiness className="w-7 h-7 text-fenix-500" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary truncate">{grupo.nombre}</h1>
              <p className="text-sm text-secondary opacity-80 mt-0.5">{grupo.descripcion || 'Sin descripcion'}</p>
            </div>
          </div>

          <div className="flex gap-4 lg:gap-6">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <Users size={20} className="text-fenix-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{grupo.clientes_count}</p>
                <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Sociedades</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <MapPin size={20} className="text-fenix-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{grupo.puntos_count}</p>
                <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Puntos</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <Zap size={20} className="text-fenix-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{grupo.total_kwh.toLocaleString('es-ES')}</p>
                <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">kWh</p>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-fenix-500/20 to-transparent mt-5" />

        <div className="flex items-center gap-2 mt-4 pt-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
          >
            <Edit size={15} />
            Editar cartera
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
            Eliminar cartera
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-bg-intermediate overflow-x-auto">
        {navLinks.map((link) => {
          const active = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              replace
              className={`px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                active
                  ? 'bg-fenix-500/20 text-fenix-600 dark:text-fourth shadow-sm border-2 border-fenix-500/40'
                  : 'text-secondary hover:text-primary hover:bg-bg-intermediate opacity-80'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <Outlet />

      <EditarGrupoClienteModal isOpen={showEditModal} grupo={grupo} onClose={() => setShowEditModal(false)} />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar cartera"
        message="Esta accion desasignara todas las sociedades de la cartera. ¿Deseas continuar?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}
