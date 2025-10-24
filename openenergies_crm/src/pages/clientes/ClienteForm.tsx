// src/pages/clientes/ClienteForm.tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
// --- Importa los nuevos tipos ---
import type { Cliente, TipoCliente, EstadoCliente } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { useEmpresas } from '@hooks/useEmpresas';
// --- Importa el icono Activity ---
import { HardHat, Tags, FileText, Mail, Lock, Building2, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Usamos el tipo específico para mayor seguridad
const createClienteSchema = (createAccess: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['persona', 'sociedad'], { required_error: 'Debes seleccionar un tipo' }),
  empresa_id: z.string().uuid('Debes seleccionar la empresa propietaria'),
  // --- CAMPO ESTADO AÑADIDO AL SCHEMA ---
  estado: z.enum(['desistido', 'stand by', 'procesando', 'activo'], { required_error: 'El estado es obligatorio' }).default('stand by'),
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

  const { empresas, loading: loadingEmpresas } = useEmpresas();

  const schema = createClienteSchema(createPortalAccess);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    // --- VALOR POR DEFECTO PARA ESTADO ---
    defaultValues: {
      estado: 'stand by',
    }
  });

  // --- *** CORRECCIÓN DEL BUG *** ---
  useEffect(() => {
    // (1) GUARD CLAUSE:
    // No hacer nada si no estamos editando O si la lista de empresas aún está cargando.
    if (!editing || !id || loadingEmpresas) return;
    
    const fetchCliente = async () => {
      // Al pedir los datos, también pedimos los de la empresa para asegurar consistencia
      const { data, error } = await supabase.from('clientes').select('*, empresas(*)').eq('id', id!).maybeSingle();
      if (error) {
        toast.error(`Error al cargar el cliente: ${error.message}`);
        return;
      }
      if (data) {
        // (2) AHORA SÍ:
        // El reset se ejecuta DESPUÉS de que loadingEmpresas es false,
        // por lo que el <select> ya tiene sus <option> y puede ser preseleccionado.
        const clienteData = { 
          ...data, 
          tipo: data.tipo as TipoCliente,
          estado: data.estado as EstadoCliente, // <-- CAMPO AÑADIDO
        };
        reset(clienteData);
      }
    };
    fetchCliente();
  // (3) AÑADIR loadingEmpresas a la lista de dependencias.
  }, [editing, id, reset, loadingEmpresas]);
  // --- *** FIN DE LA CORRECCIÓN *** ---

  async function onSubmit(values: FormData) {
    setServerError(null);
    if (loadingEmpresa || !empresaId) {
      toast.error('No se pudo determinar tu empresa. Recarga la página.');
      return;
    }

    try {
      if (editing) {
        // --- CAMPO ESTADO AÑADIDO AL UPDATE ---
        const { error } = await supabase.from('clientes').update({
          nombre: values.nombre,
          tipo: values.tipo,
          empresa_id: values.empresa_id,
          dni: values.dni,
          cif: values.cif,
          email_facturacion: values.email_facturacion,
          estado: values.estado // <-- CAMPO AÑADIDO
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
              empresa_id: values.empresa_id,
              dni: values.dni,
              cif: values.cif,
              email_facturacion: values.email_facturacion,
              estado: values.estado, // <-- CAMPO AÑADIDO
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
      toast.success(editing ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente');
      navigate({ to: '/app/clientes' });
    } catch (e: any) {
      console.error("Error al guardar cliente:", e);
      toast.error(`Error al guardar: ${e.message}.`);
    }
  }

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
            <div>
              <label htmlFor="empresa_id">Empresa Propietaria</label>
              <div className="input-icon-wrapper">
                <Building2 size={18} className="input-icon" />
                <select id="empresa_id" {...register('empresa_id')} disabled={loadingEmpresas}>
                  <option value="">{loadingEmpresas ? 'Cargando empresas...' : 'Selecciona una empresa'}</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {errors.empresa_id && <p className="error-text">{errors.empresa_id.message}</p>}
            </div>
            
          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="nombre">Nombre o Razón Social</label>
              <div className="input-icon-wrapper">
                <HardHat size={18} className="input-icon" />
                <input id="nombre" {...register('nombre')} />
              </div>
              {errors.nombre && <p className="error-text">{errors.nombre.message}</p>}
            </div>
            <div>
              <label htmlFor="tipo">Tipo de cliente</label>
              <div className="input-icon-wrapper">
                <Tags size={18} className="input-icon" />
                <select id="tipo" {...register('tipo')}>
                  <option value=""> Selecciona </option>
                  <option value="persona">Persona</option>
                  <option value="sociedad">Sociedad</option>
                </select>
              </div>
              {errors.tipo && <p className="error-text">{errors.tipo.message}</p>}
            </div>
          </div>

          {/* --- NUEVO CAMPO "ESTADO" AÑADIDO --- */}
          <div>
            <label htmlFor="estado">Estado</label>
            <div className="input-icon-wrapper">
              <Activity size={18} className="input-icon" />
              <select id="estado" {...register('estado')}>
                <option value="stand by">🟠 Stand By</option>
                <option value="procesando">🟡 Procesando</option>
                <option value="activo">🟢 Activo</option>
                <option value="desistido">🔴 Desistido</option>
              </select>
            </div>
            {errors.estado && <p className="error-text">{errors.estado.message}</p>}
          </div>
          {/* ---------------------------------- */}


          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="dni">DNI (para personas físicas)</label>
              <div className="input-icon-wrapper">
                <FileText size={18} className="input-icon" />
                <input id="dni" {...register('dni')} />
              </div>
            </div>
            <div>
              <label htmlFor="cif">CIF (para sociedades)</label>
              <div className="input-icon-wrapper">
                <FileText size={18} className="input-icon" />
                <input id="cif" {...register('cif')} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="email_facturacion">Email de facturación (opcional)</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input id="email_facturacion" type="email" {...register('email_facturacion')} />
            </div>
            {errors.email_facturacion && <p className="error-text">{errors.email_facturacion.message}</p>}
          </div>

          {!editing && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Acceso al Portal de Cliente</h3>
              <label className="switch-wrapper">
                <input 
                  type="checkbox" 
                  checked={createPortalAccess} 
                  onChange={(e) => setCreatePortalAccess(e.target.checked)}
                />
                <span className="switch-slider"></span>
                <span className="switch-label">Crear un usuario para que este cliente pueda acceder a su portal</span>
              </label>

              {createPortalAccess && (
                <div className="grid" style={{ gap: '1rem', marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg)', borderRadius: '0.5rem' }}>
                  <p style={{color: 'var(--muted)', fontSize: '0.9rem', margin: 0}}>
                    Se creará un usuario con rol 'cliente'. Deberás comunicarle sus credenciales de acceso.
                  </p>
                  <div>
                    <label htmlFor="email">Email de acceso</label>
                    <div className="input-icon-wrapper">
                      <Mail size={18} className="input-icon" />
                      <input id="email" type="email" {...register('email')} />
                    </div>
                    {errors.email && <p className="error-text">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="password">Contraseña inicial</label>
                    <div className="input-icon-wrapper">
                      <Lock size={18} className="input-icon" />
                      <input id="password" type="password" {...register('password')} />
                    </div>
                    {errors.password && <p className="error-text">{errors.password.message}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/clientes' })}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}