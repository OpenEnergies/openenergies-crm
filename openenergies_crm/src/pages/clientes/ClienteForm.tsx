// src/pages/clientes/ClienteForm.tsx
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@hooks/useSession';
import { useTheme } from '@hooks/ThemeContext';
import { HardHat, Tags, FileText, Mail, Users, Loader2, ArrowLeft, Phone, Lock, CreditCard, UserCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';
import { MultiPhoneInput } from '@components/form/MultiPhoneInput';

type TipoCliente = 'Persona fisica' | 'Persona juridica';

const createClienteSchema = (createAccess: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['Persona fisica', 'Persona juridica']).optional().nullable(),
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  numero_cuenta: z.string().optional().nullable(),
  representante: z.string().optional().nullable(),
  telefonos: z.string().optional().nullable(),
  email: z.string().email('Formato de email inválido').optional().nullable().or(z.literal('')),
  portal_email: createAccess ? z.string().email('El email de acceso es obligatorio') : z.string().optional(),
  portal_password: createAccess ? z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') : z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof createClienteSchema>>;

interface ClienteFormProps {
  readonly id?: string;
}

export default function ClienteForm({ id }: ClienteFormProps) {
  const navigate = useNavigate();
  const { rol: currentUserRol, userId } = useSession();
  const editing = Boolean(id);
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  // Accent border color: green in dark mode, light gray in light mode
  const accentBorderColor = theme === 'dark' ? '#17553e' : 'rgba(0, 0, 0, 0.1)';

  const [createPortalAccess, setCreatePortalAccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = createClienteSchema(createPortalAccess);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      tipo: null,
      dni: '',
      cif: '',
      numero_cuenta: '',
      representante: '',
      telefonos: '',
      email: '',
    }
  });

  const tipoCliente = watch('tipo');
  const isDniDisabled = tipoCliente === 'Persona juridica';
  const isCifDisabled = tipoCliente === 'Persona fisica';

  useEffect(() => {
    if (tipoCliente === 'Persona fisica') {
      setValue('cif', '');
    } else if (tipoCliente === 'Persona juridica') {
      setValue('dni', '');
    }
  }, [tipoCliente, setValue]);

  useEffect(() => {
    if (!editing || !id) return;

    let isMounted = true;

    const fetchCliente = async () => {
      // Intentar obtener datos descifrados con la función RPC
      const { data: clienteDescifrado, error: rpcError } = await supabase
        .rpc('obtener_cliente_completo', { p_cliente_id: id });

      if (!isMounted) return;

      // Usar datos descifrados si la RPC funciona, sino fallback a consulta directa
      let data: any;
      if (rpcError || !clienteDescifrado || clienteDescifrado.error) {
        console.warn('RPC falló, usando consulta directa:', rpcError);
        const { data: directData, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .is('eliminado_en', null)
          .maybeSingle();
        if (error) {
          toast.error(`Error al cargar el cliente: ${error.message}`);
          return;
        }
        data = directData;
      } else {
        data = clienteDescifrado;
      }

      if (data) {
        reset({
          nombre: data.nombre || '',
          tipo: data.tipo as TipoCliente || null,
          dni: data.dni || '',
          cif: data.cif || '',
          numero_cuenta: data.numero_cuenta || '',
          representante: data.representante || '',
          telefonos: data.telefonos || '',
          email: data.email || '',
        });
      }
    };

    fetchCliente();

    return () => { isMounted = false; };
  }, [editing, id, reset]);

  async function onSubmit(values: FormData) {
    setServerError(null);

    try {
      if (editing && id) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            nombre: values.nombre,
            tipo: values.tipo,
            dni: values.dni || null,
            cif: values.cif || null,
            numero_cuenta: values.numero_cuenta || null,
            representante: values.representante || null,
            telefonos: values.telefonos || null,
            email: values.email || null,
            modificado_en: new Date().toISOString(),
            modificado_por: userId,
          })
          .eq('id', id);

        if (updateError) throw updateError;
        toast.success('Cliente actualizado correctamente');

      } else {
        if (createPortalAccess && values.portal_email && values.portal_password) {
          const payload = {
            action: 'onboard-client',
            payload: {
              creatingUser: { rol: currentUserRol, id: userId },
              clientData: {
                nombre: values.nombre,
                tipo: values.tipo,
                dni: values.dni || null,
                cif: values.cif || null,
                numero_cuenta: values.numero_cuenta || null,
                representante: values.representante || null,
                telefonos: values.telefonos || null,
                email: values.email || null,
              },
              createPortalAccess: true,
              userData: {
                email: values.portal_email,
                password: values.portal_password,
                nombre: values.nombre.split(' ')[0],
                apellidos: values.nombre.split(' ').slice(1).join(' '),
              }
            }
          };

          const { error: functionError } = await supabase.functions.invoke('manage-user', { body: payload });
          if (functionError) throw functionError;

        } else {
          const { error: insertError } = await supabase
            .from('clientes')
            .insert({
              nombre: values.nombre,
              tipo: values.tipo || 'Persona fisica',
              dni: values.dni || null,
              cif: values.cif || null,
              numero_cuenta: values.numero_cuenta || null,
              representante: values.representante || null,
              telefonos: values.telefonos || null,
              email: values.email || null,
              creado_por: userId,
            });

          if (insertError) throw insertError;
        }

        toast.success('Cliente creado correctamente');
      }

      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      navigate({ to: '/app/clientes' });

    } catch (e: unknown) {
      console.error("Error al guardar cliente:", e);
      const message = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
      toast.error(`Error al guardar: ${message}`);
      setServerError(`Error al guardar: ${message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: '/app/clientes' })}
          className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
          </div>
          <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">
            {editing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
        <div className="space-y-6">

          {/* Row 1: Nombre + Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <HardHat size={16} />
                Nombre o Razón Social *
              </label>
              <input
                id="nombre"
                {...register('nombre')}
                placeholder="Nombre completo o razón social"
                className="glass-input w-full"
              />
              {errors.nombre && <p className="text-sm text-red-400 mt-1">{errors.nombre.message}</p>}
            </div>

            <div>
              <label htmlFor="tipo" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <Tags size={16} />
                Tipo de cliente
              </label>
              <select
                id="tipo"
                {...register('tipo')}
                className="glass-input w-full appearance-none cursor-pointer"
              >
                <option value="">Selecciona tipo</option>
                <option value="Persona fisica">Persona Física</option>
                <option value="Persona juridica">Persona Jurídica</option>
              </select>
              {errors.tipo && <p className="text-sm text-red-400 mt-1">{errors.tipo.message}</p>}
            </div>
          </div>

          {/* Row 2: DNI + CIF */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={isDniDisabled ? 'opacity-50' : ''}>
              <label htmlFor="dni" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <FileText size={16} />
                DNI
              </label>
              <input
                id="dni"
                {...register('dni')}
                disabled={isDniDisabled}
                placeholder={isDniDisabled ? 'No aplica para Persona Jurídica' : 'DNI del titular'}
                className="glass-input w-full disabled:cursor-not-allowed"
              />
              {errors.dni && <p className="text-sm text-red-400 mt-1">{errors.dni.message}</p>}
            </div>

            <div className={isCifDisabled ? 'opacity-50' : ''}>
              <label htmlFor="cif" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <FileText size={16} />
                CIF
              </label>
              <input
                id="cif"
                {...register('cif')}
                disabled={isCifDisabled}
                placeholder={isCifDisabled ? 'No aplica para Persona Física' : 'CIF de la empresa'}
                className="glass-input w-full disabled:cursor-not-allowed"
              />
              {errors.cif && <p className="text-sm text-red-400 mt-1">{errors.cif.message}</p>}
            </div>
          </div>

          {/* Row 3: IBAN + Representante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="numero_cuenta" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <CreditCard size={16} />
                Número de cuenta (IBAN)
              </label>
              <input
                id="numero_cuenta"
                {...register('numero_cuenta')}
                placeholder="ES00 0000 0000 0000 0000 0000"
                className="glass-input w-full font-mono"
              />
              {errors.numero_cuenta && <p className="text-sm text-red-400 mt-1">{errors.numero_cuenta.message}</p>}
            </div>

            <div>
              <label htmlFor="representante" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <UserCircle size={16} />
                Representante
              </label>
              <input
                id="representante"
                {...register('representante')}
                placeholder="Nombre del representante legal"
                className="glass-input w-full"
              />
              {errors.representante && <p className="text-sm text-red-400 mt-1">{errors.representante.message}</p>}
            </div>
          </div>

          {/* Row 4: Teléfonos + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefonos" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <Phone size={16} />
                Teléfono(s)
              </label>
              <Controller
                name="telefonos"
                control={control}
                render={({ field }) => (
                  <MultiPhoneInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    showIcon={false}
                  />
                )}
              />
              {errors.telefonos && <p className="text-sm text-red-400 mt-1">{errors.telefonos.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                <Mail size={16} />
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                placeholder="correo@ejemplo.com"
                className="glass-input w-full"
              />
              {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>}
            </div>
          </div>

          {/* Portal Access Section (only on create) */}
          {!editing && (
            <div
              className="pt-8 pb-4"
              style={{ borderTop: `1px solid ${accentBorderColor}` }}
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2">
                  <Lock size={20} />
                  Acceso al Portal de Cliente
                </h3>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={createPortalAccess}
                    onChange={(e) => setCreatePortalAccess(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bg-intermediate border border-primary/20 rounded-full peer peer-checked:bg-fenix-500 peer-checked:border-fenix-500 transition-all duration-300"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-secondary/40 peer-checked:bg-white rounded-full transition-all duration-300 peer-checked:translate-x-5 shadow-sm"></div>
                </div>
                <span className="text-secondary font-bold group-hover:text-primary transition-colors">Crear usuario para acceso al portal</span>
              </label>

              {createPortalAccess && (
                <div
                  className="mt-4 p-5 rounded-xl bg-bg-intermediate/30 space-y-4"
                  style={{ border: `1px solid ${accentBorderColor}` }}
                >
                  <p className="text-sm text-secondary font-medium opacity-70">
                    Se creará un usuario con rol 'cliente'. Comunícale sus credenciales de acceso.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="portal_email" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                        <Mail size={16} />
                        Email de acceso *
                      </label>
                      <input
                        id="portal_email"
                        type="email"
                        {...register('portal_email')}
                        placeholder="usuario@ejemplo.com"
                        className="glass-input w-full"
                      />
                      {errors.portal_email && <p className="text-sm text-red-400 mt-1">{errors.portal_email.message}</p>}
                    </div>

                    <div>
                      <label htmlFor="portal_password" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                        <Lock size={16} />
                        Contraseña inicial *
                      </label>
                      <PasswordInput
                        id="portal_password"
                        {...register('portal_password')}
                        showIcon={false}
                      />
                      {errors.portal_password && <p className="text-sm text-red-400 mt-1">{errors.portal_password.message}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Server Error */}
          {serverError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
              {serverError}
            </div>
          )}

          {/* Buttons */}
          <div
            className="flex justify-end gap-3 pt-6"
            style={{ borderTop: `1px solid ${accentBorderColor}` }}
          >
            <button
              type="button"
              className="btn-secondary cursor-pointer"
              onClick={() => navigate({ to: '/app/clientes' })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear Cliente')}
            </button>
          </div>
        </div>
      </form >
    </div >
  );
}
