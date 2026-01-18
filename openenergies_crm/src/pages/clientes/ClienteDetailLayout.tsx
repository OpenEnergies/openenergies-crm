import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import { useSession } from '@hooks/useSession';
import { FileText, Mail, Phone, MapPin, Zap, ArrowLeft, Loader2, Users, CreditCard, IdCard, UserCircle } from 'lucide-react';
import { formatIBAN } from '@lib/utils';

interface ClienteDetallado {
  id: string;
  nombre: string;
  tipo: 'Persona fisica' | 'Persona juridica';
  dni: string | null;
  cif: string | null;
  email: string | null;
  telefonos: string | null;
  numero_cuenta: string | null;
  representante: string | null;
  creado_en: string;
  puntos_count: number;
  total_kwh: number;
}

async function fetchCliente(clienteId: string): Promise<ClienteDetallado> {
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .is('eliminado_en', null)
    .single();

  if (error) throw error;

  const { data: puntos } = await supabase
    .from('puntos_suministro')
    .select('p1_kw, p2_kw, p3_kw, p4_kw, p5_kw, p6_kw')
    .eq('cliente_id', clienteId)
    .is('eliminado_en', null);

  // Obtener IBAN real desde vault (desencriptado para admins)
  let ibanReal = cliente.numero_cuenta;
  try {
    const { data: ibanVault } = await supabase.rpc('obtener_iban_vault', { p_cliente_id: clienteId });
    if (ibanVault) {
      ibanReal = ibanVault;
    }
  } catch (e) {
    console.warn('No se pudo obtener IBAN del vault:', e);
  }

  const puntosCount = puntos?.length || 0;
  const totalKwh = (puntos || []).reduce((acc, p) => {
    return acc +
      (Number(p.p1_kw) || 0) +
      (Number(p.p2_kw) || 0) +
      (Number(p.p3_kw) || 0) +
      (Number(p.p4_kw) || 0) +
      (Number(p.p5_kw) || 0) +
      (Number(p.p6_kw) || 0);
  }, 0);

  return {
    ...cliente,
    numero_cuenta: ibanReal,
    puntos_count: puntosCount,
    total_kwh: totalKwh,
  } as ClienteDetallado;
}

export default function ClienteDetailLayout() {
  const { id: clienteId } = useParams({ from: clienteDetailRoute.id });
  const location = useLocation();
  const { rol } = useSession();

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => fetchCliente(clienteId),
    enabled: !!clienteId,
  });

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
    { path: `${basePath}/facturas`, label: 'Facturas' },
    { path: `${basePath}/actividad`, label: 'Actividad' },
  ];

  if (!clienteId) {
    return (
      <div className="glass-card p-6 text-red-400" role="alert">
        Error: ID de cliente no encontrado en la URL.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card p-6 text-red-400" role="alert">
        Error al cargar los datos del cliente.
      </div>
    );
  }

  if (rol === 'cliente') {
    return (
      <div className="space-y-6">
        <Outlet />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="glass-card p-6 text-red-400" role="alert">
        No se pudo encontrar al cliente con ID: {clienteId}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/app/clientes"
        className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors font-medium"
      >
        <ArrowLeft size={16} />
        Volver a Clientes
      </Link>

      {/* Client Header */}
      <div className="glass-card p-6">
        {/* Main Info Row */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: Icon + Name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fenix-500/20 to-fenix-600/20 flex items-center justify-center shrink-0 ring-1 ring-fenix-500/20">
              <Users className="w-7 h-7 text-fenix-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary truncate">{cliente.nombre}</h1>
              <p className="text-sm text-secondary opacity-70 mt-0.5 font-medium">
                {cliente.dni || cliente.cif || 'Sin identificador'}
              </p>
            </div>
          </div>

          {/* Center: Stats Cards */}
          <div className="flex gap-4 lg:gap-6">
            {/* Puntos */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <MapPin size={20} className="text-fenix-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{cliente.puntos_count}</p>
                <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">Puntos</p>
              </div>
            </div>

            {/* kWh */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-fenix-500/10 border-2 border-fenix-500/20 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                <Zap size={20} className="text-fenix-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{cliente.total_kwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-fenix-600 dark:text-fenix-400 font-bold uppercase tracking-wider">kWh</p>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-fenix-500/20 to-transparent mt-5" />

        {/* Contact Info Row */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4 pt-2">
          {/* DNI o CIF */}
          {(cliente.dni || cliente.cif) && (
            <div className="flex items-center gap-2 text-sm">
              <IdCard size={14} className="text-secondary opacity-60" />
              <span className="text-secondary opacity-70 font-medium">
                {cliente.tipo === 'Persona fisica' ? 'DNI:' : 'CIF:'}
              </span>
              <span className="text-primary font-bold">
                {cliente.dni || cliente.cif}
              </span>
            </div>
          )}

          {/* Email */}
          {cliente.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-secondary opacity-70" />
              <a
                href={`mailto:${cliente.email}`}
                className="text-fenix-600 dark:text-fourth font-bold hover:underline transition-colors"
              >
                {cliente.email}
              </a>
            </div>
          )}

          {/* Teléfonos */}
          {cliente.telefonos && (
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-secondary opacity-70" />
              <span className="text-primary font-bold">
                {cliente.telefonos.split(' / ').join(' / ')}
              </span>
            </div>
          )}

          {/* Número de cuenta (IBAN) */}
          {cliente.numero_cuenta && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard size={14} className="text-secondary opacity-70" />
              <span className="text-secondary opacity-70 font-medium">IBAN:</span>
              <span className="text-primary font-mono font-bold">
                {formatIBAN(cliente.numero_cuenta)}
              </span>
            </div>
          )}

          {/* Representante */}
          {cliente.representante && (
            <div className="flex items-center gap-2 text-sm">
              <UserCircle size={14} className="text-secondary opacity-60" />
              <span className="text-secondary opacity-70 font-medium">Representante:</span>
              <span className="text-primary font-medium">
                {cliente.representante}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation - iOS Style */}
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
                  ? 'bg-fenix-500/20 text-fenix-600 dark:text-fourth shadow-sm border-2 border-fenix-500/40'
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


