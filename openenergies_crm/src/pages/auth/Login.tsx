// src/pages/auth/Login.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { Mail, Lock, ShieldCheck, Loader2, Zap, BarChart3, RefreshCw } from 'lucide-react';
import PasswordInput from '@components/PasswordInput';

const schema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria').optional().or(z.literal('')),
  mfaCode: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ENV_LABEL = import.meta.env.VITE_ENV_LABEL || 'Producción';

export default function Login() {
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
  });

  async function onSubmit(formData: FormData) {
    try {
      if (isMfaStep) {
        if (!formData.mfaCode || formData.mfaCode.length !== 6) {
          toast.error('Introduce un código de 6 dígitos.');
          return;
        }

        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          throw new Error(`Error al listar factores 2FA: ${factorsError.message}`);
        }

        const totpFactor = factorsData?.totp?.[0];
        if (!totpFactor) {
          throw new Error('No se encontró un factor 2FA (TOTP) activo para verificar.');
        }

        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: totpFactor.id,
          code: formData.mfaCode,
        });

        if (verifyError) {
          throw new Error('Código 2FA incorrecto o caducado.');
        }

        window.location.href = '/app';
        return;
      }

      const email = formData.email;
      const password = formData.password;

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

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }

      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        console.warn('No se pudo obtener el nivel de autenticación:', aalError.message);
      }

      if (aalData && aalData.currentLevel !== aalData.nextLevel && aalData.nextLevel === 'aal2') {
        toast.success('Contraseña correcta. Introduce tu código 2FA.');
        setLoginEmail(email);
        setIsMfaStep(true);
        reset({ email, password: '', mfaCode: '' });
        return;
      }

      window.location.href = '/app';
    } catch (e: any) {
      toast.error(e.message || 'Ha ocurrido un error');
    }
  }

  return (
    <main className="login-page">
      {/* Full-screen background */}
      <div className="login-bg" />

      {/* Left side – branding */}
      <div className="login-branding">
        <div className="login-branding-inner">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <img src="/logo_openenergies.png" alt="Open Energies" />
            </div>
            <span className="login-logo-text">Open Energies</span>
          </div>

          {/* Headline */}
          <h1 className="login-headline">
            CRM<br />Intelligence Platform
          </h1>
          <p className="login-subheadline">
            Centro de control energético para<br />comercializadoras y gestores.
          </p>

          {/* Feature list */}
          <ul className="login-features">
            <li>
              <span className="login-feature-icon"><Zap size={18} /></span>
              Gestión de contratos
            </li>
            <li>
              <span className="login-feature-icon"><BarChart3 size={18} /></span>
              Analítica avanzada
            </li>
            <li>
              <span className="login-feature-icon"><RefreshCw size={18} /></span>
              Automatización energética
            </li>
          </ul>
        </div>
      </div>

      {/* Right side – login card */}
      <div className="login-form-wrapper">
        <div className="login-card">
          {/* Environment badge */}
          <div className="login-env-badge">
            Entorno. <em>{ENV_LABEL}</em>
          </div>

          {/* Shield icon */}
          <div className="login-shield">
            <ShieldCheck size={32} />
          </div>

          {/* Title */}
          <h2 className="login-title">
            {isMfaStep ? 'Verificar Identidad' : 'Acceso seguro al sistema'}
          </h2>

          <p className="login-subtitle">
            {isMfaStep
              ? `Introduce el código de 6 dígitos de tu app de autenticación para ${loginEmail}`
              : 'Introduce tus credenciales corporativas'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            {/* Email */}
            {!isMfaStep && (
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  <Mail size={14} className="login-label-icon" />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  placeholder="tu.email@ejemplo.com"
                  className="login-input"
                />
                {errors.email && (
                  <p className="login-error" role="alert">{errors.email.message}</p>
                )}
              </div>
            )}

            {/* Password */}
            {!isMfaStep && (
              <div className="login-field">
                <label htmlFor="password" className="login-label">
                  <Lock size={14} className="login-label-icon" />
                  Contraseña
                </label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="********"
                  showIcon={false}
                />
                {errors.password && (
                  <p className="login-error" role="alert">{errors.password.message}</p>
                )}
              </div>
            )}

            {/* MFA code */}
            {isMfaStep && (
              <div className="login-field">
                <label htmlFor="mfaCode" className="login-label">
                  Código de Autenticación
                </label>
                <div className="relative">
                  <ShieldCheck
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: '#9CA3AF' }}
                  />
                  <input
                    id="mfaCode"
                    type="tel"
                    autoComplete="one-time-code"
                    {...register('mfaCode')}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                    className="login-input login-input-mfa"
                  />
                </div>
                {errors.mfaCode && (
                  <p className="login-error" role="alert">{errors.mfaCode.message}</p>
                )}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="login-submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Validando...
                </>
              ) : isMfaStep ? (
                'Verificar y Entrar'
              ) : (
                'Entrar'
              )}
            </button>

            {/* Back to login */}
            {isMfaStep && (
              <div className="text-center">
                <button
                  type="button"
                  className="login-back-btn"
                  onClick={() => setIsMfaStep(false)}
                >
                  ← Volver a Email/Contraseña
                </button>
              </div>
            )}

            {/* Forgot password */}
            {!isMfaStep && (
              <p className="login-forgot">¿Has olvidado tu contraseña?</p>
            )}
          </form>

          {/* Footer */}
          <footer className="login-footer">
            <p>
              <Lock size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              Autenticación protegida con cifrado <strong>AES-256</strong>
            </p>
            <p>© {new Date().getFullYear()} Converly Solutions</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
