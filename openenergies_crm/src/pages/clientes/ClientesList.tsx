import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import type { Cliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';

async function fetchClientes(filter: string){
  let q = supabase.from('clientes').select('*').limit(100);
  if (filter) {
    q = q.or(`nombre.ilike.%${filter}%,dni.ilike.%${filter}%,cif.ilike.%${filter}%`);
  }
  const { data, error } = await q.order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Cliente[];
}

export default function ClientesList(){
  const [filter, setFilter] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey:['clientes', filter], queryFn:()=>fetchClientes(filter) });

  return (
    <div className="grid">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: '0' }}>Clientes</h2>
        <Link to="/app/clientes/nuevo"><button>Nuevo Cliente</button></Link>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem', maxWidth: '400px' }}>
          <input 
            placeholder="Buscar por nombre, DNI o CIF..." 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
          />
        </div>

        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar clientes.</div>}

        {data && data.length === 0 && !isLoading && (
          <EmptyState 
            title="Sin clientes" 
            description="Aún no hay clientes registrados que coincidan con tu búsqueda."
            cta={<Link to="/app/clientes/nuevo"><button>Crear el primero</button></Link>}
          />
        )}

        {data && data.length > 0 && (
          <div className="table-wrapper" role="table" aria-label="Listado de clientes">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>DNI/CIF</th>
                  <th>Email facturación</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{c.dni || c.cif || '—'}</td>
                    <td>{c.email_facturacion ?? '—'}</td>
                    <td>{fmtDate(c.creado_en)}</td>
                    <td><Link to={`/app/puntos?cliente_id=${c.id}` as any}>Ver Puntos</Link></td>
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
