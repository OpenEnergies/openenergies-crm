import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro } from '@lib/types';
import { Pencil } from 'lucide-react';

async function fetchPuntos(filter: string, clienteId?: string){
  let q = supabase.from('puntos_suministro').select('*, clientes(nombre)').limit(100);
  if (clienteId) {
    q = q.eq('cliente_id', clienteId);
  }
  if (filter) {
    q = q.or(`cups.ilike.%${filter}%,direccion.ilike.%${filter}%,titular.ilike.%${filter}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as (PuntoSuministro & { clientes: { nombre:string } | null })[];
}

export default function PuntosList({ clienteId }: { clienteId?: string }){
  const [filter, setFilter] = useState('');
  // La clave de la query ahora incluye el clienteId para evitar conflictos de caché
  const { data, isLoading, isError } = useQuery({ 
    queryKey: ['puntos', filter, clienteId], 
    queryFn: () => fetchPuntos(filter, clienteId) 
  });

  return (
    <div className="grid">
      {/* --- CABECERA CON ESTILO Y ESPACIADO --- */}
      {!clienteId && (
      <div className="page-header">
        <h2 style={{margin:'0'}}>Puntos de suministro</h2>
        <div className="page-actions" style={{width: '100%', maxWidth: 500}}>
          <input 
            placeholder="CUPS, dirección o titular" 
            value={filter} 
            onChange={e=>setFilter(e.target.value)} 
            aria-label="Filtro" 
          />
          <Link to="/app/puntos/nuevo"><button>Nuevo</button></Link>
        </div>
      </div>
      )}

      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar puntos.</div>}
      
      <div className="card">
        {data && data.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Titular</th>
                  <th>Cliente</th>
                  <th>CUPS</th>
                  <th>Dirección</th>
                  <th>Tarifa</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p => (
                  <tr key={p.id}>
                    <td>{p.titular}</td>
                    <td>{p.clientes?.nombre ?? '—'}</td>
                    <td>{p.cups}</td>
                    <td>{p.direccion}</td>
                    <td><span className="kbd">{p.tarifa_acceso}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {/* --- ACCIÓN CON ICONO --- */}
                      <Link 
                        to={`/app/puntos/$id`} 
                        params={{ id: p.id }}
                        className="icon-button secondary"
                        title="Editar Punto de Suministro"
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
        {data && data.length === 0 && !isLoading && <div style={{textAlign: 'center', padding: '2rem'}}>Sin resultados.</div>}
      </div>
    </div>
  );
}
