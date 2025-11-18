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
  // --- (1) Type Assertion Añadida ---
  // Explicitly tell TypeScript the expected shape of the params for this route
  const { id: clienteId } = useParams({ from: clienteDetailRoute.id }) as { id: string }; 
  // --- Fin Modificación (1) ---
  
  const location = useLocation();
  const { rol } = useSession();

  // --- (2) Asegurarse de que clienteId es válido antes de la query ---
  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: (): Promise<ClienteDetallado> => fetchCliente(clienteId),
    enabled: !!clienteId, // Query solo se activa si clienteId es válido
  });
  // --- Fin Modificación (2) ---

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
  ];

  // --- (3) Añadir manejo si clienteId no es válido ---
  if (!clienteId) {
    return <div className="card" role="alert">Error: ID de cliente no encontrado en la URL.</div>;
  }
  // --- Fin Modificación (3) ---

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

  // Renderizado normal para admin/comercial (sin cambios)
  return (
    <div className="grid">
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          {cliente.nombre}
        </h3>
        <div className="profile-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label>{cliente.tipo === 'persona' ? 'DNI' : 'CIF'}</label>
            <p>{cliente.tipo === 'persona' ? (cliente.dni || '—') : (cliente.cif || '—')}</p>
          </div>
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
          <div>
            <label>Email Facturación</label>
            <p>{cliente.email_facturacion || 'No especificado'}</p>
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