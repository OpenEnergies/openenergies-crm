import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { Empresa } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useState, useEffect } from 'react';
import { Pencil, HousePlus, DollarSign, Archive, ArchiveRestore, Inbox, XCircle, Edit, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSortableTable } from '@hooks/useSortableTable';
import PreciosEmpresaModal from './PreciosEmpresaModal';
import ConfirmationModal from '@components/ConfirmationModal';
import { clsx } from '@lib/utils';

function EmpresaLogo({ url, size = 20 }: { url?: string | null; size?: number }) {
  // Define el placeholder (puedes usar el mismo que tenías)
  const placeholder =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%239ca3af">?</text></svg>';

  return (
    <img
      // Usa la URL del prop. Si es nula o indefinida, usa el placeholder.
      src={url ?? placeholder}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', borderRadius: 4, background: '#fff', border: '1px solid #e5e7eb' }}
      // Si la URL (url) falla por algún motivo (ej. 404),
      // el onError la reemplazará por el placeholder.
      onError={(e) => {
        if (e.currentTarget.src !== placeholder) {
           e.currentTarget.src = placeholder;
        }
      }}
    />
  );
}

type EmpresaConConteo = Empresa & {
  contratos_activos: { count: number }[];
  logo_url?: string | null;
};

//    En este caso, coinciden con las claves del tipo Empresa
type SortableEmpresaKey = keyof EmpresaConConteo | 'contratos_activos_count';

async function fetchEmpresas(mode: 'active' | 'archived') {
  const { data, error } = await supabase
    .from('empresas')
    .select(`
      *,
      logo_url,
      contratos_activos:contratos!comercializadora_id(
        count
      )
    `)
    .eq('is_archived', mode === 'archived')
    .eq('contratos.estado', 'activo')
    .lte('contratos.fecha_inicio', new Date().toISOString().split('T')[0])
    .or(`fecha_fin.is.null,fecha_fin.gte.${new Date().toISOString().split('T')[0]}`, { foreignTable: 'contratos' })
    .order('creada_en', { ascending: false });

  if (error) throw error;
  return data as (EmpresaConConteo & { logo_url: string | null })[]; // <-- Tipo actualizado
}

interface EmpresasListProps {
  mode?: 'active' | 'archived'; // 'active' por defecto
}

export default function EmpresasList({ mode = 'active' }: EmpresasListProps) {
  const queryClient = useQueryClient();
  const { data: fetchedData, isLoading, isError } = useQuery({
    queryKey: ['empresas', mode],
    queryFn: () => fetchEmpresas(mode),
  });
  const [modalState, setModalState] = useState<{ id: string; nombre: string } | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToArchive, setIdsToArchive] = useState<string[]>([]);
  const [idsToUnarchive, setIdsToUnarchive] = useState<string[]>([]); 

  // --- 👇 3. Usa el hook ---
  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon,
  } = useSortableTable<EmpresaConConteo>(fetchedData, { // <-- Tipo actualizado
    initialSortKey: 'nombre',
    initialSortDirection: 'asc',
    // --- Añadir accesor para la nueva clave de ordenación ---
    // Se castea a `any` para aceptar la clave personalizada 'contratos_activos_count'
    sortValueAccessors: {
      contratos_activos_count: (item: EmpresaConConteo) => item.contratos_activos[0]?.count ?? 0,
    } as any,
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('empresas')
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.length} empresa(s) archivada(s).`);
      queryClient.invalidateQueries({ queryKey: ['empresas', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['empresas', 'archived'] });
      setSelectedIds([]);
      setIdsToArchive([]);
    },
    onError: (error: Error) => {
      toast.error(`Error al archivar: ${error.message}`);
      setIdsToArchive([]);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('empresas')
        .update({ is_archived: false, archived_at: null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`${variables.length} empresa(s) desarchivada(s).`);
      queryClient.invalidateQueries({ queryKey: ['empresas', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['empresas', 'archived'] });
      setSelectedIds([]);
      setIdsToUnarchive([]);
    },
    onError: (error: Error) => {
      toast.error(`Error al desarchivar: ${error.message}`);
      setIdsToUnarchive([]);
    },
  });

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  const isAllSelected =
    displayedData.length > 0 && selectedIds.length === displayedData.length;
  const isIndeterminate =
    selectedIds.length > 0 && selectedIds.length < displayedData.length;

  const handleArchiveSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToArchive([...selectedIds]);
    }
  };

  const handleUnarchiveSelected = () => {
    if (selectedIds.length > 0) {
      setIdsToUnarchive([...selectedIds]);
    }
  };

  const canEdit = selectedIds.length === 1;
  const canUpdatePrices =
    selectedIds.length === 1 &&
    fetchedData?.find((e) => e.id === selectedIds[0])?.tipo === 'comercializadora';
  const canArchive = selectedIds.length > 0;
  const canUnarchive = selectedIds.length > 0;

  return (
    <div className="grid">
      {/* --- (9) CABECERA MODIFICADA (condicional) --- */}
      {/* Oculta la cabecera por defecto si estamos en modo 'archivado' */}
      <div className="page-header">
        
        {/* --- Título (depende del modo) --- */}
        {mode === 'active' ? (
          <h2 style={{ margin: 0 }}>Gestión de Empresas</h2>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/app/empresas" className="icon-button secondary" title="Volver">
              <ArrowLeft size={20} />
            </Link>
            <h2 style={{ margin: 0 }}>Empresas Archivadas</h2>
          </div>
        )}

        {/* --- Acciones (depende del modo y la selección) --- */}
        <div className="page-actions">
          
          {/* CASO A: Hay filas seleccionadas */}
          {selectedIds.length > 0 ? (
            <div className="contextual-actions">
              <span>{selectedIds.length} seleccionada(s)</span>

              {/* A.1: Acciones para MODO ACTIVO */}
              {mode === 'active' && (
                <>
                  {canEdit && (
                    <Link
                      to="/app/empresas/$id"
                      params={{ id: selectedIds[0]! }}
                      className="icon-button secondary"
                      title="Editar Empresa"
                    >
                      <Edit size={18} />
                    </Link>
                  )}
                  {canUpdatePrices && (
                    <button
                      className="icon-button secondary"
                      title="Actualizar Precios"
                      onClick={() => {
                        const empresa = fetchedData?.find((e) => e.id === selectedIds[0]);
                        if (empresa) {
                          setModalState({ id: empresa.id, nombre: empresa.nombre });
                        }
                      }}
                    >
                      <DollarSign size={18} />
                    </button>
                  )}
                  {canArchive && (
                    <button
                      className="icon-button danger"
                      title={`Archivar ${selectedIds.length} empresa(s)`}
                      onClick={handleArchiveSelected}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive size={18} />
                    </button>
                  )}
                </>
              )}

              {/* A.2: Acciones para MODO ARCHIVADO */}
              {mode === 'archived' && (
                <>
                  {canUnarchive && (
                    <button
                      className="icon-button secondary" // Usamos 'secondary' (azul) para desarchivar
                      title={`Desarchivar ${selectedIds.length} empresa(s)`}
                      onClick={handleUnarchiveSelected}
                      disabled={unarchiveMutation.isPending}
                    >
                      <ArchiveRestore size={18} />
                    </button>
                  )}
                </>
              )}

              {/* A.3: Acción Común (Limpiar selección) */}
              <button
                className="icon-button secondary"
                title="Limpiar selección"
                onClick={() => setSelectedIds([])}
              >
                <XCircle size={18} />
              </button>
            </div>
          ) : (
            
            /* CASO B: No hay filas seleccionadas */
            <>
              {/* B.1: Acciones por defecto MODO ACTIVO */}
              {mode === 'active' && (
                <>
                  <Link to="/app/empresas/archivadas">
                    {/*
                      Quitamos 'icon-button' para que use el padding
                      estándar (rectangular) en lugar del padding cuadrado.
                      Mantenemos 'secondary' para el color azul.
                    */}
                    <button className="secondary" title="Empresas Archivadas">
                      <Inbox size={22} />
                    </button>
                  </Link>
                  <Link to="/app/empresas/nueva">
                    <button><HousePlus size={22} /></button>
                  </Link>
                </>
              )}
              
              {/* B.2: Acciones por defecto MODO ARCHIVADO */}
              {/* (No se muestra nada si no hay selección) */}
            </>
          )}
        </div>
      </div>
      {/* --- FIN (9) --- */}

      {/* --- (10) ELIMINAR EL ANTIGUO BLOQUE CONTEXTUAL DE 'ARCHIVED' --- */}
      {/* {mode === 'archived' && selectedIds.length > 0 && ( ... ESTE BLOQUE SE ELIMINA ... )}
      */}

      {/* --- El resto del componente (card, tabla, modales) sigue igual --- */}
      <div className="card">
        {isLoading && <div>Cargando...</div>}
        {isError && <div role="alert">Error al cargar las empresas.</div>}

        {fetchedData && fetchedData.length === 0 && !isLoading && (
          <EmptyState
            title={mode === 'archived' ? 'Sin empresas archivadas' : 'Sin empresas'}
            description={
              mode === 'archived'
                ? 'No hay ninguna empresa en el archivo.'
                : 'Aún no hay empresas colaboradoras registradas.'
            }
            cta={
              mode === 'active' ? (
                <Link to="/app/empresas/nueva">
                  <button>Crear la primera</button>
                </Link>
              ) : null
            }
          />
        )}

        {fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '1%', paddingRight: 0 }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={handleSelectAll}
                      aria-label="Seleccionar todas las empresas"
                    />
                  </th>
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
                    <button onClick={() => handleSort('contratos_activos_count' as any)} className="sortable-header">
                      Contratos activos {renderSortIcon('contratos_activos_count' as any)}
                    </button>
                  </th>
                  <th>
                    <button
                      onClick={() => handleSort(mode === 'active' ? 'creada_en' : 'archived_at')}
                      className="sortable-header"
                    >
                      {mode === 'active' ? 'Creada en' : 'Archivada en'}
                      {renderSortIcon(mode === 'active' ? 'creada_en' : 'archived_at')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedData.map((e) => {
                  const isSelected = selectedIds.includes(e.id);
                  return (
                    <tr key={e.id} className={clsx(isSelected && 'selected-row')}>
                      <td style={{ paddingRight: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(e.id)}
                          aria-label={`Seleccionar empresa ${e.nombre}`}
                        />
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <EmpresaLogo url={e.logo_url} size={20} />
                          <span>{e.nombre}</span>
                        </div>
                      </td>
                      <td>{e.cif ?? '—'}</td>
                      <td>
                        <span className="kbd">{e.tipo}</span>
                      </td>
                      <td>{e.contratos_activos[0]?.count ?? 0}</td>
                      <td>
                        {fmtDate(mode === 'active' ? e.creada_en : e.archived_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ... (Modales de Confirmación y PreciosEmpresaModal ... sin cambios) ... */}
      <ConfirmationModal
        isOpen={idsToArchive.length > 0}
        onClose={() => setIdsToArchive([])}
        onConfirm={() => archiveMutation.mutate(idsToArchive)}
        title={`Archivar Empresa(s)`}
        message={`¿Estás seguro de que quieres archivar ${idsToArchive.length} empresa(s)? No aparecerán en la lista principal.`}
        confirmText="Sí, Archivar"
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={archiveMutation.isPending}
      />
      <ConfirmationModal
        isOpen={idsToUnarchive.length > 0}
        onClose={() => setIdsToUnarchive([])}
        onConfirm={() => unarchiveMutation.mutate(idsToUnarchive)}
        title={`Desarchivar Empresa(s)`}
        message={`¿Estás seguro de que quieres desarchivar ${idsToUnarchive.length} empresa(s)? Volverán a la lista principal.`}
        confirmText="Sí, Desarchivar"
        cancelText="Cancelar"
        confirmButtonClass="secondary"
        isConfirming={unarchiveMutation.isPending}
      />
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

