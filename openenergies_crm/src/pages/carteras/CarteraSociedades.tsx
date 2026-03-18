import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Plus, Search, Trash2, Users, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTheme } from '@hooks/ThemeContext';
import AsignarSociedadesGrupoModal from '@components/grupos-clientes/AsignarSociedadesGrupoModal';
import ConfirmationModal from '@components/ConfirmationModal';
import { DataTableSkeleton } from '@components/ui/DataTableSkeleton';
import {
  useDesasignarClienteDeGrupo,
  useGrupoClienteDetail,
  useGrupoClienteMembers,
} from '@hooks/useGruposClientes';

const ITEMS_PER_PAGE = 50;

export default function CarteraSociedades() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { theme } = useTheme();
  const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idsToUnassign, setIdsToUnassign] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: grupo } = useGrupoClienteDetail(id);
  const { data: members = [], isLoading } = useGrupoClienteMembers(id, searchTerm);
  const unassignMutation = useDesasignarClienteDeGrupo();

  const totalItems = members.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const displayedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return members.slice(start, start + ITEMS_PER_PAGE);
  }, [members, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedVisibleCount = displayedData.filter((item) => selectedIds.includes(item.id)).length;
  const isAllSelected = displayedData.length > 0 && selectedVisibleCount === displayedData.length;
  const isIndeterminate = selectedVisibleCount > 0 && selectedVisibleCount < displayedData.length;

  const selectedMember = useMemo(
    () => (selectedIds.length === 1 ? members.find((m) => m.id === selectedIds[0]) : null),
    [members, selectedIds],
  );

  const handleSelectAll = (event: { target: { checked: boolean } }) => {
    if (event.target.checked) {
      setSelectedIds(displayedData.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleRowSelect = (memberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(memberId) ? prev.filter((idValue) => idValue !== memberId) : [...prev, memberId],
    );
  };

  const handleConfirmUnassign = async () => {
    if (idsToUnassign.length === 0) return;

    try {
      for (const memberId of idsToUnassign) {
        await unassignMutation.mutateAsync({ clienteId: memberId });
      }
      toast.success(`${idsToUnassign.length} sociedad(es) desasignada(s)`);
      setSelectedIds((prev) => prev.filter((memberId) => !idsToUnassign.includes(memberId)));
      setIdsToUnassign([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al desasignar sociedades';
      toast.error(message);
    }
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-bg-intermediate">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-fenix-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500">Sociedades</h2>
              <p className="text-sm text-gray-400">
                {totalItems} sociedad{totalItems !== 1 ? 'es' : ''} vinculada{totalItems !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2 w-full md:w-auto justify-between md:justify-start">
                <span className="text-sm text-fenix-400 font-medium">
                  {selectedIds.length} seleccionado(s)
                </span>
                <div className="flex items-center gap-1 ml-2">
                  {selectedIds.length === 1 && selectedMember && (
                    <Link
                      to="/app/clientes/$id/editar"
                      params={{ id: selectedMember.id }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                      title="Editar sociedad"
                    >
                      <Edit size={16} />
                    </Link>
                  )}
                  <button
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={`Quitar ${selectedIds.length} sociedad(es) de la cartera`}
                    onClick={() => setIdsToUnassign([...selectedIds])}
                    disabled={unassignMutation.isPending}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                    title="Cancelar selección"
                    onClick={() => setSelectedIds([])}
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-1 md:flex-initial">
                  <label className="flex items-center gap-2 text-sm font-medium text-fenix-600 dark:text-fenix-400 whitespace-nowrap">
                    <Search size={16} />
                    Buscar
                  </label>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="glass-input w-full md:w-64"
                    placeholder="Nombre, DNI o CIF..."
                  />
                </div>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 text-white font-bold cursor-pointer"
                >
                  <Plus size={16} />
                  Asignar más
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <DataTableSkeleton rowCount={8} columnCount={6} />
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                style={{ borderBottomColor: tableBorderColor }}
              >
                <th className="p-4 w-10 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Seleccionar todas"
                    className="w-5 h-5 rounded-full border-2 border-slate-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                  />
                </th>
                <th className="p-4 text-left">Sociedad</th>
                <th className="p-4 text-left">DNI / CIF</th>
                <th className="p-4 text-center">Puntos</th>
                <th className="p-4 text-right">Consumo Anual</th>
                <th className="p-4 text-center">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fenix-500/10">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-secondary">
                    No hay sociedades asociadas a esta cartera.
                  </td>
                </tr>
              ) : (
                displayedData.map((member) => {
                  const isSelected = selectedIds.includes(member.id);
                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-fenix-500/5 transition-colors ${isSelected ? 'bg-fenix-500/15 hover:bg-fenix-500/20' : ''}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(member.id)}
                          aria-label={`Seleccionar sociedad ${member.nombre}`}
                          className="w-5 h-5 rounded-full border-2 border-primary bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                        />
                      </td>
                      <td className="p-4">
                        <Link
                          to="/app/clientes/$id"
                          params={{ id: member.id }}
                          className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors"
                        >
                          {member.nombre}
                        </Link>
                      </td>
                      <td className="p-4 text-secondary text-sm">{member.dni || member.cif || '—'}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                            member.puntos_count > 0
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                          }`}
                        >
                          {member.puntos_count}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-sm text-secondary">
                        {member.total_kwh ? `${member.total_kwh.toLocaleString('es-ES')} kWh` : '—'}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                            member.activo
                              ? 'bg-green-500/15 text-green-500 border-green-500/30'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}
                        >
                          {member.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && totalItems > 0 && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t"
          style={{ borderTopColor: tableBorderColor }}
        >
          <div className="text-sm text-secondary">
            Total: <span className="text-primary font-bold">{totalItems}</span> registros • Página <span className="text-primary font-bold">{currentPage}</span> de <span className="text-primary font-bold">{totalPages || 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="Primera página"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              title="Página anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              title="Página siguiente"
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Última página"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>
      )}

      <AsignarSociedadesGrupoModal
        isOpen={showAssignModal}
        grupoId={id}
        currentClienteIds={grupo?.cliente_ids || []}
        onClose={() => setShowAssignModal(false)}
      />

      <ConfirmationModal
        isOpen={idsToUnassign.length > 0}
        onClose={() => setIdsToUnassign([])}
        onConfirm={handleConfirmUnassign}
        title="Quitar sociedades de cartera"
        message={`Se desasignarán ${idsToUnassign.length} sociedad(es) de esta cartera. ¿Deseas continuar?`}
        confirmText="Quitar"
        cancelText="Cancelar"
        confirmButtonClass="danger"
        isConfirming={unassignMutation.isPending}
      />
    </div>
  );
}
