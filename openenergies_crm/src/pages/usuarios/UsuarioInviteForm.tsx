import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa, RolUsuario } from '@lib/types';
import { useSession } from '@hooks/useSession';

const schema = z.object({
  nombre_completo: z.string().min(2, 'El nombre es obligatorio'),
  email: z.string().email('Introduce un email válido'),
  rol: z.enum(['comercializadora', 'comercial', 'cliente', 'administrador']),
  empresa_id: z.string().uuid('Debes seleccionar una empresa'),
});

type FormData = z.infer<typeof schema>;

export default function UsuarioInviteForm() {
  const navigate = useNavigate();
  const { rol: adminRol } = useSession();
  const { empresaId: ownEmpresaId } = useEmpresaId();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  // Cargar empresas para el select
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('empresas').select('*').order('nombre');
      setEmpresas(data ?? []);
    })();
  }, []);

  // Roles que puede crear el usuario actual
  const rolesDisponibles: RolUsuario[] =
    adminRol === 'administrador'
      ? ['administrador', 'comercializadora', 'comercial', 'cliente']
      : ['comercial', 'cliente'];

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: JSON.stringify({
            ...values,
            // Si el que invita no es admin, fuerza la empresa a la suya propia
            empresa_id: adminRol === 'administrador' ? values.empresa_id : ownEmpresaId
        }),
      });

      if (error) {
        throw new Error(error.message);
      }
      
      alert('¡Invitación enviada con éxito!');
      navigate({ to: '/app/usuarios' });

    } catch (e: any) {
      setServerError(`Error al enviar la invitación: ${e.message}`);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Invitar nuevo usuario</h2>
      {serverError && <div role="alert" style={{color:'#b91c1c', marginBottom:'1rem'}}>{serverError}</div>}
      <form className="grid" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-row">
          <div>
            <label htmlFor="nombre_completo">Nombre completo</label>
            <input id="nombre_completo" {...register('nombre_completo')} />
            {errors.nombre_completo && <div role="alert" style={{ color: '#b91c1c' }}>{errors.nombre_completo.message}</div>}
          </div>
          <div>
            <label htmlFor="email">Email de acceso</label>
            <input id="email" type="email" {...register('email')} />
            {errors.email && <div role="alert" style={{ color: '#b91c1c' }}>{errors.email.message}</div>}
          </div>
        </div>
        <div className="form-row">
          <div>
            <label htmlFor="rol">Rol</label>
            <select id="rol" {...register('rol')}>
              <option value="">-- Selecciona un rol --</option>
              {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.rol && <div role="alert" style={{ color: '#b91c1c' }}>{errors.rol.message}</div>}
          </div>
          {adminRol === 'administrador' && (
            <div>
              <label htmlFor="empresa_id">Empresa</label>
              <select id="empresa_id" {...register('empresa_id')}>
                <option value="">-- Selecciona una empresa --</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              {errors.empresa_id && <div role="alert" style={{ color: '#b91c1c' }}>{errors.empresa_id.message}</div>}
            </div>
          )}
        </div>
        <div>
          <button disabled={isSubmitting}>{isSubmitting ? 'Enviando invitación...' : 'Enviar Invitación'}</button>
        </div>
      </form>
    </div>
  );
}