import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Loader2, Search, Upload, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  useActualizarGrupoCliente,
  useAsignarClientesAGrupo,
  useBuscarClientesParaGrupo,
  useDesasignarClienteDeGrupo,
  useGrupoClienteMembers,
  type GrupoClienteDetail,
} from '@hooks/useGruposClientes';

type ClienteOption = {
  id: string;
  nombre: string;
  dni: string | null;
  cif: string | null;
  grupo_cliente_id: string | null;
};

interface Props {
  isOpen: boolean;
  grupo: GrupoClienteDetail | null;
  onClose: () => void;
}

export default function EditarGrupoClienteModal({ isOpen, grupo, onClose }: Props) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientes, setSelectedClientes] = useState<ClienteOption[]>([]);
  const [removedClienteIds, setRemovedClienteIds] = useState<string[]>([]);

  const updateMutation = useActualizarGrupoCliente();
  const assignMutation = useAsignarClientesAGrupo();
  const unassignMutation = useDesasignarClienteDeGrupo();

  const { data: currentMembers = [] } = useGrupoClienteMembers(grupo?.id, '');

  const excludeIds = useMemo(
    () => [
      ...currentMembers.filter((member) => !removedClienteIds.includes(member.id)).map((member) => member.id),
      ...selectedClientes.map((client) => client.id),
    ],
    [currentMembers, removedClienteIds, selectedClientes],
  );

  const { data: clienteOptions = [], isLoading: loadingClients } = useBuscarClientesParaGrupo(searchTerm, excludeIds);

  const isNonPngLogo = useMemo(() => !!logoFile && logoFile.type !== 'image/png', [logoFile]);

  useEffect(() => {
    if (isOpen && grupo) {
      setNombre(grupo.nombre);
      setDescripcion(grupo.descripcion || '');
      setLogoFile(null);
      setRemoveLogo(false);
      setSearchTerm('');
      setSelectedClientes([]);
      setRemovedClienteIds([]);
    }
  }, [isOpen, grupo]);

  if (!isOpen || !grupo) return null;

  const availableOptions = clienteOptions as ClienteOption[];

  const addCliente = (client: ClienteOption) => {
    setSelectedClientes((prev) => {
      if (prev.some((item) => item.id === client.id)) return prev;
      return [...prev, client];
    });
    setSearchTerm('');
  };

  const removeSelectedCliente = (clienteId: string) => {
    setSelectedClientes((prev) => prev.filter((client) => client.id !== clienteId));
  };

  const toggleRemoveCurrentCliente = (clienteId: string) => {
    setRemovedClienteIds((prev) =>
      prev.includes(clienteId) ? prev.filter((idValue) => idValue !== clienteId) : [...prev, clienteId],
    );
  };

  const handleSubmit = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre de la cartera es obligatorio');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        grupoId: grupo.id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        logoFile,
        removeLogo,
      });

      if (selectedClientes.length > 0) {
        await assignMutation.mutateAsync({
          grupoId: grupo.id,
          clienteIds: selectedClientes.map((client) => client.id),
        });
      }

      if (removedClienteIds.length > 0) {
        await Promise.all(
          removedClienteIds.map((clienteId) =>
            unassignMutation.mutateAsync({ clienteId }),
          ),
        );
      }

      toast.success('Cartera actualizada');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar la cartera';
      toast.error(message);
    }
  };

  const isSaving = updateMutation.isPending || assignMutation.isPending || unassignMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl glass-modal overflow-hidden max-h-[90vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-fenix-500/20">
          <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar cartera
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

              <div className="space-y-2">
                <p className="text-xs text-secondary uppercase tracking-wider font-medium">Sociedades actuales</p>
                <div className="flex flex-wrap gap-2">
                  {currentMembers.filter((member) => !removedClienteIds.includes(member.id)).length === 0 && (
                    <span className="text-xs text-secondary">No hay sociedades actualmente asociadas</span>
                  )}
                  {currentMembers
                    .filter((member) => !removedClienteIds.includes(member.id))
                    .map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-fenix-500/15 text-fenix-600 dark:text-fenix-400 text-xs font-medium"
                      >
                        {member.nombre}
                        <button
                          type="button"
                          onClick={() => toggleRemoveCurrentCliente(member.id)}
                          className="cursor-pointer hover:text-red-400"
                          title="Quitar de esta cartera"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-secondary uppercase tracking-wider font-medium">Nuevas sociedades a asignar</p>
                <div className="flex flex-wrap gap-2">
                  {selectedClientes.length === 0 && (
                    <span className="text-xs text-secondary">No hay nuevas sociedades seleccionadas</span>
                  )}
                  {selectedClientes.map((client) => (
                    <span
                      key={client.id}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-medium"
                    >
                      {client.nombre}
                      <button
                        type="button"
                        onClick={() => removeSelectedCliente(client.id)}
                        className="cursor-pointer hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-secondary font-medium uppercase tracking-wider mb-1.5">Adjuntar logo</label>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-fenix-500/30 hover:border-fenix-500/60 transition-colors cursor-pointer">
              <Upload size={16} className="text-fenix-500" />
              <span className="text-sm text-primary">{logoFile ? logoFile.name : 'Seleccionar PNG, JPG o SVG'}</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              />
            </label>
            {isNonPngLogo && (
              <p className="text-xs text-amber-500 mt-2">
                El archivo se transformara a PNG al guardar la cartera y puede perder formato.
              </p>
            )}
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={removeLogo}
                onChange={(event) => setRemoveLogo(event.target.checked)}
                className="accent-fenix-500"
              />
              Quitar logo actual
            </label>
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
            disabled={isSaving || !nombre.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 text-white font-bold disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Edit size={16} />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
