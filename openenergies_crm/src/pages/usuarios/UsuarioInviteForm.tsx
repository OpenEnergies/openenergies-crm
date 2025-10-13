import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa, RolUsuario } from '@lib/types';
import { useSession } from '@hooks/useSession';

// Schema dinámico que requiere contraseña solo si el rol no es admin
const createUserSchema = (isAdmin: boolean, createWithPass: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional(),
  email: z.string().email('Introduce un email válido'),
  rol: z.enum(['comercializadora', 'comercial', 'cliente', 'administrador']),
  empresa_id: isAdmin 
    ? z.string().uuid('Debes seleccionar una empresa') 
    : z.string().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine(data => {
  // Si no es admin, la contraseña es obligatoria
  if (!isAdmin || createWithPass) return !!data.password;
  return true;
}, {
  message: "La contraseña es obligatoria",
  path: ["password"],
}).refine(data => {
  // Si hay contraseña, debe coincidir con la confirmación
  if (data.password) return data.password === data.confirmPassword;
  return true;
}, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type FormData = z.infer<ReturnType<typeof createUserSchema>>;

export default function UsuarioInviteForm() {
  const navigate = useNavigate();
  const { rol: currentUserRol } = useSession();
  const { empresaId: ownEmpresaId, loading: loadingEmpresa } = useEmpresaId();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const isAdmin = currentUserRol === 'administrador';

  const [createWithPassword, setCreateWithPassword] = useState(!isAdmin);
  const schema = createUserSchema(isAdmin, createWithPassword);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    context: { createWithPassword }
  });
  
  useEffect(() => {
    if (isAdmin) {
      supabase.from('empresas').select('*').order('nombre').then(({ data }) => setEmpresas(data ?? []));
    }
  }, [isAdmin]);

  const rolesDisponibles: RolUsuario[] = isAdmin
    ? ['administrador', 'comercializadora', 'comercial', 'cliente']
    : ['comercial', 'cliente'];

   // ¡NUEVA FUNCIÓN PARA DEPURAR!
  // Esta función se ejecutará si la validación falla.
  const onValidationErrors = (errorList: any) => {
    console.error('La validación del formulario ha fallado:', errorList);
    alert('La validación del formulario ha fallado. Revisa la consola para más detalles (F12).');
  };

  async function onSubmit(values: FormData) {
    setServerError(null);
    if (!isAdmin && (loadingEmpresa || !ownEmpresaId)) {
      return setServerError('No se pudo determinar tu empresa. Recarga la página.');
    }

    // Definimos el TIPO de creación
    const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';
    
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Estructuramos el body de la petición como lo espera la Edge Function
    const bodyPayload = {
      action: 'create', // La acción principal es 'create'
      payload: {        // El resto de la información va dentro de 'payload'
        creationType: creationType,
        userData: {
          ...values,
          empresa_id: isAdmin ? values.empresa_id : ownEmpresaId!,
        }
      }
    };
    
    try {
      // Enviamos el bodyPayload corregido
      const { error } = await supabase.functions.invoke('manage-user', { body: bodyPayload });

      if (error) throw new Error(error.message);
      
      alert('¡Usuario creado con éxito!');
      navigate({ to: '/app/usuarios' });

    } catch (e: any) {
      setServerError(`Error al crear el usuario: ${e.message}`);
    }
  }

  const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Nuevo Usuario</h2>
      {serverError && <div role="alert" style={{ color: '#b91c1c', marginBottom: '1rem' }}>{serverError}</div>}
      
      <form className="grid" onSubmit={handleSubmit(onSubmit, onValidationErrors)} style={{gap: '1.5rem'}}>
        <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          <div>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" {...register('nombre')} />
            {errors.nombre && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.nombre.message}</p>}
          </div>
          <div>
            <label htmlFor="apellidos">Apellidos</label>
            <input id="apellidos" {...register('apellidos')} />
            {errors.apellidos && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.apellidos.message}</p>}
          </div>
        </div>

        <div>
            <label htmlFor="email">Email de acceso</label>
            <input id="email" type="email" {...register('email')} />
            {errors.email && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.email.message}</p>}
        </div>

        <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          <div>
            <label htmlFor="telefono">Teléfono (opcional)</label>
            <input id="telefono" type="tel" {...register('telefono')} />
          </div>
          <div>
            <label htmlFor="rol">Rol</label>
            <select id="rol" {...register('rol')}>
              <option value="">-- Selecciona un rol --</option>
              {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.rol && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.rol.message}</p>}
          </div>
        </div>

        {isAdmin && (
            <div>
              <label htmlFor="empresa_id">Empresa</label>
              <select id="empresa_id" {...register('empresa_id')}>
                <option value="">-- Selecciona una empresa --</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              {errors.empresa_id && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.empresa_id.message}</p>}
            </div>
        )}

        {isAdmin && (
          <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
            <label>Método de creación</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label><input type="radio" name="creation_method" checked={!createWithPassword} onChange={() => setCreateWithPassword(false)} /> Enviar invitación por email</label>
              <label><input type="radio" name="creation_method" checked={createWithPassword} onChange={() => setCreateWithPassword(true)} /> Establecer contraseña manual</label>
            </div>
          </div>
        )}

        {(!isAdmin || createWithPassword) && (
          <>
            <p style={{color: 'var(--muted)', fontSize: '0.9rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem'}}>Define una contraseña inicial para el usuario. Deberás comunicársela de forma segura.</p>
            <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
              <div>
                <label htmlFor="password">Contraseña</label>
                <input id="password" type="password" {...register('password')} />
                {errors.password && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.password.message}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/usuarios' })}>Cancelar</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : (creationType === 'invite' ? 'Enviar Invitación' : 'Crear Usuario')}
            </button>
        </div>
      </form>
    </div>
  );
}