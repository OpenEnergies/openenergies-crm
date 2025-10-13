import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa, RolUsuario } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { User, Mail, Phone, Shield, Building2, Lock } from 'lucide-react';

// Schema dinámico que requiere contraseña solo si el rol no es admin
const createUserSchema = (isAdmin: boolean, createWithPass: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional(),
  email: z.string().email('Introduce un email válido'),
  rol: z.enum(['comercializadora', 'comercial', 'administrador']),
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
    ? ['administrador', 'comercializadora', 'comercial']
    : ['comercial'];

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
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Nuevo Colaborador</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}
          
          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="nombre">Nombre</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input id="nombre" {...register('nombre')} />
              </div>
              {errors.nombre && <p className="error-text">{errors.nombre.message}</p>}
            </div>
            <div>
              <label htmlFor="apellidos">Apellidos</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input id="apellidos" {...register('apellidos')} />
              </div>
              {errors.apellidos && <p className="error-text">{errors.apellidos.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email">Email de acceso</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input id="email" type="email" {...register('email')} />
            </div>
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="telefono">Teléfono (opcional)</label>
              <div className="input-icon-wrapper">
                <Phone size={18} className="input-icon" />
                <input id="telefono" type="tel" {...register('telefono')} />
              </div>
            </div>
            <div>
              <label htmlFor="rol">Rol del Colaborador</label>
              <div className="input-icon-wrapper">
                <Shield size={18} className="input-icon" />
                <select id="rol" {...register('rol')}>
                  {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {errors.rol && <p className="error-text">{errors.rol.message}</p>}
            </div>
          </div>

          {isAdmin && (
            <div>
              <label htmlFor="empresa_id">Empresa</label>
              <div className="input-icon-wrapper">
                <Building2 size={18} className="input-icon" />
                <select id="empresa_id" {...register('empresa_id')}>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {errors.empresa_id && <p className="error-text">{errors.empresa_id.message}</p>}
            </div>
          )}
          
          {/* SECCIÓN DE MÉTODO DE CREACIÓN MEJORADA */}
          {isAdmin && (
            <div style={{ padding: '1rem', borderRadius: '0.5rem' }}>
              <label style={{marginBottom: '0.5rem'}}>Método de creación</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><input type="radio" name="creation_method" checked={!createWithPassword} onChange={() => setCreateWithPassword(false)} /> Enviar invitación por email</label>
                <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}><input type="radio" name="creation_method" checked={createWithPassword} onChange={() => setCreateWithPassword(true)} /> Establecer contraseña manual</label>
              </div>
            </div>
          )}

          {(!isAdmin || createWithPassword) && (
            <>
              <p style={{color: 'var(--muted)', fontSize: '0.9rem', paddingTop: '1.5rem', marginTop: 0}}>Define una contraseña inicial para el usuario.</p>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div>
                  <label htmlFor="password">Contraseña</label>
                  <div className="input-icon-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input id="password" type="password" {...register('password')} />
                  </div>
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                  <div className="input-icon-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input id="confirmPassword" type="password" {...register('confirmPassword')} />
                  </div>
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem'}}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/usuarios' })}>Cancelar</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : (creationType === 'invite' ? 'Enviar Invitación' : 'Crear Usuario')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}