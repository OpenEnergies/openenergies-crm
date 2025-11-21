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

        {/* --- GRID DE DATOS (4 Columnas Homogéneas) --- */}
        <div className="profile-grid" style={{ 
            display: 'grid',
            // Forzamos 4 columnas de igual tamaño (25% cada una)
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '1.5rem'
        }}>
          {/* 1. DNI / CIF (Alineado a la izquierda) */}
          <div>
            <label>{cliente.tipo === 'persona' ? 'DNI' : 'CIF'}</label>
            <p>{cliente.tipo === 'persona' ? (cliente.dni || '—') : (cliente.cif || '—')}</p>
          </div>

          {/* 2. Estado (Centro-Izquierda) */}
          <div>
            <label>Estado</label>
            <p style={{ display: 'flex', alignItems: 'center', margin: 0, paddingTop: '0.25rem' }}>
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

          {/* 3. Email Facturación (Centro-Derecha) */}
          <div>
            <label>Email Facturación</label>
            <p>{cliente.email_facturacion || 'No especificado'}</p>
          </div>

          {/* 4. Nº Cuenta (Alineado a la Derecha) */}
          <div style={{ textAlign: 'right' }}>
            <label>Nº Cuenta</label>
            {/* Eliminamos monospace y aplicamos el mismo peso que los demás */}
            <p style={{ 
                fontWeight: 500, 
                fontSize: '1rem',
                margin: 0,
                paddingTop: '0.25rem'
            }}>
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