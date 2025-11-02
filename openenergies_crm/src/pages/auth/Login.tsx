// src/pages/auth/Login.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { Leaf, Mail, Lock, ShieldCheck } from 'lucide-react';

// Esquema de validación
const schema = z.object({
  email: z.string().email('Introduce un email válido'),
  // contraseña opcional para permitir magic link
  password: z.string().min(1, 'La contraseña es obligatoria').optional().or(z.literal('')),
  mfaCode: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });

  // ahora mismo no lo usamos, pero lo dejo porque ya lo tenías
  const mfaCodeInput = watch('mfaCode');

  async function onSubmit(formData: FormData) {
    try {
      // ========================
      // PASO 2: VERIFICAR 2FA
      // ========================
      if (isMfaStep) {
        if (!formData.mfaCode || formData.mfaCode.length !== 6) {
          toast.error('Introduce un código de 6 dígitos.');
          return;
        }

        // 1. listar factores activos del usuario de esta sesión
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          throw new Error(`Error al listar factores 2FA: ${factorsError.message}`);
        }

        const totpFactor = factorsData?.totp?.[0];
        if (!totpFactor) {
          throw new Error('No se encontró un factor 2FA (TOTP) activo para verificar.');
        }

        // 2. crear challenge y verificar en un solo paso
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: totpFactor.id,
          code: formData.mfaCode,
        });

        if (verifyError) {
          throw new Error('Código 2FA incorrecto o caducado.');
        }

        // 3. éxito: ya estamos en AAL2
        window.location.href = '/app';
        return;
      }

      // ========================
      // PASO 1: EMAIL + PASSWORD
      // ========================
      const email = formData.email;
      const password = formData.password;

      // --- caso magic link (sin contraseña) ---
      if (!password) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/app',
          },
        });
        if (error) throw error;
        toast.success('Revisa tu correo. Te hemos enviado un enlace de acceso.');
        return;
      }

      // --- caso login normal con contraseña ---
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // aquí ya no esperamos que venga "AAL2_REQUIRED"
        throw error;
      }

      // 👇 aquí es donde Supabase te dice si HAY que subir a AAL2
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        console.warn('No se pudo obtener el nivel de autenticación:', aalError.message);
      }

      // si la sesión actual es AAL1 y el siguiente nivel disponible es AAL2 -> pedir código
      if (aalData && aalData.currentLevel !== aalData.nextLevel && aalData.nextLevel === 'aal2') {
        toast.success('Contraseña correcta. Introduce tu código 2FA.');
        setLoginEmail(email);
        setIsMfaStep(true);
        // dejamos el email y limpiamos lo demás
        reset({ email, password: '', mfaCode: '' });
        return;
      }

      // si no hay MFA pendiente, entrar directo
      window.location.href = '/app';
    } catch (e: any) {
      toast.error(e.message || 'Ha ocurrido un error');
    }
  }

  return (
    <main className="login-page-background">
      <div className="card login-card" aria-labelledby="login-title">
        <div className="login-logo">
          <Leaf size={30} />
          <span>Open Energies CRM</span>
        </div>

        <h1 id="login-title" style={{ marginTop: 0, textAlign: 'center', fontSize: '1.8rem' }}>
          {isMfaStep ? 'Verificar Identidad' : 'Accede a tu cuenta'}
        </h1>

        <p className="login-hint">
          {isMfaStep
            ? `Introduce el código de 6 dígitos de tu app de autenticación para ${loginEmail}`
            : 'Introduce tu email y contraseña. Si no la recuerdas, deja la contraseña en blanco para recibir un enlace mágico.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="grid login-form">
          {/* Email */}
          {!isMfaStep && (
            <div>
              <label htmlFor="email">Email</label>
              <div className="input-icon-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  placeholder="tu.email@ejemplo.com"
                />
              </div>
              {errors.email && <div className="error-text" role="alert">{errors.email.message}</div>}
            </div>
          )}

          {/* Password */}
          {!isMfaStep && (
            <div>
              <label htmlFor="password">Contraseña (opcional)</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="********"
                />
              </div>
              {errors.password && <div className="error-text" role="alert">{errors.password.message}</div>}
            </div>
          )}

          {/* MFA code */}
          {isMfaStep && (
            <div>
              <label htmlFor="mfaCode">Código de Autenticación (6 dígitos)</label>
              <div className="input-icon-wrapper">
                <ShieldCheck size={18} className="input-icon" />
                <input
                  id="mfaCode"
                  type="tel"
                  autoComplete="one-time-code"
                  {...register('mfaCode')}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                />
              </div>
              {errors.mfaCode && <div className="error-text" role="alert">{errors.mfaCode.message}</div>}
            </div>
          )}

          <div>
            <button type="submit" disabled={isSubmitting} className="login-submit-button">
              {isSubmitting ? 'Validando...' : isMfaStep ? 'Verificar y Entrar' : 'Entrar'}
            </button>
          </div>

          {/* volver al login normal */}
          {isMfaStep && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary"
                style={{ background: 'none', color: 'var(--muted)', padding: 0 }}
                onClick={() => setIsMfaStep(false)}
              >
                Volver a Email/Contraseña
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
