// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState, useMemo } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import {
  MapPin, Barcode, Zap, TrendingUp, FileText, Building, Sun,
  Users, X, Plus, ChevronDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchableSelect from '@components/SearchableSelect';
import { useTheme } from '@hooks/ThemeContext';

// ============ TIPOS ============
type TipoFactura = 'Luz' | 'Gas';
type TipoTarifa = '2.0TD' | '3.0TD' | '6.1TD' | 'RL.1' | 'RL.2' | 'RL.3' | 'RL.4' | 'RL.5' | 'RL.6' | 'RL.7' | 'RL.8' | 'RL.9' | 'RL.10' | 'RL.11';
type EstadoPunto = 'Nueva Oportunidad' | 'Solicitar Doc.' | 'Doc. OK' | 'Estudio enviado' | 'Aceptado' | 'Permanencia' | 'Standby' | 'Desiste';
type EstadoFV = 'activa' | 'no' | 'pendiente';

interface ClienteOpt { id: string; nombre: string; cif: string | null; }
interface ComercializadoraOpt { id: string; nombre: string; }
interface ComercialOpt { user_id: string; nombre: string; apellidos: string | null; }

// ============ CONSTANTES ============
const ESTADOS_PUNTO: EstadoPunto[] = [
  'Nueva Oportunidad', 'Solicitar Doc.', 'Doc. OK', 'Estudio enviado',
  'Aceptado', 'Permanencia', 'Standby', 'Desiste'
];

const TARIFAS_LUZ: TipoTarifa[] = ['2.0TD', '3.0TD', '6.1TD'];
const TARIFAS_GAS: TipoTarifa[] = ['RL.1', 'RL.2', 'RL.3', 'RL.4', 'RL.5', 'RL.6', 'RL.7', 'RL.8', 'RL.9', 'RL.10', 'RL.11'];

const ESTADOS_FV: EstadoFV[] = ['activa', 'no', 'pendiente'];

// Determina cuántas potencias se muestran según la tarifa
function getPotenciasActivas(tarifa: TipoTarifa | null): number {
  if (!tarifa) return 0;
  if (tarifa === '2.0TD') return 2;
  if (tarifa === '3.0TD') return 3;
  return 6; // 6.1TD y todos los RL
}

// ============ SCHEMA DE VALIDACIÓN ============
const schema = z.object({
  // Fila 1: Comercializadora, Cliente, Estado
  current_comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }).nullable().optional().or(z.literal('')),
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  estado: z.enum(['Nueva Oportunidad', 'Solicitar Doc.', 'Doc. OK', 'Estudio enviado', 'Aceptado', 'Permanencia', 'Standby', 'Desiste'] as const),

  // Fila 2: Tipo factura, Tarifa
  tipo_factura: z.enum(['Luz', 'Gas'] as const, { invalid_type_error: 'Selecciona Luz o Gas' }),
  tarifa: z.string().min(1, 'Tarifa obligatoria'),

  // Fila 3: 6 Potencias (solo las activas son requeridas según tarifa)
  p1_kw: z.number().nullable().optional(),
  p2_kw: z.number().nullable().optional(),
  p3_kw: z.number().nullable().optional(),
  p4_kw: z.number().nullable().optional(),
  p5_kw: z.number().nullable().optional(),
  p6_kw: z.number().nullable().optional(),

  // Fila 4: CUPS, Consumo, FV, Compensación
  cups: z.string().min(5, 'CUPS obligatorio (mín. 5 caracteres)'),
  consumo_anual_kwh: z.number().nullable().optional(),
  tiene_fv: z.boolean().optional(),
  fv_compensacion: z.enum(['activa', 'no', 'pendiente'] as const).nullable().optional().or(z.literal('')),

  // Fila 5: Dirección Suministro
  direccion_sum: z.string().min(1, 'Dirección de suministro obligatoria'),
  localidad_sum: z.string().nullable().optional(),
  provincia_sum: z.string().nullable().optional(),

  // Fila 6: Dirección Fiscal
  direccion_fisc: z.string().nullable().optional(),
  localidad_fisc: z.string().nullable().optional(),
  provincia_fisc: z.string().nullable().optional(),

  // Fila 7: Dirección Postal
  direccion_post: z.string().nullable().optional(),
  localidad_post: z.string().nullable().optional(),
  provincia_post: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ============ FUNCIONES DE FETCH ============
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tipo', 'comercializadora')
    .order('nombre');
  if (error) throw error;
  return data || [];
}

async function fetchAllClientes(): Promise<ClienteOpt[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, cif')
    .is('eliminado_en', null)
    .order('nombre');
  if (error) throw error;
  return data || [];
}

async function fetchComerciales(): Promise<ComercialOpt[]> {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('user_id, nombre, apellidos')
    .eq('rol', 'comercial')
    .eq('activo', true)
    .is('eliminado_en', null)
    .order('nombre');
  if (error) throw error;
  return data || [];
}

async function fetchAsignaciones(puntoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('asignaciones_comercial_punto')
    .select('comercial_user_id')
    .eq('punto_id', puntoId);
  if (error) throw error;
  return data?.map(a => a.comercial_user_id) || [];
}

// ============ COMPONENTE PRINCIPAL ============
export default function PuntoForm({ id }: { id?: string }) {
  const editing = Boolean(id);
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  // Accent border color: green in dark mode, light gray in light mode (matches ClienteForm)
  const accentBorderColor = theme === 'dark' ? '#17553e' : 'rgba(0, 0, 0, 0.1)';

  // Estados locales
  const [selectedComerciales, setSelectedComerciales] = useState<string[]>([]);
  const [showComercialDropdown, setShowComercialDropdown] = useState(false);

  // Queries
  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
    queryKey: ['comercializadoras'],
    queryFn: fetchComercializadoras,
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['allClientesForPuntoForm'],
    queryFn: fetchAllClientes,
  });

  const { data: comerciales = [], isLoading: loadingComerciales } = useQuery({
    queryKey: ['comerciales'],
    queryFn: fetchComerciales,
  });

  // Formulario
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      estado: 'Nueva Oportunidad',
      tipo_factura: 'Luz',
      tiene_fv: false,
      fv_compensacion: '',
      tarifa: '',
      cups: '',
      direccion_sum: '',
      current_comercializadora_id: '',
      // Initialize other text fields to empty string if needed for controlled inputs
    },
  });

  // Observadores
  const watchedTipoFactura = watch('tipo_factura');
  const watchedTarifa = watch('tarifa');
  const watchedTieneFV = watch('tiene_fv');

  // Tarifas disponibles según tipo de factura
  const tarifasDisponibles = useMemo(() => {
    return watchedTipoFactura === 'Gas' ? TARIFAS_GAS : TARIFAS_LUZ;
  }, [watchedTipoFactura]);

  // Potencias activas según tarifa
  const potenciasActivas = useMemo(() => {
    return getPotenciasActivas(watchedTarifa as TipoTarifa);
  }, [watchedTarifa]);

  // Reset tarifa cuando cambia tipo factura
  useEffect(() => {
    const currentTarifa = watch('tarifa');
    if (watchedTipoFactura === 'Gas' && TARIFAS_LUZ.includes(currentTarifa as TipoTarifa)) {
      setValue('tarifa', '');
    } else if (watchedTipoFactura === 'Luz' && TARIFAS_GAS.includes(currentTarifa as TipoTarifa)) {
      setValue('tarifa', '');
    }
  }, [watchedTipoFactura, setValue, watch]);

  // Carga datos en modo edición
  useEffect(() => {
    if (!editing || !id) return;

    let alive = true;
    (async () => {
      try {
        // Cargar punto
        const { data, error } = await supabase
          .from('puntos_suministro')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!alive) return;
        if (error) throw error;

        if (data) {
          reset({
            current_comercializadora_id: data.current_comercializadora_id || null,
            cliente_id: data.cliente_id,
            estado: data.estado as EstadoPunto,
            tipo_factura: data.tipo_factura as TipoFactura,
            tarifa: data.tarifa || '',
            p1_kw: data.p1_kw ? Number(data.p1_kw) : null,
            p2_kw: data.p2_kw ? Number(data.p2_kw) : null,
            p3_kw: data.p3_kw ? Number(data.p3_kw) : null,
            p4_kw: data.p4_kw ? Number(data.p4_kw) : null,
            p5_kw: data.p5_kw ? Number(data.p5_kw) : null,
            p6_kw: data.p6_kw ? Number(data.p6_kw) : null,
            cups: data.cups,
            consumo_anual_kwh: data.consumo_anual_kwh ? Number(data.consumo_anual_kwh) : null,
            tiene_fv: data.tiene_fv || false,
            fv_compensacion: data.fv_compensacion as EstadoFV || null,
            direccion_sum: data.direccion_sum,
            localidad_sum: data.localidad_sum || null,
            provincia_sum: data.provincia_sum || null,
            direccion_fisc: data.direccion_fisc || null,
            localidad_fisc: data.localidad_fisc || null,
            provincia_fisc: data.provincia_fisc || null,
            direccion_post: data.direccion_post || null,
            localidad_post: data.localidad_post || null,
            provincia_post: data.provincia_post || null,
          });

          // Cargar asignaciones de comerciales
          const asignados = await fetchAsignaciones(id);
          setSelectedComerciales(asignados);
        }
      } catch (err: any) {
        toast.error(`Error al cargar: ${err.message}`);
      }
    })();

    return () => { alive = false; };
  }, [editing, id, reset]);

  // Gestión de comerciales asignados
  const handleToggleComercial = (userId: string) => {
    setSelectedComerciales(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRemoveComercial = (userId: string) => {
    setSelectedComerciales(prev => prev.filter(id => id !== userId));
  };

  // Submit
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      const payload = {
        cliente_id: values.cliente_id,
        current_comercializadora_id: values.current_comercializadora_id || null,
        estado: values.estado,
        tipo_factura: values.tipo_factura,
        tarifa: values.tarifa || null,
        p1_kw: values.p1_kw ?? null,
        p2_kw: values.p2_kw ?? null,
        p3_kw: values.p3_kw ?? null,
        p4_kw: values.p4_kw ?? null,
        p5_kw: values.p5_kw ?? null,
        p6_kw: values.p6_kw ?? null,
        cups: values.cups,
        consumo_anual_kwh: values.consumo_anual_kwh ?? null,
        tiene_fv: values.tiene_fv || false,
        fv_compensacion: values.tiene_fv ? (values.fv_compensacion || null) : null,
        direccion_sum: values.direccion_sum,
        localidad_sum: values.localidad_sum || null,
        provincia_sum: values.provincia_sum || null,
        direccion_fisc: values.direccion_fisc || null,
        localidad_fisc: values.localidad_fisc || null,
        provincia_fisc: values.provincia_fisc || null,
        direccion_post: values.direccion_post || null,
        localidad_post: values.localidad_post || null,
        provincia_post: values.provincia_post || null,
      };

      let puntoId = id;

      if (editing) {
        const { error } = await supabase
          .from('puntos_suministro')
          .update(payload)
          .eq('id', id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('puntos_suministro')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        puntoId = data.id;
      }

      // Sincronizar asignaciones de comerciales
      if (puntoId) {
        // Eliminar asignaciones existentes
        await supabase
          .from('asignaciones_comercial_punto')
          .delete()
          .eq('punto_id', puntoId);

        // Insertar nuevas asignaciones
        if (selectedComerciales.length > 0) {
          const nuevasAsignaciones = selectedComerciales.map(comercialId => ({
            punto_id: puntoId,
            comercial_user_id: comercialId,
          }));

          const { error: asigError } = await supabase
            .from('asignaciones_comercial_punto')
            .insert(nuevasAsignaciones);

          if (asigError) {
            console.error('Error al asignar comerciales:', asigError);
            toast.error('Punto guardado, pero hubo un error al asignar comerciales.');
          }
        }
      }

      toast.success(editing ? 'Punto actualizado correctamente' : 'Punto creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['puntos'] });
      router.history.back();
    } catch (error: any) {
      console.error('Error al guardar punto:', error);
      toast.error(`Error al guardar: ${error.message}`);
    }
  };

  // Debug de errores de validación
  const onInvalid = (errors: any) => {
    console.error("Errores de validación:", errors);
    const camposConError = Object.keys(errors).join(", ");
    toast.error(`Faltan campos por completar: ${camposConError}`);
  };

  const isLoading = loadingComercializadoras || loadingClientes || loadingComerciales;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MapPin className="text-fenix-600 dark:text-fenix-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">
            {editing ? 'Editar Punto de Suministro' : 'Nuevo Punto de Suministro'}
          </h2>
          <p className="text-secondary opacity-70 text-sm font-medium">
            {editing ? 'Modifica los datos del punto de suministro' : 'Registra un nuevo punto de suministro (CUPS)'}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="animate-spin text-fenix-500"><MapPin size={32} /></div>
          <p className="ml-3 text-secondary font-bold">Cargando datos...</p>
        </div>
      )}

      {!isLoading && (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">

          {/* ===== SECCIÓN 1: DATOS GENERALES ===== */}
          <div className="glass-card p-6 relative z-50">
            <h3
              className="text-lg font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2 mb-6 pb-3"
              style={{ borderBottom: `1px solid ${accentBorderColor}` }}
            >
              <Building size={20} />
              Datos Generales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Comercializadora */}
              <Controller
                name="current_comercializadora_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={comercializadoras.map(c => ({
                      value: c.id,
                      label: c.nombre,
                    }))}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Buscar comercializadora..."
                    label="Comercializadora Actual"
                    icon={<Building size={16} />}
                    allowEmpty={true}
                    emptyLabel="Sin comercializadora"
                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                    error={errors.current_comercializadora_id?.message}
                  />
                )}
              />

              {/* Cliente */}
              <Controller
                name="cliente_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={allClientes.map(c => ({
                      value: c.id,
                      label: c.nombre,
                      subtitle: c.cif || undefined,
                    }))}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Buscar cliente..."
                    label="Cliente *"
                    icon={<Users size={16} />}
                    error={errors.cliente_id?.message}
                    allowEmpty={false}
                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                  />
                )}
              />

              {/* Estado */}
              <div className="form-group">
                <label htmlFor="estado" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <FileText size={16} />
                  Estado *
                </label>
                <select
                  id="estado"
                  {...register('estado')}
                  className="glass-input appearance-none bg-no-repeat bg-right pr-10 cursor-pointer hover:border-fenix-400 focus:border-fenix-500 transition-colors"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233B82F6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")", backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '16px 16px' }}
                >
                  {ESTADOS_PUNTO.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                {errors.estado && <p className="form-error">{errors.estado.message}</p>}
              </div>
            </div>
          </div>

          {/* ===== SECCIÓN 2: DATOS ESPECÍFICOS ===== */}
          <div className="glass-card p-6 relative z-40">
            <h3
              className="text-lg font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2 mb-6 pb-3"
              style={{ borderBottom: `1px solid ${accentBorderColor}` }}
            >
              <Zap size={20} />
              Datos Específicos
            </h3>

            {/* Fila: Tipo Factura y Tarifa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="form-group">
                <label htmlFor="tipo_factura" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <Zap size={16} />
                  Tipo Factura *
                </label>
                <select
                  id="tipo_factura"
                  {...register('tipo_factura')}
                  className="glass-input appearance-none bg-no-repeat bg-right pr-10 cursor-pointer hover:border-fenix-400 focus:border-fenix-500 transition-colors"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233B82F6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")", backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '16px 16px' }}
                >
                  <option value="Luz">Luz</option>
                  <option value="Gas">Gas</option>
                </select>
                {errors.tipo_factura && <p className="form-error">{errors.tipo_factura.message}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="tarifa" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp size={16} />
                  Tarifa de Acceso *
                </label>
                <select
                  id="tarifa"
                  {...register('tarifa')}
                  className="glass-input appearance-none bg-no-repeat bg-right pr-10 cursor-pointer hover:border-fenix-400 focus:border-fenix-500 transition-colors"
                  style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2310B981\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg>')", backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '16px 16px' }}
                >
                  <option value="">Selecciona tarifa</option>
                  {tarifasDisponibles.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.tarifa && <p className="form-error">{errors.tarifa.message}</p>}
              </div>
            </div>

            {/* Potencias - visibles solo si NO es Gas */}
            {watchedTipoFactura !== 'Gas' && (
              <div className="mb-6">
                <label className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2 mb-3 block">
                  <Zap size={16} />
                  Potencias Contratadas (kW)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => {
                    // Para 2.0TD: solo P1 y P2 habilitados
                    // Para 3.0TD y 6.1TD: todos habilitados
                    const isDisabled = watchedTarifa === '2.0TD' && i > 2;

                    return (
                      <div key={`p${i}`} className="form-group">
                        <div className="relative">
                          <Zap size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDisabled ? 'text-secondary/30' : 'text-secondary/60'}`} />
                          <input
                            type="number"
                            step="0.001"
                            placeholder={`P${i}`}
                            disabled={isDisabled}
                            {...register(`p${i}_kw` as keyof FormValues, {
                              setValueAs: v => (v === '' || v === null ? null : Number(v))
                            })}
                            className={`glass-input pl-10 text-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fila: CUPS, Consumo, FV, Compensación */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="form-group md:col-span-2">
                <label htmlFor="direccion_sum" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <Barcode size={16} />
                  CUPS *
                </label>
                <input
                  type="text"
                  id="cups"
                  {...register('cups')}
                  placeholder="ES0000..."
                  className="glass-input font-mono"
                />
                {errors.cups && <p className="form-error">{errors.cups.message}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="consumo_anual_kwh" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp size={16} />
                  Consumo Anual (kWh)
                </label>
                <input
                  type="number"
                  step="1"
                  id="consumo_anual_kwh"
                  {...register('consumo_anual_kwh', {
                    setValueAs: v => (v === '' || v === null ? null : Number(v))
                  })}
                  className="glass-input"
                />
              </div>

              <div className="form-group">
                <label className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <Sun size={16} />
                  Fotovoltaica
                </label>
                <div className="flex items-center gap-4 h-[42px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="tiene_fv"
                      {...register('tiene_fv')}
                      className="w-5 h-5 rounded border-2 border-primary/40 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 cursor-pointer"
                    />
                    <Sun size={18} className={watchedTieneFV ? 'text-fenix-600 dark:text-fenix-400' : 'text-secondary opacity-40'} />
                    <span className="text-sm text-secondary font-medium">{watchedTieneFV ? 'Sí' : 'No'}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Compensación FV - siempre visible, bloqueada si no tiene FV */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="form-group">
                <label htmlFor="fv_compensacion" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <Sun size={16} />
                  Compensación FV
                </label>
                <select
                  id="fv_compensacion"
                  {...register('fv_compensacion')}
                  disabled={!watchedTieneFV}
                  className={`glass-input appearance-none bg-no-repeat bg-right pr-10 cursor-pointer hover:border-fenix-400 focus:border-fenix-500 transition-colors ${!watchedTieneFV ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2310B981\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg>')", backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '16px 16px' }}
                >
                  <option value="">Selecciona...</option>
                  {ESTADOS_FV.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ===== SECCIÓN 3: DIRECCIONES ===== */}
          <div className="glass-card p-6 relative z-30">
            <h3
              className="text-lg font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2 mb-6 pb-3"
              style={{ borderBottom: `1px solid ${accentBorderColor}` }}
            >
              <MapPin size={20} />
              Direcciones
            </h3>

            {/* Dirección de Suministro */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-secondary flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-fenix-500 rounded-full shadow-[0_0_8px_rgba(244,114,182,0.4)]"></span>
                Dirección de Suministro *
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group md:col-span-1">
                  <label htmlFor="cups" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Dirección
                  </label>
                  <input type="text" id="direccion_sum" {...register('direccion_sum')} className="glass-input" />
                  {errors.direccion_sum && <p className="form-error">{errors.direccion_sum.message}</p>}
                </div>
                <div className="form-group">
                  <label htmlFor="localidad_sum" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Localidad
                  </label>
                  <input type="text" id="localidad_sum" {...register('localidad_sum')} className="glass-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="provincia_sum" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Provincia
                  </label>
                  <input type="text" id="provincia_sum" {...register('provincia_sum')} className="glass-input" />
                </div>
              </div>
            </div>

            {/* Dirección Fiscal */}
            <div className="mb-6">
              <h4 className="text-sm font-bold text-secondary opacity-60 flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-primary/20 rounded-full"></span>
                Dirección Fiscal (opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group md:col-span-1">
                  <label htmlFor="direccion_fisc" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Dirección
                  </label>
                  <input type="text" id="direccion_fisc" {...register('direccion_fisc')} className="glass-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="localidad_fisc" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Localidad
                  </label>
                  <input type="text" id="localidad_fisc" {...register('localidad_fisc')} className="glass-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="provincia_fisc" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Provincia
                  </label>
                  <input type="text" id="provincia_fisc" {...register('provincia_fisc')} className="glass-input" />
                </div>
              </div>
            </div>

            {/* Dirección Postal */}
            <div className="mb-6 opacity-60">
              <h4 className="text-sm font-bold text-secondary flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-primary/40 rounded-full"></span>
                Dirección Postal (opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group md:col-span-1">
                  <label htmlFor="direccion_post" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Dirección
                  </label>
                  <input type="text" id="direccion_post" {...register('direccion_post')} className="glass-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="localidad_post" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Localidad
                  </label>
                  <input type="text" id="localidad_post" {...register('localidad_post')} className="glass-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="provincia_post" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={16} />
                    Provincia
                  </label>
                  <input type="text" id="provincia_post" {...register('provincia_post')} className="glass-input" />
                </div>
              </div>
            </div>
          </div>

          {/* ===== SECCIÓN 4: COMERCIALES ===== */}
          <div className="glass-card p-6 relative z-20">
            <h3
              className="text-lg font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider flex items-center gap-2 mb-6 pb-3"
              style={{ borderBottom: `1px solid ${accentBorderColor}` }}
            >
              <Users size={20} />
              Comerciales Asignados
            </h3>

            {/* Tags de comerciales seleccionados */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedComerciales.length === 0 && (
                <span className="text-sm text-secondary opacity-40 italic">Sin comerciales asignados</span>
              )}
              {selectedComerciales.map(userId => {
                const comercial = comerciales.find(c => c.user_id === userId);
                if (!comercial) return null;
                return (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-fenix-500/15 border border-fenix-500/30 text-fenix-600 dark:text-fourth rounded-full text-sm font-bold"
                  >
                    {comercial.nombre} {comercial.apellidos}
                    <button
                      type="button"
                      onClick={() => handleRemoveComercial(userId)}
                      className="hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Dropdown para añadir comerciales */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 bg-bg-intermediate hover:bg-bg-intermediate/80 border border-primary/20 rounded-lg text-primary text-sm font-bold transition-colors cursor-pointer"
                onClick={() => setShowComercialDropdown(!showComercialDropdown)}
              >
                <Plus size={16} /> Añadir comercial <ChevronDown size={14} className={`transition-transform ${showComercialDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showComercialDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 glass-modal py-2 shadow-2xl z-50 max-h-60 overflow-y-auto">
                  {comerciales
                    .filter(c => !selectedComerciales.includes(c.user_id))
                    .map(c => (
                      <button
                        key={c.user_id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm text-secondary hover:bg-bg-intermediate hover:text-primary font-medium transition-colors cursor-pointer"
                        onClick={() => {
                          handleToggleComercial(c.user_id);
                          setShowComercialDropdown(false);
                        }}
                      >
                        {c.nombre} {c.apellidos}
                      </button>
                    ))}
                  {comerciales.filter(c => !selectedComerciales.includes(c.user_id)).length === 0 && (
                    <div className="px-4 py-2 text-secondary opacity-40 text-sm italic">
                      No hay más comerciales disponibles
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ===== BOTONES DE ACCIÓN ===== */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <button
              type="button"
              className="btn-secondary cursor-pointer"
              onClick={() => router.history.back()}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear punto')}
            </button>
          </div>

        </form>
      )}
    </div>
  );
}

