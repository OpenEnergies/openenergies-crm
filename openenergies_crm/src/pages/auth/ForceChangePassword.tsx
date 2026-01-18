import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Lock } from 'lucide-react';
import PasswordInput from '@components/PasswordInput';


const schema = z.object({
  password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onTouched' });
  async function onSubmit({ password }: FormData) {
    try {
      // 1. Actualizar la contraseña en Supabase Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({ password });
      if (updateAuthError) throw updateAuthError;

      // 2. Actualizar nuestra bandera en la tabla de perfiles
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se pudo encontrar al usuario.');

      const { error: updateProfileError } = await supabase
        .from('usuarios_app')
        .update({ forzar_cambio_password: false })
        .eq('user_id', user.id);

      if (updateProfileError) throw updateProfileError;

      // --- 3. FORZAR REFETCH Y ESPERAR ---
      await queryClient.refetchQueries({ queryKey: ['userProfile', user.id], exact: true });

      // --- 4. FEEDBACK Y REDIRECCIÓN ---
      toast.success('Contraseña actualizada correctamente. Redirigiendo...');

      // Navegamos DESPUÉS de asegurar que los datos se han recargado
      navigate({ to: '/app', replace: true });

    } catch (e: any) {
      console.error("Error al actualizar contraseña:", e);
      toast.error(`Error al actualizar la contraseña: La contraseña debe tener al menos 8 caracteres, que incluyan al menos 1 letra mayúscula, 1 minúscula, 1 número y 1 carácter especial.`);
    }
  }

  return (
    <main className="
      min-h-screen flex items-center justify-center p-4
      bg-linear-to-br from-fenix-950 via-bg-primary to-bg-secondary
    ">
      {/* Password Change Card */}
      <div
        className="glass-modal w-full max-w-md p-6 sm:p-8 animate-slide-up"
        aria-labelledby="change-password-title"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-white/90 flex items-center justify-center">
            <img src="/logo_openenergies.png" alt="Open Energies" className="w-9 h-9" />
          </div>
          <span className="text-xl font-semibold text-white">Open Energies CRM</span>
        </div>

        {/* Title */}
        <h1
          id="change-password-title"
          className="text-2xl font-bold text-white text-center mb-2"
        >
          Actualiza tu contraseña
        </h1>

        {/* Hint text */}
        <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">
          Por seguridad, necesitas establecer una nueva contraseña personal para acceder.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-describedby="change-password-hint">
          {/* New Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <Lock size={16} />
              Nueva Contraseña
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              {...register('password')}
              aria-invalid={!!errors.password}
              placeholder="Introduce 8+ caracteres"
              showIcon={false}
            />
            {errors.password && (
              <p className="text-sm text-red-400" role="alert">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <Lock size={16} />
              Confirmar Nueva Contraseña
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              {...register('confirmPassword')}
              aria-invalid={!!errors.confirmPassword}
              placeholder="Repite la contraseña"
              showIcon={false}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-400" role="alert">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div id="change-password-hint" className="sr-only">Introduce y confirma tu nueva contraseña. Mínimo 8 caracteres.</div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              w-full py-3 rounded-xl font-medium
              bg-linear-to-r from-fenix-500 to-fenix-600
              hover:from-fenix-400 hover:to-fenix-500
              text-white shadow-lg shadow-fenix-500/25
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
              flex items-center justify-center gap-2
            "
          >
            {isSubmitting ? 'Actualizando...' : 'Actualizar y Entrar'}
          </button>
        </form>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-bg-intermediate text-center">
          <span className="text-xs text-gray-500">
            © {new Date().getFullYear()} Powered by Converly Solutions
          </span>
        </footer>
      </div>
    </main>
  );
}
