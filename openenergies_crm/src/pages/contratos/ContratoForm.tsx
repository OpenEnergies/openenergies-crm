// src/pages/contratos/ContratoForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
// --- Importa Controller y useQuery ---
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
// --- Importa HardHat y tipos ---
import { Plug, Building2, Calendar, Tag, Activity, BellRing, HardHat } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import type { Cliente, Empresa, PuntoSuministro } from '@lib/types';

// === Schema del formulario (sin cambios) ===
// El schema ya tiene 'punto_id' y 'comercializadora_id' que es lo que se guarda.
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
// (Usamos Pick para seleccionar solo los campos necesarios)
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif' | 'empresa_id'>;
type PuntoOpt = Pick<PuntoSuministro, 'id' | 'cups' | 'direccion' | 'cliente_id'>;
// ------------------------------------

// --- Funciones para fetching con React Query ---
// 1. Obtiene solo las empresas de tipo 'comercializadora'
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'comercializadora') // ¡Filtro clave!
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

// 2. Obtiene TODOS los clientes (para filtrar en el frontend)
async function fetchAllClientes(): Promise<ClienteOpt[]> {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif, empresa_id') // Necesitamos empresa_id
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

// 3. Obtiene TODOS los puntos de suministro (para filtrar en el frontend)
async function fetchAllPuntos(): Promise<PuntoOpt[]> {
    const { data, error } = await supabase
        .from('puntos_suministro')
        .select('id, cups, direccion, cliente_id') // Necesitamos cliente_id
        .order('cups', { ascending: true });
    if (error) throw error;
    return data || [];
}
// ---------------------------------------------

export default function ContratoForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);

  // --- Estados para las listas filtradas ---
  const [filteredClientes, setFilteredClientes] = useState<ClienteOpt[]>([]);
  const [filteredPuntos, setFilteredPuntos] = useState<PuntoOpt[]>([]);
  // ---------------------------------------

  // --- Fetching de datos ---
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
  // -------------------------

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control, // Importante para los selects controlados
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      aviso_renovacion: false,
      estado: 'activo',
    },
  });

  // Observamos los campos que actúan como filtros
  const watchedComercializadoraId = watch('comercializadora_id');
  // Creamos un campo 'cliente_id_filter' (NO está en el schema) para el 2º desplegable
  const watchedClienteId = watch('cliente_id_filter' as any); 
  
  const aviso = watch('aviso_renovacion');

  // --- Efecto 1: Filtrar Clientes por Comercializadora ---
  useEffect(() => {
      if (watchedComercializadoraId) {
          const filtered = allClientes.filter(c => c.empresa_id === watchedComercializadoraId);
          setFilteredClientes(filtered);
      } else {
          setFilteredClientes([]);
      }
      // Al cambiar de comercializadora, reseteamos los campos dependientes
      setValue('cliente_id_filter' as any, '', { shouldValidate: false });
      setValue('punto_id', '', { shouldValidate: false });
  }, [watchedComercializadoraId, allClientes, setValue]);

  // --- Efecto 2: Filtrar Puntos por Cliente ---
  useEffect(() => {
      if (watchedClienteId) {
          const filtered = allPuntos.filter(p => p.cliente_id === watchedClienteId);
          setFilteredPuntos(filtered);
      } else {
          setFilteredPuntos([]);
      }
      // Al cambiar de cliente, reseteamos el punto
      setValue('punto_id', '', { shouldValidate: false });
  }, [watchedClienteId, allPuntos, setValue]);
  // ----------------------------------------------

  // Carga contrato si edita
  useEffect(() => {
    if (!editing || !id) return;
    // Espera a que todos los datos de los desplegables estén cargados
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
        // --- Lógica para pre-seleccionar los desplegables en modo edición ---
        const initialComercializadoraId = data.comercializadora_id;
        const initialPuntoId = data.punto_id;
        
        // 1. Encontrar el punto para saber el cliente
        const puntoInicial = allPuntos.find(p => p.id === initialPuntoId);
        const initialClienteId = puntoInicial?.cliente_id ?? '';

        // 2. Filtrar las listas
        if (initialComercializadoraId) {
            const clientesFiltrados = allClientes.filter(c => c.empresa_id === initialComercializadoraId);
            setFilteredClientes(clientesFiltrados);
        }
        if (initialClienteId) {
            const puntosFiltrados = allPuntos.filter(p => p.cliente_id === initialClienteId);
            setFilteredPuntos(puntosFiltrados);
        }

        // 3. Resetear el formulario con TODOS los valores
        reset({
          ...data,
          oferta: data.oferta ?? null,
          fecha_fin: data.fecha_fin ?? null,
          aviso_renovacion: Boolean(data.aviso_renovacion),
          fecha_aviso: data.fecha_aviso ?? null,
          estado: (data.estado as string) ?? 'activo',
        });
        
        // 4. Establecer el valor del campo 'cliente_id_filter' (que no está en 'data')
        setValue('cliente_id_filter' as any, initialClienteId, { shouldDirty: false });
      }
    })();
    return () => { alive = false; };
  }, [editing, id, reset, setValue, loadingComercializadoras, loadingClientes, loadingPuntos, allClientes, allPuntos]);


  const onSubmit = async (values: FormValues) => {
    // serverError ya no se usa, usamos toasts
    
    // Normaliza opcionales a null si vienen vacíos
    const payload = {
      ...values,
      oferta: values.oferta?.toString().trim() || null,
      fecha_fin: values.fecha_fin?.toString().trim() || null,
      fecha_aviso: values.aviso_renovacion ? (values.fecha_aviso?.toString().trim() || null) : null,
    };
    // El payload ya contiene 'punto_id' y 'comercializadora_id' del schema

    try {
        if (editing) {
          const { error } = await supabase.from('contratos').update(payload).eq('id', id!);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('contratos').insert(payload);
          if (error) throw error;
        }
        toast.success(editing ? 'Contrato actualizado' : 'Contrato creado');
        navigate({ to: '/app/contratos' });
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

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          
          {/* --- NUEVO LAYOUT DE 3 COLUMNAS --- */}
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
              {/* No mostramos error de Zod aquí porque este campo no está en el schema */}
            </div>

            {/* 3. Punto de Suministro (Controlado y deshabilitado) */}
            <div>
              <label htmlFor="punto_id">Punto de suministro</label>
              <div
                  className="input-icon-wrapper"
                  onMouseDownCapture={(e) => {
                      if (!watchedClienteId) {
                          e.preventDefault();
                          toast.error('Selecciona primero un cliente.');
                      }
                  }}
                  title={!watchedClienteId ? 'Selecciona primero un cliente' : undefined}
              >
                <Plug size={18} className="input-icon" />
                <Controller
                    name="punto_id" // Este SÍ está en el schema
                    control={control}
                    render={({ field }) => (
                        <select
                            id="punto_id"
                            {...field}
                            disabled={!watchedClienteId || loadingPuntos}
                            style={{ cursor: !watchedClienteId ? 'not-allowed' : 'default' }}
                        >
                            <option value="">
                                {!watchedClienteId
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
          {/* --- FIN LAYOUT 3 COLUMNAS --- */}


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
                        <option value="activo">Activo</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="vencido">Vencido</option>
                        <option value="resuelto">Resuelto</option>
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
            className="" // Quita btn-primary si no lo usas
            disabled={isSubmittingForm}
          >
            {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear contrato')}
          </button>
          <button
            type="button"
            className="secondary" // Quita btn-secondary
            onClick={() => navigate({ to: '/app/contratos' })}
          >
            Cancelar
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}