import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import type { Documento } from '@lib/types';
import { Link } from '@tanstack/react-router';
// Importamos el icono de descarga
import { Download } from 'lucide-react';
import { useSession } from '@hooks/useSession';

async function fetchDocs() {
  const { data, error } = await supabase.from('documentos').select('*, clientes(nombre)').order('subido_en', { ascending: false }).limit(100);
  if (error) throw error;
  return data as (Documento & { clientes: { nombre: string } | null })[];
}

async function getSignedUrl(path: string) {
  
  // 5 minutos de validez para el enlace
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export default function DocumentosList(){
  const { rol } = useSession();
  const { data, isLoading, isError } = useQuery({ queryKey:['documentos'], queryFn: fetchDocs });

  const canUpload = rol === 'administrador' || rol === 'comercializadora' || rol === 'comercial';

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{margin:0}}>Documentos</h2>
        <div className="page-actions">
          {/* --- 4. MUESTRA EL BOTÓN SOLO SI SE CUMPLE LA CONDICIÓN --- */}
          {canUpload && (
            <Link to="/app/documentos/subir"><button>Subir Documento</button></Link>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar documentos.</div>}
        
        {data && data.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th>Subido</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.id}>
                    <td>{d.nombre_archivo ?? d.ruta_storage}</td>
                    <td>{d.clientes?.nombre ?? 'N/A'}</td>
                    <td>{d.tipo}</td>
                    <td>{d.tamano_bytes ? `${(d.tamano_bytes / 1024).toFixed(2)} KB` : '—'}</td>
                    <td>{d.subido_en ? new Date(d.subido_en).toLocaleString('es-ES') : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="icon-button secondary" 
                        title="Descargar documento"
                        onClick={async () => {
                          try {
                            const url = await getSignedUrl(d.ruta_storage);
                            window.open(url, '_blank', 'noopener');
                          } catch (e: any) { alert(e.message); }
                        }}
                      >
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length === 0 && !isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>No hay documentos.</div>}
      </div>
    </div>
  );
}