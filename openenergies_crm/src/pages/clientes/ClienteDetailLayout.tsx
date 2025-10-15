import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import type { Cliente } from '@lib/types';
import { clsx } from '@lib/utils';

// Función para obtener los datos de un cliente específico
async function fetchCliente(clienteId: string) {
  const { data, error } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
  if (error) throw error;
  return data as Cliente;
}

export default function ClienteDetailLayout() {
  const { id: clienteId } = useParams({ from: '/app/clientes/$id' });
  const location = useLocation();

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => fetchCliente(clienteId),
  });

  const basePath = `/app/clientes/${clienteId}`;
  const navLinks = [
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
    { path: `${basePath}/documentos`, label: 'Documentos' },
  ];

  if (isLoading) return <div className="card">Cargando ficha del cliente...</div>;
  if (isError) return <div className="card" role="alert">Error al cargar los datos del cliente.</div>;
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  // Si por alguna razón la carga termina pero no tenemos datos de cliente,
  // mostramos un mensaje de error en lugar de intentar renderizar.
  if (!cliente) {
    return <div className="card" role="alert">No se pudo encontrar al cliente.</div>;
  }
  return (
    <div className="grid">
      {/* Aquí podrías añadir los Breadcrumbs en el futuro */}
      <div className="card">
        <h3>{cliente.nombre}</h3>
        <p className="text-muted">{cliente.tipo === 'persona' ? `DNI: ${cliente.dni}` : `CIF: ${cliente.cif}`}</p>
        {/* Aquí podrías mostrar más datos del cliente si quisieras */}
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

      {/* El contenido de cada pestaña se renderizará aquí */}
      <Outlet />
    </div>
  );
}