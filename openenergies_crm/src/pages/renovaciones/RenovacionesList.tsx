// src/pages/renovaciones/RenovacionesList.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import type { Contrato } from '@lib/types';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { fmtDate } from '@lib/utils';
import { CalendarCheck } from 'lucide-react'; // Icono para el botón de reiniciar

// Tipos (igual que en ContratosList)
type ContratoExtendido = Contrato & {
  puntos_suministro: {
    cups: string;
    direccion: string;
    clientes: { nombre: string } | null;
  } | null;
  empresas: { nombre: string } | null;
};
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
      // Deshabilitamos re-fetch en foco para que no pida los datos de nuevo
      // si el usuario solo cambia de pestaña.
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

  const displayedData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      const inicio = item.fecha_inicio ? new Date(item.fecha_inicio) : null;
      const fin = item.fecha_fin ? new Date(item.fecha_fin) : null;
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
        (columnFilters.aviso_renovacion.length === 0 || columnFilters.aviso_renovacion.includes(formattedAviso))
      );
    });
  }, [fetchedData, columnFilters]);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[] | DateParts) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };
  
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

        {displayedData && displayedData.length > 0 && (
          <div className="table-wrapper" style={{overflow: 'visible'}}>
            <table className="table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Comercializadora</th>
                  <th>Oferta</th>
                  <th>
                    Inicio
                    <DateFilterDropdown
                      columnName="Fecha Inicio"
                      options={filterOptions.fecha_inicio}
                      selectedDate={columnFilters.fecha_inicio}
                      onChange={(selected) => handleColumnFilterChange('fecha_inicio', selected)}
                    />
                  </th>
                  <th>
                    Fin
                    <DateFilterDropdown
                      columnName="Fecha Fin"
                      options={filterOptions.fecha_fin}
                      selectedDate={columnFilters.fecha_fin}
                      onChange={(selected) => handleColumnFilterChange('fecha_fin', selected)}
                    />
                  </th>
                  <th>
                    Aviso
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