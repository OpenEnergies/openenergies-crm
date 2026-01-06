import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

// --- Funciones de API ---
// Obtiene los factores 2FA que el usuario ya tiene activos
async function getMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

// Inicia el proceso y obtiene el QR
async function enrollMfa() {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return data;
}

// Verifica el código y activa el 2FA
async function challengeAndVerify(payload: { factorId: string, code: string }) {
  // Primero, creamos un "desafío"
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: payload.factorId });
  if (challengeError) throw challengeError;

  // Luego, verificamos el código contra ese desafío
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: payload.factorId,
    challengeId: challenge.id,
    code: payload.code,
  });
  if (verifyError) throw verifyError;
}

// Desactiva un factor 2FA
async function unenrollMfa(payload: { factorId: string }) {
  // Primero, nos aseguramos de que el usuario está "verificado" recientemente
  // Esto es un requisito de seguridad de Supabase
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

  // Ahora que el usuario está verificado, puede desactivar el factor
  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: payload.factorId });
  if (unenrollError) throw new Error(unenrollError.message);
}


export default function TwoFactorAuthManager() {
  const queryClient = useQueryClient();
  const [enrollData, setEnrollData] = useState<any>(null); // Guardará el QR y el factorId
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>();

  // Query para saber si el 2FA ya está activo
  const { data: factorsData, isLoading } = useQuery({
    queryKey: ['mfaFactors'],
    queryFn: getMfaFactors,
  });

  const activeFactor = factorsData?.totp[0]; // Nos centramos en el primer factor TOTP

  // Mutaciones para las diferentes acciones
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
    return <p>Comprobando estado de 2FA...</p>;
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Autenticación de Dos Factores (2FA)</h3>
      
      {activeFactor ? (
        // --- VISTA CUANDO EL 2FA ESTÁ ACTIVO ---
        <div>
          <p style={{ color: 'var(--primary)', fontWeight: 500 }}>El 2FA está ACTIVO en tu cuenta.</p>
          <button 
            className="danger" 
            onClick={() => unenrollMutation.mutate({ factorId: activeFactor.id })}
            disabled={unenrollMutation.isPending}
          >
            {unenrollMutation.isPending ? 'Desactivando...' : 'Desactivar 2FA'}
          </button>
        </div>
      ) : (
        // --- VISTA CUANDO EL 2FA ESTÁ INACTIVO ---
        <div>
          <p style={{ color: 'var(--muted)' }}>Añade una capa extra de seguridad a tu cuenta.</p>
          <button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
            {enrollMutation.isPending ? 'Generando QR...' : 'Activar 2FA'}
          </button>
        </div>
      )}

      {/* --- MODAL PARA ESCANEAR EL QR Y VERIFICAR --- */}
      {enrollData && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h3 style={{ marginTop: 0 }}>Activar 2FA</h3>
            <p>1. Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.).</p>
            <img src={enrollData.totp.qr_code} alt="Código QR para 2FA" style={{ display: 'block', margin: '1rem auto' }} />

            <p>2. Introduce el código de 6 dígitos que aparece en tu app para verificar.</p>
            <form onSubmit={handleSubmit(onVerifySubmit)} className="grid" style={{ gap: '1rem' }}>
              <div>
                <input {...register('code', { required: true, minLength: 6, maxLength: 6 })} placeholder="123456" />
                {errors.code && <p className="error-text">El código debe tener 6 dígitos.</p>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="secondary" onClick={() => setEnrollData(null)}>Cancelar</button>
                <button type="submit" disabled={verifyMutation.isPending}>
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
