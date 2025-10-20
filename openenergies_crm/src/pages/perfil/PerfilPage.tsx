import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import type { UsuarioApp } from '@lib/types';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Avatar from './Avatar';
import TwoFactorAuthManager from './TwoFactorAuthManager';
import { User, Phone, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Schema de validación para el formulario de perfil
const profileSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional().nullable(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

// --- Schema para el cambio de contraseña ---
const passwordSchema = z.object({
  password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});
type PasswordFormData = z.infer<typeof passwordSchema>;

// Tipado extendido para el perfil
type PerfilUsuario = UsuarioApp & { empresas: { nombre: string } | null };

// Función para obtener el perfil completo
async function fetchUserProfile(userId: string): Promise<PerfilUsuario> {
  const { data, error } = await supabase.from('usuarios_app').select('*, empresas(nombre)').eq('user_id', userId).single();
  if (error) throw error;
  return data as PerfilUsuario;
}

// Función para actualizar el perfil
async function updateUserProfile({ userId, updates }: { userId: string, updates: ProfileFormData }) {
  const { error } = await supabase.from('usuarios_app').update(updates).eq('user_id', userId);
  if (error) throw error;
}

// --- Función para cambiar la contraseña ---
async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export default function PerfilPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: perfil, isLoading, isError } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    // Cargamos los datos del perfil en el formulario cuando estén disponibles
    values: perfil ? {
      nombre: perfil.nombre ?? '',
      apellidos: perfil.apellidos ?? '',
      telefono: perfil.telefono ?? '',
    } : undefined
  });

  // --- NUEVO: Formulario para la contraseña ---
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      toast.success('Perfil actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      setIsEditing(false); // Volvemos al modo vista
    },
    onError: (error) => {
      toast.error(`Error al actualizar el perfil: ${error.message}`);
    },
  });

  // --- NUEVA: Mutación para la contraseña ---
  const updatePasswordMutation = useMutation({
    mutationFn: updateUserPassword,
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente.');
      passwordForm.reset(); // Limpiamos el formulario de contraseña
    },
    onError: (error) => {
      toast.error(`Error al actualizar la contraseña: ${error.message}`);
    },
  });

  const onSubmit = (formData: ProfileFormData) => {
    if (!userId) return;
    updateProfileMutation.mutate({ userId, updates: formData });
  };

  // --- NUEVA: Función de envío para la contraseña ---
  const onPasswordSubmit = (formData: PasswordFormData) => {
    updatePasswordMutation.mutate(formData.password);
  };

  if (isLoading) return <div className="card">Cargando perfil...</div>;
  if (isError) return <div className="card" role="alert">Error al cargar el perfil.</div>;

  return (
    // --- NUEVA ESTRUCTURA DE COLUMNAS ---
    <div className="profile-layout-grid">
      
      {/* --- COLUMNA IZQUIERDA: AVATAR Y DATOS CLAVE --- */}
      <div className="grid" style={{ gap: '1.5rem', alignContent: 'start' }}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          {userId && (
            <Avatar 
              userId={userId}
              url={perfil?.avatar_url ?? null}
              onUpload={() => queryClient.invalidateQueries({ queryKey: ['userProfile', userId] })}
            />
          )}
        </div>
        <div className="card">
          <div className="profile-summary">
            <h4>{perfil?.nombre} {perfil?.apellidos}</h4>
            <p>{perfil?.email}</p>
            <span className="badge" style={{textTransform: 'capitalize'}}>{perfil?.rol}</span>
          </div>
        </div>
      </div>

      {/* --- COLUMNA DERECHA: FORMULARIOS Y ACCIONES --- */}
      <div className="profile-forms-column">
        
        {/* --- TARJETA DE DATOS PERSONALES --- */}
        <form onSubmit={handleSubmit(onSubmit)} className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="page-header" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Datos Personales</h3>
            {!isEditing && <button type="button" onClick={() => setIsEditing(true)}>Editar</button>}
          </div>

          <div className="grid" style={{ gap: '2rem' }}>
            <div className="form-row">
              <div>
                <label htmlFor="nombre">Nombre</label>
                <div className="input-icon-wrapper">
                  <User size={18} className="input-icon" />
                  {isEditing ? <input id="nombre" {...register('nombre')} /> : <p className="profile-data-text">{perfil?.nombre}</p>}
                </div>
                 {errors.nombre && <p className="error-text">{errors.nombre.message}</p>}
              </div>
              <div>
                <label htmlFor="apellidos">Apellidos</label>
                <div className="input-icon-wrapper">
                  <User size={18} className="input-icon" />
                  {isEditing ? <input id="apellidos" {...register('apellidos')} /> : <p className="profile-data-text">{perfil?.apellidos}</p>}
                </div>
                 {errors.apellidos && <p className="error-text">{errors.apellidos.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="telefono">Teléfono</label>
              <div className="input-icon-wrapper">
                <Phone size={18} className="input-icon" />
                {isEditing ? <input id="telefono" type="tel" {...register('telefono')} /> : <p className="profile-data-text">{perfil?.telefono || 'No especificado'}</p>}
              </div>
            </div>
          </div>

          {isEditing && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="secondary" onClick={() => { setIsEditing(false); reset(); }}>Cancelar</button>
              <button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>

        {/* --- TARJETA DE 2FA --- */}
        <div style={{ marginBottom: '1.5rem' }}>
            <TwoFactorAuthManager />
        </div>

        {/* --- TARJETA DE CAMBIAR CONTRASEÑA --- */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cambiar Contraseña</h3>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid" style={{ gap: '1.5rem' }}>
            <div className="form-row">
              <div>
                <label htmlFor="password">Nueva Contraseña</label>
                <div className="input-icon-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input id="password" type="password" {...passwordForm.register('password')} />
                </div>
                {passwordForm.formState.errors.password && <p className="error-text">{passwordForm.formState.errors.password.message}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
                <div className="input-icon-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input id="confirmPassword" type="password" {...passwordForm.register('confirmPassword')} />
                </div>
                {passwordForm.formState.errors.confirmPassword && <p className="error-text">{passwordForm.formState.errors.confirmPassword.message}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={passwordForm.formState.isSubmitting || !passwordForm.formState.isDirty}>
                {passwordForm.formState.isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}