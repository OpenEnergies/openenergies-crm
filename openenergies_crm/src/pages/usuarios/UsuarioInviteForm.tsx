import { useForm, useWatch } from 'react-hook-form';
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
const createUserSchema = (isAdmin: boolean, createWithPass: boolean, editing: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional(),
  email: z.string().email('Introduce un email válido'),
  rol: z.enum(['comercial', 'administrador', 'cliente']),
  empresa_id: isAdmin 
    ? z.string().uuid('Debes seleccionar una empresa') 
    : z.string().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine(data => {
  if (editing) return true;
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

export default function UsuarioInviteForm({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const { rol: currentUserRol } = useSession();
  const { empresaId: ownEmpresaId, loading: loadingEmpresa } = useEmpresaId();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = Boolean(userId);

  const isAdmin = currentUserRol === 'administrador';

  const [createWithPassword, setCreateWithPassword] = useState(!isAdmin);
  const schema = createUserSchema(isAdmin, createWithPassword, editing);

  const { register, handleSubmit, formState: { errors, isSubmitting }, control, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
        rol: 'comercial', // Valor por defecto
    }
  });

  const selectedRol = useWatch({ control, name: 'rol' });
  const isInternalRol = selectedRol === 'comercial' || selectedRol === 'administrador';
  const isClientRol = selectedRol === 'cliente';

  // --- CAMBIO #3: Efecto para cargar los datos del usuario si estamos editando ---
  useEffect(() => {
    if (editing) {
      async function fetchUsuario() {
        const { data, error } = await supabase
          .from('usuarios_app')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error) {
          setServerError('No se pudo cargar el usuario para editar.');
          console.error(error);
        } else if (data) {
          // Usamos 'reset' para rellenar el formulario con los datos del usuario
          reset(data);
        }
      }
      fetchUsuario();
    }
  }, [editing, userId, reset]);
  
  useEffect(() => {
    if (isAdmin) {
      supabase.from('empresas').select('*').order('nombre').then(({ data }) => setEmpresas(data ?? []));
    }
  }, [isAdmin]);

  const rolesDisponibles: RolUsuario[] = isAdmin
    ? ['administrador', 'comercial', 'cliente']
    : [];

  async function onSubmit(values: FormData) {
    setServerError(null);

    try {
      if (editing) {
        // --- MODO EDICIÓN ---
        const { error } = await supabase
          .from('usuarios_app')
          .update({
            nombre: values.nombre,
            apellidos: values.apellidos,
            telefono: values.telefono,
            rol: values.rol,
            // La empresa solo se actualiza si el rol no es interno
            empresa_id: isInternalRol ? undefined : values.empresa_id,
          })
          .eq('user_id', userId!);
        
        if (error) throw error;
        alert('¡Usuario actualizado con éxito!');
      } else {
        // --- MODO CREACIÓN (TU CÓDIGO ORIGINAL) ---
        const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';
        const bodyPayload = {
          action: 'create',
          payload: {
            creationType: creationType,
            userData: {
              ...values,
              empresa_id: isAdmin ? values.empresa_id : undefined,
            }
          }
        };
        const { error } = await supabase.functions.invoke('manage-user', { body: bodyPayload });
        if (error) throw new Error(error.message);
        alert('¡Usuario invitado con éxito!');
      }
      navigate({ to: '/app/usuarios' });

    } catch (e: any) {
      setServerError(`Error: ${e.message}`);
    }
  }

  const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Usuario' : 'Invitar Colaborador'}</h2>
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
              {/* En modo edición, el email no se puede cambiar */}
              <input id="email" type="email" {...register('email')} disabled={editing} />
            </div>
            {editing && <p className="info-text">El email de un usuario no puede ser modificado.</p>}
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
              {/* --- CAMBIO #3 (MEJORA UX): El select se deshabilita si es un comercial --- */}
              <select id="empresa_id" {...register('empresa_id')} disabled={isInternalRol || isClientRol}>
                <option value="">{isInternalRol ? 'Asignado a Open Energies' : (isClientRol ? 'Gestionado desde Ficha Cliente' : 'Selecciona una empresa...')}</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
              {isInternalRol && <p className="info-text">Un 'comercial' o 'administrador' siempre pertenece a Open Energies.</p>}
              {isClientRol && <p className="info-text">La empresa de un cliente se gestiona desde su ficha principal.</p>}
              {errors.empresa_id && !isInternalRol && <p className="error-text">{errors.empresa_id.message}</p>}
            </div>
          )}
          {!editing && (
          <>
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
          </>
          )}
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem'}}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/usuarios' })}>Cancelar</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : (editing ? 'Guardar Cambios' : 'Invitar Usuario')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}