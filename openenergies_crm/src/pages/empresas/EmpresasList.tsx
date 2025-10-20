import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { Pencil } from 'lucide-react';
import { toast } from 'react-hot-toast';

async function fetchEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('creada_en', { ascending: false });

  if (error) throw error;
  return data as Empresa[];
}

export default function EmpresasList() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['empresas'], queryFn: fetchEmpresas });

  return (
    <div className="grid">
      {/* --- CABECERA CON EL ESTILO Y ESPACIADO CORRECTO --- */}
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Gestión de Empresas</h2>
        <div className="page-actions">
          <Link to="/app/empresas/nueva"><button>Nueva Empresa</button></Link>
        </div>
      </div>

      <div className="card">
        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar las empresas.</div>}

        {data && data.length === 0 && !isLoading && (
          <EmptyState 
            title="Sin empresas" 
            description="Aún no hay empresas colaboradoras registradas."
            cta={<Link to="/app/empresas/nueva"><button>Crear la primera</button></Link>}
          />
        )}

        {data && data.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CIF</th>
                  <th>Tipo</th>
                  <th>Creada en</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(e => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td>
                    <td>{e.cif ?? '—'}</td>
                    <td><span className="kbd">{e.tipo}</span></td>
                    <td>{fmtDate(e.creada_en)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {/* --- ENLACE DE EDITAR CON ICONO --- */}
                      <Link 
                        to="/app/empresas/$id" 
                        params={{ id: e.id }} 
                        className="icon-button secondary"
                        title="Editar Empresa"
                      >
                        <Pencil size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}