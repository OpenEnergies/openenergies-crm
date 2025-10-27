// src/pages/dashboard/widgets/ResumenEmpresasWidget.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { Building2, Store, Loader2 } from 'lucide-react'; // Usamos Building2 y Store
import type { Empresa } from '@lib/types';

// Tipo para almacenar los conteos por tipo
type EmpresaSummaryCounts = {
  total: number;
  tipos: Record<Empresa['tipo'], number>;
};

// Función para obtener los conteos de empresas
async function fetchEmpresaSummaryCounts(): Promise<EmpresaSummaryCounts> {
  const { data, error, count } = await supabase
    .from('empresas')
    .select('tipo', { count: 'exact' }); // Pedimos 'tipo' y el conteo total

  if (error) {
    console.error("Error fetching empresa summary counts:", error);
    throw new Error(error.message);
  }

  // Calculamos los conteos por tipo
  const total = count ?? 0;
  const tipos: Record<Empresa['tipo'], number> = {
    openenergies: 0,
    comercializadora: 0,
  };

  data?.forEach(e => {
    if (tipos[e.tipo as Empresa['tipo']] !== undefined) {
      tipos[e.tipo as Empresa['tipo']]++;
    }
  });

  return { total, tipos };
}

// Reutilizamos el KpiCard del ResumenUsuariosWidget (puedes moverlo a /components si lo usas mucho)
function KpiCard({ title, value, icon: Icon, linkTo }: { title: string; value: number | string; icon: React.ElementType; linkTo?: string }) {
  const content = (
     <div style={{ textAlign: 'center' }}>
       <Icon size={28} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
       <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.25rem' }}>{value}</p>
       <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{title}</p>
     </div>
  );

  if (linkTo) {
      return <Link to={linkTo} className="card-link"><div className="card action-card">{content}</div></Link>;
  }
  return <div className="card">{content}</div>;
}

export default function ResumenEmpresasWidget() {
  const { data: counts, isLoading, isError } = useQuery({
    queryKey: ['empresaSummaryCountsDashboard'],
    queryFn: fetchEmpresaSummaryCounts,
    staleTime: 5 * 60 * 1000, // Cachear por 5 minutos
  });

  return (
    <div className="card"> {/* Contenedor principal del widget */}
      <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <Building2 size={20} /> Resumen de Empresas
      </h3>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {isError && (
        <p className="error-text" style={{ textAlign: 'center' }}>Error al cargar resumen.</p>
      )}

      {/* Cuadrícula para las tarjetas KPI */}
      {!isLoading && !isError && counts && (
        // Ajustamos las columnas para que quepan 3 tarjetas cómodamente
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '0.8rem' }}>
          <KpiCard title="Comercializadoras" value={counts.tipos.comercializadora} icon={Store} linkTo="/app/empresas" />
          {/* Mostramos 'Internas' solo si hay alguna */}
          {counts.tipos.openenergies > 0 && (
             <KpiCard title="Internas" value={counts.tipos.openenergies} icon={Building2} linkTo="/app/empresas" />
          )}
        </div>
      )}
    </div>
  );
}