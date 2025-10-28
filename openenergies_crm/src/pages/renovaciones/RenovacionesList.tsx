// src/pages/renovaciones/RenovacionesList.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import type { Contrato } from '@lib/types';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { fmtDate } from '@lib/utils';
import { CalendarCheck } from 'lucide-react'; // Icono para el botón de reiniciar
import { useSortableTable } from '@hooks/useSortableTable';

// Tipos (igual que en ContratosList)
type ContratoExtendido = Contrato & {
  puntos_suministro: {
    cups: string;
    direccion: string;
    clientes: { nombre: string } | null;
  } | null;
  empresas: { nombre: string } | null;
};

type SortableRenovacionKey = keyof ContratoExtendido | 'cups' | 'comercializadora_nombre';

const initialColumnFilters = {
  fecha_inicio: { year: null, month: null, day: null } as DateParts,
  fecha_fin: { year: null, month: null, day: null } as DateParts,
  aviso_renovacion: [] as string[],
};

// --- FUNCIÓN DE FETCH MODIFICADA ---
// Ahora acepta 'daysToExpiry'
async function fetchRenovaciones(
  filter: string,
  daysToExpiry: number
): Promise<ContratoExtendido[]> {
  
  // Calcula las fechas límite
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysToExpiry);
  const todayISO = today.toISOString().split('T')[0];
  const futureDateISO = futureDate.toISOString().split('T')[0];

  const selectQuery = `*, puntos_suministro ( cups, direccion, clientes ( nombre ) ), empresas ( nombre )`;
  
  // Modificamos ambas ramas de la consulta para incluir el filtro de fecha
  
  if (!filter) {
    let q = supabase.from('contratos').select(selectQuery)
      .gte('fecha_fin', todayISO)      // >= Hoy
      .lte('fecha_fin', futureDateISO) // <= Futuro
      .eq('estado', 'activo');         // Solo contratos activos

    const { data, error } = await q.order('fecha_inicio', { ascending: false }).limit(100);
    if (error) throw error;
    return data as ContratoExtendido[];
  }
  
  // Búsqueda RPC CON filtro de fecha
  const { data, error } = await supabase
    .rpc('search_contratos', { search_text: filter, p_cliente_id: null })
    .select(selectQuery)
    .gte('fecha_fin', todayISO)      // >= Hoy
    .lte('fecha_fin', futureDateISO) // <= Futuro
    .eq('estado', 'activo')         // Solo contratos activos
    .order('fecha_inicio', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data as ContratoExtendido[];
}

// Props: Acepta daysToExpiry y onReset
interface Props {
  daysToExpiry: number;
  onReset: () => void;
}

export default function RenovacionesList({ daysToExpiry, onReset }: Props){
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  // El Query Key ahora incluye 'daysToExpiry'
  const { data: fetchedData, isLoading, isError } = useQuery({
      queryKey: ['renovaciones', filter, daysToExpiry],
      queryFn: () => fetchRenovaciones(filter, daysToExpiry),
      refetchOnWindowFocus: false,
  });

  // --- El resto de la lógica de filtros (useMemo, handlers) es IDÉNTICA a ContratosList ---
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

  // --- 👇 3. Filtra por columnas (igual que ContratosList) ---
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    // El filtro de texto ya lo hace la query fetchRenovaciones
    // Aplicamos filtros de columna
    return fetchedData.filter(item => {
      const inicio = item.fecha_inicio ? new Date(item.fecha_inicio) : null;
      const fin = item.fecha_fin ? new Date(item.fecha_fin) : null;
      const formattedAviso = item.aviso_renovacion ? 'Sí' : 'No';
      const checkDate = (date: Date | null, filter: DateParts) => {
        // Si no hay filtros aplicados, aceptar cualquier fecha
        if (!filter || (filter.year === null && filter.month === null && filter.day === null)) return true;
        // Si hay filtro pero el valor es nulo, no coincide
        if (!date) return false;
        // Comparaciones por partes (si están definidas)
        if (filter.year !== null && date.getFullYear() !== Number(filter.year)) return false;
        if (filter.month !== null && (date.getMonth() + 1) !== Number(filter.month)) return false;
        if (filter.day !== null && date.getDate() !== Number(filter.day)) return false;
        return true;
      };
      return (
        checkDate(inicio, columnFilters.fecha_inicio) &&
        checkDate(fin, columnFilters.fecha_fin) &&
        (columnFilters.aviso_renovacion.length === 0 || columnFilters.aviso_renovacion.includes(formattedAviso))
      );
    });
  }, [fetchedData, columnFilters]);
  // --------------------------------------------------------

  // --- 👇 4. Usa el hook useSortableTable (igual que ContratosList) ---
  const {
      sortedData: displayedData,
      handleSort,
      renderSortIcon
  } = useSortableTable(filteredData, {
      initialSortKey: 'fecha_fin', // Orden inicial por fecha de fin ASCENDENTE
      initialSortDirection: 'asc', // <-- Cambiado a 'asc'
      sortValueAccessors: {
          // Use the relation keys allowed by the hook's type definitions.
          // Return the comparable value (CUPS string or null).
          puntos_suministro: (item) => item.puntos_suministro?.cups ?? null,
          // Use empresas to access comercializadora nombre.
          empresas: (item) => item.empresas?.nombre ?? null,
          oferta: (item) => item.oferta,
          fecha_inicio: (item) => item.fecha_inicio ? new Date(item.fecha_inicio) : null,
          fecha_fin: (item) => item.fecha_fin ? new Date(item.fecha_fin) : null,
          aviso_renovacion: (item) => item.aviso_renovacion,
      }
  });
  
  return (
    <div className="grid">
      {/* --- CABECERA MODIFICADA --- */}
      <div className="page-header">
        <h2 style={{margin:0}}>Renovaciones (Próximos {daysToExpiry} días)</h2>
        <div className="page-actions" style={{width: '100%', maxWidth: 500}}>
          <input placeholder="Buscar por Comercializadora o CUPS..." value={filter} onChange={e => setFilter(e.target.value)} />
          {/* --- BOTÓN DE REINICIAR CONSULTA --- */}
          <button onClick={onReset} className="secondary" title="Reiniciar consulta">
            <CalendarCheck size={18} />
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading && <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando…</div>}
        {isError && <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>Error al cargar contratos.</div>}

        {fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper" style={{overflow: 'visible'}}>
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
                  {/* Columna de Acciones Eliminada */}
                </tr>
              </thead>
              <tbody>
                {displayedData.map(c => (
                  <tr key={c.id}>
                    <td>{c.puntos_suministro?.cups ?? '—'}</td>
                    <td>{c.empresas?.nombre ?? '—'}</td>
                    <td>{c.oferta ?? '—'}</td>
                    <td>{fmtDate(c.fecha_inicio)}</td>
                    <td>{fmtDate(c.fecha_fin)}</td>
                    <td>{c.aviso_renovacion ? `Sí (${fmtDate(c.fecha_aviso)})` : 'No'}</td>
                    {/* Celda de Acciones Eliminada */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {displayedData && displayedData.length === 0 && !isLoading && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            No se encontraron contratos que venzan en los próximos {daysToExpiry} días.
          </div>
        )}
      </div>
    </div>
  );
}