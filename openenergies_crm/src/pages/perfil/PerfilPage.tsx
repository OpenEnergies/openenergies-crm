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
import { User, Phone, Loader2, Settings, Moon, Sun, Shield, Lock } from 'lucide-react';
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
  const { userId, nombre: sessionNombre, avatar_url: sessionAvatarUrl, rol } = useSession();
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-fenix-600 dark:text-fenix-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Mi Perfil</h1>
          <p className="text-secondary text-sm">Gestiona tu información personal y configuración</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left Column: Avatar & Appearance (col-span-1) */}
        <div className="space-y-6">

          {/* Card 1: Profile Summary */}
          <div className="glass-card p-6 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-fenix-500/5 to-transparent pointer-events-none" />
            {userId && (
              <div className="relative z-10 mb-4">
                <Avatar
                  userId={userId}
                  url={displayAvatarUrl}
                  onUpload={handleAvatarUploadSuccess}
                  nombre={displayNombre}
                  size={120}
                />
              </div>
            )}
            <div className="relative z-10 w-full">
              <h3 className="text-xl font-bold text-primary truncate px-2">
                {displayNombre} {perfil?.apellidos ?? ''}
              </h3>
              <p className="text-secondary text-sm mt-1 mb-3 truncate px-2">{perfil?.email ?? 'No disponible'}</p>
              {rol === 'administrador' && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-fenix-500/10 border border-fenix-500/20 text-fenix-600 dark:text-fenix-400 text-xs font-bold uppercase tracking-wider">
                  {perfil?.rol ?? '...'}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Appearance Config (Admin only) */}
          {rol === 'administrador' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
                <Sun className="text-fenix-500" size={20} />
                Configuración de Apariencia
              </h3>

              <div className="flex flex-col gap-4">
                {/* Light Mode Button */}
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`relative flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer text-left
                    bg-white text-slate-900 border-2
                    ${theme === 'light'
                      ? 'border-fenix-500 shadow-lg shadow-fenix-500/20 ring-1 ring-fenix-500/50'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                      <Sun size={20} />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900">Modo Claro</span>
                      <span className="text-xs text-slate-500 font-medium">Apariencia luminosa</span>
                    </div>
                  </div>
                  {theme === 'light' && (
                    <div className="w-3 h-3 rounded-full bg-fenix-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  )}
                </button>

                {/* Dark Mode Button */}
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`relative flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer text-left
                    bg-slate-900 text-white border-2
                    ${theme === 'dark'
                      ? 'border-fenix-500 shadow-lg shadow-fenix-500/20 ring-1 ring-fenix-500/50'
                      : 'border-slate-700 hover:border-slate-600 hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                      <Moon size={20} />
                    </div>
                    <div>
                      <span className="block font-bold text-white">Modo Oscuro</span>
                      <span className="text-xs text-slate-400 font-medium">Menos fatiga visual</span>
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <div className="w-3 h-3 rounded-full bg-fenix-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Security & Personal Info (col-span-2) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Card 3: Personal Info (Moved to Top) */}
          <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <User className="text-fenix-500" size={20} />
                <h3 className="text-lg font-bold text-primary">Información Personal</h3>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-medium text-fenix-600 dark:text-fenix-400 hover:text-fenix-500 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="nombre" className="block text-sm font-bold text-secondary uppercase tracking-wider mb-2">
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
                  <p className="text-primary font-medium p-2 bg-bg-intermediate/50 rounded-lg border border-transparent">{perfil?.nombre}</p>
                )}
                {errors.nombre && <p className="text-sm text-red-400 mt-1">{errors.nombre.message}</p>}
              </div>

              <div>
                <label htmlFor="apellidos" className="block text-sm font-bold text-secondary uppercase tracking-wider mb-2">
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
                  <p className="text-primary font-medium p-2 bg-bg-intermediate/50 rounded-lg border border-transparent">{perfil?.apellidos}</p>
                )}
                {errors.apellidos && <p className="text-sm text-red-400 mt-1">{errors.apellidos.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="telefono" className="block text-sm font-bold text-secondary uppercase tracking-wider mb-2">
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
                  <p className="text-primary font-medium p-2 bg-bg-intermediate/50 rounded-lg border border-transparent">{perfil?.telefono || 'No especificado'}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
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

          {/* Card 4: Security (Moved to Bottom) */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-100 dark:border-gray-800">
              <Shield className="text-fenix-500" size={20} />
              <h3 className="text-lg font-bold text-primary">Seguridad y Acceso</h3>
            </div>

            <div className="space-y-8">
              {/* 2FA Manager */}
              <div className="space-y-4">
                <TwoFactorAuthManager />
              </div>

              {/* Password Manager */}
              <div className="space-y-4 pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
                <h4 className="flex items-center gap-2 text-sm font-bold text-secondary uppercase tracking-wider">
                  <Lock size={16} />
                  Cambiar Contraseña
                </h4>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1">
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
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-1">
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
                  <div className="flex justify-end">
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
      </div>
    </div>
  );
}

