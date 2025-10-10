import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal(''))
});

type FormData = z.infer<typeof schema>;

export default function Login(){
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ email, password }: FormData){
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      else window.location.href = '/app';
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/app' } });
      if (error) alert(error.message);
      else alert('Te hemos enviado un enlace de acceso a tu correo.');
    }
  }

  return (
    <div className="container" style={{maxWidth:420, marginTop:'10vh'}}>
      <div className="card" aria-labelledby="login-title">
        <h1 id="login-title" style={{marginTop:0}}>Accede a tu cuenta</h1>
        <p style={{color:'var(--muted)'}}>Introduce tus credenciales. Si no recuerdas tu contraseña, déjala en blanco para recibir un enlace de acceso a tu correo.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="grid" aria-describedby="login-hint">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <div role="alert" style={{color:'#b91c1c'}}>{errors.email.message}</div>}
          </div>
          <div>
            <label htmlFor="password">Contraseña (opcional)</label>
            <input id="password" type="password" autoComplete="current-password" {...register('password')} />
          </div>
          <div id="login-hint" className="sr-only"></div>
          <div><button disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</button></div>
        </form>
      </div>
    </div>
  );
}
