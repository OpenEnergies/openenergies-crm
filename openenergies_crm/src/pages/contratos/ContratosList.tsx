import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { fmtDate } from '@lib/utils';

async function fetchContratos(){
  const { data, error } = await supabase
    .from('contratos')
    .select('*, puntos_suministro(cups), empresas!contratos_comercializadora_id_fkey(nombre)')
    .limit(100);
  if (error) throw error;
  return data as (Contrato & { puntos_suministro: { cups:string } | null, empresas: { nombre:string } | null })[];
}

export default function ContratosList(){
  const { data, isLoading, isError } = useQuery({ queryKey:['contratos'], queryFn: fetchContratos });

  return (
    <div className="grid">
      <div className="card" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2 style={{margin:0}}>Contratos</h2>
        <Link to="/app/contratos/nuevo"><button>Nuevo</button></Link>
      </div>

      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar contratos.</div>}

      {data && data.length>0 && (
        <div className="card">
          <table className="table">
            <thead><tr><th>CUPS</th><th>Comercializadora</th><th>Oferta</th><th>Inicio</th><th>Fin</th><th>Aviso</th><th></th></tr></thead>
            <tbody>
              {data.map(c=>(
                <tr key={c.id}>
                  <td>{c.puntos_suministro?.cups ?? '—'}</td>
                  <td>{c.empresas?.nombre ?? '—'}</td>
                  <td>{c.oferta ?? '—'}</td>
                  <td>{fmtDate(c.fecha_inicio)}</td>
                  <td>{fmtDate(c.fecha_fin)}</td>
                  <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                  <td><Link to={`/app/contratos/${c.id}` as any}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.length===0 && <div className="card">Sin resultados.</div>}
    </div>
  );
}
