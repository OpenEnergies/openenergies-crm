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
import { useTheme } from '@hooks/ThemeContext';
import ExportButton from '@components/ExportButton';

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

// Helper para colores de estado (igual que ContratosList)
type EstadoContrato = 'Aceptado' | 'En curso' | 'Bloqueado' | 'Pendiente Doc.' | 'Pendiente firma' | 'Firmado' | 'Contratado' | 'Pendiente renovacion' | 'Baja' | 'Standby' | 'Desiste';

const getEstadoColorClass = (estado: string) => {
  const map: Record<EstadoContrato, string> = {
    'Aceptado': 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    'En curso': 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30',
    'Bloqueado': 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30',
    'Pendiente Doc.': 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    'Pendiente firma': 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    'Firmado': 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    'Contratado': 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-500/30',
    'Pendiente renovacion': 'bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/30',
    'Baja': 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20',
    'Standby': 'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 dark:border-yellow-500/30',
    'Desiste': 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30',
  };
  return map[estado as EstadoContrato] || 'bg-bg-intermediate text-secondary opacity-70 border border-primary/20';
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

  const { data, error } = await supabase
    .from('contratos')
    .select(selectQuery)
    .gte('fecha_renovacion', todayISO)
    .lte('fecha_renovacion', futureDateISO)
    .in('estado', ['En curso', 'Contratado', 'Pendiente renovacion'])
    .order('fecha_renovacion', { ascending: true })
    .range(0, 99999);
  
  if (error) throw error;
  
  // Filtro de búsqueda en el cliente (filtra por CUPS, comercializadora y nombre del cliente)
  if (filter && filter.trim()) {
    const searchTerm = filter.toLowerCase().trim();
    return (data as ContratoExtendido[] || []).filter(contrato => {
      const cups = contrato.puntos_suministro?.cups?.toLowerCase() || '';
      const clienteNombre = contrato.puntos_suministro?.clientes?.nombre?.toLowerCase() || '';
      const comercializadoraNombre = contrato.comercializadoras?.nombre?.toLowerCase() || '';
      const direccion = contrato.puntos_suministro?.direccion_sum?.toLowerCase() || '';
      
      return cups.includes(searchTerm) ||
             clienteNombre.includes(searchTerm) ||
             comercializadoraNombre.includes(searchTerm) ||
             direccion.includes(searchTerm);
    });
  }
  
  return data as ContratoExtendido[];
}

interface Props {
  daysToExpiry: number;
  onReset: () => void;
}

export default function RenovacionesList({ daysToExpiry, onReset }: Props) {
  const [filter, setFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const { theme } = useTheme();

  // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

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
          <h2 className="text-2xl font-bold text-fenix-600 dark:text-emerald-400 flex items-center gap-2">
            <CalendarClock size={24} className="text-fenix-600 dark:text-emerald-400" />
            Renovaciones
          </h2>
          <p className="text-secondary opacity-70">
            Contratos que vencen en los próximos <span className="font-bold text-fenix-600 dark:text-fenix-400">{daysToExpiry} días</span>.
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

          <ExportButton
            exportParams={{
              entity: 'renovaciones',
              filters: {
                search: filter || undefined,
              },
            }}
          />

          <button
            onClick={onReset}
            className="p-2.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors border border-primary glass shadow-sm cursor-pointer"
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
            <span className="text-secondary font-medium">Cargando renovaciones...</span>
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
              <thead
                className="text-xs text-primary uppercase bg-bg-intermediate border-b-2"
                style={{ borderBottomColor: tableBorderColor }}
              >
                <tr>
                  <th className="px-6 py-3 font-bold">
                    <button onClick={() => handleSort('puntos_suministro')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      CUPS {renderSortIcon('puntos_suministro')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-bold">
                    <button onClick={() => handleSort('comercializadoras')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      Comercializadora {renderSortIcon('comercializadoras')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-bold">
                    <button onClick={() => handleSort('estado')} className="flex items-center gap-1 hover:text-fenix-500 transition-colors cursor-pointer">
                      Estado {renderSortIcon('estado')}
                    </button>
                  </th>
                  <th className="px-6 py-3 font-bold">
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
                  <th className="px-6 py-3 font-bold">
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
                  <th className="px-6 py-3 font-bold">
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
                    <td className="px-6 py-4 font-mono text-secondary">
                      {c.puntos_suministro?.cups
                        ? <span className="bg-bg-intermediate px-2 py-0.5 rounded text-xs">{c.puntos_suministro.cups}</span>
                        : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">{c.comercializadoras?.nombre ?? '—'}</td>
                    <td className="px-6 py-4 text-secondary">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getEstadoColorClass(c.estado)}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-secondary">{fmtDate(c.fecha_activacion)}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-amber-600 dark:text-amber-400">{fmtDate(c.fecha_renovacion)}</span>
                    </td>
                    <td className="px-6 py-4 text-secondary">
                      {c.aviso_renovacion
                        ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">Sí ({fmtDate(c.fecha_aviso)})</span>
                        : <span className="text-secondary opacity-60">No</span>
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
              <Search className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-lg font-bold text-primary mb-1">No se encontraron renovaciones</p>
            <p className="text-secondary">
              No hay contratos que venzan en los próximos {daysToExpiry} días con los filtros actuales.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
