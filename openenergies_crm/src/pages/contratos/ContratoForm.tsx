// src/pages/contratos/ContratoForm.tsx
import { useEffect, useState } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { Plug, Building2, Calendar, Tag, Activity, BellRing, HardHat } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cliente, Empresa, PuntoSuministro } from '@lib/types';

const schema = z.object({
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  punto_id: z.string().uuid({ message: 'Punto obligatorio' }),
  comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }),
  fecha_inicio: z.string().optional().nullable().or(z.literal('')),
  estado: z.string().min(1, 'Estado obligatorio'),
  oferta: z.string().trim().optional().nullable(),
  fecha_fin: z.string().optional().nullable().or(z.literal('')),
  aviso_renovacion: z.boolean().default(false),
  fecha_aviso: z.string().optional().nullable(),
}).refine(
  (v) => (v.aviso_renovacion ? Boolean(v.fecha_aviso && v.fecha_aviso.length > 0) : true),
  { path: ['fecha_aviso'], message: 'Indica la fecha de aviso si activas la renovación' }
);

type FormValues = z.input<typeof schema>;
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif'>;
type PuntoOpt = Pick<PuntoSuministro, 'id' | 'cups' | 'direccion' | 'cliente_id'>;

// --- Fetching ---
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'comercializadora')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Búsqueda dinámica de Clientes
async function searchClientes(query: string): Promise<ClienteOpt[]> {
    if (!query) return [];
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif')
        .or(`nombre.ilike.%${query}%,cif.ilike.%${query}%`)
        .limit(20);
    if (error) throw error;
    return data || [];
}

// Búsqueda dinámica de Puntos (filtrados por cliente si se selecciona)
async function searchPuntos(query: string, clienteId?: string): Promise<PuntoOpt[]> {
    let q = supabase
        .from('puntos_suministro')
        .select('id, cups, direccion, cliente_id')
        .limit(20);
    
    if (clienteId) {
        q = q.eq('cliente_id', clienteId);
    }
    
    // Si hay query, filtramos por CUPS o Dirección
    if (query) {
        q = q.or(`cups.ilike.%${query}%,direccion.ilike.%${query}%`);
    } else if (!clienteId) {
        // Si no hay cliente ni query, no devolver nada para no saturar
        return [];
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export default function ContratoForm({ id }: { id?: string }) {
  const editing = Boolean(id);
  const queryClient = useQueryClient();

  // --- Estados de Búsqueda ---
  const [clienteInput, setClienteInput] = useState('');
  const [puntoInput, setPuntoInput] = useState('');
  
  const [debouncedCliente, setDebouncedCliente] = useState('');
  const [debouncedPunto, setDebouncedPunto] = useState('');

  const [clienteOpen, setClienteOpen] = useState(false);
  const [puntoOpen, setPuntoOpen] = useState(false);

  // Debounce effects
  useEffect(() => { const t = setTimeout(() => setDebouncedCliente(clienteInput), 300); return () => clearTimeout(t); }, [clienteInput]);
  useEffect(() => { const t = setTimeout(() => setDebouncedPunto(puntoInput), 300); return () => clearTimeout(t); }, [puntoInput]);

  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
      queryKey: ['comercializadoras'],
      queryFn: fetchComercializadoras,
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cliente_id: '', aviso_renovacion: false, estado: 'activo' },
  });

  const watchedClienteId = watch('cliente_id');
  const aviso = watch('aviso_renovacion');

  // --- Queries Dinámicas ---
  const { data: clientesFound = [], isLoading: loadingClientes } = useQuery({
      queryKey: ['searchClientes', debouncedCliente],
      queryFn: () => searchClientes(debouncedCliente),
      enabled: debouncedCliente.length >= 2,
  });

  const { data: puntosFound = [], isLoading: loadingPuntos } = useQuery({
      queryKey: ['searchPuntos', debouncedPunto, watchedClienteId],
      queryFn: () => searchPuntos(debouncedPunto, watchedClienteId),
      // Buscar si hay texto O si hay un cliente seleccionado (para mostrar todos sus puntos)
      enabled: debouncedPunto.length >= 2 || !!watchedClienteId, 
  });

  // --- Carga Inicial (Edición) ---
  useEffect(() => {
    if (!editing || !id) return;
    if (loadingComercializadoras) return;

    let alive = true;
    (async () => {
      // Obtenemos contrato con joins para mostrar nombre cliente y cups
      const { data, error } = await supabase
        .from('contratos')
        .select(`
            *,
            puntos_suministro (
                id, cups, direccion, cliente_id,
                clientes ( id, nombre, cif )
            )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        toast.error(`Error al cargar: ${error.message}`);
      } else if (data) {
        const punto = data.puntos_suministro as any; // Cast rápido para acceder a relaciones
        const cliente = punto?.clientes;

        reset({
          punto_id: data.punto_id,
          comercializadora_id: data.comercializadora_id,
          fecha_inicio: data.fecha_inicio ?? '',
          estado: (data.estado as string) ?? 'activo',
          oferta: data.oferta ?? '', 
          fecha_fin: data.fecha_fin ?? '', 
          aviso_renovacion: Boolean(data.aviso_renovacion),
          fecha_aviso: data.fecha_aviso ?? '', 
          cliente_id: cliente?.id ?? '' // Establecer ID cliente para habilitar filtro puntos
        });

        // Pre-rellenar inputs visuales
        if (cliente) setClienteInput(`${cliente.nombre} ${cliente.cif ? `(${cliente.cif})` : ''}`);
        if (punto) setPuntoInput(`${punto.cups} - ${punto.direccion}`);
      }
    })();
    return () => { alive = false; };
  }, [editing, id, reset, loadingComercializadoras]);

  // --- Submit Optimizado (Bloque 1 + Bloque 2) ---
  const onSubmit = async (values: FormValues) => {
    // Validaciones básicas
    if (!values.cliente_id) { setError('cliente_id', { message: 'Selecciona un cliente' }); return; }
    if (!values.punto_id) { setError('punto_id', { message: 'Selecciona un punto' }); return; }

    const payload = {
      punto_id: values.punto_id,
      comercializadora_id: values.comercializadora_id,
      fecha_inicio: values.fecha_inicio?.trim() || null,
      estado: values.estado,
      oferta: values.oferta?.trim() || null,
      fecha_fin: values.fecha_fin?.trim() || null,
      aviso_renovacion: values.aviso_renovacion,
      fecha_aviso: values.aviso_renovacion ? (values.fecha_aviso?.trim() || null) : null,
    };

    try {
        if (editing) {
          const { error } = await supabase.from('contratos').update(payload).eq('id', id!);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('contratos').insert(payload);
          if (error) throw error;
        }

        // Invalidación global para refrescar vistas
        queryClient.invalidateQueries({ queryKey: ['contratos'] });
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
        queryClient.invalidateQueries({ queryKey: ['puntos'] });

        toast.success(editing ? 'Contrato actualizado' : 'Contrato creado');
        router.history.back();
    } catch (error: any) {
        console.error("Error:", error);
        toast.error(`Error al guardar: ${error.message}`);
    }
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>

          <div className="form-row" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
            {/* 1. Comercializadora */}
            <div>
              <label htmlFor="comercializadora_id">Comercializadora</label>
              <div className="input-icon-wrapper">
                <Building2 size={18} className="input-icon" />
                <select id="comercializadora_id" {...register('comercializadora_id')} disabled={loadingComercializadoras}>
                  <option value="">{loadingComercializadoras ? 'Cargando...' : 'Selecciona...'}</option>
                  {comercializadoras.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {errors.comercializadora_id && <p className="error-text">{errors.comercializadora_id.message}</p>}
            </div>

            {/* 2. Cliente (Server-Side Search) */}
            <div>
              <label htmlFor="cliente_input">Cliente</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <HardHat size={18} className="input-icon" />
                <input
                  id="cliente_input"
                  type="text"
                  autoComplete="off"
                  value={clienteInput}
                  placeholder="Buscar cliente..."
                  onChange={(e) => {
                    setClienteInput(e.target.value);
                    setValue('cliente_id', '', { shouldDirty: true }); // Reset ID al escribir
                    // Resetear también punto porque depende del cliente
                    setValue('punto_id', '', { shouldDirty: true });
                    setPuntoInput('');
                    setClienteOpen(e.target.value.length >= 2);
                  }}
                  onFocus={() => { if (clienteInput.length >= 2) setClienteOpen(true); }}
                  onBlur={() => setTimeout(() => setClienteOpen(false), 200)}
                />
                <Controller name='cliente_id' control={control} render={({ field }) => <input type="hidden" {...field} />} />
                
                {clienteOpen && (
                  <ul className="typeahead-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, margin: 0, padding: 0, listStyle: 'none', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
                    {loadingClientes ? <li style={{padding:'0.5rem'}}>Cargando...</li> : clientesFound.map(c => (
                      <li key={c.id} onMouseDown={(e) => {
                        e.preventDefault();
                        setClienteInput(`${c.nombre} ${c.cif ? `(${c.cif})` : ''}`);
                        setValue('cliente_id', c.id, { shouldValidate: true });
                        clearErrors('cliente_id');
                        setClienteOpen(false);
                      }} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        {c.nombre} <small style={{color:'var(--muted)'}}>{c.cif}</small>
                      </li>
                    ))}
                    {!loadingClientes && clientesFound.length === 0 && <li style={{padding:'0.5rem'}}>No se encontraron clientes</li>}
                  </ul>
                )}
              </div>
              {errors.cliente_id && <p className="error-text">{errors.cliente_id.message}</p>}
            </div>

            {/* 3. Punto (Server-Side Search + Filtro Cliente) */}
            <div>
              <label htmlFor="punto_input">Punto de suministro</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <Plug size={18} className="input-icon" />
                <input
                  id="punto_input"
                  type="text"
                  autoComplete="off"
                  value={puntoInput}
                  placeholder={!watchedClienteId ? 'Selecciona un cliente primero' : 'Buscar CUPS...'}
                  disabled={!watchedClienteId}
                  onChange={(e) => {
                    setPuntoInput(e.target.value);
                    setValue('punto_id', '' as any, { shouldDirty: true });
                    setPuntoOpen(true); // Abrir siempre al escribir si hay cliente
                  }}
                  onFocus={() => { if (watchedClienteId) setPuntoOpen(true); }}
                  onBlur={() => setTimeout(() => setPuntoOpen(false), 200)}
                />
                <Controller name="punto_id" control={control} render={({ field }) => <input type="hidden" {...field} />} />

                {puntoOpen && watchedClienteId && (
                  <ul className="typeahead-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, margin: 0, padding: 0, listStyle: 'none', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
                    {loadingPuntos ? <li style={{padding:'0.5rem'}}>Cargando...</li> : puntosFound.map(p => (
                      <li key={p.id} onMouseDown={(e) => {
                        e.preventDefault();
                        setPuntoInput(p.cups);
                        setValue('punto_id', p.id, { shouldValidate: true });
                        clearErrors('punto_id');
                        setPuntoOpen(false);
                      }} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        <strong>{p.cups}</strong><br/><small>{p.direccion}</small>
                      </li>
                    ))}
                    {!loadingPuntos && puntosFound.length === 0 && <li style={{padding:'0.5rem'}}>Sin resultados</li>}
                  </ul>
                )}
              </div>
              {errors.punto_id && <p className="error-text">{errors.punto_id.message}</p>}
            </div>
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="fecha_inicio">Fecha inicio</label>
              <div className="input-icon-wrapper">
                <Calendar size={18} className="input-icon" />
                <input type="date" id="fecha_inicio" {...register('fecha_inicio')} />
              </div>
              {errors.fecha_inicio && <p className="error-text">{errors.fecha_inicio.message}</p>}
            </div>
            <div>
              <label htmlFor="fecha_fin">Fecha fin (opcional)</label>
              <div className="input-icon-wrapper">
                <Calendar size={18} className="input-icon" />
                <input type="date" id="fecha_fin" {...register('fecha_fin')} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="oferta">Oferta (opcional)</label>
            <div className="input-icon-wrapper">
                <Tag size={18} className="input-icon" />
                <input type="text" id="oferta" placeholder="Nombre o referencia de la oferta" {...register('oferta')} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>Renovación y Estado</h3>
            <div className="grid" style={{ gap: '1rem' }}>
              <label className="switch-wrapper">
                <input type="checkbox" {...register('aviso_renovacion')} />
                <span className="switch-slider"></span>
                <span className="switch-label">Activar aviso de renovación</span>
              </label>

              <div className="form-row">
                <div>
                  <label htmlFor="fecha_aviso">Fecha aviso</label>
                  <div className="input-icon-wrapper">
                    <BellRing size={18} className="input-icon" />
                    <input type="date" id="fecha_aviso" disabled={!aviso} {...register('fecha_aviso')} />
                  </div>
                  {errors.fecha_aviso && <p className="error-text">{errors.fecha_aviso.message}</p>}
                </div>
                <div>
                  <label htmlFor="estado">Estado</label>
                  <div className="input-icon-wrapper">
                    <Activity size={18} className="input-icon" />
                    <select id="estado" {...register('estado')}>
                      <option value="stand by">🟠 Stand By</option>
                      <option value="procesando">🟡 Procesando</option>
                      <option value="activo">🟢 Activo</option>
                      <option value="desistido">⚫ Desistido</option>
                    </select>
                  </div>
                  {errors.estado && <p className="error-text">{errors.estado.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear contrato')}
            </button>
            <button type="button" className="secondary" onClick={() => router.history.back()}>
                Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}