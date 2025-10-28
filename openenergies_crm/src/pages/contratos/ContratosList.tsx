import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import type { Contrato } from '@lib/types';
import { Pencil, Trash2, BadgePlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { toast } from 'react-hot-toast';
import { fmtDate } from '@lib/utils';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { useSortableTable } from '@hooks/useSortableTable';

type ContratoExtendido = Contrato & {
  puntos_suministro: { cups: string; direccion: string; clientes: { nombre: string } | null; } | null;
  empresas: { nombre: string } | null;
};

// Incluye claves reales y virtuales para datos anidados
type SortableContratoKey = keyof ContratoExtendido | 'cups' | 'comercializadora_nombre';

const initialColumnFilters = {
  fecha_inicio: { year: null, month: null, day: null } as DateParts,
  fecha_fin: { year: null, month: null, day: null } as DateParts,
  aviso_renovacion: [] as string[],
};

async function fetchContratos(filter: string, clienteId?: string): Promise<ContratoExtendido[]> {
    const selectQuery = `*, puntos_suministro ( cups, direccion, clientes ( nombre ) ), empresas ( nombre )`;

    // Usamos SIEMPRE la función RPC. 
    // Está preparada para manejar un search_text vacío Y el p_cliente_id correctamente.
    const { data, error } = await supabase.rpc('search_contratos', { 
        search_text: filter, 
        p_cliente_id: clienteId || null 
    }).select(selectQuery).order('fecha_inicio', { ascending: false }).limit(100);
    
    if (error) throw error;
    return data as ContratoExtendido[];
}

export default function ContratosList({ clienteId }: { clienteId?: string }){
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const queryClient = useQueryClient();

  const { rol } = useSession();

  const { data: fetchedData, isLoading, isError } = useQuery({
      queryKey: ['contratos', filter, clienteId],
      queryFn: () => fetchContratos(filter, clienteId),
  });

  const filterOptions = useMemo(() => {
    if (!fetchedData) return { fecha_inicio: [], fecha_fin: [], aviso_renovacion: [] };
    const getUniqueDates = (key: 'fecha_inicio' | 'fecha_fin') => 
      fetchedData.map(c => c[key] ? new Date(c[key]!) : null).filter(Boolean) as Date[];
    const avisoOptions = Array.from(new Set(fetchedData.map(c => c.aviso_renovacion ? 'Sí' : 'No')));
    return {
      fecha_inicio: getUniqueDates('fecha_inicio'),
      fecha_fin: getUniqueDates('fecha_fin'),
      aviso_renovacion: avisoOptions,
    };
  }, [fetchedData]);
  
  
  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[] | DateParts) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  // --- 👇 3. Filtra primero (por texto RPC y columnas) ---
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    // El filtro de texto ya se aplica en la RPC 'fetchContratos' si 'filter' tiene valor.
    // Aplicamos solo los filtros de columna aquí.
    return fetchedData.filter(item => {
      const inicio = item.fecha_inicio ? new Date(item.fecha_inicio) : null;
      const fin = item.fecha_fin ? new Date(item.fecha_fin) : null;
      // Convertimos el booleano a 'Sí'/'No' para coincidir con las opciones del dropdown
      const formattedAviso = item.aviso_renovacion ? 'Sí' : 'No';

      const checkDate = (date: Date | null, filter: DateParts) => {
          if (!date) return !filter.year && !filter.month && !filter.day;
          if (filter.year && date.getFullYear().toString() !== filter.year) return false;
          if (filter.month && (date.getMonth() + 1).toString().padStart(2, '0') !== filter.month) return false;
          if (filter.day && date.getDate().toString().padStart(2, '0') !== filter.day) return false;
          return true;
      };
      return (
        checkDate(inicio, columnFilters.fecha_inicio) &&
        checkDate(fin, columnFilters.fecha_fin) &&
        // Comparamos el valor formateado con las opciones seleccionadas
        (columnFilters.aviso_renovacion.length === 0 || columnFilters.aviso_renovacion.includes(formattedAviso))
      );
    });
  // Depende de fetchedData Y columnFilters
  }, [fetchedData, columnFilters]);
  
  const [contratoToDelete, setContratoToDelete] = useState<ContratoExtendido | null>(null);
  const deleteContratoMutation = useMutation({
    mutationFn: async (contratoId: string) => {
      const { error } = await supabase.from('contratos').delete().eq('id', contratoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contrato eliminado.');
      setContratoToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['contratos', filter, clienteId] });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
      setContratoToDelete(null);
    },
  });

  // --- 👇 4. Usa el hook useSortableTable ---
    const {
        sortedData: displayedData,
        handleSort,
        renderSortIcon
    } = useSortableTable<ContratoExtendido>(filteredData, {
        initialSortKey: 'fecha_inicio', // Orden inicial por fecha de inicio descendente
        initialSortDirection: 'desc',
        sortValueAccessors: {
            // Usamos las claves de propiedad permitidas y devolvemos los valores anidados necesarios
            puntos_suministro: (item) => item.puntos_suministro?.cups,
            empresas: (item) => item.empresas?.nombre,
            // Accessors explícitos para manejar nulls/tipos
            oferta: (item) => item.oferta,
            fecha_inicio: (item) => item.fecha_inicio ? new Date(item.fecha_inicio) : null, // Convertir a Date para ordenar
            fecha_fin: (item) => item.fecha_fin ? new Date(item.fecha_fin) : null,     // Convertir a Date para ordenar
            aviso_renovacion: (item) => item.aviso_renovacion, // Ordenar por booleano
        }
    });

  const isFiltered = filter.length > 0 ||
                     columnFilters.fecha_inicio.year !== null ||
                     columnFilters.fecha_fin.year !== null ||
                     columnFilters.aviso_renovacion.length > 0;

  const canCreate = rol === 'administrador' || rol === 'comercial';

  return (
    <div className="grid">
      {!clienteId && (
        <div className="page-header">
          <h2 style={{margin:0}}>Contratos</h2>
          <div className="page-actions" style={{width: '100%', maxWidth: 500}}>
            <input placeholder="Buscar por Comercializadora o CUPS..." value={filter} onChange={e => setFilter(e.target.value)} />
            {canCreate && (
              <Link to="/app/contratos/nuevo"><button><BadgePlus /></button></Link>
            )}
          </div>
        </div>
      )}

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando…</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar contratos.</div>}
        
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && !isFiltered && !clienteId && (
          <EmptyState
            title="Sin contratos"
            description="Aún no hay contratos registrados."
            cta={canCreate ? <Link to="/app/contratos/nuevo"><button>Crear el primero</button></Link> : null}
          />    
        )}
        
        {!isLoading && !isError && fetchedData && fetchedData.length === 0 && clienteId && (
           <div style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
             Este cliente no tiene contratos asignados.
           </div>
        )}

        {!isLoading && !isError && fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort('puntos_suministro')} className="sortable-header">
                      CUPS {renderSortIcon('puntos_suministro')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('empresas')} className="sortable-header">
                      Comercializadora {renderSortIcon('empresas')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('oferta')} className="sortable-header">
                      Oferta {renderSortIcon('oferta')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('fecha_inicio')} className="sortable-header">
                      Inicio {renderSortIcon('fecha_inicio')}
                    </button>
                    <DateFilterDropdown
                      columnName="Fecha Inicio"
                      options={filterOptions.fecha_inicio}
                      selectedDate={columnFilters.fecha_inicio}
                      onChange={(selected) => handleColumnFilterChange('fecha_inicio', selected)}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('fecha_fin')} className="sortable-header">
                      Fin {renderSortIcon('fecha_fin')}
                    </button>
                    <DateFilterDropdown
                      columnName="Fecha Fin"
                      options={filterOptions.fecha_fin}
                      selectedDate={columnFilters.fecha_fin}
                      onChange={(selected) => handleColumnFilterChange('fecha_fin', selected)}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('aviso_renovacion')} className="sortable-header">
                      Aviso {renderSortIcon('aviso_renovacion')}
                    </button>
                    <ColumnFilterDropdown
                      columnName="Aviso"
                      options={filterOptions.aviso_renovacion}
                      selectedOptions={columnFilters.aviso_renovacion}
                      onChange={(selected) => handleColumnFilterChange('aviso_renovacion', selected as string[])}
                    />
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              {/* --- CUERPO CORREGIDO --- */}
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(c => (
                    <tr key={c.id}>
                      <td>{c.puntos_suministro?.cups ?? '—'}</td>
                      <td>{c.empresas?.nombre ?? '—'}</td>
                      <td>{c.oferta ?? '—'}</td>
                      <td>{fmtDate(c.fecha_inicio)}</td>
                      <td>{fmtDate(c.fecha_fin)}</td>
                      <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          <Link to={`/app/contratos/$id`} params={{ id: c.id }} className="icon-button secondary" title="Editar Contrato"><Pencil size={18} /></Link>
                          <button className="icon-button danger" title="Eliminar Contrato" onClick={() => setContratoToDelete(c)} disabled={deleteContratoMutation.isPending}><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
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
      
      {contratoToDelete && (
        <ConfirmationModal
          isOpen={!!contratoToDelete}
          onClose={() => setContratoToDelete(null)}
          onConfirm={() => {
            // Corregido: Chequeo de null
            if (contratoToDelete) {
              deleteContratoMutation.mutate(contratoToDelete.id);
            }
          }}
          title="Confirmar Eliminación"
           // Corregido: Usar ?. (optional chaining)
          message={`¿Estás seguro de que quieres eliminar el contrato "${contratoToDelete?.oferta || 'sin nombre'}"?`}
          confirmText="Sí, Eliminar"
          cancelText="Cancelar"
          confirmButtonClass="danger"
          isConfirming={deleteContratoMutation.isPending}
        />
      )}
    </div>
  );
}