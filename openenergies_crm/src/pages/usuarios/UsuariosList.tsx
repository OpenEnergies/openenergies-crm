import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { UsuarioApp } from '@lib/types';
import { EmptyState } from '@components/EmptyState';
import { useSession } from '@hooks/useSession';
import { clsx } from '@lib/utils';
// ¡Importamos los nuevos iconos!
import { ShieldCheck, ShieldOff, KeyRound, Trash2, Pencil } from 'lucide-react';

// Tipado extendido para incluir el nombre de la empresa
type UsuarioConEmpresa = UsuarioApp & { empresas: { nombre: string } | null };

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
  if (!window.confirm(`¿Estás seguro de que quieres enviar un correo de restablecimiento de contraseña a ${email}?`)) {
    throw new Error('Acción cancelada');
  }
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
  const { data: usuarios, isLoading, isError } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });

  // Estado para controlar el modal
  const [userToDelete, setUserToDelete] = useState<UsuarioConEmpresa | null>(null);

  // Mutación para cambiar el estado de activo/inactivo
  const toggleActiveMutation = useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => {
      alert('Estado del usuario actualizado.');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] }); // Refresca la lista
    },
    onError: (error) => alert(`Error: ${error.message}`),
  });

  // Mutación para resetear la contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => alert('Correo de restablecimiento enviado.'),
    onError: (error) => {
      // No mostramos el error si el usuario canceló la acción
      if (error.message !== 'Acción cancelada') {
        alert(`Error: ${error.message}`);
      }
    },
  });

  // NUEVA Mutación para eliminar usuario
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      alert('Usuario eliminado correctamente.');
      setUserToDelete(null); // Cierra el modal
      queryClient.invalidateQueries({ queryKey: ['usuarios'] }); // Refresca la lista
    },
    onError: (error) => alert(`Error al eliminar: ${error.message}`),
  });

  return (
    <div className="grid">
      <div className="page-header">
        <h2>Gestión de Usuarios</h2>
        <div className="page-actions">
          <Link to="/app/clientes/nuevo"><button className="secondary">Dar de Alta Cliente</button></Link>
          <Link to="/app/usuarios/invitar"><button>Invitar Colaborador</button></Link>
        </div>
      </div>
      <div className="card">
        {isLoading && <div className="card">Cargando usuarios...</div>}
        {isError && <div className="card" role="alert">Error al cargar los usuarios.</div>}
        {usuarios && usuarios.length === 0 && !isLoading && (
          <EmptyState 
            title="No hay usuarios"
            description="Invita a tu primer colaborador o da de alta a un cliente."
          />
        )}
        {usuarios && usuarios.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
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
                          onClick={() => resetPasswordMutation.mutate({ email: u.email! })}
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
                ))}
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
    </div>
  );
}