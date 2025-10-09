import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import type { Documento } from '@lib/types';
import { Link } from '@tanstack/react-router';

async function fetchDocs() {
  const { data, error } = await supabase.from('documentos').select('*').order('subido_en', { ascending: false }).limit(100);
  if (error) throw error;
  return data as Documento[];
}

async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 5); // 5 min
  if (error) throw error;
  return data.signedUrl;
}

export default function DocumentosList(){
  const { data, isLoading, isError } = useQuery({ queryKey:['documentos'], queryFn: fetchDocs });

  return (
    <div className="grid">
      <div className="card" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2 style={{margin:0}}>Documentos</h2>
        <Link to="/app/documentos/subir"><button>Subir</button></Link>
      </div>

      {isLoading && <div className="card">Cargando…</div>}
      {isError && <div className="card" role="alert">Error al cargar documentos.</div>}

      {data && data.length > 0 && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Archivo</th><th>Tipo</th><th>Tamaño</th><th>Subido</th><th></th></tr></thead>
            <tbody>
              {data.map(d=>(
                <tr key={d.id}>
                  <td>{d.nombre_archivo ?? d.ruta_storage}</td>
                  <td>{d.tipo}</td>
                  <td>{d.tamano_bytes ? Intl.NumberFormat('es-ES').format(d.tamano_bytes) + ' B' : '—'}</td>
                  <td>{d.subido_en ? new Date(d.subido_en).toLocaleString('es-ES') : '—'}</td>
                  <td>
                    <button onClick={async()=>{
                      try {
                        const url = await getSignedUrl(d.ruta_storage);
                        window.open(url, '_blank','noopener');
                      } catch(e:any){ alert(e.message); }
                    }}>Descargar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.length===0 && <div className="card">No hay documentos.</div>}
    </div>
  );
}
