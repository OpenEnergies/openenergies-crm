// src/pages/auth/Login.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { Mail, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import PasswordInput from '@components/PasswordInput';

const schema = z.object({
  email: z.string().email('Introduce un email válido'),
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
    <main className="
      min-h-screen flex items-center justify-center p-4
      bg-linear-to-br from-fenix-950 via-bg-primary to-bg-secondary
    ">
      {/* Login Card */}
      <div
        className="glass-modal w-full max-w-md p-6 sm:p-8 animate-slide-up"
        aria-labelledby="login-title"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-white/90 flex items-center justify-center">
            <img src="/logo_openenergies.png" alt="Open Energies" className="w-9 h-9" />
          </div>
          <span className="font-semibold text-lg whitespace-nowrap transition-opacity duration-200">Open Energies CRM</span>
        </div>

        {/* Title */}
        <h1
          id="login-title"
          className="text-xl font-bold text-fenix-600 dark:text-fenix-500 text-center mb-2"
        >
          {isMfaStep ? 'Verificar Identidad' : 'Accede a tu cuenta'}
        </h1>

        {/* Hint text */}
        <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">
          {isMfaStep
            ? `Introduce el código de 6 dígitos de tu app de autenticación para ${loginEmail}`
            : 'Introduce tu email y contraseña. Si no la recuerdas, deja la contraseña en blanco para recibir un enlace mágico.'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          {!isMfaStep && (
            <div className="space-y-1.5">
              <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Mail size={16} />
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                placeholder="tu.email@ejemplo.com"
                className="glass-input"
              />
              {errors.email && (
                <p className="text-sm text-red-400" role="alert">{errors.email.message}</p>
              )}
            </div>
          )}

          {/* Password */}
          {!isMfaStep && (
            <div className="space-y-1.5">
              <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Lock size={16} />
                Contraseña <span className="text-gray-500 ml-1">(opcional)</span>
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                {...register('password')}
                placeholder="********"
                showIcon={false}
              />
              {errors.password && (
                <p className="text-sm text-red-400" role="alert">{errors.password.message}</p>
              )}
            </div>
          )}

          {/* MFA code */}
          {isMfaStep && (
            <div className="space-y-1.5">
              <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-300">
                Código de Autenticación
              </label>
              <div className="relative">
                <ShieldCheck
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  id="mfaCode"
                  type="tel"
                  autoComplete="one-time-code"
                  {...register('mfaCode')}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  className="glass-input pl-10 text-center text-lg tracking-[0.5em] font-mono"
                />
              </div>
              {errors.mfaCode && (
                <p className="text-sm text-red-400" role="alert">{errors.mfaCode.message}</p>
              )}
            </div>
          )}

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
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
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
                className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                onClick={() => setIsMfaStep(false)}
              >
                ← Volver a Email/Contraseña
              </button>
            </div>
          )}
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

