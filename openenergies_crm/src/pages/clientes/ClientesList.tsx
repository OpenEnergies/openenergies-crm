// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Imports añadidos
import { supabase } from '@lib/supabase';
import type { Cliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Pencil, MapPin, Building2, Trash2 } from 'lucide-react'; // Icono de papelera añadido

type ClienteConEmpresa = Cliente & {
  empresas: {
    nombre: string;
  } | null;
};

async function fetchClientes(filter: string){
  let q = supabase.from('clientes').select('*, empresas ( nombre )').limit(100);
  if (filter) {
    q = q.or(`nombre.ilike.%${filter}%,dni.ilike.%${filter}%,cif.ilike.%${filter}%`);
  }
  const { data, error } = await q.order('creado_en', { ascending: false });
  if (error) throw error;
  return data as ClienteConEmpresa[];
}

// --- NUEVA FUNCIÓN DE BORRADO ---
// Llama a la nueva Edge Function 'manage-client' que has creado.
async function deleteCliente({ clienteId }: { clienteId: string }) {
    const { error } = await supabase.functions.invoke('manage-client', {
        body: { action: 'delete', payload: { clienteId } }
    });
    if (error) throw new Error(error.message);
}

export default function ClientesList(){
  const { rol } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  
  // --- ESTADO PARA EL MODAL (igual que en UsuariosList) ---
  const [clienteToDelete, setClienteToDelete] = useState<ClienteConEmpresa | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey:['clientes', filter], queryFn:()=>fetchClientes(filter) });
  
  // --- MUTACIÓN PARA ELIMINAR (igual que en UsuariosList) ---
  const deleteMutation = useMutation({
    mutationFn: deleteCliente,
    onSuccess: () => {
        alert('Cliente y todos sus datos asociados han sido eliminados.');
        setClienteToDelete(null); // Cierra el modal
        queryClient.invalidateQueries({ queryKey: ['clientes'] }); // Refresca la lista
    },
    onError: (error: any) => {
        alert(`Error al eliminar el cliente: ${error.message}`);
        setClienteToDelete(null); // Cierra el modal también en caso de error
    }
  });

  // Lógica de permisos (solo el admin puede borrar)
  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';

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
                  <th>Empresa</th>
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
                    {/* --- CAMBIO #5: Mostramos el nombre de la empresa --- */}
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={16} style={{ color: 'var(--muted)'}} />
                            {c.empresas?.nombre ?? 'No asignada'}
                        </div>
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
                            to="/app/clientes/$id/editar" 
                            params={{ id: c.id }} 
                            className="icon-button secondary"
                            title="Editar Cliente"
                          >
                            <Pencil size={18} />
                          </Link>
                        )}
                        {/* --- BOTÓN DE BORRADO AÑADIDO --- */}
                        {canDelete && (
                            <button
                                className="icon-button danger"
                                title="Eliminar Cliente"
                                onClick={() => setClienteToDelete(c)} // Guarda el cliente y abre el modal
                            >
                                <Trash2 size={18} />
                            </button>
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
      {/* --- MODAL DE CONFIRMACIÓN AÑADIDO (igual que en UsuariosList) --- */}
      {clienteToDelete && (
        <div className="modal-overlay">
            <div className="modal-content card">
                <h3 style={{marginTop: 0}}>Confirmar Eliminación</h3>
                <p>
                    ¿Estás seguro de que quieres eliminar al cliente <strong>{clienteToDelete.nombre}</strong> de <strong>{clienteToDelete.empresas?.nombre ?? 'N/A'}</strong>?
                    <br />
                    <span style={{color: '#b91c1c', fontWeight: 'bold'}}>
                        Se borrará tanto el cliente como todos sus puntos de suministro, contratos y documentos.
                    </span>
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button className="secondary" onClick={() => setClienteToDelete(null)}>
                        Cancelar
                    </button>
                    <button 
                        className="danger" 
                        onClick={() => deleteMutation.mutate({ clienteId: clienteToDelete.id })}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
