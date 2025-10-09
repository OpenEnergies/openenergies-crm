import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import type { Cliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';

async function fetchClientes(filter: string){
  let q = supabase.from('clientes').select('*').limit(100);
  if (filter) {
    // filtro por nombre, dni o cif
    q = q.or(`nombre.ilike.%${filter}%,dni.ilike.%${filter}%,cif.ilike.%${filter}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as Cliente[];
}

export default function ClientesList(){
  const [filter, setFilter] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey:['clientes', filter], queryFn:()=>fetchClientes(filter) });

  return (
    <div className="grid">
      <div className="card">
        <div style={{display:'flex', gap:'.5rem', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap'}}>
          <h2 style={{margin:'0'}}>Clientes</h2>
          <div style={{display:'flex', gap:'.5rem', width:'100%', maxWidth:500}}>
            <input placeholder="Buscar por nombre, DNI o CIF" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtro" />
            <Link to="/app/clientes/nuevo"><button>Nuevo</button></Link>
            <button onClick={()=>refetch()}>Refrescar</button>
          </div>
        </div>
      </div>

      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar clientes.</div>}

      {data && data.length === 0 && (
        <EmptyState title="Sin clientes" description="Empieza creando el primero" cta={<Link to="/app/clientes/nuevo"><button>Crear cliente</button></Link>} />
      )}

      {data && data.length > 0 && (
        <div className="card" role="table" aria-label="Listado de clientes">
          <table className="table">
            <thead><tr><th>Nombre</th><th>DNI/CIF</th><th>Email facturación</th><th>Creado</th><th></th></tr></thead>
            <tbody>
              {data.map(c=>(
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>{c.dni || c.cif || '—'}</td>
                  <td>{c.email_facturacion ?? '—'}</td>
                  <td>{new Date(c.creado_en ?? '').toLocaleDateString('es-ES')}</td>
                  <td><Link to={`/app/puntos?cliente_id=${c.id}` as any}>Puntos</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
