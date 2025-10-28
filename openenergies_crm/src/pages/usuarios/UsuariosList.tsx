import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { UsuarioApp } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { clsx } from '@lib/utils';
import { toast } from 'react-hot-toast';
// ¡Importamos los nuevos iconos!
import { ShieldCheck, ShieldOff, KeyRound, Trash2, Pencil, UserRoundPlus } from 'lucide-react';
import ConfirmationModal from '@components/ConfirmationModal'; // Ajusta la ruta si es necesario
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import { useSortableTable } from '@hooks/useSortableTable';

// Tipado extendido para incluir el nombre de la empresa
type UsuarioConEmpresa = UsuarioApp & { empresas: { nombre: string } | null };
// Usamos keyof UsuarioConEmpresa para las claves reales y añadimos las virtuales
type SortableUserKey = keyof UsuarioConEmpresa | 'nombre_completo' | 'empresa_nombre';

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

// --- Lógica para las acciones ---
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
  const { userId: currentUserId } = useSession(); // Para no poder bloquearse a uno mismo
  const { data: fetchedData, isLoading, isError } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);

  // Estado para controlar el modal
  const [userToDelete, setUserToDelete] = useState<UsuarioConEmpresa | null>(null);
  const [userToReset, setUserToReset] = useState<{ email: string } | null>(null);

  // Mutación para cambiar el estado de activo/inactivo
  const toggleActiveMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => {
      toast.success('Estado del usuario actualizado.');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] }); // Refresca la lista
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  // Mutación para resetear la contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => toast.success('Correo de restablecimiento enviado.'),
    onError: (error) => {
      // No mostramos el error si el usuario canceló la acción
      if (error.message !== 'Acción cancelada') {
        toast.error(`Error: ${error.message}`);
      }
    },
  });

  // NUEVA Mutación para eliminar usuario
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success('Usuario eliminado correctamente.');
      setUserToDelete(null); // Cierra el modal
      queryClient.invalidateQueries({ queryKey: ['usuarios'] }); // Refresca la lista
    },
    onError: (error) => toast.error(`Error al eliminar: ${error.message}`),
  });

  const filterOptions = useMemo(() => {
    return {
      rol: ['administrador', 'comercial', 'cliente'],
    };
  }, []);

  const handleColumnFilterChange = (column: keyof typeof initialColumnFilters, selected: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  };

  // --- 👇 2. Filtra primero los datos ---
  const filteredData = useMemo(() => {
    if (!fetchedData) return [];
    return fetchedData.filter(item => {
      return (
        (columnFilters.rol.length === 0 || columnFilters.rol.includes(item.rol))
      );
    });
  }, [fetchedData, columnFilters]);

  // --- 👇 3. Usa el hook useSortableTable con los datos filtrados ---
  const {
    sortedData: displayedData,
    handleSort,
    renderSortIcon
    // --- 👇 Tipamos el hook explícitamente con las claves posibles ---
  } = useSortableTable<UsuarioConEmpresa>(filteredData, {
    // ---------------------------------------------------------------
    sortValueAccessors: {
      // --- 👇 2. TIPOS EXPLÍCITOS para 'item' ---
      nombre_completo: (item: UsuarioConEmpresa) => `${item.nombre ?? ''} ${item.apellidos ?? ''}`.trim(),
      empresa_nombre: (item: UsuarioConEmpresa) => item.empresas?.nombre,
      // -------------------------------------------
    } as unknown as Partial<Record<string, (item: UsuarioConEmpresa) => any>>
  });

  const isFiltered = columnFilters.rol.length > 0;

  return (
    <div className="grid">
      <div className="page-header">
        <h2>Gestión de Usuarios</h2>
        <div className="page-actions">
          <Link to="/app/usuarios/invitar" ><button><UserRoundPlus /></button></Link>
        </div>
      </div>
      <div className="card">
        {isLoading && <div className="card">Cargando usuarios...</div>}
        {isError && <div className="card" role="alert">Error al cargar los usuarios.</div>}

        {fetchedData && fetchedData.length === 0 && !isLoading && !isFiltered && (
          <EmptyState 
            title="No hay usuarios"
            description="Invita a tu primer colaborador o da de alta a un cliente."
          />
        )}
        {fetchedData && fetchedData.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{/* Usa la clave 'nombre_completo' definida en los accessors */}
                    <button onClick={() => handleSort('nombre_completo' as unknown as any)} className="sortable-header">
                      Nombre {renderSortIcon('nombre_completo' as unknown as any)}
                    </button></th>
                  <th>
                    <button onClick={() => handleSort('email' as unknown as any)} className="sortable-header">
                      Email {renderSortIcon('email' as unknown as any)}
                    </button></th>
                  <th>
                    <button onClick={() => handleSort('rol' as unknown as any)} className="sortable-header">
                       Rol {renderSortIcon('rol' as unknown as any)}
                     </button>
                    <ColumnFilterDropdown
                      columnName="Rol"
                      options={filterOptions.rol}
                      selectedOptions={columnFilters.rol}
                      onChange={(selected) => handleColumnFilterChange('rol', selected as string[])}
                    />
                  </th>
                  <th>
                    <button onClick={() => handleSort('empresa_nombre' as unknown as any)} className="sortable-header">
                       Empresa {renderSortIcon('empresa_nombre' as unknown as any)}
                     </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort('activo')} className="sortable-header">
                       Estado {renderSortIcon('activo')}
                     </button>
                  </th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedData.length > 0 ? (
                  displayedData.map(u => (
                  <tr key={u.user_id}>
                    <td>{u.nombre} {u.apellidos}</td>
                    <td>{u.email}</td>
                    <td><span className="kbd">{u.rol}</span></td>
                    <td>{u.empresas?.nombre ?? '—'}</td>
                    <td>
                      <span className={`badge ${u.activo ? 'active' : 'inactive'}`}>
                        {u.activo ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        {/* --- ¡NUEVO BOTÓN AÑADIDO! --- */}
                        <Link
                          to="/app/usuarios/$id/editar"
                          params={{ id: u.user_id }}
                          className="icon-button secondary"
                          title="Editar usuario"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button 
                          className={clsx('icon-button', u.activo ? 'secondary' : 'success')}
                          onClick={() => toggleActiveMutation.mutate({ userId: u.user_id, newActiveState: !u.activo })}
                          disabled={u.user_id === currentUserId || toggleActiveMutation.isPending}
                          title={u.user_id === currentUserId ? "No puedes bloquearte a ti mismo" : (u.activo ? "Bloquear usuario" : "Activar usuario")}
                        >
                          {u.activo ? <ShieldOff size={18} /> : <ShieldCheck size={18} />}
                        </button>
                        
                        <button 
                          // --- ¡CAMBIO AQUÍ! ---
                          className="icon-button warning" // Cambiamos 'secondary' por 'warning'
                          onClick={() => setUserToReset({ email: u.email! })}
                          disabled={resetPasswordMutation.isPending}
                          title="Enviar correo de restablecimiento de contraseña"
                        >
                          <KeyRound size={18} />
                        </button>
                        
                        <button 
                          className="icon-button danger"
                          onClick={() => setUserToDelete(u)}
                          disabled={u.user_id === currentUserId || deleteMutation.isPending}
                          title={u.user_id === currentUserId ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{textAlign: 'center', padding: '2rem', color: 'var(--muted)'}}>
                    Sin resultados que coincidan con los filtros.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- NUEVO: Modal de Confirmación --- */}
      {userToDelete && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3 style={{marginTop: 0}}>Confirmar Eliminación</h3>
            <p>
              ¿Estás seguro de que quieres eliminar al usuario <strong>{userToDelete.nombre} {userToDelete.apellidos}</strong>?
              <br />
              Esta acción es irreversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="secondary" onClick={() => setUserToDelete(null)}>
                Cancelar
              </button>
              <button 
                className="danger" 
                onClick={() => deleteMutation.mutate({ userId: userToDelete.user_id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {userToReset && (
        <ConfirmationModal
          isOpen={!!userToReset} // Abierto si userToReset tiene datos
          onClose={() => setUserToReset(null)} // Cierra al cancelar
          onConfirm={() => {
            // Llama a la mutación al confirmar
            resetPasswordMutation.mutate({ email: userToReset.email });
            setUserToReset(null); // Cierra el modal
          }}
          title="Confirmar Restablecimiento"
          message={`¿Estás seguro de que quieres enviar un correo de restablecimiento de contraseña a ${userToReset.email}?`}
          confirmText="Sí, Enviar Correo"
          cancelText="Cancelar"
          confirmButtonClass="warning" // Botón amarillo/naranja
          isConfirming={resetPasswordMutation.isPending} // Estado de carga
        />
      )}
    </div>
  );
}