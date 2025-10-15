import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import type { Cliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Pencil, MapPin } from 'lucide-react';
import { clsx } from '@lib/utils';

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
  const { rol } = useSession();
  const [filter, setFilter] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey:['clientes', filter], queryFn:()=>fetchClientes(filter) });
  // Determinamos si el usuario actual puede editar clientes
  const canEdit = rol === 'administrador' || rol === 'comercializadora' || rol === 'comercial';

  return (
    <div className="grid">
      {/* --- CABECERA CON EL ESPACIADO CORRECTO --- */}
      <div className="page-header">
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
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link to="/app/clientes/$id" params={{ id: c.id }} className="table-action-link font-semibold">
                        {c.nombre}
                      </Link>
                    </td>
                    <td>{c.dni || c.cif || '—'}</td>
                    <td>{c.email_facturacion ?? '—'}</td>
                    <td>{fmtDate(c.creado_en)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {/* --- ACCIONES CON ICONOS --- */}
                      <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                        <Link 
                            to="/app/puntos" 
                            search={{ cliente_id: c.id }} 
                            className="icon-button secondary"
                            title="Ver Puntos de Suministro"
                        >
                          <MapPin size={18} />
                        </Link>
                        {canEdit && (
                          <Link 
                            to="/app/clientes/$id" 
                            params={{ id: c.id }} 
                            className="icon-button secondary"
                            title="Editar Cliente"
                          >
                            <Pencil size={18} />
                          </Link>
                        )}
                      </div>
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
