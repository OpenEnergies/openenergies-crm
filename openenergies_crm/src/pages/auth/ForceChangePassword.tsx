import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Leaf, Lock } from 'lucide-react';


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
      // Invalidamos Y forzamos la recarga inmediata de la query del perfil,
      // esperando a que termine antes de continuar.
      await queryClient.refetchQueries({ queryKey: ['userProfile', user.id], exact: true });
      // Alternativa (más explícita si la anterior no funciona):
      // await queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
      // await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa opcional

      // --- 4. FEEDBACK Y REDIRECCIÓN ---
      toast.success('Contraseña actualizada correctamente. Redirigiendo...');

      // Navegamos DESPUÉS de asegurar que los datos se han recargado
      navigate({ to: '/app', replace: true });

    } catch (e: any) {
      console.error("Error al actualizar contraseña:", e);
      toast.error(`Error al actualizar la contraseña: La contraseña debe tener al menos 8 caracteres, que incluyan al menos 1 letra mayúscula, 1 minúscula, 1 número y 1 carácter especial.`); // Mensaje genérico
    }
  }

  return (
    // --- 👇 Aplicamos la misma clase de fondo que el Login ---
    <main className="login-page-background">
      {/* --- 👇 Usamos la misma clase de tarjeta que el Login --- */}
      <div className="card login-card" aria-labelledby="change-password-title">

        {/* --- Logo (igual que en Login) --- */}
        <div className="login-logo">
          <Leaf size={30} />
          <span>Open Energies CRM</span>
        </div>

        <h1 id="change-password-title" style={{ marginTop: 0, textAlign: 'center', fontSize: '1.8rem' }}>Actualiza tu contraseña</h1>
        <p className="login-hint">
          Por seguridad, necesitas establecer una nueva contraseña personal para acceder.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="grid login-form" aria-describedby="change-password-hint">
          <div>
            <label htmlFor="password">Nueva Contraseña</label>
            {/* --- Input con icono --- */}
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                 id="password"
                 type="password"
                 {...register('password')}
                 aria-invalid={!!errors.password}
                 placeholder="Introduce 8+ caracteres" // Placeholder
               />
            </div>
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
             {/* --- Input con icono --- */}
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                 id="confirmPassword"
                 type="password"
                 {...register('confirmPassword')}
                 aria-invalid={!!errors.confirmPassword}
                 placeholder="Repite la contraseña" // Placeholder
               />
            </div>
            {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
          </div>

          {/* Hint para lectores de pantalla */}
          <div id="change-password-hint" className="sr-only">Introduce y confirma tu nueva contraseña. Mínimo 8 caracteres.</div>

          <div>
            {/* --- Botón mejorado (misma clase que Login) --- */}
            <button
               type="submit"
               disabled={isSubmitting}
               className="login-submit-button"
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar y Entrar'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}