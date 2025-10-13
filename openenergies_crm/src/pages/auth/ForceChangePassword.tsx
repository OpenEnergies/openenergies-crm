import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

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
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ password }: FormData) {
    setServerError(null);
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

      // --- 3. ¡CORRECCIÓN CLAVE! ---
      // Invalidamos la caché del perfil de usuario antes de navegar.
      await queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });

      // 4. Redirigir al Dashboard
      alert('Contraseña actualizada correctamente. Ya puedes acceder al CRM.');
      navigate({ to: '/app', replace: true });

    } catch (e: any) {
      setServerError(`Error al actualizar la contraseña: ${e.message}`);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ marginTop: 0 }}>Actualiza tu contraseña</h1>
        <p style={{ color: 'var(--muted)' }}>Por seguridad, debes establecer una nueva contraseña personal para poder acceder al sistema.</p>
        
        {serverError && <div role="alert" style={{ color: '#b91c1c', marginBottom: '1rem' }}>{serverError}</div>}
        
        <form onSubmit={handleSubmit(onSubmit)} className="grid" style={{ gap: '1rem' }}>
          <div>
            <label htmlFor="password">Nueva Contraseña</label>
            <input id="password" type="password" {...register('password')} />
            {errors.password && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
            <input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.confirmPassword.message}</p>}
          </div>
          <div>
            <button disabled={isSubmitting}>{isSubmitting ? 'Actualizando...' : 'Actualizar y Entrar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}