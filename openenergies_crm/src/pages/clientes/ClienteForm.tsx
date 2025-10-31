// src/pages/clientes/ClienteForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cliente, TipoCliente, EstadoCliente, UsuarioApp } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { useEmpresas } from '@hooks/useEmpresas';
import { HardHat, Tags, FileText, Mail, Lock, Building2, Activity, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Tipado para los comerciales en el selector
type ComercialOption = Pick<UsuarioApp, 'user_id' | 'nombre' | 'apellidos'>;

// Schema (sin cambios)
const createClienteSchema = (createAccess: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['persona', 'sociedad'], { required_error: 'Debes seleccionar un tipo' }),
  empresa_id: z.string().uuid('Debes seleccionar la empresa propietaria'),
  estado: z.enum(['rechazado', 'desistido', 'stand by', 'procesando', 'activo'], { required_error: 'El estado es obligatorio' }).default('stand by'),
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  email_facturacion: z.string().email('Email de facturación inválido').optional().nullable().or(z.literal('')),
  email: createAccess ? z.string().email('El email de acceso es obligatorio') : z.string().optional(),
  password: createAccess ? z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') : z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof createClienteSchema>>;

// Función para obtener comerciales (sin cambios)
async function fetchComerciales(): Promise<ComercialOption[]> {
    const { data, error } = await supabase
        .from('usuarios_app')
        .select('user_id, nombre, apellidos')
        .eq('rol', 'comercial')
        .eq('activo', true)
        .order('nombre', { ascending: true });
    if (error) {
        console.error("Error fetching comerciales:", error);
        throw error;
    }
    return data || [];
}

// Función para obtener asignaciones actuales (sin cambios)
async function fetchCurrentAssignments(clienteId: string): Promise<string[]> {
    if (!clienteId) return [];
    const { data, error } = await supabase
        .from('asignaciones_comercial')
        .select('comercial_user_id')
        .eq('cliente_id', clienteId);
    if (error) {
        console.error("Error fetching current assignments:", error);
        // Devolvemos array vacío en caso de error para no romper, pero logueamos
        return [];
        // Alternativa: throw error; // Para que React Query maneje el error
    }
    return data?.map(a => a.comercial_user_id) ?? [];
}


export default function ClienteForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { rol: currentUserRol, userId } = useSession();
  const editing = Boolean(id);
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [createPortalAccess, setCreatePortalAccess] = useState(false);
  const [selectedComerciales, setSelectedComerciales] = useState<string[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<string[]>([]);

  const { empresas, loading: loadingEmpresas } = useEmpresas();

  // Query para comerciales
  const { data: comerciales = [], isLoading: loadingComerciales } = useQuery({
      queryKey: ['comercialesList'],
      queryFn: fetchComerciales,
      enabled: currentUserRol === 'administrador',
  });

  // Query para obtener asignaciones actuales en modo edición
  const { data: currentAssignmentsData, isLoading: loadingAssignments } = useQuery({
      queryKey: ['clienteAssignments', id],
      queryFn: () => fetchCurrentAssignments(id!),
      enabled: editing && !!id && currentUserRol === 'administrador',
      // Añadir staleTime y gcTime puede ser útil si no cambian frecuentemente durante la edición
      // staleTime: 5 * 60 * 1000, // 5 minutos
      // gcTime: 10 * 60 * 1000, // 10 minutos
  });


  const schema = createClienteSchema(createPortalAccess);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      estado: 'stand by',
    }
  });

  // useEffect para cargar cliente en modo edición
  useEffect(() => {
    // No cargar datos del cliente hasta que las empresas estén listas (evita reset prematuro)
    if (!editing || !id || loadingEmpresas) return;
    let isMounted = true; // Flag para evitar seteo si el componente se desmonta
    const fetchCliente = async () => {
      const { data, error } = await supabase.from('clientes').select('*, empresas(*)').eq('id', id!).maybeSingle();
      if (!isMounted) return; // Salir si ya no está montado
      if (error) {
        toast.error(`Error al cargar el cliente: ${error.message}`);
        return;
      }
      if (data) {
        const clienteData = {
          ...data,
          tipo: data.tipo as TipoCliente,
          estado: data.estado as EstadoCliente,
        };
        reset(clienteData); // Resetea el formulario con los datos
      }
    };
    fetchCliente();
    return () => { isMounted = false; }; // Cleanup al desmontar
  }, [editing, id, reset, loadingEmpresas]); // Depende de loadingEmpresas

  // --- useEffect para inicializar selección en modo edición (AJUSTADO) ---
  useEffect(() => {
      // Solo actuar si estamos editando, somos admin, Y LOS DATOS HAN LLEGADO (no undefined)
      // Usamos una comprobación explícita `!== undefined` para asegurarnos de que la query ha finalizado
      if (editing && currentUserRol === 'administrador' && typeof currentAssignmentsData !== 'undefined') {
          // Aseguramos que sea un array, incluso si la query devuelve null o algo inesperado
          const initialSelection = Array.isArray(currentAssignmentsData) ? currentAssignmentsData : [];
          console.log("Setting initial commercial selection:", initialSelection); // Log para depuración
          // Establecer ambos estados con los datos cargados
          setSelectedComerciales(initialSelection);
          setInitialAssignments(initialSelection);
      }
  // Ejecutar SOLO cuando cambie `currentAssignmentsData` (además de las condiciones iniciales)
  }, [editing, currentUserRol, currentAssignmentsData]);


  // Handler para selección de comerciales
  const handleComercialSelection = (comercialId: string) => {
    setSelectedComerciales(prevSelected =>
      prevSelected.includes(comercialId)
        ? prevSelected.filter(id => id !== comercialId)
        : [...prevSelected, comercialId]
    );
    // No actualizamos initialAssignments aquí, solo al guardar
  };

  // onSubmit (sin cambios respecto a la versión anterior con la corrección del ID)
  async function onSubmit(values: FormData) {
    setServerError(null);

    try {
      let clientIdToUse: string | null = editing ? id! : null;

      if (editing) {
        // Modo Edición: Actualizar datos del cliente
        const { error: updateError } = await supabase.from('clientes').update({
          nombre: values.nombre,
          tipo: values.tipo,
          empresa_id: values.empresa_id,
          dni: values.dni,
          cif: values.cif,
          email_facturacion: values.email_facturacion,
          estado: values.estado
        }).eq('id', id!);
        if (updateError) throw updateError;
        toast.success('Cliente actualizado correctamente');

        // Lógica para actualizar asignaciones (solo admin)
        if (currentUserRol === 'administrador') {
            const assignmentsToAdd = selectedComerciales.filter(cid => !initialAssignments.includes(cid));
            const assignmentsToRemove = initialAssignments.filter(cid => !selectedComerciales.includes(cid));
            let hadErrors = false;

            if (assignmentsToAdd.length > 0) {
                const inserts = assignmentsToAdd.map(comercialUserId => ({
                    cliente_id: clientIdToUse,
                    comercial_user_id: comercialUserId,
                }));
                const { error: insertAssignError } = await supabase.from('asignaciones_comercial').insert(inserts);
                if (insertAssignError) {
                    console.error("Error al añadir asignaciones:", insertAssignError);
                    toast.error('Error al añadir nuevas asignaciones de comerciales.');
                    hadErrors = true;
                }
            }
            if (assignmentsToRemove.length > 0) {
                const { error: deleteAssignError } = await supabase
                    .from('asignaciones_comercial')
                    .delete()
                    .eq('cliente_id', clientIdToUse!)
                    .in('comercial_user_id', assignmentsToRemove);
                if (deleteAssignError) {
                    console.error("Error al eliminar asignaciones:", deleteAssignError);
                    toast.error('Error al quitar asignaciones de comerciales.');
                    hadErrors = true;
                }
            }
             if (!hadErrors) {
                setInitialAssignments([...selectedComerciales]); // Actualizar base para la próxima comparación
             }
        }

      } else {
        // Modo Creación
        const payload = {
            action: 'onboard-client',
            payload: { /* ... payload existente ... */
              creatingUser: { rol: currentUserRol, id: userId },
              clientData: { /* ... datos cliente ... */
                nombre: values.nombre,
                tipo: values.tipo,
                empresa_id: values.empresa_id,
                dni: values.dni,
                cif: values.cif,
                email_facturacion: values.email_facturacion,
                estado: values.estado,
              },
              createPortalAccess: createPortalAccess,
              userData: createPortalAccess ? { /* ... datos usuario ... */
                email: values.email,
                password: values.password,
                nombre: values.nombre.split(' ')[0],
                apellidos: values.nombre.split(' ').slice(1).join(' '),
              } : null
            }
          };
        const { data: functionData, error: functionError } = await supabase.functions.invoke('manage-user', { body: payload });
        console.log('Respuesta de la función manage-user:', functionData);
        if (functionError) throw functionError;
        if (functionData && functionData.data && typeof functionData.data.newClientId === 'string') {
            clientIdToUse = functionData.data.newClientId;
        } else {
            console.error('La respuesta de la función no contenía data.newClientId esperado:', functionData);
            throw new Error("La función no devolvió el ID del nuevo cliente en la estructura esperada.");
        }
        toast.success('Cliente creado correctamente');

        // Insertar asignaciones para admin
        if (currentUserRol === 'administrador' && selectedComerciales.length > 0 && clientIdToUse) {
          const asignaciones = selectedComerciales.map(comercialUserId => ({
            cliente_id: clientIdToUse,
            comercial_user_id: comercialUserId,
          }));
          const { error: assignError } = await supabase.from('asignaciones_comercial').insert(asignaciones);
          if (assignError) {
            console.error("Error al asignar comerciales:", assignError);
            toast.error('Cliente creado, pero hubo un error al asignar los comerciales seleccionados.');
          }
        }
        // Auto-asignación comercial
        if (currentUserRol === 'comercial' && userId && clientIdToUse && !selectedComerciales.includes(userId)) {
            const { error: selfAssignError } = await supabase.from('asignaciones_comercial').insert({ cliente_id: clientIdToUse, comercial_user_id: userId });
            if (selfAssignError) console.warn("Error en auto-asignación del comercial creador:", selfAssignError.message);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['clienteAssignments', id] });
      navigate({ to: '/app/clientes' });

    } catch (e: any) {
      console.error("Error al guardar cliente:", e);
      const message = e.details || e.message || 'Ocurrió un error inesperado.';
      toast.error(`Error al guardar: ${message}.`);
      setServerError(`Error al guardar: ${message}.`);
    }
  }

  const showComercialSelector = currentUserRol === 'administrador';

  // JSX del return (sin cambios estructurales, solo usa los estados actualizados)
  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
            {/* Campos existentes: Empresa, Nombre, Tipo, Estado, DNI, CIF, Email Facturación */}
            {/* ... (código JSX de estos campos sin cambios) ... */}
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

          <div>
            <label htmlFor="estado">Estado</label>
            <div className="input-icon-wrapper">
              <Activity size={18} className="input-icon" />
              <select id="estado" {...register('estado')}>
                <option value="stand by">🟠 Stand By</option>
                <option value="procesando">🟡 Procesando</option>
                <option value="activo">🟢 Activo</option>
                <option value="rechazado">🔴 Rechazado</option>
                <option value="desistido">⚫ Desistido</option>
              </select>
            </div>
            {errors.estado && <p className="error-text">{errors.estado.message}</p>}
          </div>


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


            {/* --- SECCIÓN ASIGNAR COMERCIALES --- */}
            {showComercialSelector && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} /> Asignar Comerciales {editing ? '' : '(Opcional)'}
                    </h3>
                    {/* Mostrar carga si CUALQUIERA de las queries relevantes está cargando */}
                    {(loadingComerciales || (editing && loadingAssignments)) ? (
                        <p>Cargando información de comerciales...</p>
                    ) : comerciales.length === 0 ? (
                        <p style={{ color: 'var(--muted)'}}>No hay comerciales activos para asignar.</p>
                    ) : (
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                            {comerciales.map(comercial => (
                                <label key={comercial.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' }} className="comercial-select-label">
                                    <input
                                        type="checkbox"
                                        // El checked ahora SÍ debería funcionar porque el estado se inicializa correctamente
                                        checked={selectedComerciales.includes(comercial.user_id)}
                                        onChange={() => handleComercialSelection(comercial.user_id)}
                                        style={{ width: 'auto' }}
                                    />
                                    <span>{comercial.nombre} {comercial.apellidos}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* --- FIN SECCIÓN ASIGNAR COMERCIALES --- */}


          {/* Sección Crear Acceso Portal (solo visible al crear) */}
          {!editing && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              {/* ... (código existente para crear acceso portal) ... */}
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
                      {/* ... inputs email/password ... */}
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

          {/* Botones */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/clientes' })}>
              Cancelar
            </button>
            {/* Deshabilitar botón si alguna query relevante está cargando */}
            <button type="submit" disabled={isSubmitting || loadingComerciales || (editing && loadingAssignments)}>
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear Cliente')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}