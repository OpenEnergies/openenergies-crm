// @ts-nocheck
// src/pages/usuarios/UsuarioInviteForm.tsx
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa, RolUsuario } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { User, Mail, Phone, Shield, ArrowLeft, Users, Loader2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';
import { useTheme } from '@hooks/ThemeContext';

const createUserSchema = (isAdmin: boolean, createWithPass: boolean, editing: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellidos: z.string().min(2, 'Los apellidos son obligatorios'),
  telefono: z.string().optional(),
  email: z.string().email('Introduce un email válido'),
  rol: z.enum(['comercial', 'administrador', 'cliente']).optional(),
  empresa_id: z.string().uuid('Debes seleccionar una empresa').optional().or(z.literal('')),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine(data => {
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
  const [originalRol, setOriginalRol] = useState<RolUsuario | null>(null);

  const editing = Boolean(userId);
  const isAdmin = currentUserRol === 'administrador';
  const [createWithPassword, setCreateWithPassword] = useState(!isAdmin);
  const { theme } = useTheme();

  // Accent border color: green in dark mode, light gray in light mode (matches ClienteForm)
  const accentBorderColor = theme === 'dark' ? '#17553e' : 'rgba(0, 0, 0, 0.1)';
  const schema = createUserSchema(isAdmin, createWithPassword, editing);

  const { register, handleSubmit, formState: { errors, isSubmitting }, control, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: isAdmin ? { rol: 'comercial' } : {},
  });

  const selectedRol = useWatch({ control, name: 'rol' });
  const isInternalRol = selectedRol === 'comercial' || selectedRol === 'administrador';

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
          setOriginalRol(data.rol as RolUsuario);
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

  const rolesDisponiblesAdmin: RolUsuario[] = ['administrador', 'comercial'];
  const isRolDisabled = editing && originalRol === 'cliente';

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      if (editing) {
        const updatePayload: Partial<FormData> = {
          nombre: values.nombre,
          apellidos: values.apellidos,
          telefono: values.telefono,
          ...(!isRolDisabled && { rol: values.rol }),
          empresa_id: isInternalRol ? undefined : values.empresa_id,
        };

        const { error } = await supabase
          .from('usuarios_app')
          .update(updatePayload)
          .eq('user_id', userId!);

        if (error) throw error;
        toast.success('¡Usuario actualizado con éxito!');

      } else {
        const creationType = !isAdmin || createWithPassword ? 'create_with_password' : 'invite';
        const bodyPayload = {
          action: 'create',
          payload: {
            creationType: creationType,
            userData: {
              ...values,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: '/app/usuarios' })}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-bg-intermediate transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-fenix-500" />
          </div>
          <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">
            {editing ? 'Editar Usuario' : 'Nuevo Colaborador'}
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
        <div className="space-y-6">
          {serverError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
              {serverError}
            </div>
          )}

          {/* Row: Nombre + Apellidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <User size={16} />
                Nombre
              </label>
              <input
                id="nombre"
                {...register('nombre')}
                className="glass-input w-full"
              />
              {errors.nombre && <p className="text-sm text-red-400 mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label htmlFor="apellidos" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <User size={16} />
                Apellidos
              </label>
              <input
                id="apellidos"
                {...register('apellidos')}
                className="glass-input w-full"
              />
              {errors.apellidos && <p className="text-sm text-red-400 mt-1">{errors.apellidos.message}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
              <Mail size={16} />
              Email de acceso
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              disabled={editing}
              className="glass-input w-full disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {editing && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">El email de acceso no se puede modificar.</p>}
            {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>}
          </div>

          {/* Row: Teléfono + Rol */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefono" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <Phone size={16} />
                Teléfono (opcional)
              </label>
              <input
                id="telefono"
                type="tel"
                {...register('telefono')}
                className="glass-input w-full"
              />
            </div>
            <div>
              <label htmlFor="rol" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <Shield size={16} />
                Rol del Usuario
              </label>
              <select
                id="rol"
                {...register('rol')}
                disabled={isRolDisabled}
                className="glass-input w-full appearance-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isRolDisabled ? (
                  <option value="cliente">cliente</option>
                ) : isAdmin ? (
                  rolesDisponiblesAdmin.map(r => <option key={r} value={r}>{r}</option>)
                ) : (
                  <option value="comercial">comercial</option>
                )}
              </select>
              {isRolDisabled && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  El rol de un usuario 'cliente' no se puede modificar.
                </p>
              )}
              {errors.rol && <p className="text-sm text-red-400 mt-1">{errors.rol.message}</p>}
            </div>
          </div>

          {/* Creation Method (only when creating) */}
          {!editing && (
            <>
              {isAdmin && (
                <div className="p-4 rounded-lg bg-bg-intermediate/50 dark:bg-bg-tertiary border border-slate-200 dark:border-fenix-700/50">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    Método de creación
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                      <input
                        type="radio"
                        name="creation_method"
                        checked={!createWithPassword}
                        onChange={() => setCreateWithPassword(false)}
                        className="w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                      />
                      Enviar invitación por email
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                      <input
                        type="radio"
                        name="creation_method"
                        checked={createWithPassword}
                        onChange={() => setCreateWithPassword(true)}
                        className="w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                      />
                      Establecer contraseña manual
                    </label>
                  </div>
                </div>
              )}

              {(!isAdmin || createWithPassword) && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Define una contraseña inicial para el usuario.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                        <Lock size={16} />
                        Contraseña
                      </label>
                      <PasswordInput
                        id="password"
                        showIcon={false}
                        {...register('password')}
                      />
                      {errors.password && <p className="text-sm text-red-400 mt-1">{errors.password.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                        <Lock size={16} />
                        Confirmar Contraseña
                      </label>
                      <PasswordInput
                        id="confirmPassword"
                        showIcon={false}
                        {...register('confirmPassword')}
                      />
                      {errors.confirmPassword && <p className="text-sm text-red-400 mt-1">{errors.confirmPassword.message}</p>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div
            className="flex justify-end gap-3 pt-6"
            style={{ borderTop: `1px solid ${accentBorderColor}` }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate({ to: '/app/usuarios' })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : (creationType === 'invite' ? 'Invitar Usuario' : 'Crear Usuario'))}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

