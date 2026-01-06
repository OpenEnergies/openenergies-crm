// @ts-nocheck
// src/pages/usuarios/UsuarioInviteForm.tsx
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
// Importamos useState
import { useEffect, useState } from 'react';
import type { Empresa, RolUsuario } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { User, Mail, Phone, Shield, Building2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';

// El Schema ahora recibe 'editing' para saber si la contraseña es opcional
const createUserSchema = (isAdmin: boolean, createWithPass: boolean, editing: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional(),
  email: z.string().email('Introduce un email válido'),
  // Hacemos el rol opcional en el schema base para poder deshabilitarlo
  rol: z.enum(['comercial', 'administrador', 'cliente']).optional(),
  empresa_id: z.string().uuid('Debes seleccionar una empresa').optional().or(z.literal('')),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine(data => {
  // En modo edición, la validación de contraseña no aplica
  if (editing) return true;
  if (!isAdmin || createWithPass) return !!data.password;
  return true;
}, {
  message: "La contraseña es obligatoria",
  path: ["password"],
}).refine(data => {
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
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  // --- (1) Añadir estado para el rol original ---
  const [originalRol, setOriginalRol] = useState<RolUsuario | null>(null);

  const editing = Boolean(userId);

  const isAdmin = currentUserRol === 'administrador';
  const [createWithPassword, setCreateWithPassword] = useState(!isAdmin);
  const schema = createUserSchema(isAdmin, createWithPassword, editing);

  const { register, handleSubmit, formState: { errors, isSubmitting }, control, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Cambiamos el default a comercial si es admin, si no, no ponemos default aquí
    defaultValues: isAdmin ? { rol: 'comercial' } : {},
  });

  const selectedRol = useWatch({ control, name: 'rol' });
  const isInternalRol = selectedRol === 'comercial' || selectedRol === 'administrador';

  // Efecto para cargar datos en modo edición
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
          // --- (2) Guardar el rol original ---
          setOriginalRol(data.rol as RolUsuario);
          reset(data);
        }
      }
      fetchUsuario();
    }
  }, [editing, userId, reset]);

  // Tu efecto para cargar empresas
  useEffect(() => {
    if (isAdmin) {
      supabase.from('empresas').select('*').order('nombre').then(({ data }) => setEmpresas(data ?? []));
    }
  }, [isAdmin]);

  // Roles disponibles para administradores (excluye cliente)
  const rolesDisponiblesAdmin: RolUsuario[] = ['administrador', 'comercial'];

  // Determinar si el campo de rol debe estar deshabilitado
  const isRolDisabled = editing && originalRol === 'cliente';

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      if (editing) {
        // --- MODO EDICIÓN ---
        const updatePayload: Partial<FormData> = {
            nombre: values.nombre,
            apellidos: values.apellidos,
            telefono: values.telefono,
            // Solo incluimos el rol si NO está deshabilitado
            ...( !isRolDisabled && { rol: values.rol }),
            empresa_id: isInternalRol ? undefined : values.empresa_id,
        };

        const { error } = await supabase
          .from('usuarios_app')
          .update(updatePayload) // Usamos el payload condicional
          .eq('user_id', userId!);

        if (error) throw error;
        toast.success('¡Usuario actualizado con éxito!');

      } else {
        // --- MODO CREACIÓN (Tu lógica original) ---
        const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';
        const bodyPayload = {
          action: 'create',
          payload: {
            creationType: creationType,
            userData: {
              ...values,
              // Asegurarse de que el rol se envía correctamente al crear
              rol: values.rol,
              empresa_id: values.empresa_id || undefined,
            }
          }
        };
        const { error } = await supabase.functions.invoke('manage-user', { body: bodyPayload });
        if (error) throw new Error(error.message);
        toast.success('¡Usuario creado con éxito!');
      }
      navigate({ to: '/app/usuarios' });

    } catch (e: any) {
      setServerError(`Error: ${e.message}`);
    }
  }

  const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';

  return (
    <div className="page-layout">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Usuario' : 'Nuevo Colaborador'}</h2>
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
              <input id="email" type="email" {...register('email')} disabled={editing} />
            </div>
            {editing && <p className="info-text">El email de acceso no se puede modificar.</p>}
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
              {/* --- (3) Modificar Campo Rol --- */}
              <label htmlFor="rol">Rol del Usuario</label>
              <div className="input-icon-wrapper">
                <Shield size={18} className="input-icon" />
                <select
                  id="rol"
                  {...register('rol')}
                  disabled={isRolDisabled} // Deshabilitar condicionalmente
                  style={isRolDisabled ? { cursor: 'not-allowed', backgroundColor: 'var(--bg-muted)' } : {}} // Estilo visual
                >
                  {/* Si está deshabilitado, solo mostramos la opción 'cliente' */}
                  {isRolDisabled ? (
                    <option value="cliente">cliente</option>
                  ) : (
                    // Si es admin, mostramos admin y comercial
                    isAdmin ? (
                      rolesDisponiblesAdmin.map(r => <option key={r} value={r}>{r}</option>)
                    ) : (
                      // Si no es admin (y no es cliente), debería ser comercial (aunque este caso no debería darse en edición)
                      <option value="comercial">comercial</option>
                    )
                  )}
                </select>
              </div>
              {/* --- (4) Añadir Mensaje Informativo --- */}
              {isRolDisabled && (
                <p className="info-text" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  El rol de un usuario 'cliente' no se puede modificar.
                </p>
              )}
              {errors.rol && <p className="error-text">{errors.rol.message}</p>}
            </div>
          </div>
          {!editing && (
          <>
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
              <p style={{color: 'var(--muted)', /* ... */}}>Define una contraseña inicial...</p>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                {/* --- 👇 2. Campo Contraseña MODIFICADO --- */}
                <div>
                  <label htmlFor="password">Contraseña</label>
                  <PasswordInput
                    id="password"
                    {...register('password')}
                  />
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>
                {/* --- 👇 3. Campo Confirmar Contraseña MODIFICADO --- */}
                <div>
                  <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                  <PasswordInput
                    id="confirmPassword"
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
                </div>
                {/* --- Fin Modificaciones --- */}
              </div>
            </>
          )}
          </>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem'}}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/usuarios' })}>Cancelar</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : (creationType === 'invite' ? 'Invitar Usuario' : 'Crear Usuario'))}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
