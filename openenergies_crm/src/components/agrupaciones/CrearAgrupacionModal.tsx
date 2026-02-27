// src/components/agrupaciones/CrearAgrupacionModal.tsx
import { useState, useMemo } from 'react';
import { X, Search, Plus, Loader2 } from 'lucide-react';
import { useCrearAgrupacion, usePuntosSinAgrupar, type TipoAgrupacion } from '@hooks/useAgrupaciones';
import { toast } from 'react-hot-toast';

const TIPOS: { value: TipoAgrupacion; label: string }[] = [
  { value: 'edificio', label: 'Edificio' },
  { value: 'grupo', label: 'Grupo' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'zona', label: 'Zona' },
  { value: 'cartera', label: 'Cartera' },
  { value: 'delegación', label: 'Delegación' },
  { value: 'centro', label: 'Centro' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clienteId?: string;
}

export default function CrearAgrupacionModal({ isOpen, onClose, clienteId }: Props) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoAgrupacion>('edificio');
  const [codigo, setCodigo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  const { data: puntosSinAgrupar, isLoading: loadingPuntos } = usePuntosSinAgrupar(clienteId);
  const crearMutation = useCrearAgrupacion(clienteId);

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
    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      await crearMutation.mutateAsync({
        nombre: nombre.trim(),
        tipo,
        codigo: codigo.trim() || undefined,
        direccion: direccion.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        puntoIds: selectedIds,
      });
      toast.success('Agrupación creada correctamente');
      resetAndClose();
    } catch {
      toast.error('Error al crear la agrupación');
    }
  };

  const resetAndClose = () => {
    setNombre('');
    setTipo('edificio');
    setCodigo('');
    setDireccion('');
    setDescripcion('');
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
            Nueva Agrupación
          </h3>
          <button
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            onClick={resetAndClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Tipo</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as TipoAgrupacion)}
              className="glass-input w-full"
            >
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Código */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Código identificador</label>
            <input
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Código único de la agrupación"
              className="glass-input w-full"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la agrupación"
              className="glass-input w-full"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Dirección de la agrupación"
              className="glass-input w-full"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              rows={2}
              className="glass-input w-full resize-none"
            />
          </div>

          {/* Selector de puntos */}
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">
              Seleccionar puntos ({selectedIds.length} seleccionados)
            </label>
            <div className="flex items-center gap-2 mb-2">
              <Search size={16} className="text-secondary" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Buscar por CUPS o dirección..."
                className="glass-input w-full text-sm"
              />
            </div>

            <div className="border border-fenix-500/10 rounded-lg overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
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
            disabled={crearMutation.isPending || !nombre.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {crearMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Crear Agrupación
          </button>
        </div>
      </div>
    </div>
  );
}
