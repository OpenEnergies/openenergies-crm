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
  punto_id: z.string().uuid({ message: 'Punto obligatorio' }),
  comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }),
  fecha_inicio: z.string().min(1, 'Fecha de inicio obligatoria'),
  estado: z.string().min(1, 'Estado obligatorio'),
  oferta: z.string().trim().optional().nullable(),
  fecha_fin: z.string().optional().nullable(),
  aviso_renovacion: z.boolean().default(false),
  fecha_aviso: z.string().optional().nullable(),
}).refine(
  (v) => (v.aviso_renovacion ? Boolean(v.fecha_aviso && v.fecha_aviso.length > 0) : true),
  { path: ['fecha_aviso'], message: 'Indica la fecha de aviso si activas la renovación' }
);

type FormValues = z.input<typeof schema>;

// --- Tipos para los desplegables ---
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif' | 'empresa_id'>;
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
        .select('id, nombre, cif, empresa_id')
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

export default function ContratoForm({ id }: { id?: string }) {
  const editing = Boolean(id);
  const queryClient = useQueryClient();

  // --- Estados para las listas filtradas ---
  const [filteredClientes, setFilteredClientes] = useState<ClienteOpt[]>([]);
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
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      aviso_renovacion: false,
      estado: 'activo',
    },
  });

  // Observadores (sin cambios)
  const watchedComercializadoraId = watch('comercializadora_id');
  const watchedClienteIdFilter = watch('cliente_id_filter' as any);
  const aviso = watch('aviso_renovacion');

  // --- EFECTO FILTRADO CLIENTES (CORREGIDO) ---
  useEffect(() => {
      if (watchedComercializadoraId) {
          const filtered = allClientes.filter(c => c.empresa_id === watchedComercializadoraId);
          setFilteredClientes(filtered);

          const currentClientIdFilter = getValues('cliente_id_filter' as any);
          const clientInNewList = filtered.some(c => c.id === currentClientIdFilter);
          if (!clientInNewList) {
             setValue('cliente_id_filter' as any, '', { shouldValidate: false });
             setValue('punto_id', '', { shouldValidate: false });
          }

      } else {
          setFilteredClientes([]);
          setValue('cliente_id_filter' as any, '', { shouldValidate: false });
          setValue('punto_id', '', { shouldValidate: false });
      }
  }, [watchedComercializadoraId, allClientes, setValue, getValues]);

  // --- EFECTO FILTRADO PUNTOS (CORREGIDO) ---
  useEffect(() => {
      if (watchedClienteIdFilter) {
          const filtered = allPuntos.filter(p => p.cliente_id === watchedClienteIdFilter);
          setFilteredPuntos(filtered);

          const currentPuntoId = getValues('punto_id');
          const puntoInNewList = filtered.some(p => p.id === currentPuntoId);
          if (!puntoInNewList) {
            setValue('punto_id', '', { shouldValidate: false });
          }

      } else {
          setFilteredPuntos([]);
          setValue('punto_id', '', { shouldValidate: false });
      }
  }, [watchedClienteIdFilter, allPuntos, setValue, getValues]);

  // --- EFECTO CARGA EDICIÓN (CORREGIDO - ERROR TYPESCRIPT) ---
  useEffect(() => {
    if (!editing || !id) return;
    if (loadingComercializadoras || loadingClientes || loadingPuntos) return;

    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id,punto_id,comercializadora_id,oferta,fecha_inicio,fecha_fin,aviso_renovacion,fecha_aviso,estado')
        .eq('id', id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        toast.error(`Error al cargar el contrato: ${error.message}`);
      } else if (data) {
        const initialComercializadoraId = data.comercializadora_id;
        const initialPuntoId = data.punto_id;
        const puntoInicial = allPuntos.find(p => p.id === initialPuntoId);
        const initialClienteIdFilter = puntoInicial?.cliente_id ?? '';

        // *** CORRECCIÓN AQUÍ ***
        // 1. Resetear SOLO los campos del schema
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

        // 2. Usar setValue para el campo de filtro DESPUÉS del reset
        setValue('cliente_id_filter' as any, initialClienteIdFilter, { shouldDirty: false });
        // *** FIN CORRECCIÓN ***

        // Poblar estados locales (sin cambios)
        if (initialComercializadoraId) {
            const clientesFiltrados = allClientes.filter(c => c.empresa_id === initialComercializadoraId);
            setFilteredClientes(clientesFiltrados);
        }
        if (initialClienteIdFilter) {
            const puntosFiltrados = allPuntos.filter(p => p.cliente_id === initialClienteIdFilter);
            setFilteredPuntos(puntosFiltrados);
        }
      }
    })();
    return () => { alive = false; };
  // Añadido setValue a las dependencias porque ahora se usa aquí
  }, [editing, id, reset, setValue, loadingComercializadoras, loadingClientes, loadingPuntos, allClientes, allPuntos]);

  // --- FUNCIÓN ONSUBMIT ---
  const onSubmit = async (values: FormValues) => {
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
      fecha_inicio: values.fecha_inicio,
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

            {/* 2. Cliente (Controlado y deshabilitado) */}
            <div>
              <label htmlFor="cliente_id_filter">Cliente</label>
              <div
                  className="input-icon-wrapper"
                  onMouseDownCapture={(e) => {
                      if (!watchedComercializadoraId) {
                          e.preventDefault();
                          toast.error('Selecciona primero una comercializadora.');
                      }
                  }}
                  title={!watchedComercializadoraId ? 'Selecciona primero una comercializadora' : undefined}
              >
                <HardHat size={18} className="input-icon" />
                <Controller
                    name={"cliente_id_filter" as any} // Campo de control, no del schema
                    control={control}
                    render={({ field }) => (
                        <select
                            id="cliente_id_filter"
                            {...field}
                            disabled={!watchedComercializadoraId || loadingClientes}
                            style={{ cursor: !watchedComercializadoraId ? 'not-allowed' : 'default' }}
                        >
                            <option value="">
                                {!watchedComercializadoraId
                                    ? '← Selecciona comercializadora'
                                    : loadingClientes
                                    ? 'Cargando...'
                                    : filteredClientes.length === 0
                                    ? 'No hay clientes'
                                    : 'Selecciona cliente...'}
                            </option>
                            {filteredClientes.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre} {c.cif ? `(${c.cif})` : ''}</option>
                            ))}
                        </select>
                    )}
                />
              </div>
              {/* No mostramos error para el campo de filtro */}
            </div>

            {/* 3. Punto de Suministro (Controlado y deshabilitado) */}
            <div>
              <label htmlFor="punto_id">Punto de suministro</label>
              <div
                  className="input-icon-wrapper"
                  onMouseDownCapture={(e) => {
                      if (!watchedClienteIdFilter) { // Usar campo de filtro
                          e.preventDefault();
                          toast.error('Selecciona primero un cliente.');
                      }
                  }}
                  title={!watchedClienteIdFilter ? 'Selecciona primero un cliente' : undefined} // Usar campo de filtro
              >
                <Plug size={18} className="input-icon" />
                <Controller
                    name="punto_id" // Este SÍ está en el schema
                    control={control}
                    render={({ field }) => (
                        <select
                            id="punto_id"
                            {...field}
                            disabled={!watchedClienteIdFilter || loadingPuntos} // Usar campo de filtro
                            style={{ cursor: !watchedClienteIdFilter ? 'not-allowed' : 'default' }} // Usar campo de filtro
                        >
                            <option value="">
                                {!watchedClienteIdFilter // Usar campo de filtro
                                    ? '← Selecciona un cliente'
                                    : loadingPuntos
                                    ? 'Cargando...'
                                    : filteredPuntos.length === 0
                                    ? 'No hay puntos'
                                    : 'Selecciona punto...'}
                            </option>
                            {filteredPuntos.map((p) => (
                              <option key={p.id} value={p.id}>{puntoLabel(p)}</option>
                            ))}
                        </select>
                    )}
                />
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