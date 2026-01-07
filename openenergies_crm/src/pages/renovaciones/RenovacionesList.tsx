// src/pages/renovaciones/RenovacionesList.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useState, useMemo } from 'react';
import type { Contrato } from '@lib/types';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import { fmtDate } from '@lib/utils';
import { CalendarClock, Search, CalendarCheck, Calendar } from 'lucide-react';
import { useSortableTable } from '@hooks/useSortableTable';

// Tipos (igual que en ContratosList)
type ContratoExtendido = Contrato & {
  puntos_suministro: {
    cups: string;
    direccion_sum: string;
    clientes: { nombre: string } | null;
  } | null;
  comercializadoras: { nombre: string } | null;
};

// ... resto del archivo sin cambios hasta fetchRenovaciones ...

const initialColumnFilters = {
  fecha_activacion: { year: null, month: null, day: null } as DateParts,
  fecha_renovacion: { year: null, month: null, day: null } as DateParts,
  aviso_renovacion: [] as string[],
};

// --- FUNCIÓN DE FETCH MODIFICADA ---
async function fetchRenovaciones(
  filter: string,
  daysToExpiry: number
): Promise<ContratoExtendido[]> {

  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysToExpiry);
  const todayISO = today.toISOString().split('T')[0];
  const futureDateISO = futureDate.toISOString().split('T')[0];

  const selectQuery = `
    *,
    puntos_suministro ( cups, direccion_sum, clientes ( nombre ) ),
    comercializadoras:empresas!contratos_comercializadora_id_fkey ( nombre )
  `;

  if (!filter) {
    const { data, error } = await supabase
      .from('contratos')
      .select(selectQuery)
      .gte('fecha_renovacion', todayISO)
      .lte('fecha_renovacion', futureDateISO)
      .in('estado', ['En curso', 'Contratado', 'Pendiente renovacion'])
      .order('fecha_renovacion', { ascending: true })
      .limit(100);
    if (error) throw error;
    return data as ContratoExtendido[];
  }

  const { data, error } = await supabase
    .rpc('search_contratos', { search_text: filter, p_cliente_id: null })
    .select(selectQuery)
    .gte('fecha_renovacion', todayISO)
    .lte('fecha_renovacion', futureDateISO)
    .in('estado', ['En curso', 'Contratado', 'Pendiente renovacion'])
    .order('fecha_renovacion', { ascending: true })
    .limit(100);

  if (error) throw error;
  return data as ContratoExtendido[];
}

interface Props {
  daysToExpiry: number;
  onReset: () => void;
}

export default function RenovacionesList({ daysToExpiry, onReset }: Props) {
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['renovaciones', filter, daysToExpiry],
    queryFn: () => fetchRenovaciones(filter, daysToExpiry),
    refetchOnWindowFocus: false,
  });

  const filterOptions = useMemo(() => {
    if (!fetchedData) return { fecha_activacion: [], fecha_renovacion: [], aviso_renovacion: [] };
    const getUniqueDates = (key: 'fecha_activacion' | 'fecha_renovacion') =>
      fetchedData.map(c => c[key] ? new Date(c[key]!) : null).filter(Boolean) as Date[];
    const avisoOptions = Array.from(new Set(fetchedData.map(c => c.aviso_renovacion ? 'Sí' : 'No')));
    return {
      fecha_activacion: getUniqueDates('fecha_activacion'),
      fecha_renovacion: getUniqueDates('fecha_renovacion'),
      aviso_renovacion: avisoOptions,
    };
  }, [fetchedData]);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[] | DateParts) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      const activacion = item.fecha_activacion ? new Date(item.fecha_activacion) : null;
      const renovacion = item.fecha_renovacion ? new Date(item.fecha_renovacion) : null;
      const formattedAviso = item.aviso_renovacion ? 'Sí' : 'No';
      const checkDate = (date: Date | null, filter: DateParts) => {
        if (!filter || (filter.year === null && filter.month === null && filter.day === null)) return true;
        if (!date) return false;
        if (filter.year !== null && date.getFullYear() !== Number(filter.year)) return false;
        if (filter.month !== null && (date.getMonth() + 1) !== Number(filter.month)) return false;
        if (filter.day !== null && date.getDate() !== Number(filter.day)) return false;
        return true;
      };
      return (
        checkDate(activacion, columnFilters.fecha_activacion) &&
        checkDate(renovacion, columnFilters.fecha_renovacion) &&
        (columnFilters.aviso_renovacion.length === 0 || columnFilters.aviso_renovacion.includes(formattedAviso))
      );
    });
  }, [fetchedData, columnFilters]);

  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
  } = useSortableTable(filteredData, {
    initialSortKey: 'fecha_renovacion',
    initialSortDirection: 'asc',
    sortValueAccessors: {
      puntos_suministro: (item) => item.puntos_suministro?.cups ?? null,
      comercializadoras: (item: ContratoExtendido) => item.comercializadoras?.nombre ?? null,
      estado: (item) => item.estado,
      fecha_activacion: (item) => item.fecha_activacion ? new Date(item.fecha_activacion) : null,
      fecha_renovacion: (item) => item.fecha_renovacion ? new Date(item.fecha_renovacion) : null,
      aviso_renovacion: (item) => item.aviso_renovacion,
    }
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <CalendarClock size={24} className="text-emerald-400" />
            Renovaciones
          </h2>
          <p className="text-gray-400">
            Contratos que vencen en los próximos <span className="font-semibold text-fenix-400">{daysToExpiry} días</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-1 sm:w-64">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 whitespace-nowrap">
              <Search size={16} />
              Buscar
            </label>
            <input
              placeholder="Comercializadora o CUPS..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="glass-input w-full"
            />
          </div>

          <button
            onClick={onReset}
            className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors border border-bg-intermediate glass shadow-sm cursor-pointer"
            title="Cambiar filtro de días"
          >
            <CalendarCheck size={20} />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading && (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin text-fenix-500 mr-3"><Calendar size={24} /></div>
            <span className="text-gray-400">Cargando renovaciones...</span>
          </div>
        )}

        {isError && (
          <div role="alert" className="p-8 text-center text-red-500">
            Error al cargar contratos.
          </div>
        )}

        {fetchedData && fetchedData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-200 uppercase bg-bg-intermediate border-b border-bg-intermediate">
                <tr>
                  <th className="px-6 py-3 font-medium">
                    <button onClick={() => handleSort('puntos_suministro')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      CUPS {renderSortIcon('puntos_suministro')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <button onClick={() => handleSort('comercializadoras')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      Comercializadora {renderSortIcon('comercializadoras')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <button onClick={() => handleSort('estado')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      Estado {renderSortIcon('estado')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('fecha_activacion')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                        Activación {renderSortIcon('fecha_activacion')}
                      </button>
                      <DateFilterDropdown
                        columnName="Fecha Activación"
                        options={filterOptions.fecha_activacion}
                        selectedDate={columnFilters.fecha_activacion}
                        onChange={(selected) => handleColumnFilterChange('fecha_activacion', selected)}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('fecha_renovacion')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                        Renovación {renderSortIcon('fecha_renovacion')}
                      </button>
                      <DateFilterDropdown
                        columnName="Fecha Renovación"
                        options={filterOptions.fecha_renovacion}
                        selectedDate={columnFilters.fecha_renovacion}
                        onChange={(selected) => handleColumnFilterChange('fecha_renovacion', selected)}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSort('aviso_renovacion')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                        Aviso {renderSortIcon('aviso_renovacion')}
                      </button>
                      <ColumnFilterDropdown
                        columnName="Aviso"
                        options={filterOptions.aviso_renovacion}
                        selectedOptions={columnFilters.aviso_renovacion}
                        onChange={(selected) => handleColumnFilterChange('aviso_renovacion', selected as string[])}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.map(c => (
                  <tr key={c.id} className="hover:bg-bg-intermediate transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-mono text-gray-300">
                      {c.puntos_suministro?.cups
                        ? <span className="bg-bg-intermediate px-2 py-0.5 rounded text-xs">{c.puntos_suministro.cups}</span>
                        : '—'}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{c.comercializadoras?.nombre ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-300">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-300">
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{fmtDate(c.fecha_activacion)}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-amber-400">{fmtDate(c.fecha_renovacion)}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {c.aviso_renovacion
                        ? <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">Sí ({fmtDate(c.fecha_aviso)})</span>
                        : <span className="text-gray-400">No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {displayedData && displayedData.length === 0 && !isLoading && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-bg-intermediate rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-white mb-1">No se encontraron renovaciones</p>
            <p className="text-gray-400">
              No hay contratos que venzan en los próximos {daysToExpiry} días con los filtros actuales.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
