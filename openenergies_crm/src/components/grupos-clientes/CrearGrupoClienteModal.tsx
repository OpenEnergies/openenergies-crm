import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useBuscarClientesParaGrupo, useCrearGrupoCliente } from '@hooks/useGruposClientes';

type ClienteOption = {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  grupo_cliente_id: string | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (groupId: string) => void;
}

export default function CrearGrupoClienteModal({ isOpen, onClose, onCreated }: Props) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientes, setSelectedClientes] = useState<ClienteOption[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const createMutation = useCrearGrupoCliente();
  const { data: clienteOptions = [], isLoading: loadingClients } = useBuscarClientesParaGrupo(
    searchTerm,
    selectedClientes.map((c) => c.id),
  );

  const isNonPngLogo = useMemo(() => !!logoFile && logoFile.type !== 'image/png', [logoFile]);

  useEffect(() => {
    if (!isOpen) {
      setNombre('');
      setDescripcion('');
      setSearchTerm('');
      setSelectedClientes([]);
      setLogoFile(null);
    }
  }, [isOpen]);

  const availableOptions = clienteOptions as ClienteOption[];

  const addCliente = (client: ClienteOption) => {
    setSelectedClientes((prev) => {
      if (prev.some((p) => p.id === client.id)) return prev;
      return [...prev, client];
    });
    setSearchTerm('');
  };

  const removeCliente = (clientId: string) => {
    setSelectedClientes((prev) => prev.filter((c) => c.id !== clientId));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setLogoFile(null);
      return;
    }

    const accepted = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!accepted.includes(nextFile.type)) {
      toast.error('Solo se permiten archivos PNG, JPG o SVG');
      event.target.value = '';
      return;
    }

    setLogoFile(nextFile);
  };

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre de la cartera es obligatorio');
      return;
    }

    try {
      const groupId = await createMutation.mutateAsync({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        clienteIds: selectedClientes.map((c) => c.id),
        logoFile,
      });

      toast.success('Cartera creada correctamente');
      onClose();
      onCreated?.(groupId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear la cartera';
      toast.error(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl glass-modal overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20">
          <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nueva cartera de clientes
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="glass-input w-full"
              placeholder="Nombre de la cartera"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Descripcion</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="glass-input w-full resize-none"
              rows={3}
              placeholder="Descripcion de la cartera"
            />
          </div>

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Sociedades</label>
            <div className="rounded-xl border border-fenix-500/20 bg-bg-intermediate/20 p-3 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="glass-input w-full pl-9"
                  placeholder="Escribe para buscar y anadir sociedades por nombre o DNI/CIF"
                />
              </div>

              {searchTerm.trim().length >= 1 && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-fenix-500/10 bg-bg-secondary">
                  {loadingClients ? (
                    <div className="p-3 text-sm text-secondary flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Buscando sociedades...
                    </div>
                  ) : availableOptions.length === 0 ? (
                    <div className="p-3 text-sm text-secondary">No se encontraron sociedades</div>
                  ) : (
                    availableOptions.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => addCliente(client)}
                        className="w-full text-left px-3 py-2 hover:bg-fenix-500/10 transition-colors cursor-pointer"
                      >
                        <div className="text-sm font-medium text-primary">{client.nombre}</div>
                        <div className="text-xs text-secondary">
                          {client.dni || client.cif || 'Sin identificador'}
                          {client.grupo_cliente_id ? ' • Actualmente en otra cartera' : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedClientes.length === 0 && (
                  <span className="text-xs text-secondary">No hay sociedades seleccionadas</span>
                )}
                {selectedClientes.map((client) => (
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
          </div>

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Adjuntar logo</label>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-fenix-500/30 hover:border-fenix-500/60 transition-colors cursor-pointer">
              <Upload size={16} className="text-fenix-500" />
              <span className="text-sm text-primary">
                {logoFile ? logoFile.name : 'Seleccionar PNG, JPG o SVG'}
              </span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>
            {isNonPngLogo && (
              <p className="text-xs text-amber-500 mt-2">
                El archivo se transformara a PNG al guardar la cartera y puede perder formato.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-fenix-500/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !nombre.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Confirmar nueva cartera
          </button>
        </div>
      </div>
    </div>
  );
}
