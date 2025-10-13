import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Cliente, TipoCliente } from '@lib/types';
import { useSession } from '@hooks/useSession';

// Usamos el tipo específico para mayor seguridad
const createClienteSchema = (createAccess: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['persona', 'sociedad'], { required_error: 'Debes seleccionar un tipo' }),
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  email_facturacion: z.string().email('Email de facturación inválido').optional().nullable().or(z.literal('')),
  // Campos del usuario (solo si se crea el acceso)
  email: createAccess ? z.string().email('El email de acceso es obligatorio') : z.string().optional(),
  password: createAccess ? z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') : z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof createClienteSchema>>;

// Hacemos que el componente acepte 'id' como prop
export default function ClienteForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { rol: currentUserRol, userId } = useSession();
  const editing = Boolean(id);
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [serverError, setServerError] = useState<string | null>(null);

  // Nuevo estado para controlar si se crea el acceso al portal
  const [createPortalAccess, setCreatePortalAccess] = useState(false);

  const schema = createClienteSchema(createPortalAccess);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!editing) return;
    
    const fetchCliente = async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id!).maybeSingle();
      if (error) {
        setServerError(`Error al cargar el cliente: ${error.message}`);
        return;
      }
      if (data) {
        // Aseguramos que el 'tipo' sea del tipo correcto antes de hacer reset
        const clienteData = { ...data, tipo: data.tipo as TipoCliente };
        reset(clienteData);
      }
    };
    fetchCliente();
  }, [editing, id, reset]);

  async function onSubmit(values: FormData) {
    setServerError(null);
    if (loadingEmpresa || !empresaId) {
      setServerError('No se pudo determinar tu empresa. Recarga la página.');
      return;
    }

    try {
      if (editing) {
        // La edición sigue siendo una simple actualización del cliente
        const { error } = await supabase.from('clientes').update({
          nombre: values.nombre,
          tipo: values.tipo,
          dni: values.dni,
          cif: values.cif,
          email_facturacion: values.email_facturacion
        }).eq('id', id!);
        if (error) throw error;
      } else {
        // La creación ahora llama a la Edge Function
        const payload = {
          action: 'onboard-client',
          payload: {
            creatingUser: {
                rol: currentUserRol,
                id: userId,
            },
            clientData: {
              nombre: values.nombre,
              tipo: values.tipo,
              dni: values.dni,
              cif: values.cif,
              email_facturacion: values.email_facturacion,
              empresa_id: empresaId,
            },
            createPortalAccess: createPortalAccess,
            userData: createPortalAccess ? {
              email: values.email,
              password: values.password,
              nombre: values.nombre.split(' ')[0], // Usamos el primer nombre
              apellidos: values.nombre.split(' ').slice(1).join(' '), // y el resto como apellidos
            } : null
          }
        };
        const { data, error } = await supabase.functions.invoke('manage-user', { body: payload });
        if (error) throw error;
        // ¡CAMBIO 2: Lógica de auto-asignación!
        // Si el usuario es un 'comercial', lo auto-asignamos al nuevo cliente.
        if (currentUserRol === 'comercial' && userId && data.newClientId) {
            const { error: assignError } = await supabase
                .from('asignaciones_comercial')
                .insert({ cliente_id: data.newClientId, comercial_user_id: userId });

            if (assignError) throw assignError;
        }
      }
      navigate({ to: '/app/clientes' });
    } catch (e: any) {
      console.error("Error al guardar cliente:", e);
      setServerError(`Error al guardar: ${e.message}.`);
    }
  }

  return (
    <div className="grid">
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: '0' }}>{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="nombre">Nombre o Razón Social</label>
              <input id="nombre" {...register('nombre')} />
              {errors.nombre && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{errors.nombre.message}</p>}
            </div>
            <div>
              <label htmlFor="tipo">Tipo de cliente</label>
              <select id="tipo" {...register('tipo')}>
                <option value="">-- Selecciona --</option>
                <option value="persona">Persona</option>
                <option value="sociedad">Sociedad</option>
              </select>
              {errors.tipo && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="dni">DNI (para personas físicas)</label>
              <input id="dni" {...register('dni')} />
            </div>
            <div>
              <label htmlFor="cif">CIF (para sociedades)</label>
              <input id="cif" {...register('cif')} />
            </div>
          </div>

          <div>
            <label htmlFor="email_facturacion">Email de facturación (opcional)</label>
            <input id="email_facturacion" type="email" {...register('email_facturacion')} />
            {errors.email_facturacion && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{errors.email_facturacion.message}</p>}
          </div>

          {/* --- NUEVA SECCIÓN: Acceso al Portal (solo en modo creación) --- */}
          {!editing && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ marginTop: 0 }}>Acceso al Portal de Cliente</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={createPortalAccess} 
                  onChange={(e) => setCreatePortalAccess(e.target.checked)}
                />
                Crear un usuario para que este cliente pueda acceder a su portal
              </label>

              {createPortalAccess && (
                <div className="grid" style={{ gap: '1rem', marginTop: '1rem', paddingLeft: '1rem', borderLeft: '2px solid var(--primary)' }}>
                  <p style={{color: 'var(--muted)', fontSize: '0.9rem', margin: 0}}>
                    Se creará un usuario con rol 'cliente'. Deberás comunicarle sus credenciales de acceso.
                  </p>
                  <div>
                    <label htmlFor="email">Email de acceso</label>
                    <input id="email" type="email" {...register('email')} />
                    {errors.email && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{errors.email.message}</p>}
                  </div>
                   <div>
                    <label htmlFor="password">Contraseña inicial</label>
                    <input id="password" type="password" {...register('password')} />
                    {errors.password && <p style={{ color: 'red', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{errors.password.message}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/clientes' })}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
