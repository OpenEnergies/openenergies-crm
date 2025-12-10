// src/pages/clientes/ClienteForm.tsx
import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
// CAMBIO: Eliminamos useNavigate ya que usaremos history.back()
// import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cliente, TipoCliente, EstadoCliente, UsuarioApp } from '@lib/types';
import { useSession } from '@hooks/useSession';
import { HardHat, Tags, FileText, Mail, Lock, Building2, Activity, Users, CreditCard, User, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';

type ComercialOption = Pick<UsuarioApp, 'user_id' | 'nombre' | 'apellidos'>;

const createClienteSchema = (createAccess: boolean) => z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['persona', 'sociedad'], { required_error: 'Debes seleccionar un tipo' }),
  estado: z.enum(['rechazado', 'desistido', 'stand by', 'procesando', 'activo'], { required_error: 'El estado es obligatorio' }).default('stand by'),
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  email_facturacion: z.string().email('Email de facturación inválido').optional().nullable().or(z.literal('')),
  representante: z.string().optional().nullable(),
  numero_cuenta: z.string().optional().nullable(),
  telefonos: z.string().optional().nullable(),
  email: createAccess ? z.string().email('El email de acceso es obligatorio') : z.string().optional(),
  password: createAccess ? z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') : z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof createClienteSchema>>;

async function fetchComerciales(): Promise<ComercialOption[]> {
    const { data, error } = await supabase.from('usuarios_app').select('user_id, nombre, apellidos').eq('rol', 'comercial').eq('activo', true).order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function fetchCurrentAssignments(clienteId: string): Promise<string[]> {
    if (!clienteId) return [];
    const { data } = await supabase.from('asignaciones_comercial').select('comercial_user_id').eq('cliente_id', clienteId);
    return data?.map(a => a.comercial_user_id) ?? [];
}

export default function ClienteForm({ id }: { id?: string }) {
  // const navigate = useNavigate(); // Eliminado
  const { rol: currentUserRol, userId } = useSession();
  const editing = Boolean(id);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [createPortalAccess, setCreatePortalAccess] = useState(false);
  const [selectedComerciales, setSelectedComerciales] = useState<string[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<string[]>([]);

  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');

  const { data: comerciales = [], isLoading: loadingComerciales } = useQuery({
      queryKey: ['comercialesList'],
      queryFn: fetchComerciales,
      enabled: currentUserRol === 'administrador',
  });

  const { data: currentAssignmentsData, isLoading: loadingAssignments } = useQuery({
      queryKey: ['clienteAssignments', id],
      queryFn: () => fetchCurrentAssignments(id!),
      enabled: editing && !!id && currentUserRol === 'administrador',
  });

  const schema = createClienteSchema(createPortalAccess);

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { estado: 'stand by' }
  });

  const tipoCliente = useWatch({ control, name: 'tipo' });

  const syncTelefonos = (t1: string, t2: string) => {
    const finalString = [t1, t2].filter(t => t.trim() !== '').join(' / ');
    setValue('telefonos', finalString, { shouldDirty: true });
  };

  useEffect(() => {
    if (!editing || !id) return;
    let isMounted = true;
    const fetchCliente = async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id!).maybeSingle();
      if (!isMounted) return;
      if (error) {
        toast.error(`Error al cargar el cliente: ${error.message}`);
        return;
      }
      if (data) {
        const rawTel = data.telefonos || '';
        const parts = rawTel.split('/').map((s: string) => s.trim());
        setTel1(parts[0] || '');
        setTel2(parts[1] || '');

        const clienteData = {
          ...data,
          tipo: data.tipo as TipoCliente,
          estado: data.estado as EstadoCliente,
          representante: data.representante ?? '',
          numero_cuenta: data.numero_cuenta ?? '',
          telefonos: rawTel,
        };
        reset(clienteData);
      }
    };
    fetchCliente();
    return () => { isMounted = false; };
  }, [editing, id, reset]);

  useEffect(() => {
      if (editing && currentUserRol === 'administrador' && typeof currentAssignmentsData !== 'undefined') {
          const initialSelection = Array.isArray(currentAssignmentsData) ? currentAssignmentsData : [];
          setSelectedComerciales(initialSelection);
          setInitialAssignments(initialSelection);
      }
  }, [editing, currentUserRol, currentAssignmentsData]);

  const handleComercialSelection = (comercialId: string) => {
    setSelectedComerciales(prev => prev.includes(comercialId) ? prev.filter(id => id !== comercialId) : [...prev, comercialId]);
  };

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      let clientIdToUse: string | null = editing ? id! : null;
      const finalTelefonos = [tel1, tel2].filter(t => t.trim() !== '').join(' / ');
      const valuesToSubmit = { ...values, telefonos: finalTelefonos };

      if (editing) {
        const { error: updateError } = await supabase.from('clientes').update({
          nombre: valuesToSubmit.nombre,
          tipo: valuesToSubmit.tipo,
          dni: valuesToSubmit.dni,
          cif: valuesToSubmit.cif,
          email_facturacion: valuesToSubmit.email_facturacion,
          estado: valuesToSubmit.estado,
          representante: valuesToSubmit.representante,
          numero_cuenta: valuesToSubmit.numero_cuenta,
          telefonos: valuesToSubmit.telefonos
        }).eq('id', id!);
        
        if (updateError) throw updateError;
        toast.success('Cliente actualizado correctamente');

        if (currentUserRol === 'administrador') {
            const assignmentsToAdd = selectedComerciales.filter(cid => !initialAssignments.includes(cid));
            const assignmentsToRemove = initialAssignments.filter(cid => !selectedComerciales.includes(cid));
            
            if (assignmentsToAdd.length > 0) {
                const inserts = assignmentsToAdd.map(uid => ({ cliente_id: clientIdToUse, comercial_user_id: uid }));
                await supabase.from('asignaciones_comercial').insert(inserts);
            }
            if (assignmentsToRemove.length > 0) {
                await supabase.from('asignaciones_comercial').delete().eq('cliente_id', clientIdToUse!).in('comercial_user_id', assignmentsToRemove);
            }
            setInitialAssignments([...selectedComerciales]);
        }

      } else {
        const payload = {
            action: 'onboard-client',
            payload: {
              creatingUser: { rol: currentUserRol, id: userId },
              clientData: {
                nombre: valuesToSubmit.nombre,
                tipo: valuesToSubmit.tipo,
                dni: valuesToSubmit.dni,
                cif: valuesToSubmit.cif,
                email_facturacion: valuesToSubmit.email_facturacion,
                estado: valuesToSubmit.estado,
                representante: valuesToSubmit.representante,
                numero_cuenta: valuesToSubmit.numero_cuenta,
                telefonos: valuesToSubmit.telefonos
              },
              createPortalAccess: createPortalAccess,
              userData: createPortalAccess ? {
                email: valuesToSubmit.email,
                password: valuesToSubmit.password,
                nombre: valuesToSubmit.nombre.split(' ')[0],
                apellidos: valuesToSubmit.nombre.split(' ').slice(1).join(' '),
              } : null
            }
          };
        const { data: functionData, error: functionError } = await supabase.functions.invoke('manage-user', { body: payload });
        if (functionError) throw functionError;
        clientIdToUse = functionData.data.newClientId;
        toast.success('Cliente creado correctamente');

        if (currentUserRol === 'administrador' && selectedComerciales.length > 0 && clientIdToUse) {
          const asignaciones = selectedComerciales.map(uid => ({ cliente_id: clientIdToUse, comercial_user_id: uid }));
          await supabase.from('asignaciones_comercial').insert(asignaciones);
        }
        if (currentUserRol === 'comercial' && userId && clientIdToUse && !selectedComerciales.includes(userId)) {
            await supabase.from('asignaciones_comercial').insert({ cliente_id: clientIdToUse, comercial_user_id: userId });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      // CAMBIO: Volver al historial en lugar de ruta fija
      window.history.back();

    } catch (e: any) {
      console.error("Error al guardar cliente:", e);
      toast.error(`Error al guardar: ${e.message}`);
    }
  }

  const showComercialSelector = currentUserRol === 'administrador';
  const disabledStyle = { backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed', opacity: 0.7 };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: '0' }}>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          
          {/* FILA 1: Nombre y Tipo (50% - 50%) */}
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

          {/* FILA 2: Representante y Nº de Cuenta (50% - 50%) */}
          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="representante">Representante</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input id="representante" {...register('representante')} placeholder="Nombre del representante" />
              </div>
            </div>
            <div>
              <label htmlFor="numero_cuenta">Nº de Cuenta</label>
              <div className="input-icon-wrapper">
                <CreditCard size={18} className="input-icon" />
                <input id="numero_cuenta" {...register('numero_cuenta')} placeholder="IBAN o Nº de cuenta" />
              </div>
            </div>
          </div>

          {/* FILA 3: DNI, CIF, Estado (25% - 25% - 50%) */}
          <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem'}}>
            <div>
              <label htmlFor="dni" style={tipoCliente === 'sociedad' ? { color: 'var(--muted)' } : {}}>
                DNI (personas)
              </label>
              <div className="input-icon-wrapper">
                <FileText size={18} className="input-icon" />
                <input 
                  id="dni" 
                  {...register('dni')}
                  disabled={tipoCliente === 'sociedad'}
                  style={tipoCliente === 'sociedad' ? disabledStyle : {}}
                  placeholder={tipoCliente === 'sociedad' ? 'No aplica' : 'DNI'}
                />
              </div>
            </div>
            <div>
              <label htmlFor="cif" style={tipoCliente === 'persona' ? { color: 'var(--muted)' } : {}}>
                CIF (sociedades)
              </label>
              <div className="input-icon-wrapper">
                <FileText size={18} className="input-icon" />
                <input 
                  id="cif" 
                  {...register('cif')} 
                  disabled={tipoCliente === 'persona'}
                  style={tipoCliente === 'persona' ? disabledStyle : {}}
                  placeholder={tipoCliente === 'persona' ? 'No aplica' : 'CIF'}
                />
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
          </div>

          {/* FILA 4: Email, Teléfonos (50% - 50%) */}
          <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            
            {/* Email */}
            <div>
              <label htmlFor="email_facturacion">Email de facturación</label>
              <div className="input-icon-wrapper">
                <Mail size={18} className="input-icon" />
                <input id="email_facturacion" type="email" {...register('email_facturacion')} placeholder="ejemplo@email.com" />
              </div>
              {errors.email_facturacion && <p className="error-text">{errors.email_facturacion.message}</p>}
            </div>

            {/* Teléfonos (Input Doble) */}
            <div>
              <label>Teléfono(s) de contacto</label>
              <div className="input-icon-wrapper">
                <Phone size={18} className="input-icon" />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    placeholder="Teléfono 1" 
                    value={tel1} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setTel1(val);
                      syncTelefonos(val, tel2);
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <span style={{ color: 'var(--muted)', fontWeight: 'bold', userSelect: 'none' }}>/</span>
                  <input 
                    placeholder="Teléfono 2 (Opcional)" 
                    value={tel2} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setTel2(val);
                      syncTelefonos(tel1, val);
                    }}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                </div>
              </div>
              <input type="hidden" {...register('telefonos')} />
            </div>
          </div>

          {/* ... (Resto de secciones) ... */}
          {showComercialSelector && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={20} /> Asignar Comerciales {editing ? '' : '(Opcional)'}
                  </h3>
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
                        <PasswordInput id="password" {...register('password')} />
                        {errors.password && <p className="error-text">{errors.password.message}</p>}
                      </div>
                  </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {/* CAMBIO: Volver al historial en Cancelar */}
            <button type="button" className="secondary" onClick={() => window.history.back()}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || loadingComerciales || (editing && loadingAssignments)}>
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear Cliente')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}