import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { fmtDate } from '@lib/utils';
import { Pencil } from 'lucide-react';
import { useSession } from '@hooks/useSession';
import { toast } from 'react-hot-toast';

async function fetchContratos(clienteId?: string){
  let query = supabase
    .from('contratos')
    .select('*, puntos_suministro!inner(cups, cliente_id), empresas!contratos_comercializadora_id_fkey(nombre)')
    .limit(100);
  if (clienteId) {
    query = query.eq('puntos_suministro.cliente_id', clienteId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as (Contrato & { puntos_suministro: { cups:string } | null, empresas: { nombre:string } | null })[];
}

export default function ContratosList({ clienteId }: { clienteId?: string }){
  const { rol } = useSession();
  const { data, isLoading, isError } = useQuery({ 
    queryKey:['contratos', clienteId], 
    queryFn: () => fetchContratos(clienteId) 
  });

  const canEdit = rol === 'administrador' || rol === 'comercial';

  return (
    <div className="grid">
      {/* --- CABECERA CON ESTILO Y ESPACIADO --- */}
      {!clienteId && (
        <div className="page-header">
          <h2 style={{margin:0}}>Contratos</h2>
          <div className="page-actions">
            <Link to="/app/contratos/nuevo"><button>Nuevo</button></Link>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando…</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar contratos.</div>}

        {data && data.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Comercializadora</th>
                  <th>Oferta</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Aviso</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td>{c.puntos_suministro?.cups ?? '—'}</td>
                    <td>{c.empresas?.nombre ?? '—'}</td>
                    <td>{c.oferta ?? '—'}</td>
                    <td>{fmtDate(c.fecha_inicio)}</td>
                    <td>{fmtDate(c.fecha_fin)}</td>
                    <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {/* --- ACCIÓN CON ICONO --- */}
                      {canEdit && (
                        <Link 
                          to="/app/contratos/$id" 
                          params={{ id: c.id }}
                          className="icon-button secondary"
                          title="Editar Contrato"
                        >
                          <Pencil size={18} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length === 0 && !isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Sin resultados.</div>}
      </div>
    </div>
  );
}
