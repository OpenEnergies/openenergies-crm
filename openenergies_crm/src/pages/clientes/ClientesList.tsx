// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import type { Cliente, EstadoCliente } from '@lib/types';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useSession } from '@hooks/useSession';
import { Pencil, MapPin, Building2, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';

type ClienteConEmpresa = Cliente & {
  empresas: {
    nombre: string;
  } | null;
  estado: EstadoCliente;
};

const initialColumnFilters = {
  estado: [] as string[],
};

async function fetchClientes(filter: string) {
  if (!filter) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*, empresas ( nombre ), estado')
      .limit(100)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data as ClienteConEmpresa[];
  }
  const { data, error } = await supabase
    .rpc('search_clientes', { search_text: filter })
    .select('*, empresas ( nombre ), estado')
    .limit(100)
    .order('creado_en', { ascending: false });
  
  if (error) throw error;
  return data as ClienteConEmpresa[];
}

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
  
  const [clienteToDelete, setClienteToDelete] = useState<ClienteConEmpresa | null>(null);
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  const { data, isLoading, isError } = useQuery({ queryKey:['clientes', filter], queryFn:()=>fetchClientes(filter) });
  
  const deleteMutation = useMutation({
    mutationFn: deleteCliente,
    onSuccess: () => {
        toast.success('Cliente y todos sus datos asociados han sido eliminados.');
        setClienteToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error: any) => {
        toast.error(`Error al eliminar el cliente: ${error.message}`);
        setClienteToDelete(null);
    }
  });

  const filterOptions = useMemo(() => {
    return {
      estado: ['stand by', 'procesando', 'activo', 'desistido'] as EstadoCliente[]
    };
  }, []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const displayedData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const estadoItem = item.estado || 'stand by'; // Fallback
      return (
        (columnFilters.estado.length === 0 || columnFilters.estado.includes(estadoItem))
      );
    });
  }, [data, columnFilters]); 

  const canDelete = rol === 'administrador';
  const canEdit = rol === 'administrador' || rol === 'comercial';
  const isFiltered = filter.length > 0 || columnFilters.estado.length > 0;

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>Clientes</h2>
        <Link to="/app/clientes/nuevo"><button>Nuevo Cliente</button></Link>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem', maxWidth: '400px' }}>
          <input 
            placeholder="Buscar por nombre, DNI/CIF o comercializadora" 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
          />
        </div>

        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar clientes.</div>}

        {!isLoading && !isError && data && data.length === 0 && !isFiltered && (
          <EmptyState 
            title="Sin clientes" 
            description="Aún no hay clientes registrados."
            cta={<Link to="/app/clientes/nuevo"><button>Crear el primero</button></Link>}
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className="table-wrapper" role="table" aria-label="Listado de clientes">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>DNI/CIF</th>
                  <th>Email facturación</th>
                  <th>Creado</th>
                  <th>
                    Estado
                    <ColumnFilterDropdown
                      columnName="Estado"
                      options={filterOptions.estado}
                      selectedOptions={columnFilters.estado}
                      onChange={(selected) => handleColumnFilterChange('estado', selected)}
                    />
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              {/* --- CUERPO CORREGIDO --- */}
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(c => ( // Mapea si hay datos filtrados
                    <tr key={c.id}>
                      <td>
                        <Link to="/app/clientes/$id" params={{ id: c.id }} className="table-action-link font-semibold">
                          {c.nombre}
                        </Link>
                      </td>
                      <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Building2 size={16} style={{ color: 'var(--muted)'}} />
                              {c.empresas?.nombre ?? 'No asignada'}
                          </div>
                      </td>
                      <td>{c.dni || c.cif || '—'}</td>
                      <td>{c.email_facturacion ?? '—'}</td>
                      <td>{fmtDate(c.creado_en)}</td>
                      <td>
                        <span 
                          className={`status-dot ${
                            c.estado === 'activo' ? 'status-activo' :
                            c.estado === 'desistido' ? 'status-desistido' :
                            c.estado === 'procesando' ? 'status-procesando' :
                            'status-standby'
                          }`}
                          title={c.estado || 'stand by'}
                        ></span>
                        <span className="status-text">{c.estado || 'stand by'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
                          {canDelete && (
                              <button
                                  className="icon-button danger"
                                  title="Eliminar Cliente"
                                  onClick={() => setClienteToDelete(c)}
                              >
                                  <Trash2 size={18} />
                              </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : ( // Muestra mensaje si NO hay datos filtrados
                  <tr>
                    <td colSpan={7} style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
                      Sin resultados que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* --- FIN CUERPO CORREGIDO --- */}
            </table>
          </div>
        )}
      </div>
      
      {clienteToDelete && (
        <div className="modal-overlay">
            <div className="modal-content card">
                {/* Corregido: Usar clienteToDelete?.nombre */}
                <h3 style={{marginTop: 0}}>Confirmar Eliminación</h3>
                <p>
                    ¿Estás seguro de que quieres eliminar al cliente <strong>{clienteToDelete?.nombre}</strong> de <strong>{clienteToDelete?.empresas?.nombre ?? 'N/A'}</strong>?
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
                        // Corregido: Asegurar que clienteToDelete existe antes de acceder a id
                        onClick={() => clienteToDelete && deleteMutation.mutate({ clienteId: clienteToDelete.id })}
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