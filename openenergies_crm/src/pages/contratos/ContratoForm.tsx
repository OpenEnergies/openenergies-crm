// src/pages/contratos/ContratoForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { Plug, Building2, Calendar, Tag, Activity, BellRing, HardHat } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cliente, Empresa, PuntoSuministro } from '@lib/types';

// === Schema del formulario (sin cambios) ===
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

// --- Tipos para los desplegables ---
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif'>;
type PuntoOpt = Pick<PuntoSuministro, 'id' | 'cups' | 'direccion' | 'cliente_id'>;

// --- Funciones para fetching (sin cambios) ---
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'comercializadora')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}
async function fetchAllClientes(): Promise<ClienteOpt[]> {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}
async function fetchAllPuntos(): Promise<PuntoOpt[]> {
    const { data, error } = await supabase
        .from('puntos_suministro')
        .select('id, cups, direccion, cliente_id')
        .order('cups', { ascending: true });
    if (error) throw error;
    return data || [];
}
// ---------------------------------------------

function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function ContratoForm({ id }: { id?: string }) {
  const editing = Boolean(id);
  const queryClient = useQueryClient();

  // --- Estado para filtrar puntos por cliente ---
  const [filteredPuntos, setFilteredPuntos] = useState<PuntoOpt[]>([]);

  // --- Fetching de datos (sin cambios) ---
  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
      queryKey: ['comercializadoras'],
      queryFn: fetchComercializadoras,
  });
  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
      queryKey: ['allClientesForContratoForm'],
      queryFn: fetchAllClientes,
  });
  const { data: allPuntos = [], isLoading: loadingPuntos } = useQuery({
      queryKey: ['allPuntosForContratoForm'],
      queryFn: fetchAllPuntos,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cliente_id: '',
      aviso_renovacion: false,
      estado: 'activo',
    },
  });

    // Cliente (typeahead)
  const [clienteInput, setClienteInput] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);

  // Punto (typeahead)
  const [puntoInput, setPuntoInput] = useState('');
  const [puntoOpen, setPuntoOpen] = useState(false);


  // Observadores
  const watchedClienteId = watch('cliente_id'); // Campo de filtro para cliente
  const aviso = watch('aviso_renovacion');

  // Lista de clientes filtrados desde 1 carácter
  const filteredClientes = useMemo(() => {
    const q = normalize(clienteInput.trim());
    if (!q) return [];
    return allClientes
      .filter(c => normalize(`${c.nombre} ${c.cif ?? ''}`).includes(q))
      .slice(0, 12);
  }, [clienteInput, allClientes]);

  // Lista de puntos filtrados por cliente + query (CUPS o Dirección), mostrando solo CUPS

  const filteredPuntosByQuery = useMemo(() => {
    const q = normalize(puntoInput.trim());
    if (!watchedClienteId || !q) return [];
    const candidatos = allPuntos.filter(p => p.cliente_id === watchedClienteId);
    return candidatos
      .filter(p => normalize(`${p.cups} ${p.direccion ?? ''}`).includes(q))
      .slice(0, 12);
  }, [puntoInput, watchedClienteId, allPuntos]);

  // --- EFECTO FILTRADO PUNTOS POR CLIENTE ---
  useEffect(() => {
    // Al cambiar de cliente, limpiar el punto
    setPuntoInput('');
    setValue('punto_id', '', { shouldValidate: true, shouldDirty: true });
    if (watchedClienteId) clearErrors('cliente_id');
  }, [watchedClienteId, setValue, clearErrors]);

  // --- EFECTO CARGA EDICIÓN ---
  useEffect(() => {
    if (!editing || !id) return;
    if (loadingComercializadoras || loadingClientes || loadingPuntos) return;

    let alive = true;
    (async () => {
      // Cargar contrato
      const { data, error } = await supabase
        .from('contratos')
        .select('id,punto_id,comercializadora_id,oferta,fecha_inicio,fecha_fin,aviso_renovacion,fecha_aviso,estado')
        .eq('id', id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        toast.error(`Error al cargar el contrato: ${error.message}`);
      } else if (data) {
        const initialPuntoId = data.punto_id;
        const puntoInicial = allPuntos.find(p => p.id === initialPuntoId);
        const initialClienteId = puntoInicial?.cliente_id ?? '';

        // Resetear campos del schema
        reset({
          punto_id: data.punto_id,
          comercializadora_id: data.comercializadora_id,
          fecha_inicio: data.fecha_inicio,
          estado: (data.estado as string) ?? 'activo',
          oferta: data.oferta ?? null,
          fecha_fin: data.fecha_fin ?? null,
          aviso_renovacion: Boolean(data.aviso_renovacion),
          fecha_aviso: data.fecha_aviso ?? null,
        });

        // Usar setValue para el campo de filtro cliente_id
        setValue('cliente_id', initialClienteId, { shouldDirty: false });

         // Mostrar nombre de cliente y CUPS del punto en los inputs visibles
        const clienteInicial = allClientes.find(c => c.id === initialClienteId);
        setClienteInput(clienteInicial ? `${clienteInicial.nombre}${clienteInicial.cif ? ` (${clienteInicial.cif})` : ''}` : '');
        setPuntoInput(puntoInicial?.cups ?? '');

        // Poblar puntos filtrados
        if (initialClienteId) {
            const puntosFiltrados = allPuntos.filter(p => p.cliente_id === initialClienteId);
            setFilteredPuntos(puntosFiltrados);
        }
      }
    })();
    return () => { alive = false; };
  }, [editing, id, reset, setValue, loadingComercializadoras, loadingClientes, loadingPuntos, allPuntos]);

  // --- FUNCIÓN ONSUBMIT ---
  const onSubmit = async (values: FormValues) => {
    const clienteId = getValues('cliente_id');
    if (!clienteId) {
      setError('cliente_id', { type: 'validate', message: 'Selecciona un cliente de la lista' });
      return;
    }
    if (!values.punto_id) {
      setError('punto_id', { type: 'validate', message: 'Selecciona un punto de la lista' });
      return;
    }
    const puntoSel = allPuntos.find(p => p.id === values.punto_id);
    if (!puntoSel || puntoSel.cliente_id !== clienteId) {
      setError('punto_id', { type: 'validate', message: 'El punto no pertenece al cliente seleccionado' });
      return;
    }
    // Necesitamos obtener el cliente_id real del punto seleccionado
    let clienteIdParaActualizar: string | null = null;
    try {
      const puntoSeleccionado = allPuntos.find(p => p.id === values.punto_id);
      if (puntoSeleccionado) {
        clienteIdParaActualizar = puntoSeleccionado.cliente_id;
      } else {
        const { data: puntoData, error: puntoError } = await supabase
          .from('puntos_suministro')
          .select('cliente_id')
          .eq('id', values.punto_id)
          .single();
        if (puntoError) throw new Error(`Punto de suministro no encontrado: ${puntoError.message}`);
        clienteIdParaActualizar = puntoData.cliente_id;
      }
    } catch (e: any) {
      console.error("Error al buscar cliente_id:", e);
      toast.error(`Error al validar el punto de suministro: ${e.message}`);
      return;
    }

    // Preparamos el payload sin el campo temporal 'cliente_id_filter'
    const payload = {
      punto_id: values.punto_id,
      comercializadora_id: values.comercializadora_id,
      fecha_inicio: values.fecha_inicio?.toString().trim() || null,
      estado: values.estado,
      oferta: values.oferta?.toString().trim() || null,
      fecha_fin: values.fecha_fin?.toString().trim() || null,
      aviso_renovacion: values.aviso_renovacion,
      fecha_aviso: values.aviso_renovacion ? (values.fecha_aviso?.toString().trim() || null) : null,
    };

    try {
        if (editing) {
          const { error } = await supabase.from('contratos').update(payload).eq('id', id!);
          if (error) throw error;
        } else {
          // --- CREACIÓN ---
          const { error } = await supabase.from('contratos').insert(payload);
          if (error) throw error;

          // --- LÓGICA DE ACTUALIZAR ESTADO DE CLIENTE ---
          if (clienteIdParaActualizar) {
            const { error: clienteUpdateError } = await supabase
              .from('clientes')
              .update({ estado: 'activo' })
              .eq('id', clienteIdParaActualizar);

            if (clienteUpdateError) {
              console.error('Error al actualizar estado del cliente:', clienteUpdateError.message);
              toast.error('Contrato creado, pero no se pudo actualizar el estado del cliente.');
            } else {
              queryClient.invalidateQueries({ queryKey: ['clientes'] });
            }
          }
          // ------------------------------------------
        }
        toast.success(editing ? 'Contrato actualizado' : 'Contrato creado');
        router.history.back();
    } catch (error: any) {
        console.error("Error al guardar contrato:", error);
        toast.error(`Error al guardar: ${error.message}`);
    }
  };


  const puntoLabel = useMemo(
    () => (p: PuntoOpt) => `${p.cups} — ${p.direccion}`,
    []
  );

  const isLoadingData = loadingComercializadoras || loadingClientes || loadingPuntos;
  const isSubmittingForm = isSubmitting || isLoadingData;

  // --- RENDERIZADO (JSX) ---
  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>

          <div className="form-row" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>

            {/* 1. Comercializadora (Independiente) */}
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

            {/* 2. Cliente (Typeahead obligatorio, independiente) */}
            <div>
              <label htmlFor="cliente_input">Cliente</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <HardHat size={18} className="input-icon" />

                {/* Input visible */}
                <input
                  id="cliente_input"
                  type="text"
                  autoComplete="off"
                  value={clienteInput}
                  placeholder={loadingClientes ? 'Cargando clientes...' : 'Escribe para buscar cliente'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClienteInput(v);
                    // Invalida la selección hasta que elija una sugerencia
                    setValue('cliente_id', '', { shouldValidate: true, shouldDirty: true });
                    setError('cliente_id', { type: 'validate', message: 'Selecciona un cliente de la lista' });
                    setClienteOpen(normalize(v).length >= 1);
                  }}
                  onFocus={() => {
                    if (normalize(clienteInput).length >= 1) setClienteOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setClienteOpen(false), 150)}
                />

                {/* Campo oculto con el UUID real */}
                <Controller
                  name={'cliente_id'}
                  control={control}
                  render={({ field }) => <input type="hidden" {...field} />}
                />

                {/* Dropdown de sugerencias */}
                {clienteOpen && filteredClientes.length > 0 && (
                  <ul
                    role="listbox"
                    className="typeahead-list"
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      margin: 0, padding: 0, listStyle: 'none',
                      background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e5e7eb)',
                      borderTop: 'none', maxHeight: 240, overflowY: 'auto',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    }}
                  >
                    {filteredClientes.map(c => (
                      <li
                        key={c.id}
                        role="option"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const label = `${c.nombre}${c.cif ? ` (${c.cif})` : ''}`;
                          setClienteInput(label);
                          setValue('cliente_id', c.id, { shouldValidate: true, shouldDirty: true });
                          clearErrors('cliente_id');
                          setClienteOpen(false);
                        }}
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderTop: '1px solid var(--border-color, #e5e7eb)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted, #f6f7f9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {c.nombre} {c.cif ? <span style={{ opacity: 0.7 }}>({c.cif})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.cliente_id && <p className="error-text">{errors.cliente_id.message}</p>}
            </div>


            {/* 3. Punto de Suministro (Typeahead dependiente del cliente) */}
            <div>
              <label htmlFor="punto_input">Punto de suministro</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <Plug size={18} className="input-icon" />

                {/* Input visible */}
                <input
                  id="punto_input"
                  type="text"
                  autoComplete="off"
                  value={puntoInput}
                  placeholder={!watchedClienteId ? '← Selecciona un cliente' : (loadingPuntos ? 'Cargando puntos...' : 'Escribe CUPS o dirección')}
                  disabled={!watchedClienteId || loadingPuntos}
                  style={{ cursor: !watchedClienteId ? 'not-allowed' : 'text' }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPuntoInput(v);
                    setValue('punto_id', '' as any, { shouldValidate: true, shouldDirty: true });
                    setError('punto_id', { type: 'validate', message: 'Selecciona un punto de la lista' });
                    setPuntoOpen(!!watchedClienteId && normalize(v).length >= 1);
                  }}
                  onFocus={() => {
                    if (watchedClienteId && normalize(puntoInput).length >= 1) setPuntoOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setPuntoOpen(false), 150)}
                />

                {/* Campo oculto con el UUID real del punto */}
                <Controller
                  name="punto_id"
                  control={control}
                  render={({ field }) => <input type="hidden" {...field} />}
                />

                {/* Dropdown de sugerencias (muestra SOLO CUPS) */}
                {puntoOpen && filteredPuntosByQuery.length > 0 && (
                  <ul
                    role="listbox"
                    className="typeahead-list"
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      margin: 0, padding: 0, listStyle: 'none',
                      background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e5e7eb)',
                      borderTop: 'none', maxHeight: 240, overflowY: 'auto',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    }}
                  >
                    {filteredPuntosByQuery.map(p => (
                      <li
                        key={p.id}
                        role="option"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPuntoInput(p.cups);            // 👉 solo CUPS en el input visible
                          setValue('punto_id', p.id, { shouldValidate: true, shouldDirty: true });
                          clearErrors('punto_id');
                          setPuntoOpen(false);
                        }}
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderTop: '1px solid var(--border-color, #e5e7eb)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted, #f6f7f9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {p.cups}
                      </li>
                    ))}
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
                      {/* Añadimos el span con el punto de color */}
                      <option value="stand by">
                        <span className="status-dot status-standby" style={{ verticalAlign: 'middle' }}></span> Stand By
                      </option>
                      <option value="procesando">
                        <span className="status-dot status-procesando" style={{ verticalAlign: 'middle' }}></span> Procesando
                      </option>
                      <option value="activo">
                        <span className="status-dot status-activo" style={{ verticalAlign: 'middle' }}></span> Activo
                      </option>
                      <option value="desistido">
                        <span className="status-dot status-desistido" style={{ verticalAlign: 'middle' }}></span> Desistido
                      </option>
                    </select>
                  </div>
                  {errors.estado && <p className="error-text">{errors.estado.message}</p>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button
            type="submit"
            className=""
            disabled={isSubmittingForm}
          >
            {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear contrato')}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => router.history.back()}
          >
            Cancelar
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}