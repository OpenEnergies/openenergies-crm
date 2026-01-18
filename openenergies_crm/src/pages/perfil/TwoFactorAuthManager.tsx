import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Shield, Loader2 } from 'lucide-react';

async function getMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

async function enrollMfa() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return data;
}

async function challengeAndVerify(payload: { factorId: string, code: string }) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: payload.factorId });
  if (challengeError) throw challengeError;

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: payload.factorId,
    challengeId: challenge.id,
    code: payload.code,
  });
  if (verifyError) throw verifyError;
}

async function unenrollMfa(payload: { factorId: string }) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: payload.factorId });
  if (challengeError) throw new Error(`No se pudo verificar la sesión para desactivar 2FA: ${challengeError.message}`);

  const code = prompt('Para confirmar la desactivación, introduce un código de tu app de autenticación:');
  if (!code) throw new Error('Acción cancelada.');

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: payload.factorId,
    challengeId: challenge.id,
    code: code,
  });
  if (verifyError) throw new Error(`Código de verificación incorrecto: ${verifyError.message}`);

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: payload.factorId });
  if (unenrollError) throw new Error(unenrollError.message);
}


export default function TwoFactorAuthManager() {
  const queryClient = useQueryClient();
  const [enrollData, setEnrollData] = useState<any>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>();

  const { data: factorsData, isLoading } = useQuery({
    queryKey: ['mfaFactors'],
    queryFn: getMfaFactors,
  });

  const activeFactor = factorsData?.totp[0];

  const enrollMutation = useMutation({ mutationFn: enrollMfa, onSuccess: setEnrollData });
  const verifyMutation = useMutation({
    mutationFn: challengeAndVerify,
    onSuccess: () => {
      toast.success('2FA activado con éxito.');
      setEnrollData(null);
      queryClient.invalidateQueries({ queryKey: ['mfaFactors'] });
    },
    onError: (e) => toast.error(e.message)
  });
  const unenrollMutation = useMutation({
    mutationFn: unenrollMfa,
    onSuccess: () => {
      toast.success('2FA desactivado.');
      queryClient.invalidateQueries({ queryKey: ['mfaFactors'] });
    },
    onError: (e) => toast.error(e.message)
  });

  const onVerifySubmit = (formData: { code: string }) => {
    verifyMutation.mutate({ factorId: enrollData.id, code: formData.code });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-fenix-500 animate-spin" />
        <span className="text-gray-400">Comprobando estado de 2FA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold text-primary tracking-tight">Autenticación de Dos Factores (2FA)</h3>
      </div>

      {activeFactor ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-green-400 font-medium">El 2FA está ACTIVO en tu cuenta.</p>
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
            onClick={() => unenrollMutation.mutate({ factorId: activeFactor.id })}
            disabled={unenrollMutation.isPending}
          >
            {unenrollMutation.isPending ? 'Desactivando...' : 'Desactivar 2FA'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400">Añade una capa extra de seguridad a tu cuenta.</p>
          <button
            onClick={() => enrollMutation.mutate()}
            disabled={enrollMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {enrollMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {enrollMutation.isPending ? 'Generando QR...' : 'Activar 2FA'}
          </button>
        </div>
      )}

      {/* QR Modal */}
      {enrollData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-modal max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Activar 2FA</h3>

            <p className="text-gray-300 mb-4">
              1. Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.).
            </p>
            <div className="bg-white p-4 rounded-lg mx-auto w-fit mb-4">
              <img src={enrollData.totp.qr_code} alt="Código QR para 2FA" />
            </div>

            <p className="text-gray-300 mb-4">
              2. Introduce el código de 6 dígitos que aparece en tu app para verificar.
            </p>
            <form onSubmit={handleSubmit(onVerifySubmit)} className="space-y-4">
              <div>
                <input
                  {...register('code', { required: true, minLength: 6, maxLength: 6 })}
                  placeholder="123456"
                  className="glass-input w-full text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
                {errors.code && <p className="text-sm text-red-400 mt-1">El código debe tener 6 dígitos.</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-bg-intermediate hover:bg-white/20 text-gray-300 transition-colors cursor-pointer"
                  onClick={() => setEnrollData(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={verifyMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {verifyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  {verifyMutation.isPending ? 'Verificando...' : 'Verificar y Activar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

