// src/pages/facturas/FacturaForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import {
    Receipt, Building2, Calendar, Users, Save, ArrowLeft,
    Zap, MapPin, Calculator, FileText, Flame, MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@hooks/ThemeContext';
import SearchableSelect from '@components/SearchableSelect';

// ============ TYPES ============
interface ComercializadoraOpt { id: string; nombre: string; }
interface ClienteOpt { id: string; nombre: string; }
interface PuntoOpt {
    id: string;
    cups: string;
    direccion_sum: string;
    provincia_sum: string | null;
    cliente_id: string;
    current_comercializadora_id: string | null;
    tipo_factura: 'Luz' | 'Gas' | null;
    tarifa: string | null;
    // Joined relations
    clientes: { id: string; nombre: string } | null;
    comercializadora: { id: string; nombre: string } | null;
}

// ============ CONSTANTS ============
const TIPOS_FACTURA = ['Luz', 'Gas'] as const;

// Tariffs categorized by energy type
const TARIFAS_LUZ = ['2.0TD', '3.0TD', '6.1TD'] as const;
const TARIFAS_GAS = ['RL.1', 'RL.2', 'RL.3', 'RL.4', 'RL.5', 'RL.6', 'RL.7', 'RL.8', 'RL.9', 'RL.10', 'RL.11'] as const;
const ALL_TARIFAS = [...TARIFAS_LUZ, ...TARIFAS_GAS];

const IMPUESTOS_PRINCIPALES = [
    { value: '', label: 'Sin impuesto' },
    { value: '21', label: '21%' },
    { value: '7', label: '7%' },
];
const IMPUESTOS_SECUNDARIOS = [
    { value: '', label: 'Sin impuesto' },
    { value: '3', label: '3%' },
];

// ============ VALIDATION SCHEMA ============
const schema = z.object({
    // Core relationships
    comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }),
    cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
    punto_id: z.string().uuid({ message: 'CUPS obligatorio' }),

    // Invoice details
    numero_factura: z.string().min(1, 'Número de factura obligatorio'),
    fecha_emision: z.string().min(1, 'Fecha de emisión obligatoria'),
    tipo_factura: z.enum(['Luz', 'Gas']).nullable().optional(),
    tarifa: z.string().nullable().optional(),

    // Supply data
    direccion_suministro: z.string().nullable().optional(),
    provincia: z.string().nullable().optional(),
    potencia_kw_min: z.number().nullable().optional(),
    potencia_kw_max: z.number().nullable().optional(),
    consumo_kwh: z.number().nullable().optional(),
    precio_eur_kwh: z.number().nullable().optional(),

    // Primary tax
    base_impuesto_principal: z.number().nullable().optional(),
    tipo_impuesto_principal_pct: z.number().nullable().optional(),
    importe_impuesto_principal: z.number().nullable().optional(),

    // Secondary tax
    base_impuesto_secundario: z.number().nullable().optional(),
    tipo_impuesto_secundario_pct: z.number().nullable().optional(),
    importe_impuesto_secundario: z.number().nullable().optional(),

    // Total
    total: z.number().min(0, 'Total debe ser mayor o igual a 0'),

    // Notes
    observaciones: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ============ FETCH FUNCTIONS ============
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

async function fetchAllClientes(): Promise<ClienteOpt[]> {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre')
        .is('eliminado_en', null)
        .order('nombre')
        .range(0, 99999);
    if (error) throw error;
    return data || [];
}

async function fetchAllPuntos(): Promise<PuntoOpt[]> {
    const { data, error } = await supabase
        .from('puntos_suministro')
        .select(`
            id, 
            cups, 
            direccion_sum, 
            provincia_sum, 
            cliente_id,
            current_comercializadora_id,
            tipo_factura,
            tarifa,
            clientes (id, nombre),
            comercializadora:empresas!current_comercializadora_id (id, nombre)
        `)
        .is('eliminado_en', null)
        .order('cups')
        .range(0, 99999);
    if (error) throw error;
    return (data || []) as unknown as PuntoOpt[];
}

// ============ MAIN COMPONENT ============
export default function FacturaForm({ id }: { id?: string }) {
    const editing = Boolean(id);
    const queryClient = useQueryClient();

    // Local state for filtering and manual override tracking
    const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
    const [manualTax1, setManualTax1] = useState(false);
    const [manualTax2, setManualTax2] = useState(false);
    const [manualTotal, setManualTotal] = useState(false);
    const { theme } = useTheme();

    // Accent border color: green in dark mode, light gray in light mode (matches ClienteForm)
    const accentBorderColor = theme === 'dark' ? '#17553e' : 'rgba(0, 0, 0, 0.1)';

    // Queries
    const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
        queryKey: ['comercializadoras'],
        queryFn: fetchComercializadoras,
    });

    const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
        queryKey: ['allClientesForFacturaForm'],
        queryFn: fetchAllClientes,
    });

    const { data: allPuntos = [], isLoading: loadingPuntos } = useQuery({
        queryKey: ['allPuntosForFacturaForm'],
        queryFn: fetchAllPuntos,
    });

    // Form
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
            tipo_factura: null,
            total: 0,
        },
    });

    // Watchers for calculations
    const watchedBasePrincipal = watch('base_impuesto_principal');
    const watchedTipoPrincipal = watch('tipo_impuesto_principal_pct');
    const watchedImportePrincipal = watch('importe_impuesto_principal');
    const watchedBaseSecundario = watch('base_impuesto_secundario');
    const watchedTipoSecundario = watch('tipo_impuesto_secundario_pct');
    const watchedImporteSecundario = watch('importe_impuesto_secundario');
    const watchedPuntoId = watch('punto_id');

    // Watch tipo_factura for conditional tariff filtering
    const watchedTipoFactura = watch('tipo_factura');

    // Filter puntos by selected client
    const filteredPuntos = useMemo(() => {
        if (!selectedClienteId) return allPuntos;
        return allPuntos.filter(p => p.cliente_id === selectedClienteId);
    }, [allPuntos, selectedClienteId]);

    // Get filtered tariff options based on tipo_factura
    const tarifaOptions = useMemo(() => {
        if (watchedTipoFactura === 'Luz') {
            return TARIFAS_LUZ.map(t => ({ value: t, label: t }));
        } else if (watchedTipoFactura === 'Gas') {
            return TARIFAS_GAS.map(t => ({ value: t, label: t }));
        }
        // Show all if no tipo selected
        return ALL_TARIFAS.map(t => ({ value: t, label: t }));
    }, [watchedTipoFactura]);

    // CUPS-driven auto-population: Fill Comercializadora, Cliente, address, tipo_factura, tarifa
    useEffect(() => {
        if (!watchedPuntoId) return;

        const punto = allPuntos.find(p => p.id === watchedPuntoId);
        if (!punto) return;

        // Always fill address data
        setValue('direccion_suministro', punto.direccion_sum || null);
        setValue('provincia', punto.provincia_sum || null);

        // Auto-fill Cliente if not already set
        const currentClienteId = watch('cliente_id');
        if (!currentClienteId && punto.cliente_id) {
            setValue('cliente_id', punto.cliente_id);
            setSelectedClienteId(punto.cliente_id);
        }

        // Auto-fill Comercializadora if not already set
        const currentComercializadoraId = watch('comercializadora_id');
        if (!currentComercializadoraId && punto.current_comercializadora_id) {
            setValue('comercializadora_id', punto.current_comercializadora_id);
        }

        // Auto-fill Tipo Factura if not already set
        const currentTipoFactura = watch('tipo_factura');
        if (!currentTipoFactura && punto.tipo_factura) {
            // Map DB value (lowercase) to form value (capitalized)
            const mappedTipo = punto.tipo_factura === 'Luz' || punto.tipo_factura === 'Gas'
                ? punto.tipo_factura
                : null;
            if (mappedTipo) {
                setValue('tipo_factura', mappedTipo);
            }
        }

        // Auto-fill Tarifa if not already set
        const currentTarifa = watch('tarifa');
        if (!currentTarifa && punto.tarifa) {
            setValue('tarifa', punto.tarifa);
        }
    }, [watchedPuntoId, allPuntos, setValue, watch]);

    // Clear tarifa if it's not valid for the current tipo_factura
    useEffect(() => {
        const currentTarifa = watch('tarifa');
        if (!currentTarifa || !watchedTipoFactura) return;

        // Check if current tarifa is valid for the selected tipo
        const isValidForLuz = TARIFAS_LUZ.includes(currentTarifa as typeof TARIFAS_LUZ[number]);
        const isValidForGas = TARIFAS_GAS.includes(currentTarifa as typeof TARIFAS_GAS[number]);

        if (watchedTipoFactura === 'Luz' && !isValidForLuz) {
            setValue('tarifa', null);
        } else if (watchedTipoFactura === 'Gas' && !isValidForGas) {
            setValue('tarifa', null);
        }
    }, [watchedTipoFactura, watch, setValue]);

    // Auto-calculate primary tax (if not manually overridden)
    useEffect(() => {
        if (manualTax1) return;
        if (watchedBasePrincipal && watchedTipoPrincipal) {
            const importe = (watchedBasePrincipal * watchedTipoPrincipal) / 100;
            setValue('importe_impuesto_principal', Math.round(importe * 100) / 100);
        } else if (!watchedBasePrincipal || !watchedTipoPrincipal) {
            setValue('importe_impuesto_principal', null);
        }
    }, [watchedBasePrincipal, watchedTipoPrincipal, manualTax1, setValue]);

    // Auto-calculate secondary tax (if not manually overridden)
    useEffect(() => {
        if (manualTax2) return;
        if (watchedBaseSecundario && watchedTipoSecundario) {
            const importe = (watchedBaseSecundario * watchedTipoSecundario) / 100;
            setValue('importe_impuesto_secundario', Math.round(importe * 100) / 100);
        } else if (!watchedBaseSecundario || !watchedTipoSecundario) {
            setValue('importe_impuesto_secundario', null);
        }
    }, [watchedBaseSecundario, watchedTipoSecundario, manualTax2, setValue]);

    // Auto-calculate total (if not manually overridden)
    useEffect(() => {
        if (manualTotal) return;
        const base1 = watchedBasePrincipal || 0;
        const tax1 = watchedImportePrincipal || 0;
        const base2 = watchedBaseSecundario || 0;
        const tax2 = watchedImporteSecundario || 0;
        const total = base1 + tax1 + base2 + tax2;
        setValue('total', Math.round(total * 100) / 100);
    }, [watchedBasePrincipal, watchedImportePrincipal, watchedBaseSecundario, watchedImporteSecundario, manualTotal, setValue]);

    // Load data in edit mode
    useEffect(() => {
        if (!editing || !id) return;

        let alive = true;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('facturacion_clientes')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (!alive) return;
                if (error) throw error;

                if (data) {
                    reset({
                        comercializadora_id: data.comercializadora_id,
                        cliente_id: data.cliente_id,
                        punto_id: data.punto_id,
                        numero_factura: data.numero_factura,
                        fecha_emision: data.fecha_emision,
                        tipo_factura: data.tipo_factura as 'Luz' | 'Gas' | null,
                        tarifa: data.tarifa,
                        direccion_suministro: data.direccion_suministro,
                        provincia: data.provincia,
                        potencia_kw_min: data.potencia_kw_min,
                        potencia_kw_max: data.potencia_kw_max,
                        consumo_kwh: data.consumo_kwh,
                        precio_eur_kwh: data.precio_eur_kwh,
                        base_impuesto_principal: data.base_impuesto_principal,
                        tipo_impuesto_principal_pct: data.tipo_impuesto_principal_pct,
                        importe_impuesto_principal: data.importe_impuesto_principal,
                        base_impuesto_secundario: data.base_impuesto_secundario,
                        tipo_impuesto_secundario_pct: data.tipo_impuesto_secundario_pct,
                        importe_impuesto_secundario: data.importe_impuesto_secundario,
                        total: data.total,
                        observaciones: data.observaciones,
                    });
                    setSelectedClienteId(data.cliente_id);
                    // Mark calculations as manual since they come from DB
                    setManualTax1(true);
                    setManualTax2(true);
                    setManualTotal(true);
                }
            } catch (err: any) {
                toast.error(`Error al cargar: ${err.message}`);
            }
        })();

        return () => { alive = false; };
    }, [editing, id, reset]);

    // Submit handler
    const onSubmit: SubmitHandler<FormValues> = async (values) => {
        try {
            const payload = {
                punto_id: values.punto_id,
                cliente_id: values.cliente_id,
                comercializadora_id: values.comercializadora_id,
                numero_factura: values.numero_factura,
                fecha_emision: values.fecha_emision,
                tipo_factura: values.tipo_factura || null,
                tarifa: values.tarifa || null,
                direccion_suministro: values.direccion_suministro || null,
                provincia: values.provincia || null,
                potencia_kw_min: values.potencia_kw_min ?? null,
                potencia_kw_max: values.potencia_kw_max ?? null,
                consumo_kwh: values.consumo_kwh ?? null,
                precio_eur_kwh: values.precio_eur_kwh ?? null,
                base_impuesto_principal: values.base_impuesto_principal ?? null,
                tipo_impuesto_principal_pct: values.tipo_impuesto_principal_pct ?? null,
                importe_impuesto_principal: values.importe_impuesto_principal ?? null,
                base_impuesto_secundario: values.base_impuesto_secundario ?? null,
                tipo_impuesto_secundario_pct: values.tipo_impuesto_secundario_pct ?? null,
                importe_impuesto_secundario: values.importe_impuesto_secundario ?? null,
                total: values.total,
                observaciones: values.observaciones || null,
            };

            if (editing) {
                const { error } = await supabase
                    .from('facturacion_clientes')
                    .update(payload)
                    .eq('id', id!);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('facturacion_clientes')
                    .insert(payload);
                if (error) throw error;
            }

            toast.success(editing ? 'Factura actualizada correctamente' : 'Factura creada correctamente');
            queryClient.invalidateQueries({ queryKey: ['facturas-global'] });
            queryClient.invalidateQueries({ queryKey: ['cliente-facturas'] });
            router.history.back();
        } catch (error: any) {
            console.error('Error al guardar factura:', error);
            toast.error(`Error al guardar: ${error.message}`);
        }
    };

    const isLoading = loadingComercializadoras || loadingClientes || loadingPuntos;

    // Helper for number inputs - handles string, number, null, undefined
    const parseNumber = (value: unknown): number | null => {
        if (value === null || value === undefined || value === '') return null;
        // If it's already a number, return it
        if (typeof value === 'number') return isNaN(value) ? null : value;
        // Convert to string and parse
        const stringValue = String(value).replace(',', '.');
        const parsed = parseFloat(stringValue);
        return isNaN(parsed) ? null : parsed;
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.history.back()}
                    className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500 flex items-center gap-2">
                    <Receipt size={24} className="text-fenix-600 dark:text-fenix-400" />
                    {editing ? 'Editar Factura' : 'Nueva Factura'}
                </h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                {/* ===== SECTION 1: GENERAL INFO (z-50) ===== */}
                <div className="glass-card p-6 sm:p-8 space-y-6 relative z-50">
                    <div
                        className="flex items-center gap-2 pb-3"
                        style={{ borderBottom: `1px solid ${accentBorderColor}` }}
                    >
                        <FileText size={18} className="text-fenix-600 dark:text-fenix-400" />
                        <h3 className="font-bold text-fenix-600 dark:text-fenix-400 text-lg uppercase tracking-wider">Datos Generales</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Comercializadora */}
                        <Controller
                            name="comercializadora_id"
                            control={control}
                            render={({ field }) => (
                                <SearchableSelect
                                    label="Comercializadora *"
                                    icon={<Building2 size={16} />}
                                    options={comercializadoras.map(c => ({ value: c.id, label: c.nombre }))}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.comercializadora_id?.message}
                                    disabled={loadingComercializadoras}
                                    placeholder="Buscar comercializadora..."
                                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                                    allowEmpty={false}
                                />
                            )}
                        />

                        {/* Cliente */}
                        <Controller
                            name="cliente_id"
                            control={control}
                            render={({ field }) => (
                                <SearchableSelect
                                    label="Cliente *"
                                    icon={<Users size={16} />}
                                    options={allClientes.map(c => ({ value: c.id, label: c.nombre }))}
                                    value={field.value || ''}
                                    onChange={(val: string) => {
                                        field.onChange(val);
                                        setSelectedClienteId(val || null);
                                        // Reset punto when client changes
                                        if (val !== selectedClienteId) {
                                            setValue('punto_id', '');
                                        }
                                    }}
                                    error={errors.cliente_id?.message}
                                    disabled={loadingClientes}
                                    placeholder="Buscar cliente..."
                                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                                    allowEmpty={false}
                                />
                            )}
                        />

                        {/* CUPS/Punto */}
                        <Controller
                            name="punto_id"
                            control={control}
                            render={({ field }) => (
                                <SearchableSelect
                                    label="CUPS *"
                                    icon={<Zap size={16} />}
                                    options={filteredPuntos.map(p => ({
                                        value: p.id,
                                        label: p.cups,
                                        subtitle: p.direccion_sum
                                    }))}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.punto_id?.message}
                                    disabled={loadingPuntos}
                                    placeholder={selectedClienteId ? "Selecciona CUPS..." : "Selecciona cliente primero"}
                                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                                    allowEmpty={false}
                                />
                            )}
                        />
                    </div>
                </div>

                {/* ===== SECTION 2: INVOICE DETAILS (z-40) ===== */}
                <div className="glass-card p-6 sm:p-8 space-y-6 relative z-40">
                    <div
                        className="flex items-center gap-2 pb-3"
                        style={{ borderBottom: `1px solid ${accentBorderColor}` }}
                    >
                        <Receipt size={18} className="text-fenix-600 dark:text-fenix-400" />
                        <h3 className="font-bold text-fenix-600 dark:text-fenix-400 text-lg uppercase tracking-wider">Datos de la Factura</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Número de factura */}
                        <div className="space-y-2">
                            <label htmlFor="fecha_emision" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <FileText size={16} />
                                Nº Factura *
                            </label>
                            <input
                                type="text"
                                id="numero_factura"
                                placeholder="FAC-001234"
                                {...register('numero_factura')}
                                className="glass-input w-full"
                            />
                            {errors.numero_factura && <p className="text-sm text-red-500">{errors.numero_factura.message}</p>}
                        </div>

                        {/* Fecha de emisión */}
                        <div className="space-y-2">
                            <label htmlFor="fecha_emision" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <Calendar size={16} />
                                Fecha Emisión *
                            </label>
                            <input
                                type="date"
                                id="fecha_emision"
                                {...register('fecha_emision')}
                                className="glass-input w-full cursor-pointer"
                                onClick={(e) => { try { e.currentTarget.showPicker(); } catch { } }}
                            />
                            {errors.fecha_emision && <p className="text-sm text-red-500">{errors.fecha_emision.message}</p>}
                        </div>

                        {/* Tipo factura */}
                        <div className="space-y-2">
                            <label htmlFor="tipo_factura" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                {watch('tipo_factura') === 'Gas' ? <Flame size={16} /> : <Zap size={16} />}
                                Tipo
                            </label>
                            <select
                                id="tipo_factura"
                                {...register('tipo_factura')}
                                className="glass-input w-full cursor-pointer"
                            >
                                <option value="">Selecciona tipo</option>
                                {TIPOS_FACTURA.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tarifa - Conditional based on tipo_factura */}
                        <Controller
                            name="tarifa"
                            control={control}
                            render={({ field }) => (
                                <SearchableSelect
                                    label="Tarifa"
                                    icon={<FileText size={16} />}
                                    options={tarifaOptions}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    placeholder={
                                        watchedTipoFactura
                                            ? `Tarifas ${watchedTipoFactura}...`
                                            : "Selecciona tipo primero..."
                                    }
                                    labelClassName="text-sm font-bold text-primary uppercase tracking-tight"
                                    allowEmpty
                                    emptyLabel="Sin tarifa"
                                />
                            )}
                        />
                    </div>
                </div>

                {/* ===== SECTION 3: SUPPLY DATA (z-30) ===== */}
                <div className="glass-card p-6 sm:p-8 space-y-6 relative z-30">
                    <div
                        className="flex items-center gap-2 pb-3"
                        style={{ borderBottom: `1px solid ${accentBorderColor}` }}
                    >
                        <MapPin size={18} className="text-fenix-600 dark:text-fenix-400" />
                        <h3 className="font-bold text-fenix-600 dark:text-fenix-400 text-lg uppercase tracking-wider">Datos de Suministro</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Dirección */}
                        <div className="space-y-2">
                            <label htmlFor="provincia" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <MapPin size={16} />
                                Dirección
                            </label>
                            <input
                                type="text"
                                id="direccion_suministro"
                                placeholder="Calle, número, localidad..."
                                {...register('direccion_suministro')}
                                className="glass-input w-full"
                            />
                        </div>

                        {/* Provincia */}
                        <div className="space-y-2">
                            <label htmlFor="provincia" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <MapPin size={16} />
                                Provincia
                            </label>
                            <input
                                type="text"
                                id="provincia"
                                placeholder="Madrid, Barcelona..."
                                {...register('provincia')}
                                className="glass-input w-full"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Potencia min */}
                        <div className="space-y-2">
                            <label htmlFor="potencia_kw_max" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <Zap size={16} />
                                Pot. Mín (kW)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                id="potencia_kw_min"
                                placeholder="0.00"
                                {...register('potencia_kw_min', { setValueAs: parseNumber })}
                                className="glass-input w-full"
                            />
                        </div>

                        {/* Potencia max */}
                        <div className="space-y-2">
                            <label htmlFor="potencia_kw_max" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <Zap size={16} />
                                Pot. Máx (kW)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                id="potencia_kw_max"
                                placeholder="0.00"
                                {...register('potencia_kw_max', { setValueAs: parseNumber })}
                                className="glass-input w-full"
                            />
                        </div>

                        {/* Consumo */}
                        <div className="space-y-2">
                            <label htmlFor="precio_eur_kwh" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <Zap size={16} />
                                Consumo (kWh)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                id="consumo_kwh"
                                placeholder="0.00"
                                {...register('consumo_kwh', { setValueAs: parseNumber })}
                                className="glass-input w-full"
                            />
                        </div>

                        {/* Precio €/kWh */}
                        <div className="space-y-2">
                            <label htmlFor="precio_eur_kwh" className="text-sm font-bold text-primary uppercase tracking-tight flex items-center gap-2">
                                <Calculator size={16} />
                                Precio (€/kWh)
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                id="precio_eur_kwh"
                                placeholder="0.0000"
                                {...register('precio_eur_kwh', { setValueAs: parseNumber })}
                                className="glass-input w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* ===== SECTION 4: TAXES & TOTALS (z-20) ===== */}
                <div className="glass-card p-6 sm:p-8 space-y-6 relative z-20">
                    <div
                        className="flex items-center gap-2 pb-3"
                        style={{ borderBottom: `1px solid ${accentBorderColor}` }}
                    >
                        <Calculator size={18} className="text-fenix-600 dark:text-fenix-400" />
                        <h3 className="font-bold text-fenix-600 dark:text-fenix-400 text-lg uppercase tracking-wider">Impuestos y Total</h3>
                    </div>

                    {/* Primary Tax */}
                    <div className="p-5 rounded-2xl border border-primary/20 bg-bg-intermediate/30 space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Calculator size={16} className="text-fenix-600 dark:text-fenix-400" />
                            <span className="font-bold text-primary uppercase tracking-tight">Impuesto Principal (IVA)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Base imponible principal */}
                            <div className="space-y-2">
                                <label htmlFor="base_impuesto_principal" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Base Imponible (€)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    id="base_impuesto_principal"
                                    placeholder="0.00"
                                    {...register('base_impuesto_principal', {
                                        setValueAs: parseNumber,
                                        onChange: () => setManualTax1(false)
                                    })}
                                    className="glass-input w-full"
                                />
                            </div>

                            {/* Tipo % principal */}
                            <div className="space-y-2">
                                <label htmlFor="tipo_impuesto_principal_pct" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Tipo (%)
                                </label>
                                <select
                                    id="tipo_impuesto_principal_pct"
                                    {...register('tipo_impuesto_principal_pct', {
                                        setValueAs: (v) => v === '' ? null : parseFloat(v),
                                        onChange: () => setManualTax1(false)
                                    })}
                                    className="glass-input w-full cursor-pointer"
                                >
                                    {IMPUESTOS_PRINCIPALES.map(i => (
                                        <option key={i.value} value={i.value}>{i.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Importe impuesto principal */}
                            <div className="space-y-2">
                                <label htmlFor="importe_impuesto_principal" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Importe (€) <span className="text-xs text-secondary opacity-40 font-medium">(auto-calculado)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    id="importe_impuesto_principal"
                                    placeholder="0.00"
                                    {...register('importe_impuesto_principal', {
                                        setValueAs: parseNumber,
                                        onChange: () => setManualTax1(true)
                                    })}
                                    className="glass-input w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Tax */}
                    <div className="p-5 rounded-2xl border border-primary/20 bg-bg-intermediate/30 space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Calculator size={16} className="text-fenix-600 dark:text-fenix-400" />
                            <span className="font-bold text-primary uppercase tracking-tight">Impuesto Secundario (IE)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Base imponible secundario */}
                            <div className="space-y-2">
                                <label htmlFor="base_impuesto_secundario" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Base Imponible (€)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    id="base_impuesto_secundario"
                                    placeholder="0.00"
                                    {...register('base_impuesto_secundario', {
                                        setValueAs: parseNumber,
                                        onChange: () => setManualTax2(false)
                                    })}
                                    className="glass-input w-full"
                                />
                            </div>

                            {/* Tipo % secundario */}
                            <div className="space-y-2">
                                <label htmlFor="tipo_impuesto_secundario_pct" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Tipo (%)
                                </label>
                                <select
                                    id="tipo_impuesto_secundario_pct"
                                    {...register('tipo_impuesto_secundario_pct', {
                                        setValueAs: (v) => v === '' ? null : parseFloat(v),
                                        onChange: () => setManualTax2(false)
                                    })}
                                    className="glass-input w-full cursor-pointer"
                                >
                                    {IMPUESTOS_SECUNDARIOS.map(i => (
                                        <option key={i.value} value={i.value}>{i.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Importe impuesto secundario */}
                            <div className="space-y-2">
                                <label htmlFor="importe_impuesto_secundario" className="text-sm font-bold text-secondary uppercase tracking-tight">
                                    Importe (€) <span className="text-xs text-secondary opacity-40 font-medium">(auto-calculado)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    id="importe_impuesto_secundario"
                                    placeholder="0.00"
                                    {...register('importe_impuesto_secundario', {
                                        setValueAs: parseNumber,
                                        onChange: () => setManualTax2(true)
                                    })}
                                    className="glass-input w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="p-6 rounded-2xl border-2 border-fenix-500/30 bg-fenix-500/5 shadow-[0_0_20px_rgba(244,114,182,0.1)]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-fenix-500/20">
                                    <Calculator size={20} className="text-fenix-600 dark:text-fenix-400" />
                                </div>
                                <div>
                                    <span className="font-bold text-primary text-xl uppercase tracking-wider">TOTAL</span>
                                    <p className="text-xs text-secondary opacity-50 font-medium">Auto-calculado: Base1 + IVA1 + Base2 + IVA2</p>
                                </div>
                            </div>
                            <div className="w-full sm:w-48">
                                <input
                                    type="number"
                                    step="0.01"
                                    id="total"
                                    placeholder="0.00"
                                    {...register('total', {
                                        valueAsNumber: true,
                                        onChange: () => setManualTotal(true)
                                    })}
                                    className="glass-input w-full text-2xl font-bold text-fenix-600 dark:text-fourth text-right"
                                />
                                {errors.total && <p className="text-sm text-red-500 mt-1 text-right font-medium">{errors.total.message}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== SECTION 5: NOTES (z-10) ===== */}
                <div className="glass-card p-6 sm:p-8 space-y-6 relative z-10">
                    <div
                        className="flex items-center gap-2 pb-3"
                        style={{ borderBottom: `1px solid ${accentBorderColor}` }}
                    >
                        <MessageSquare size={18} className="text-fenix-600 dark:text-fenix-400" />
                        <h3 className="font-bold text-fenix-600 dark:text-fenix-400 text-lg uppercase tracking-wider">Observaciones</h3>
                    </div>

                    <div className="space-y-2">
                        <textarea
                            id="observaciones"
                            placeholder="Notas adicionales sobre la factura..."
                            rows={4}
                            {...register('observaciones')}
                            className="glass-input w-full resize-none min-h-[120px]"
                        />
                    </div>
                </div>

                {/* ===== BUTTONS ===== */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-primary/20">
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
                        className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <Save size={18} />
                        {isSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear Factura')}
                    </button>
                </div>
            </form>
        </div>
    );
}
