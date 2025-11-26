// src/pages/clientes/ClienteDetailLayout.tsx
import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import type { Cliente, EstadoCliente } from '@lib/types';
import { clsx } from '@lib/utils';
import { useSession } from '@hooks/useSession';

type ClienteDetallado = Cliente & {
  estado: EstadoCliente;
};

async function fetchCliente(clienteId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*, estado')
    .eq('id', clienteId)
    .single();

  if (error) throw error;
  return data as ClienteDetallado;
}

export default function ClienteDetailLayout() {
  const { id: clienteId } = useParams({ from: clienteDetailRoute.id }) as { id: string };
  const location = useLocation();
  const { rol } = useSession();

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: (): Promise<ClienteDetallado> => fetchCliente(clienteId),
    enabled: !!clienteId,
  });

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
  ];

  const renderTelefonos = (rawString: string | null | undefined) => {
    if (!rawString) return 'No especificado';
    const parts = rawString.split('/').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return 'No especificado';
    return parts.join(' - ');
  };

  if (!clienteId) {
    return <div className="card" role="alert">Error: ID de cliente no encontrado en la URL.</div>;
  }

  if (isLoading) return <div className="card">Cargando ficha del cliente...</div>;
  if (isError) return <div className="card" role="alert">Error al cargar los datos del cliente.</div>;

  if (rol === 'cliente') {
    return (
      <div className="grid">
        <Outlet />
      </div>
    );
  }

  if (!cliente) {
    return <div className="card" role="alert">No se pudo encontrar al cliente con ID: {clienteId}.</div>;
  }

  return (
    <div className="grid">
      <div className="card">
        {/* --- CABECERA --- */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 0,
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h3 style={{ margin: 0 }}>
            {cliente.nombre}
          </h3>

          <span style={{
            fontSize: '1rem',
            fontWeight: 500,
            color: 'var(--fg)',
          }}>
            {cliente.representante || <span style={{color: 'var(--muted)'}}>(Sin representante)</span>}
          </span>
        </div>

        {/* --- GRID DE DATOS --- */}
        <div className="profile-grid" style={{ 
            display: 'grid',
            // CAMBIO: Usamos proporciones personalizadas en lugar de 5 columnas iguales.
            // 0.8fr para CIF y Estado (pequeños)
            // 2fr para Email (grande, evita cortes)
            // 1.2fr para Teléfono y Cuenta (medianos)
            gridTemplateColumns: '0.8fr 0.8fr 2fr 1.2fr 1.2fr', 
            gap: '1rem', // Reducido un poco el gap para dar más espacio al contenido
            alignItems: 'start',
            width: '100%' // Asegura que ocupe todo el ancho disponible
        }}>
          {/* 1. DNI / CIF */}
          <div style={{ textAlign: 'center' }}>
            <label>{cliente.tipo === 'persona' ? 'DNI' : 'CIF'}</label>
            <p>{cliente.tipo === 'persona' ? (cliente.dni || '—') : (cliente.cif || '—')}</p>
          </div>

          {/* 2. Estado */}
          <div style={{ textAlign: 'center' }}>
            <label>Estado</label>
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
              <span
                className={`status-dot ${
                  cliente.estado === 'activo' ? 'status-activo' :
                  cliente.estado === 'desistido' ? 'status-desistido' :
                  cliente.estado === 'procesando' ? 'status-procesando' :
                  'status-standby'
                }`}
              ></span>
              <span className="status-text">{cliente.estado || 'stand by'}</span>
            </p>
          </div>

          {/* 3. Email Facturación (Columna más ancha) */}
          <div style={{ textAlign: 'center' }}>
            <label>Email Facturación</label>
            <p style={{ wordBreak: 'break-word' }}>{cliente.email_facturacion || 'No especificado'}</p>
          </div>

          {/* 4. Teléfonos */}
          <div style={{ textAlign: 'center' }}>
            <label>Teléfono (s)</label>
            <div style={{ fontWeight: 500, fontSize: '1rem' }}>
              {renderTelefonos(cliente.telefonos)}
            </div>
          </div>

          {/* 5. Nº Cuenta */}
          <div style={{ textAlign: 'center' }}>
            <label>Nº Cuenta</label>
            <p style={{ fontWeight: 500, fontSize: '1rem', margin: 0 }}>
               {cliente.numero_cuenta || 'No especificado'}
            </p>
          </div>
        </div>
      </div>

      <div className="tabs-nav">
        {navLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={clsx('tab-link', location.pathname.startsWith(link.path) && 'active')}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}