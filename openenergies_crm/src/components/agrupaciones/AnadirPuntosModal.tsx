// src/components/agrupaciones/AnadirPuntosModal.tsx
import { useState, useMemo } from 'react';
import { X, Search, Plus, Loader2 } from 'lucide-react';
import { useAnadirPuntosAgrupacion, usePuntosSinAgrupar } from '@hooks/useAgrupaciones';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agrupacionId: string;
  agrupacionNombre: string;
  clienteId?: string;
}

export default function AnadirPuntosModal({ isOpen, onClose, agrupacionId, agrupacionNombre, clienteId }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  const { data: puntosSinAgrupar, isLoading: loadingPuntos } = usePuntosSinAgrupar(clienteId);
  const anadirMutation = useAnadirPuntosAgrupacion(clienteId);

  const filteredPuntos = useMemo(() => {
    if (!puntosSinAgrupar) return [];
    if (!searchFilter.trim()) return puntosSinAgrupar;
    const term = searchFilter.toLowerCase().trim();
    return puntosSinAgrupar.filter(p =>
      (p.cups?.toLowerCase() || '').includes(term) ||
      (p.direccion_sum?.toLowerCase() || '').includes(term) ||
      (p.localidad_sum?.toLowerCase() || '').includes(term) ||
      (p.provincia_sum?.toLowerCase() || '').includes(term)
    );
  }, [puntosSinAgrupar, searchFilter]);

  const togglePunto = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecciona al menos un punto');
      return;
    }

    try {
      await anadirMutation.mutateAsync({
        agrupacionId,
        puntoIds: selectedIds,
      });
      toast.success(`${selectedIds.length} punto(s) añadido(s) a "${agrupacionNombre}"`);
      resetAndClose();
    } catch {
      toast.error('Error al añadir puntos');
    }
  };

  const resetAndClose = () => {
    setSelectedIds([]);
    setSearchFilter('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={resetAndClose}>
      <div className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20">
          <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Añadir puntos a "{agrupacionNombre}"
          </h3>
          <button
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            onClick={resetAndClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-3">
            <Search size={16} className="text-secondary" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Buscar por CUPS o dirección..."
              className="glass-input w-full text-sm"
            />
          </div>

          <p className="text-xs text-secondary mb-2">{selectedIds.length} punto(s) seleccionado(s)</p>

          <div className="border border-fenix-500/10 rounded-lg overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
            {loadingPuntos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
                <span className="ml-2 text-sm text-secondary">Cargando puntos...</span>
              </div>
            ) : filteredPuntos.length === 0 ? (
              <div className="text-center py-6 text-sm text-secondary">
                No hay puntos disponibles sin agrupación
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fenix-500/10 bg-bg-intermediate/50">
                    <th className="p-2 w-10"></th>
                    <th className="p-2 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">Dirección</th>
                    <th className="p-2 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">CUPS</th>
                    <th className="p-2 text-left text-[10px] font-bold text-secondary uppercase tracking-wider">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fenix-500/5">
                  {filteredPuntos.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-fenix-500/10' : 'hover:bg-fenix-500/5'}`}
                        onClick={() => togglePunto(p.id)}
                      >
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePunto(p.id)}
                            className="w-4 h-4 rounded border-2 border-slate-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 cursor-pointer accent-fenix-500"
                          />
                        </td>
                        <td className="p-2 text-primary text-xs">
                          {p.direccion_sum}
                          {p.localidad_sum ? `, ${p.localidad_sum}` : ''}
                        </td>
                        <td className="p-2">
                          <code className="text-xs font-mono text-fenix-600 dark:text-fourth">{p.cups}</code>
                        </td>
                        <td className="p-2">
                          <span className="text-xs text-secondary bg-bg-intermediate px-1.5 py-0.5 rounded font-bold">
                            {p.tipo_factura || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-fenix-500/20">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={anadirMutation.isPending || selectedIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {anadirMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Añadir {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
