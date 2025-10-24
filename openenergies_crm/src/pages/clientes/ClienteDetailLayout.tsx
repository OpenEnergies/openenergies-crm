import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
// Importamos el tipo base 'Cliente'
import type { Cliente, EstadoCliente } from '@lib/types'; 
import { clsx } from '@lib/utils';

// --- (1) Creamos un tipo local para los datos detallados que queremos ---
type ClienteDetallado = Cliente & {
  empresas: { nombre: string } | null;
  estado: EstadoCliente; // Aseguramos el tipo de estado
};

// --- (2) Actualizamos la función de fetch ---
async function fetchCliente(clienteId: string) {
  const { data, error } = await supabase
    .from('clientes')
    // Pedimos el nombre de la empresa relacionada
    .select('*, empresas(nombre), estado') 
    .eq('id', clienteId)
    .single();
    
  if (error) throw error;
  // Hacemos cast al nuevo tipo
  return data as ClienteDetallado; 
}

export default function ClienteDetailLayout() {
  const { id: clienteId } = useParams({ from: '/app/clientes/$id' });
  const location = useLocation();

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    // --- (3) La queryFn ahora usa el tipo ClienteDetallado ---
    queryFn: (): Promise<ClienteDetallado> => fetchCliente(clienteId), 
  });

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
  ];

  if (isLoading) return <div className="card">Cargando ficha del cliente...</div>;
  if (isError) return <div className="card" role="alert">Error al cargar los datos del cliente.</div>;
  if (!cliente) {
    return <div className="card" role="alert">No se pudo encontrar al cliente.</div>;
  }
  
  // --- (4) Tarjeta de cabecera rediseñada ---
  return (
    <div className="grid">
      <div className="card">
        {/* Título principal */}
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          {cliente.nombre}
        </h3>
        
        {/* Grid de datos (usando el estilo de .profile-grid de styles.css) */}
        <div className="profile-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label>{cliente.tipo === 'persona' ? 'DNI' : 'CIF'}</label>
            <p>{cliente.tipo === 'persona' ? (cliente.dni || '—') : (cliente.cif || '—')}</p>
          </div>
          <div>
            <label>Estado</label>
            {/* Usamos un <p> para alinear con los otros campos del grid */}
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
            <label>Empresa Propietaria</label>
            <p>{cliente.empresas?.nombre ?? 'No asignada'}</p>
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