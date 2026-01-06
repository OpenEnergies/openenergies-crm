import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import { clsx } from '@lib/utils';
// CAMBIO: Añadido CreditCard a los imports
import { ArrowLeft, User, Phone, Mail, FileText, MapPin, CreditCard } from 'lucide-react';

async function fetchCliente(id: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export default function ClienteDetailLayout() {
  const { id } = useParams({ from: clienteDetailRoute.id });
  const location = useLocation();

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => fetchCliente(id),
    enabled: !!id,
  });

  const basePath = `/app/clientes/${id}`;
  
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
  ];

  const isTabActive = (path: string) => {
      if (path.endsWith('/documentos')) {
          return location.pathname.includes('/documentos');
      }
      return location.pathname === path;
  };

  if (!id) return <div className="card" role="alert">Error: ID de cliente no encontrado.</div>;
  if (isLoading) return <div className="card">Cargando ficha de cliente...</div>;
  if (isError || !cliente) return <div className="card" role="alert">Error al cargar el cliente.</div>;

  return (
    <div className="page-layout">
      <div className="page-header">
         <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/app/clientes" className="icon-button secondary" title="Volver a listado"><ArrowLeft size={20}/></Link>
            <h2 style={{margin:0}}>Ficha del Cliente</h2>
         </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          
          {/* CAMBIO: Eliminado el bloque del Avatar */}
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                {cliente.nombre}
                </h3>
                <span className={`status-dot ${cliente.estado === 'activo' ? 'status-activo' : cliente.estado === 'desistido' ? 'status-desistido' : cliente.estado === 'procesando' ? 'status-procesando' : 'status-standby'}`} 
                      title={cliente.estado || 'stand by'} 
                      style={{ width: 12, height: 12, display: 'inline-block', marginLeft: 8 }}
                ></span>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} /> 
                <span style={{ fontWeight: 500 }}>{cliente.dni || cliente.cif || 'Sin ID'}</span>
              </div>
              
              {(cliente.email_facturacion) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={16} />
                    <a href={`mailto:${cliente.email_facturacion}`} className="hover:underline">{cliente.email_facturacion}</a>
                  </div>
              )}

              {(cliente.telefono || cliente.telefonos) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={16} />
                    <span>{cliente.telefono || cliente.telefonos}</span>
                  </div>
              )}

              {/* CAMBIO: Añadido campo IBAN / Nº Cuenta */}
              {(cliente.numero_cuenta) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={16} />
                    <span style={{ fontFamily: 'monospace' }}>{cliente.numero_cuenta}</span>
                  </div>
              )}
            </div>
          </div>
          
          <Link to={`${basePath}/editar` as unknown as any} className="button secondary small">
            Editar Ficha
          </Link>
        </div>
      </div>

      <div className="tabs-nav">
        {navLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            className={clsx('tab-link', isTabActive(link.path) && 'active')}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Outlet />
      </div>
    </div>
  );
}
