import { supabase } from '@lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import { useSession } from '@hooks/useSession';
import { FileText, Mail, Phone, MapPin, Zap, ArrowLeft, Loader2, Users, CreditCard, IdCard, UserCircle, UserPlus } from 'lucide-react';
import { formatIBAN } from '@lib/utils';
import { useState } from 'react';
import CrearUsuarioClienteModal from './CrearUsuarioClienteModal';

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
  // Usar la función RPC que descifra los datos sensibles
  const { data: clienteDescifrado, error: rpcError } = await supabase
    .rpc('obtener_cliente_completo', { p_cliente_id: clienteId });

  // Fallback a consulta directa si la RPC falla
  let cliente: any;
  if (rpcError || !clienteDescifrado || clienteDescifrado.error) {
    console.warn('RPC obtener_cliente_completo falló, usando consulta directa:', rpcError);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .is('eliminado_en', null)
      .single();
    if (error) throw error;
    cliente = data;
  } else {
    cliente = clienteDescifrado;
  }

  const { data: puntos } = await supabase
    .from('puntos_suministro')
    .select('p1_kw, p2_kw, p3_kw, p4_kw, p5_kw, p6_kw')
    .eq('cliente_id', clienteId)
    .is('eliminado_en', null);

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
    puntos_count: puntosCount,
    total_kwh: totalKwh,
  } as ClienteDetallado;
}

export default function ClienteDetailLayout() {
  const { id: clienteId } = useParams({ from: clienteDetailRoute.id });
  const location = useLocation();
  const { rol } = useSession();
  const queryClient = useQueryClient();
  const [showCrearUsuarioModal, setShowCrearUsuarioModal] = useState(false);

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => fetchCliente(clienteId),
    enabled: !!clienteId,
  });

  // Verificar si el cliente tiene usuario vinculado
  const { data: contactoCliente } = useQuery({
    queryKey: ['contacto_cliente', clienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contactos_cliente')
        .select('user_id')
        .eq('cliente_id', clienteId)
        .is('eliminado_en', null)
        .maybeSingle();
      return data;
    },
    enabled: !!clienteId,
  });

  const isAdmin = rol === 'administrador';
  const clienteNoTieneUsuario = !contactoCliente;

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/global`, label: 'Global' },
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    ...(rol !== 'comercial' ? [{ path: `${basePath}/contratos`, label: 'Contratos' }] : []),
    { path: `${basePath}/documentos`, label: 'Documentos' },
    { path: `${basePath}/facturas`, label: 'Facturas' },
    ...(rol !== 'comercial' ? [{ path: `${basePath}/actividad`, label: 'Actividad' }] : []),
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
      <button
        onClick={() => {
          if (window.history.length > 2) {
            window.history.back();
          } else {
            window.location.href = '/app/clientes';
          }
        }}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
        title="Volver"
      >
        <ArrowLeft size={18} />
      </button>

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

          {/* Create User Button (admin only) */}
          {isAdmin && (
            <button
              onClick={() => clienteNoTieneUsuario && setShowCrearUsuarioModal(true)}
              disabled={!clienteNoTieneUsuario}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all duration-200 whitespace-nowrap text-sm ${clienteNoTieneUsuario
                ? 'bg-gradient-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white shadow-fenix-500/25 hover:shadow-fenix-500/40 cursor-pointer'
                : 'bg-bg-intermediate text-secondary/50 shadow-none cursor-not-allowed opacity-60'
                }`}
              title={clienteNoTieneUsuario ? 'Crear acceso al portal para este cliente' : 'Este cliente ya tiene un usuario de acceso'}
            >
              <UserPlus size={16} />
              {clienteNoTieneUsuario ? 'Crear Usuario' : 'Usuario Creado'}
            </button>
          )}

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
              replace={true}
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

      {/* Modal Crear Usuario */}
      <CrearUsuarioClienteModal
        clienteId={clienteId}
        clienteNombre={cliente?.nombre || ''}
        open={showCrearUsuarioModal}
        onClose={() => setShowCrearUsuarioModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contacto_cliente', clienteId] });
        }}
      />
    </div>
  );
}


