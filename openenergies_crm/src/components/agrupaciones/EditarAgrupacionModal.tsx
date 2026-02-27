// src/components/agrupaciones/EditarAgrupacionModal.tsx
import { useState, useEffect } from 'react';
import { X, Edit, Loader2 } from 'lucide-react';
import { useEditarAgrupacion, type TipoAgrupacion, type Agrupacion } from '@hooks/useAgrupaciones';
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
  agrupacion: Agrupacion;
  clienteId?: string;
}

export default function EditarAgrupacionModal({ isOpen, onClose, agrupacion, clienteId }: Props) {
  const [nombre, setNombre] = useState(agrupacion.nombre);
  const [tipo, setTipo] = useState<TipoAgrupacion>(agrupacion.tipo);
  const [codigo, setCodigo] = useState(agrupacion.codigo || '');
  const [direccion, setDireccion] = useState(agrupacion.direccion || '');
  const [descripcion, setDescripcion] = useState(agrupacion.descripcion || '');
  const editarMutation = useEditarAgrupacion(clienteId);

  useEffect(() => {
    if (isOpen) {
      setNombre(agrupacion.nombre);
      setTipo(agrupacion.tipo);
      setCodigo(agrupacion.codigo || '');
      setDireccion(agrupacion.direccion || '');
      setDescripcion(agrupacion.descripcion || '');
    }
  }, [isOpen, agrupacion]);

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      await editarMutation.mutateAsync({
        id: agrupacion.id,
        nombre: nombre.trim(),
        tipo,
        codigo: codigo.trim() || undefined,
        direccion: direccion.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
      });
      toast.success('Agrupación actualizada');
      onClose();
    } catch {
      toast.error('Error al actualizar la agrupación');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg glass-modal overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20">
          <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar Agrupación
          </h3>
          <button
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
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

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="glass-input w-full"
            />
          </div>

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

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              className="glass-input w-full resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-fenix-500/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={editarMutation.isPending || !nombre.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {editarMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Edit size={16} />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
