import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { UsuarioApp } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { toast } from 'react-hot-toast';
import { ShieldCheck, ShieldOff, KeyRound, Trash2, Pencil, UserRoundPlus, Users, Loader2 } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { useSortableTable } from '@hooks/useSortableTable';

type UsuarioConEmpresa = UsuarioApp & { empresas: { nombre: string } | null };

const initialColumnFilters = {
  rol: [] as string[],
};

async function fetchUsuarios(): Promise<UsuarioConEmpresa[]> {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('*, empresas(nombre)')
    .order('creado_en', { ascending: false });

  if (error) throw error;
  return data as UsuarioConEmpresa[];
}

async function toggleUserActive({ userId, newActiveState }: { userId: string; newActiveState: boolean }) {
  const { error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'toggle-active', payload: { userId, newActiveState } }
  });
  if (error) throw new Error(error.message);
}

async function resetUserPassword({ email }: { email: string }) {
  const { error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'reset-password', payload: { email } }
  });
  if (error) throw new Error(error.message);
}

async function deleteUser({ userId }: { userId: string }) {
  const { error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'delete', payload: { userId } }
  });
  if (error) throw new Error(error.message);
}

export default function UsuariosList() {
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useSession();
  const { data: fetchedData, isLoading, isError } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [userToDelete, setUserToDelete] = useState<UsuarioConEmpresa | null>(null);
  const [userToReset, setUserToReset] = useState<{ email: string } | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => {
      toast.success('Estado del usuario actualizado.');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => toast.success('Correo de restablecimiento enviado.'),
    onError: (error) => {
      if (error.message !== 'Acción cancelada') {
        toast.error(`Error: ${error.message}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success('Usuario eliminado correctamente.');
      setUserToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (error) => toast.error(`Error al eliminar: ${error.message}`),
  });

  const filterOptions = useMemo(() => ({
    rol: ['administrador', 'comercial', 'cliente'],
  }), []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => (
      columnFilters.rol.length === 0 || columnFilters.rol.includes(item.rol)
    ));
  }, [fetchedData, columnFilters]);

  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
  } = useSortableTable<UsuarioConEmpresa>(filteredData, {
    sortValueAccessors: {
      nombre_completo: (item: UsuarioConEmpresa) => `${item.nombre ?? ''} ${item.apellidos ?? ''}`.trim(),
      empresa_nombre: (item: UsuarioConEmpresa) => item.empresas?.nombre,
    } as unknown as Partial<Record<string, (item: UsuarioConEmpresa) => any>>
  });

  const isFiltered = columnFilters.rol.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Gestión de Usuarios</h1>
            <p className="text-secondary opacity-70">Administra los accesos y roles de la plataforma.</p>
          </div>
        </div>

        <Link to="/app/usuarios/invitar">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all duration-200 cursor-pointer">
            <UserRoundPlus size={18} />
            Invitar
          </button>
        </Link>
      </div>

      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-red-400">Error al cargar los usuarios.</p>
          </div>
        )}

        {fetchedData && fetchedData.length === 0 && !isLoading && !isFiltered && (
          <EmptyState
            title="No hay usuarios"
            description="Invita a tu primer colaborador o da de alta a un cliente."
          />
        )}

        {fetchedData && fetchedData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold">
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('nombre_completo' as unknown as any)}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Nombre {renderSortIcon('nombre_completo' as unknown as any)}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('email' as unknown as any)}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Email {renderSortIcon('email' as unknown as any)}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSort('rol' as unknown as any)}
                        className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                      >
                        Rol {renderSortIcon('rol' as unknown as any)}
                      </button>
                      <ColumnFilterDropdown
                        columnName="Rol"
                        options={filterOptions.rol}
                        selectedOptions={columnFilters.rol}
                        onChange={(selected) => handleColumnFilterChange('rol', selected as string[])}
                      />
                    </div>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('empresa_nombre' as unknown as any)}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Empresa {renderSortIcon('empresa_nombre' as unknown as any)}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleSort('activo')}
                      className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                    >
                      Estado {renderSortIcon('activo')}
                    </button>
                  </th>
                  <th className="p-4 text-right">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fenix-500/10">
                {displayedData.length > 0 ? (
                  displayedData.map(u => (
                    <tr key={u.user_id} className="hover:bg-bg-intermediate/50 transition-colors">
                      <td className="p-4 font-bold text-secondary">
                        {u.nombre} {u.apellidos}
                      </td>
                      <td className="p-4 text-secondary font-medium">{u.email}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 text-xs font-bold rounded-md bg-bg-intermediate text-secondary">
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4 text-secondary font-medium">{u.empresas?.nombre ?? '—'}</td>
                      <td className="p-4">
                        <span className={`
                          px-2 py-1 text-xs font-bold rounded-full
                          ${u.activo
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'}
                        `}>
                          {u.activo ? 'Activo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            to="/app/usuarios/$id/editar"
                            params={{ id: u.user_id }}
                            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                            title="Editar usuario"
                          >
                            <Pencil size={16} />
                          </Link>
                          <button
                            className={`
                              p-1.5 rounded-lg transition-colors
                              ${u.activo
                                ? 'text-secondary hover:text-amber-500 hover:bg-amber-500/10'
                                : 'text-secondary hover:text-green-500 hover:bg-green-500/10'}
                              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400
                            `}
                            onClick={() => toggleActiveMutation.mutate({ userId: u.user_id, newActiveState: !u.activo })}
                            disabled={u.user_id === currentUserId || toggleActiveMutation.isPending}
                            title={u.user_id === currentUserId ? "No puedes bloquearte a ti mismo" : (u.activo ? "Bloquear usuario" : "Activar usuario")}
                          >
                            <span className={u.user_id === currentUserId ? "cursor-not-allowed" : "cursor-pointer"}>

                              {u.activo ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                            </span>
                          </button>

                          <button
                            className="p-1.5 rounded-lg text-secondary hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            onClick={() => setUserToReset({ email: u.email! })}
                            disabled={resetPasswordMutation.isPending}
                            title="Enviar correo de restablecimiento de contraseña"
                          >
                            <KeyRound size={16} />
                          </button>

                          <button
                            className="p-1.5 rounded-lg text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            onClick={() => setUserToDelete(u)}
                            disabled={u.user_id === currentUserId || deleteMutation.isPending}
                            title={u.user_id === currentUserId ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
                          >
                            <span className={u.user_id === currentUserId ? "cursor-not-allowed" : "cursor-pointer"}>
                              <Trash2 size={16} />
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Sin resultados que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md glass-modal p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-primary mb-4">Confirmar Eliminación</h3>
            <p className="text-secondary mb-6">
              ¿Estás seguro de que quieres eliminar al usuario <strong className="text-primary">{userToDelete.nombre} {userToDelete.apellidos}</strong>?
              <br />
              <span className="text-red-500 font-medium text-sm">Esta acción es irreversible.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-bg-intermediate hover:bg-white/20 border border-transparent text-gray-300 transition-colors cursor-pointer"
                onClick={() => setUserToDelete(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white transition-colors disabled:opacity-50 cursor-pointer"
                onClick={() => deleteMutation.mutate({ userId: userToDelete.user_id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {userToReset && (
        <ConfirmationModal
          isOpen={!!userToReset}
          onClose={() => setUserToReset(null)}
          onConfirm={() => {
            resetPasswordMutation.mutate({ email: userToReset.email });
            setUserToReset(null);
          }}
          title="Confirmar Restablecimiento"
          message={`¿Estás seguro de que quieres enviar un correo de restablecimiento de contraseña a ${userToReset.email}?`}
          confirmText="Sí, Enviar Correo"
          cancelText="Cancelar"
          confirmButtonClass="warning"
          isConfirming={resetPasswordMutation.isPending}
        />
      )}
    </div>
  );
}

