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
import { User, Phone, Loader2, Settings, Moon, Sun } from 'lucide-react';
import { useTheme } from '@hooks/ThemeContext';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';

const profileSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional().nullable(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});
type PasswordFormData = z.infer<typeof passwordSchema>;

type PerfilUsuario = UsuarioApp & { empresas: { nombre: string } | null };

async function fetchUserProfile(userId: string): Promise<PerfilUsuario> {
  const { data, error } = await supabase.from('usuarios_app').select('*, empresas(nombre)').eq('user_id', userId).single();
  if (error) throw error;
  return data as PerfilUsuario;
}

async function updateUserProfile({ userId, updates }: { userId: string, updates: ProfileFormData }) {
  const { error } = await supabase.from('usuarios_app').update(updates).eq('user_id', userId);
  if (error) throw error;
}

async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export default function PerfilPage() {
  const { userId, nombre: sessionNombre, avatar_url: sessionAvatarUrl } = useSession();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const { data: perfil, isLoading, isError } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: perfil ? {
      nombre: perfil.nombre ?? '',
      apellidos: perfil.apellidos ?? '',
      telefono: perfil.telefono ?? '',
    } : undefined
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      toast.success('Perfil actualizado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['sessionData'] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(`Error al actualizar el perfil: ${error.message}`);
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: updateUserPassword,
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente.');
      passwordForm.reset();
    },
    onError: (error) => {
      toast.error(`Error al actualizar la contraseña: ${error.message}`);
    },
  });

  const onSubmit = (formData: ProfileFormData) => {
    if (!userId) return;
    // Sanitize telefono to null if empty to avoid 400 errors or constraint issues
    const updates = {
      ...formData,
      telefono: formData.telefono || null,
    };
    updateProfileMutation.mutate({ userId, updates });
  };

  const onPasswordSubmit = (formData: PasswordFormData) => {
    updatePasswordMutation.mutate(formData.password);
  };

  const handleAvatarUploadSuccess = (newUrl: string) => {
    setLocalAvatarUrl(newUrl);
  };

  if (isLoading) {
    return (
      <div className="glass-card p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card p-6 text-red-400" role="alert">
        Error al cargar el perfil.
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="glass-card p-6 text-red-400" role="alert">
        No se encontró el perfil.
      </div>
    );
  }

  const displayNombre = perfil?.nombre ?? sessionNombre;
  const displayAvatarUrl = localAvatarUrl ?? perfil?.avatar_url ?? sessionAvatarUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-fenix-600 dark:text-fenix-500" />
        </div>
        <h1 className="text-2xl font-bold text-primary">Mi Perfil</h1>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Avatar and Summary */}
        <div className="space-y-6">
          <div className="glass-card p-6 flex flex-col items-center">
            {userId && (
              <Avatar
                userId={userId}
                url={displayAvatarUrl}
                onUpload={handleAvatarUploadSuccess}
                nombre={displayNombre}
                size={150}
              />
            )}
          </div>
          <div className="glass-card p-6 text-center">
            <h3 className="text-xl font-bold text-primary">
              {displayNombre} {perfil?.apellidos ?? ''}
            </h3>
            <p className="text-secondary mt-1">{perfil?.email ?? 'No disponible'}</p>
            <span className="inline-block mt-3 px-3 py-1 text-sm font-bold rounded-full bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 capitalize">
              {perfil?.rol ?? '...'}
            </span>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Info Card */}
          <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-primary">Datos Personales</h3>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  Editar
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nombre" className="block text-sm font-bold text-secondary uppercase tracking-tight mb-2">
                    Nombre
                  </label>
                  {isEditing ? (
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                      <input
                        id="nombre"
                        {...register('nombre')}
                        className="glass-input pl-10 w-full"
                      />
                    </div>
                  ) : (
                    <p className="text-primary font-medium py-2">{perfil?.nombre}</p>
                  )}
                  {errors.nombre && <p className="text-sm text-red-400 mt-1">{errors.nombre.message}</p>}
                </div>
                <div>
                  <label htmlFor="apellidos" className="block text-sm font-medium text-gray-300 mb-2">
                    Apellidos
                  </label>
                  {isEditing ? (
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                      <input
                        id="apellidos"
                        {...register('apellidos')}
                        className="glass-input pl-10 w-full"
                      />
                    </div>
                  ) : (
                    <p className="text-primary font-medium py-2">{perfil?.apellidos}</p>
                  )}
                  {errors.apellidos && <p className="text-sm text-red-400 mt-1">{errors.apellidos.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-300 mb-2">
                  Teléfono
                </label>
                {isEditing ? (
                  <div className="relative">
                    <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                    <input
                      id="telefono"
                      type="tel"
                      {...register('telefono')}
                      className="glass-input pl-10 w-full"
                    />
                  </div>
                ) : (
                  <p className="text-primary font-medium py-2">{perfil?.telefono || 'No especificado'}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-primary">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-bg-intermediate hover:bg-bg-secondary text-secondary font-medium transition-colors cursor-pointer"
                  onClick={() => { setIsEditing(false); reset(); }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            )}
          </form>

          {/* Aspecto Card */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Aspecto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${theme === 'light'
                  ? 'border-fenix-500 bg-fenix-500/10 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Sun size={20} className={theme === 'light' ? 'text-fenix-500' : ''} />
                  <span className="font-medium">Modo Claro</span>
                </div>
                {theme === 'light' && <div className="w-2 h-2 rounded-full bg-fenix-500 shadow-[0_0_8px_#10B981]" />}
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${theme === 'dark'
                  ? 'border-fenix-500 bg-fenix-500/10 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Moon size={20} className={theme === 'dark' ? 'text-fenix-500' : ''} />
                  <span className="font-medium">Modo Oscuro</span>
                </div>
                {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-fenix-500 shadow-[0_0_8px_#10B981]" />}
              </button>
            </div>
          </div>

          {/* 2FA Card */}
          <TwoFactorAuthManager />

          {/* Change Password Card */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Cambiar Contraseña</h3>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight mb-2">
                    Nueva Contraseña
                  </label>
                  <PasswordInput
                    id="password"
                    {...passwordForm.register('password')}
                  />
                  {passwordForm.formState.errors.password && (
                    <p className="text-sm text-red-400 mt-1">{passwordForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight mb-2">
                    Confirmar Nueva Contraseña
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    {...passwordForm.register('confirmPassword')}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-400 mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting || !passwordForm.formState.isDirty}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {passwordForm.formState.isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {passwordForm.formState.isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

