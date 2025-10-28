import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { Leaf, Mail, Lock } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Introduce un email válido'), // Mensaje de error mejorado
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional().or(z.literal('')) // Mensaje añadido
});

type FormData = z.infer<typeof schema>;

export default function Login(){
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Opcional: modo de validación para feedback más rápido
    mode: 'onTouched'
  });

  async function onSubmit({ email, password }: FormData){
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else window.location.href = '/app';
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/app' } });
      if (error) toast.error(error.message);
      else toast.success('Te hemos enviado un enlace de acceso a tu correo.');
    }
  }

  return (
    // --- 👇 Aplicamos clase para el fondo ---
    <main className="login-page-background">
      {/* Ya no necesitamos el div container intermedio */}
      {/* <div className="container" style={{maxWidth:420, marginTop:'10vh'}}> */}

        {/* --- 👇 Usamos clase específica para la tarjeta de login --- */}
        <div className="card login-card" aria-labelledby="login-title">

          {/* --- Logo --- */}
          <div className="login-logo">
            <Leaf size={30} />
            <span>Open Energies CRM</span>
          </div>

          <h1 id="login-title" style={{marginTop: 0, textAlign: 'center', fontSize: '1.8rem'}}>Accede a tu cuenta</h1>
          {/* Texto de ayuda mejorado */}
          <p className="login-hint">
            Introduce tu email y contraseña. Si no la recuerdas, deja la contraseña en blanco para recibir un enlace mágico.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="grid login-form" aria-describedby="login-hint" >
            <div>
              <label htmlFor="email">Email</label>
              {/* --- Input con icono --- */}
              <div className="input-icon-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    aria-invalid={!!errors.email}
                    placeholder="tu.email@ejemplo.com" // Placeholder añadido
                 />
              </div>
              {/* Mensaje de error mejorado */}
              {errors.email && <div role="alert" className="error-text">{errors.email.message}</div>}
            </div>

            <div>
              <label htmlFor="password">Contraseña (opcional)</label>
              {/* --- Input con icono --- */}
              <div className="input-icon-wrapper">
                 <Lock size={18} className="input-icon" />
                 <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...register('password')}
                    aria-invalid={!!errors.password}
                    placeholder="********" // Placeholder añadido
                 />
              </div>
               {/* Mensaje de error añadido */}
              {errors.password && <div role="alert" className="error-text">{errors.password.message}</div>}
            </div>

            {/* Hint para lectores de pantalla (no visible) */}
            <div id="login-hint" className="sr-only" style={{marginTop: '0.5rem'}}>Introduce email y contraseña o solo email para recibir enlace.</div>

            <div>
              {/* --- Botón mejorado --- */}
              <button
                 type="submit" // Añadido type="submit" explícitamente
                 disabled={isSubmitting}
                 className="login-submit-button" // Clase específica para el botón
               >
                 {isSubmitting ? 'Entrando…' : 'Entrar'}
               </button>
             </div>
          </form>
        </div>
      {/* </div> */}
    </main>
  );
}
