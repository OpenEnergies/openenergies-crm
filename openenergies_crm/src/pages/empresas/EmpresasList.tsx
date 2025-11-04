import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useState } from 'react';
import { Pencil, HousePlus, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSortableTable } from '@hooks/useSortableTable';
import PreciosEmpresaModal from './PreciosEmpresaModal';

//    En este caso, coinciden con las claves del tipo Empresa
type SortableEmpresaKey = keyof Empresa;

async function fetchEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('creada_en', { ascending: false });

  if (error) throw error;
  return data as Empresa[];
}

export default function EmpresasList() {
  const { data: fetchedData, isLoading, isError } = useQuery({ queryKey: ['empresas'], queryFn: fetchEmpresas });

  const [modalState, setModalState] = useState<{ id: string; nombre: string } | null>(null);
  
  // --- 👇 3. Usa el hook ---
  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
    // Podemos pasar una configuración inicial si queremos
  } = useSortableTable<Empresa>(fetchedData, {
      initialSortKey: 'nombre', // Ordenar por nombre por defecto
      initialSortDirection: 'asc'
  });

  return (
    <div className="grid">
      {/* --- CABECERA CON EL ESTILO Y ESPACIADO CORRECTO --- */}
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Gestión de Empresas</h2>
        <div className="page-actions">
          <Link to="/app/empresas/nueva"><button><HousePlus /></button></Link>
        </div>
      </div>

      <div className="card">
        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar las empresas.</div>}

        {fetchedData && fetchedData.length === 0 && !isLoading && (
          <EmptyState 
            title="Sin empresas" 
            description="Aún no hay empresas colaboradoras registradas."
            cta={<Link to="/app/empresas/nueva"><button>Crear la primera</button></Link>}
          />
        )}

        {fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort('nombre')} className="sortable-header">
                      Nombre {renderSortIcon('nombre')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('cif')} className="sortable-header">
                      CIF {renderSortIcon('cif')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('tipo')} className="sortable-header">
                      Tipo {renderSortIcon('tipo')}
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('creada_en')} className="sortable-header">
                      Creada en {renderSortIcon('creada_en')}
                    </button>
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedData.map(e => (
                  <tr key={e.id}>
                    <td>{e.nombre}</td>
                    <td>{e.cif ?? '—'}</td>
                    <td><span className="kbd">{e.tipo}</span></td>
                    <td>{fmtDate(e.creada_en)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {e.tipo === 'comercializadora' && (
                        <button
                          className="icon-button secondary"
                          title={`Actualizar precios de ${e.nombre}`}
                          onClick={() => setModalState({ id: e.id, nombre: e.nombre })}
                          style={{ marginRight: '0.5rem' }} // Espacio entre botones
                        >
                          <DollarSign size={18} />
                        </button>
                      )}
                      {/* --- ENLACE DE EDITAR CON ICONO --- */}
                      <Link 
                        to="/app/empresas/$id" 
                        params={{ id: e.id }} 
                        className="icon-button secondary"
                        title="Editar Empresa"
                      >
                        <Pencil size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modalState && (
        <PreciosEmpresaModal
          empresaId={modalState.id}
          empresaNombre={modalState.nombre}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}