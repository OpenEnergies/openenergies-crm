// src/pages/contratos/ContratoForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import {
  Plug, Building2, Calendar, CreditCard, Activity, Sun,
  DollarSign, Users, Lock, Save, ArrowLeft, Bell, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SearchableSelect from '../../components/SearchableSelect';
import { useTheme } from '@hooks/ThemeContext';

// ============ TIPOS ============
type EstadoContrato = 'Aceptado' | 'En curso' | 'Bloqueado' | 'Pendiente Doc.' | 'Pendiente firma' | 'Firmado' | 'Contratado' | 'Pendiente renovacion' | 'Baja' | 'Standby' | 'Desiste';
type EstadoFotovoltaica = 'Pendiente de instalar' | 'Activa' | 'Pendiente de activar' | 'Duda' | 'No';

interface ComercializadoraOpt { id: string; nombre: string; }
interface CanalOpt { id: string; nombre: string; }
interface ClienteOpt { id: string; nombre: string; cif: string | null; numero_cuenta: string | null; }
interface PuntoOpt { id: string; cups: string; direccion_sum: string; cliente_id: string; current_comercializadora_id: string | null; }

// ============ CONSTANTES ============
const ESTADOS_CONTRATO: EstadoContrato[] = [
  'Aceptado', 'En curso', 'Bloqueado', 'Pendiente Doc.', 'Pendiente firma',
  'Firmado', 'Contratado', 'Pendiente renovacion', 'Baja', 'Standby', 'Desiste'
];

const ESTADOS_FOTOVOLTAICA: EstadoFotovoltaica[] = [
  'Pendiente de instalar', 'Activa', 'Pendiente de activar', 'Duda', 'No'
];

// ============ SCHEMA DE VALIDACIÓN ============
const schema = z.object({
  // Fila 1: Comercializadora, Canal
  comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }),
  canal_id: z.string().uuid().nullable().optional(),

  // Fila 2: Cliente (filtro), Punto
  punto_id: z.string().uuid({ message: 'Punto obligatorio' }),

  // Fila 3: Estado, Número de cuenta (IBAN)
  estado: z.enum(['Aceptado', 'En curso', 'Bloqueado', 'Pendiente Doc.', 'Pendiente firma', 'Firmado', 'Contratado', 'Pendiente renovacion', 'Baja', 'Standby', 'Desiste'] as const),
  numero_cuenta: z.string().nullable().optional(),

  // Fila 4: Fotovoltaica, Cobrado
  fotovoltaica: z.enum(['Pendiente de instalar', 'Activa', 'Pendiente de activar', 'Duda', 'No'] as const).nullable().optional(),
  cobrado: z.boolean().optional(),

  // Fila 5: Fechas principales
  fecha_activacion: z.string().nullable().optional(),
  fecha_aceptacion: z.string().nullable().optional(),
  fecha_firma: z.string().nullable().optional(),

  // Fila 6: Fechas secundarias + Permanencia
  fecha_baja: z.string().nullable().optional(),
  fecha_renovacion: z.string().nullable().optional(),
  permanencia: z.boolean().optional(),
  fecha_permanencia: z.string().nullable().optional(),

  // Aviso renovación
  aviso_renovacion: z.boolean().optional(),
  fecha_aviso: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ============ FUNCIONES DE FETCH ============
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('id, nombre')
    .eq('tipo', 'comercializadora')
    .order('nombre')
    .range(0, 99999);
  if (error) throw error;
  return data || [];
}

async function fetchCanales(): Promise<CanalOpt[]> {
  const { data, error } = await supabase
    .from('canales')
    .select('id, nombre')
    .order('nombre')
    .range(0, 99999);
  if (error) throw error;
  return data || [];
}

async function fetchAllClientes(): Promise<ClienteOpt[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, cif, numero_cuenta')
    .is('eliminado_en', null)
    .order('nombre')
    .range(0, 99999);
  if (error) throw error;
  return data || [];
}

async function fetchAllPuntos(): Promise<PuntoOpt[]> {
  const { data, error } = await supabase
    .from('puntos_suministro')
    .select('id, cups, direccion_sum, cliente_id, current_comercializadora_id')
    .is('eliminado_en', null)
    .order('cups')
    .range(0, 99999);
  if (error) throw error;
  return data || [];
}

// ============ COMPONENTE PRINCIPAL ============
export default function ContratoForm({ id }: { id?: string }) {
  const editing = Boolean(id);
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  // Accent border color: green in dark mode, light gray in light mode (matches ClienteForm)
  const accentBorderColor = theme === 'dark' ? '#17553e' : 'rgba(0, 0, 0, 0.1)';

  // Estados locales para filtros cascada
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  // Queries
  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
    queryKey: ['comercializadoras'],
    queryFn: fetchComercializadoras,
  });

  const { data: canales = [], isLoading: loadingCanales } = useQuery({
    queryKey: ['canales'],
    queryFn: fetchCanales,
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['allClientesForContratoForm'],
    queryFn: fetchAllClientes,
  });

  const { data: allPuntos = [], isLoading: loadingPuntos } = useQuery({
    queryKey: ['allPuntosForContratoForm'],
    queryFn: fetchAllPuntos,
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
      estado: 'En curso',
      cobrado: false,
      permanencia: false,
      aviso_renovacion: false,
      fotovoltaica: 'No',
    },
  });

  // Observadores
  const watchedPermanencia = watch('permanencia');
  const watchedAvisoRenovacion = watch('aviso_renovacion');
  const watchedPuntoId = watch('punto_id');

  // Puntos filtrados por cliente seleccionado
  const filteredPuntos = useMemo(() => {
    if (!selectedClienteId) return allPuntos;
    return allPuntos.filter(p => p.cliente_id === selectedClienteId);
  }, [allPuntos, selectedClienteId]);

  // Autocompletar cliente y comercializadora cuando se selecciona un punto
  useEffect(() => {
    if (watchedPuntoId) {
      const punto = allPuntos.find(p => p.id === watchedPuntoId);
      if (punto) {
        // Autocompletar cliente
        if (!selectedClienteId) {
          setSelectedClienteId(punto.cliente_id);
        }
        // Autocompletar comercializadora si no está seleccionada
        const currentComercializadora = watch('comercializadora_id');
        if (!currentComercializadora && punto.current_comercializadora_id) {
          setValue('comercializadora_id', punto.current_comercializadora_id);
        }
      }
    }
  }, [watchedPuntoId, allPuntos, selectedClienteId, setValue, watch]);

  // Carga datos en modo edición
  useEffect(() => {
    if (!editing || !id) return;

    let alive = true;
    (async () => {
      try {
        // Cargar contrato
        const { data, error } = await supabase
          .from('contratos')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!alive) return;
        if (error) throw error;

        if (data) {
          // Leer IBAN desde vault
          let ibanValue = null;
          try {
            const { data: ibanData } = await supabase.rpc('leer_iban_vault', { p_contrato_id: id });
            ibanValue = ibanData;
          } catch (e) {
            console.warn('No se pudo leer IBAN del vault:', e);
          }

          reset({
            comercializadora_id: data.comercializadora_id,
            canal_id: data.canal_id || null,
            punto_id: data.punto_id,
            estado: data.estado as EstadoContrato,
            numero_cuenta: ibanValue || data.numero_cuenta || null,
            fotovoltaica: data.fotovoltaica as EstadoFotovoltaica || 'No',
            cobrado: data.cobrado || false,
            fecha_activacion: data.fecha_activacion || null,
            fecha_aceptacion: data.fecha_aceptacion || null,
            fecha_firma: data.fecha_firma || null,
            fecha_baja: data.fecha_baja || null,
            fecha_renovacion: data.fecha_renovacion || null,
            permanencia: data.permanencia || false,
            fecha_permanencia: data.fecha_permanencia || null,
            aviso_renovacion: data.aviso_renovacion || false,
            fecha_aviso: data.fecha_aviso || null,
          });

          // Cargar cliente del punto
          const punto = allPuntos.find(p => p.id === data.punto_id);
          if (punto) {
            setSelectedClienteId(punto.cliente_id);
          }
        }
      } catch (err: any) {
        toast.error(`Error al cargar: ${err.message}`);
      }
    })();

    return () => { alive = false; };
  }, [editing, id, reset, allPuntos]);

  // Submit
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      const payload = {
        punto_id: values.punto_id,
        comercializadora_id: values.comercializadora_id,
        canal_id: values.canal_id || null,
        estado: values.estado,
        numero_cuenta: null as string | null, // No guardamos IBAN en texto plano
        fotovoltaica: values.fotovoltaica || null,
        cobrado: values.cobrado || false,
        fecha_activacion: values.fecha_activacion || null,
        fecha_aceptacion: values.fecha_aceptacion || null,
        fecha_firma: values.fecha_firma || null,
        fecha_baja: values.fecha_baja || null,
        fecha_renovacion: values.fecha_renovacion || null,
        permanencia: values.permanencia || false,
        fecha_permanencia: values.permanencia ? (values.fecha_permanencia || null) : null,
        aviso_renovacion: values.aviso_renovacion || false,
        fecha_aviso: values.aviso_renovacion ? (values.fecha_aviso || null) : null,
      };

      let contratoId = id;

      if (editing) {
        const { error } = await supabase
          .from('contratos')
          .update(payload)
          .eq('id', id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contratos')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        contratoId = data.id;
      }

      // Guardar IBAN en vault si se proporcionó
      if (contratoId && values.numero_cuenta?.trim()) {
        try {
          await supabase.rpc('guardar_iban_vault', {
            p_contrato_id: contratoId,
            p_iban: values.numero_cuenta.trim(),
          });
        } catch (vaultError: any) {
          console.error('Error guardando IBAN en vault:', vaultError);
          toast.error('Contrato guardado, pero hubo un error al guardar el IBAN de forma segura.');
        }
      }

      toast.success(editing ? 'Contrato actualizado correctamente' : 'Contrato creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      router.history.back();
    } catch (error: any) {
      console.error('Error al guardar contrato:', error);
      toast.error(`Error al guardar: ${error.message}`);
    }
  };

  const isLoading = loadingComercializadoras || loadingCanales || loadingClientes || loadingPuntos;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.history.back()}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500 flex items-center gap-2">
          <FileText size={24} className="text-fenix-600 dark:text-fenix-400" />
          {editing ? 'Editar Contrato' : 'Nuevo Contrato'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* ===== SECCIÓN 1: DATOS GENERALES (z-50) ===== */}
        <div className="glass-card p-6 sm:p-8 space-y-6 relative z-50">
          <div
            className="flex items-center gap-2 pb-2"
            style={{ borderBottom: `1px solid ${accentBorderColor}` }}
          >
            <FileText size={18} className="text-fenix-600 dark:text-fenix-400" />
            <h3 className="font-semibold text-fenix-600 dark:text-fenix-400 text-lg">Datos Generales</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Comercializadora */}
            <Controller
              name="comercializadora_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Comercializadora *"
                  icon={<Building2 size={16} />}
                  options={comercializadoras.map(c => ({ value: c.id, label: c.nombre }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.comercializadora_id?.message}
                  disabled={loadingComercializadoras}
                  placeholder="Buscar comercializadora..."
                  labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                />
              )}
            />

            {/* Canal */}
            <div className="space-y-2">
              <label htmlFor="canal_id" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Users size={16} />
                Canal
              </label>
              <select
                id="canal_id"
                {...register('canal_id')}
                disabled={loadingCanales}
                className="glass-input w-full cursor-pointer"
              >
                <option value="">{loadingCanales ? 'Cargando...' : 'Selecciona canal'}</option>
                {canales.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cliente Filter */}
            <SearchableSelect
              label="Cliente (filtro)"
              icon={<Users size={16} />}
              options={allClientes.map(c => ({
                value: c.id,
                label: c.nombre,
                subtitle: c.cif || undefined
              }))}
              value={selectedClienteId || ''}
              onChange={(val: string) => {
                setSelectedClienteId(val || null);
                setValue('punto_id', '');
                // Autocompletar IBAN del cliente si existe y el campo está vacío
                if (val) {
                  const cliente = allClientes.find(c => c.id === val);
                  const currentIban = watch('numero_cuenta');
                  if (cliente?.numero_cuenta && !currentIban) {
                    setValue('numero_cuenta', cliente.numero_cuenta);
                  }
                }
              }}
              disabled={loadingClientes}
              placeholder="Todos los clientes"
              allowEmpty={true}
              emptyLabel="Todos los clientes"
              labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
            />

            {/* Punto de Suministro */}
            <Controller
              name="punto_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Punto de Suministro *"
                  icon={<Plug size={16} />}
                  options={filteredPuntos.map(p => ({
                    value: p.id,
                    label: p.cups,
                    subtitle: p.direccion_sum
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.punto_id?.message}
                  disabled={loadingPuntos}
                  placeholder="Selecciona punto..."
                  labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                />
              )}
            />
          </div>
        </div>

        {/* ===== SECCIÓN 2: DATOS ESPECÍFICOS (z-40) ===== */}
        <div className="glass-card p-6 sm:p-8 space-y-6 relative z-40">
          <div
            className="flex items-center gap-2 pb-2"
            style={{ borderBottom: `1px solid ${accentBorderColor}` }}
          >
            <Activity size={18} className="text-fenix-600 dark:text-fenix-400" />
            <h3 className="font-semibold text-fenix-600 dark:text-fenix-400 text-lg">Datos Específicos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="estado" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Activity size={16} />
                Estado *
              </label>
              <select id="estado" {...register('estado')} className="glass-input w-full cursor-pointer">
                {ESTADOS_CONTRATO.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              {errors.estado && <p className="text-sm text-red-500">{errors.estado.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="numero_cuenta" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <CreditCard size={16} />
                Número de cuenta (IBAN)
              </label>
              <input
                type="text"
                id="numero_cuenta"
                placeholder="ES00 0000 0000 0000 0000 0000"
                {...register('numero_cuenta')}
                className="glass-input w-full font-mono"
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Lock size={10} /> Se almacena de forma segura en vault
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <label htmlFor="fotovoltaica" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Sun size={16} />
                Fotovoltaica
              </label>
              <select id="fotovoltaica" {...register('fotovoltaica')} className="glass-input w-full cursor-pointer">
                {ESTADOS_FOTOVOLTAICA.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div className="pt-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" {...register('cobrado')} />
                  <div className="h-6 w-11 rounded-full bg-bg-intermediate peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-fenix-500/50 peer-checked:bg-emerald-500 transition-colors" />
                  <div className="absolute top-[2px] left-[2px] bg-white h-5 w-5 rounded-full shadow-sm transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                  <DollarSign size={16} />
                  Cobrado
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* ===== SECCIÓN 3: FECHAS (z-30) ===== */}
        <div className="glass-card p-6 sm:p-8 space-y-6 relative z-30">
          <div
            className="flex items-center gap-2 pb-2"
            style={{ borderBottom: `1px solid ${accentBorderColor}` }}
          >
            <Calendar size={18} className="text-fenix-600 dark:text-fenix-400" />
            <h3 className="font-semibold text-fenix-600 dark:text-fenix-400 text-lg">Fechas</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor="fecha_activacion" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Calendar size={16} />
                Fecha de activación
              </label>
              <input type="date" id="fecha_activacion" {...register('fecha_activacion')} className="glass-input w-full cursor-pointer" onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }} />
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_aceptacion" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Calendar size={16} />
                Fecha de aceptación
              </label>
              <input type="date" id="fecha_aceptacion" {...register('fecha_aceptacion')} className="glass-input w-full cursor-pointer" onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }} />
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_firma" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Calendar size={16} />
                Fecha de firma
              </label>
              <input type="date" id="fecha_firma" {...register('fecha_firma')} className="glass-input w-full cursor-pointer" onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="fecha_baja" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Calendar size={16} />
                Fecha de baja
              </label>
              <input type="date" id="fecha_baja" {...register('fecha_baja')} className="glass-input w-full cursor-pointer" onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }} />
            </div>

            <div className="space-y-2">
              <label htmlFor="fecha_renovacion" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                <Calendar size={16} />
                Fecha de renovación
              </label>
              <input type="date" id="fecha_renovacion" {...register('fecha_renovacion')} className="glass-input w-full cursor-pointer" onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }} />
            </div>
          </div>
        </div>

        {/* ===== SECCIÓN 4: OTROS (z-20) ===== */}
        <div className="glass-card p-6 sm:p-8 space-y-6 relative z-20">
          <div
            className="flex items-center gap-2 pb-2"
            style={{ borderBottom: `1px solid ${accentBorderColor}` }}
          >
            <Bell size={18} className="text-fenix-600 dark:text-fenix-400" />
            <h3 className="font-semibold text-fenix-600 dark:text-fenix-400 text-lg">Otros</h3>
          </div>

          {/* Permanencia */}
          <div className="p-5 rounded-xl border border-bg-intermediate bg-bg-intermediate space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={16} className="text-emerald-500" />
              <span className="font-semibold text-emerald-400">Permanencia</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" {...register('permanencia')} />
                  <div className="h-6 w-11 rounded-full bg-bg-intermediate peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-fenix-500/50 peer-checked:bg-fenix-500 transition-colors" />
                  <div className="absolute top-[2px] left-[2px] bg-white h-5 w-5 rounded-full shadow-sm transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-primary uppercase tracking-tight">
                  Tiene permanencia
                </span>
              </label>

              <div className="space-y-2">
                <label htmlFor="fecha_permanencia" className={`text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2 ${!watchedPermanencia ? 'text-gray-500' : 'text-emerald-400'}`}>
                  <Calendar size={16} />
                  Fecha fin permanencia
                </label>
                <input
                  type="date"
                  id="fecha_permanencia"
                  {...register('fecha_permanencia')}
                  disabled={!watchedPermanencia}
                  className="glass-input w-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }}
                />
              </div>
            </div>
          </div>

          {/* Aviso Renovación */}
          <div className="p-5 rounded-xl border border-bg-intermediate bg-bg-intermediate space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={16} className="text-emerald-500" />
              <span className="font-semibold text-emerald-400">Aviso de Renovación</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" {...register('aviso_renovacion')} />
                  <div className="h-6 w-11 rounded-full bg-bg-intermediate peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-fenix-500/50 peer-checked:bg-fenix-500 transition-colors" />
                  <div className="absolute top-[2px] left-[2px] bg-white h-5 w-5 rounded-full shadow-sm transition-all peer-checked:translate-x-5" />
                </div>
                <span className="text-sm font-bold text-primary uppercase tracking-tight">
                  Activar aviso
                </span>
              </label>

              <div className="space-y-2">
                <label htmlFor="fecha_aviso" className={`text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2 ${!watchedAvisoRenovacion ? 'text-gray-500' : 'text-emerald-400'}`}>
                  <Calendar size={16} />
                  Fecha del aviso
                </label>
                <input
                  type="date"
                  id="fecha_aviso"
                  {...register('fecha_aviso')}
                  disabled={!watchedAvisoRenovacion}
                  className="glass-input w-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== BOTONES ===== */}
        <div className="flex items-center justify-end gap-4 pt-6">
          <button
            type="button"
            className="btn-secondary cursor-pointer"
            onClick={() => router.history.back()}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-fenix-500 hover:bg-fenix-400 text-white rounded-lg transition-colors shadow-lg shadow-fenix-500/20 disabled:opacity-50 disabled:cursor-not-allowed font-bold cursor-pointer"
          >
            <Save size={18} />
            {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear contrato')}
          </button>
        </div>

      </form>
    </div>
  );
}
