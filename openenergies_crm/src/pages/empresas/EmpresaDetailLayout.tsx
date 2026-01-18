import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import { Building2, FileText, Users, Zap, ArrowLeft, Pencil, Loader2, Receipt, Activity } from 'lucide-react';
import EmpresaLogo from '@components/EmpresaLogo';

interface EmpresaDetallada {
  id: string;
  nombre: string;
  cif: string | null;
  tipo: 'comercializadora' | 'fenixnewenergy';
  creado_en: string | null;
  logo_url: string | null;
  clientes_count: number;
  puntos_count: number;
  contratos_count: number;
  contratos_activos_count: number;
}

async function fetchEmpresa(empresaId: string): Promise<EmpresaDetallada> {
  const { data: empresa, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', empresaId)
    .is('eliminado_en', null)
    .single();

  if (error) throw error;

  const { count: puntosCount } = await supabase
    .from('puntos_suministro')
    .select('id', { count: 'exact', head: true })
    .eq('current_comercializadora_id', empresaId)
    .is('eliminado_en', null);

  const { count: contratosCount } = await supabase
    .from('contratos')
    .select('id', { count: 'exact', head: true })
    .eq('comercializadora_id', empresaId)
    .is('eliminado_en', null);

  const { count: contratosActivosCount } = await supabase
    .from('contratos')
    .select('id', { count: 'exact', head: true })
    .eq('comercializadora_id', empresaId)
    .not('estado', 'in', '(Baja,Desiste,Bloqueado)')
    .is('eliminado_en', null);

  const { data: clientesData } = await supabase
    .from('puntos_suministro')
    .select('cliente_id')
    .eq('current_comercializadora_id', empresaId)
    .is('eliminado_en', null);

  const uniqueClienteIds = new Set(clientesData?.map(p => p.cliente_id).filter(Boolean));

  return {
    ...empresa,
    clientes_count: uniqueClienteIds.size,
    puntos_count: puntosCount || 0,
    contratos_count: contratosCount || 0,
    contratos_activos_count: contratosActivosCount || 0,
  } as EmpresaDetallada;
}

export default function EmpresaDetailLayout() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
  const location = useLocation();

  const { data: empresa, isLoading, isError } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn: () => fetchEmpresa(empresaId),
    enabled: !!empresaId,
  });

  const basePath = `/app/empresas/${empresaId}`;
  const navLinks = [
    { path: `${basePath}/clientes`, label: 'Clientes' },
    { path: `${basePath}/puntos`, label: 'Puntos' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/facturas`, label: 'Facturas' },
    { path: `${basePath}/actividad`, label: 'Actividad' },
  ];

  if (!empresaId) {
    return (
      <div className="glass-card p-6 text-red-400">
        Error: ID de empresa no encontrado en la URL.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
        <span className="text-secondary opacity-70 font-medium">Cargando ficha de empresa...</span>
      </div>
    );
  }

  if (isError || !empresa) {
    return (
      <div className="glass-card p-6 text-red-400">
        Error al cargar los datos de la empresa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/app/empresas"
        className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors font-medium text-sm"
      >
        <ArrowLeft size={16} />
        Volver a Empresas
      </Link>


      {/* Header Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left: Logo + Name */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <EmpresaLogo
              logoUrl={empresa.logo_url}
              nombre={empresa.nombre}
              size="lg"
            />
            <div>
              <h2 className="text-2xl font-bold text-primary">{empresa.nombre}</h2>
              <p className="text-sm text-secondary opacity-70 mt-0.5 font-medium">
                {empresa.tipo === 'comercializadora' ? 'Comercializadora' : 'Fenix New Energy'}
              </p>
              {empresa.cif && (
                <p className="text-xs text-secondary opacity-50 mt-1 font-mono">
                  CIF: {empresa.cif}
                </p>
              )}
            </div>
          </div>

          {/* Right: Stats Cards + Edit button */}
          <div className="flex flex-col items-end gap-4">
            {/* Edit button */}
            <Link
              to="/app/empresas/$id/editar"
              params={{ id: empresaId }}
              className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors"
              title="Editar empresa"
            >
              <Pencil size={18} />
            </Link>

            {/* Stats Cards */}
            <div className="flex flex-wrap gap-3 justify-end">
              {/* Contratos Activos */}
              {/* Contratos Activos */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                  <FileText size={16} className="text-fenix-600 dark:text-fenix-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{empresa.contratos_activos_count}</p>
                  <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Contratos Activos</p>
                </div>
              </div>

              {/* Clientes */}
              {/* Clientes */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                  <Users size={16} className="text-fenix-600 dark:text-fenix-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{empresa.clientes_count}</p>
                  <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Cliente{empresa.clientes_count === 1 ? '' : 's'}</p>
                </div>
              </div>

              {/* Puntos */}
              {/* Puntos */}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                  <Zap size={16} className="text-fenix-600 dark:text-fenix-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-primary">{empresa.puntos_count}</p>
                  <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Punto{empresa.puntos_count === 1 ? '' : 's'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - iOS Style */}
      <div className="flex gap-2 p-1 rounded-xl bg-bg-intermediate overflow-x-auto">
        {navLinks.map(link => {
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`
                px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200
                ${isActive
                  ? 'bg-fenix-500/20 text-fenix-600 dark:text-fourth shadow-sm'
                  : 'text-secondary hover:text-primary hover:bg-bg-intermediate opacity-70 hover:opacity-100'}
              `}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Tab Content */}
      <Outlet />
    </div>
  );
}


