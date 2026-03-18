import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAsignarClientesAGrupo, useBuscarClientesParaGrupo } from '@hooks/useGruposClientes';

type ClienteOption = {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  grupo_cliente_id: string | null;
};

interface Props {
  isOpen: boolean;
  grupoId: string;
  currentClienteIds: string[];
  onClose: () => void;
}

export default function AsignarSociedadesGrupoModal({
  isOpen,
  grupoId,
  currentClienteIds,
  onClose,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<ClienteOption[]>([]);

  const assignMutation = useAsignarClientesAGrupo();
  const excludeIds = useMemo(() => [...currentClienteIds, ...selected.map((s) => s.id)], [currentClienteIds, selected]);
  const { data: options = [], isLoading } = useBuscarClientesParaGrupo(searchTerm, excludeIds);

  if (!isOpen) return null;

  const addCliente = (client: ClienteOption) => {
    setSelected((prev) => {
      if (prev.some((p) => p.id === client.id)) return prev;
      return [...prev, client];
    });
    setSearchTerm('');
  };

  const removeCliente = (id: string) => {
    setSelected((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      toast.error('Selecciona al menos una sociedad');
      return;
    }

    try {
      await assignMutation.mutateAsync({ grupoId, clienteIds: selected.map((s) => s.id) });
      toast.success('Sociedades asignadas correctamente');
      onClose();
      setSelected([]);
      setSearchTerm('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al asignar sociedades';
      toast.error(message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-5xl glass-modal overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20">
          <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <Plus size={18} />
            Asignar sociedades a cartera
          </h3>
          <button onClick={onClose} className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busca por nombre, DNI o CIF"
              className="glass-input w-full pl-9"
            />
          </div>

          {searchTerm.trim().length >= 1 && (
            <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-fenix-500/10 bg-bg-secondary">
              {isLoading ? (
                <div className="p-3 text-sm text-secondary flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Buscando sociedades...
                </div>
              ) : (options as ClienteOption[]).length === 0 ? (
                <div className="p-3 text-sm text-secondary">No hay resultados</div>
              ) : (
                (options as ClienteOption[]).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => addCliente(client)}
                    className="w-full text-left px-3 py-2 hover:bg-fenix-500/10 transition-colors cursor-pointer"
                  >
                    <div className="text-sm font-medium text-primary">{client.nombre}</div>
                    <div className="text-xs text-secondary">
                      {client.dni || client.cif || 'Sin identificador'}
                      {client.grupo_cliente_id ? ' • Se movera desde otra cartera' : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {selected.length === 0 && <span className="text-xs text-secondary">No hay sociedades seleccionadas</span>}
            {selected.map((client) => (
              <span
                key={client.id}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-fenix-500/15 text-fenix-600 dark:text-fenix-400 text-xs font-medium"
              >
                {client.nombre}
                <button type="button" onClick={() => removeCliente(client.id)} className="cursor-pointer hover:text-red-400">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-fenix-500/20">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={assignMutation.isPending || selected.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 text-white font-bold disabled:opacity-50 cursor-pointer"
          >
            {assignMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Asignar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
