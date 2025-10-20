import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { PuntoSuministro } from '@lib/types';
import { Pencil, Trash2 } from 'lucide-react'; // Importa Trash2
import ConfirmationModal from '@components/ConfirmationModal'; // Importa el Modal
import { toast } from 'react-hot-toast'; // Importa toast

type PuntoConCliente = PuntoSuministro & {
  localidad?: string | null;
  provincia?: string | null;
  tipo_factura?: 'Luz' | 'Gas' | null;
  clientes: { nombre: string } | null
};

async function fetchPuntos(filter: string, clienteId?: string): Promise<PuntoConCliente[]> {
  let q = supabase.from('puntos_suministro').select('*, clientes(nombre)').limit(100);
  if (clienteId) {
    q = q.eq('cliente_id', clienteId);
  }
  if (filter) {
    q = q.or(`cups.ilike.%${filter}%,direccion.ilike.%${filter}%,titular.ilike.%${filter}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as (PuntoSuministro & {
    localidad?: string | null;
    provincia?: string | null;
    tipo_factura?: 'Luz' | 'Gas' | null;
    clientes: { nombre: string } | null
  })[];
}

export default function PuntosList({ clienteId }: { clienteId?: string }){
  const [filter, setFilter] = useState('');
  // La clave de la query ahora incluye el clienteId para evitar conflictos de caché
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ 
    queryKey: ['puntos', filter, clienteId], 
    queryFn: () => fetchPuntos(filter, clienteId) 
  });

  const [puntoToDelete, setPuntoToDelete] = useState<PuntoConCliente | null>(null);

  const deletePuntoMutation = useMutation({
    mutationFn: async (puntoId: string) => {
      // Llamamos a la función RPC 'delete_punto_suministro'
      const { error } = await supabase.rpc('delete_punto_suministro', {
        punto_id_to_delete: puntoId // Pasamos el argumento con el nombre correcto
      });
      // Si la función SQL lanzó una EXCEPTION, vendrá en 'error'
      if (error) {
           // Mensaje de error más amigable para FK violation
           const message = error.message.includes('Aún tiene datos asociados')
              ? 'No se pudo borrar: Aún tiene datos asociados (contratos, documentos, etc.).'
              : `Error al eliminar: ${error.message}`;
           throw new Error(message);
      }
    },
    onSuccess: () => {
        toast.success('Punto de Suministro eliminado.');
        setPuntoToDelete(null); // Cierra el modal
        // Invalida la caché para refrescar la lista
        queryClient.invalidateQueries({ queryKey: ['puntos', filter, clienteId] });
    },
    onError: (error: Error) => {
        // Muestra el mensaje de error procesado
        toast.error(error.message);
        setPuntoToDelete(null); // Cierra el modal también en caso de error
    },
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
                  <th>Localidad</th>
                  <th>Provincia</th>
                  <th>Tipo Factura</th>
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
                    <td>{p.localidad ?? '—'}</td>
                    <td>{p.provincia ?? '—'}</td>
                   <td>{p.tipo_factura ?? '—'}</td>
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
                      <button
                         className="icon-button danger"
                         title="Eliminar Punto de Suministro"
                         onClick={() => setPuntoToDelete(p)} // Abre el modal con los datos del punto
                         disabled={deletePuntoMutation.isPending} // Deshabilita mientras borra
                       >
                         <Trash2 size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length === 0 && !isLoading && <div style={{textAlign: 'center', padding: '2rem'}}>Sin resultados.</div>}
      </div>
      {puntoToDelete && (
        <ConfirmationModal
          isOpen={!!puntoToDelete}
          onClose={() => setPuntoToDelete(null)}
          onConfirm={() => {
            if (puntoToDelete) {
              deletePuntoMutation.mutate(puntoToDelete.id);
            }
          }}
          title="Confirmar Eliminación"
          message={`¿Estás seguro de que quieres eliminar el punto de suministro con CUPS "${puntoToDelete.cups}"? Esta acción podría borrar datos asociados (contratos, documentos) y es irreversible.`}
          confirmText="Sí, Eliminar"
          cancelText="Cancelar"
          confirmButtonClass="danger"
          isConfirming={deletePuntoMutation.isPending}
        />
      )}
    </div>
  );
}
