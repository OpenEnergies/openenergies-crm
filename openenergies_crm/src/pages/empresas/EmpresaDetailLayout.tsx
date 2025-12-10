import { supabase } from '@lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import type { Empresa } from '@lib/types';
import { clsx } from '@lib/utils';
import { ArrowLeft } from 'lucide-react';

type EmpresaDetallada = Empresa & {
  logo_url?: string | null;
};

// Componente Logo (reutilizado)
function EmpresaLogo({ url, size = 60 }: { url?: string | null; size?: number }) {
  const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="%239ca3af">?</text></svg>';
  return <img src={url ?? placeholder} alt="" width={size} height={size} style={{ objectFit: 'contain', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb' }} onError={(e) => { if (e.currentTarget.src !== placeholder) e.currentTarget.src = placeholder; }} />;
}

async function fetchEmpresa(empresaId: string) {
  const { data: empresaData, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', empresaId)
    .single();

  if (error) throw error;

  const { count, error: countError } = await supabase
    .from('contratos')
    .select('*', { count: 'exact', head: true })
    .eq('comercializadora_id', empresaId)
    .eq('estado', 'activo');
  
  if (countError) console.error("Error contando contratos:", countError);

  return { ...empresaData, activeContracts: count ?? 0 } as EmpresaDetallada & { activeContracts: number };
}

export default function EmpresaDetailLayout() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id }) as { id: string };
  const location = useLocation();

  const { data: empresa, isLoading, isError } = useQuery({
    queryKey: ['empresa', empresaId],
    queryFn: () => fetchEmpresa(empresaId),
    enabled: !!empresaId,
  });

  const basePath = `/app/empresas/${empresaId}`;
  
  const navLinks = [
    { path: `${basePath}/clientes`, label: 'Clientes' },
    { path: `${basePath}/puntos`, label: 'Puntos de Suministro' },
    { path: `${basePath}/contratos`, label: 'Contratos' },
  ];

  if (!empresaId) return <div className="card" role="alert">Error: ID de empresa no encontrado.</div>;
  if (isLoading) return <div className="card">Cargando ficha de empresa...</div>;
  if (isError || !empresa) return <div className="card" role="alert">Error al cargar la empresa.</div>;

  return (
    <div className="grid">
      <div className="page-header">
         <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/app/empresas" className="icon-button secondary"><ArrowLeft size={20}/></Link>
            <h2 style={{margin:0}}>Ficha de Empresa</h2>
         </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <EmpresaLogo url={empresa.logo_url} size={80} />
          
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {empresa.nombre} 
              {empresa.is_archived && <span className="badge inactive">Archivada</span>}
            </h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '0.9rem' }}>
              <div>
                <span style={{ fontWeight: 600 }}>CIF:</span> {empresa.cif || '—'}
              </div>
              {/* CAMBIO: Eliminado el campo "Tipo" */}
              <div>
                <span style={{ fontWeight: 600 }}>Contratos Activos:</span> {empresa.activeContracts}
              </div>
            </div>
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

      <div style={{ marginTop: '1.5rem' }}>
        <Outlet />
      </div>
    </div>
  );
}