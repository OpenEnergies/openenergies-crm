// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState } from 'react';
import { router } from '@router/routes';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { HardHat, MapPin, Barcode, Tags, Zap, TrendingUp, FileText, Building, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import type { Cliente, Empresa, TipoFactura } from '@lib/types';

const schema = z.object({
  comercializadora_id: z.string().uuid({ message: 'Comercializadora debe ser válida' }).optional().nullable().or(z.literal('')),
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  direccion: z.string().min(1, 'Dirección obligatoria'),
  cups: z.string().min(5, 'CUPS obligatorio'),
  tarifa_acceso: z.string().optional().nullable(),
  potencia_contratada_kw: z.number().nullable().optional(),
  consumo_anual_kwh: z.number().nullable().optional(),
  localidad: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  tipo_factura: z.enum(['Luz', 'Gas'], { invalid_type_error: 'Debes seleccionar Luz o Gas' }).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif'>;
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;

async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'comercializadora')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

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

export default function PuntoForm({ id }: { id?: string }) {
  const editing = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const [clienteInput, setClienteInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(clienteInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [clienteInput]);

  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
      queryKey: ['comercializadoras'],
      queryFn: fetchComercializadoras,
  });

  const { data: clientesFound = [], isLoading: loadingClientes } = useQuery({
      queryKey: ['searchClientes', debouncedQuery],
      queryFn: () => searchClientes(debouncedQuery),
      enabled: debouncedQuery.length >= 2,
      staleTime: 60000,
  });

  useEffect(() => {
    if (!editing || !id) return;
    if (comercializadoras.length === 0) return;

    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('puntos_suministro')
        .select('*, clientes(id, nombre, cif)')
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        toast.error(`Error al cargar datos: ${error.message}`);
      } else if (data) {
        const cli = data.clientes as unknown as ClienteOpt;
        if (cli) {
            setClienteInput(`${cli.nombre}${cli.cif ? ` (${cli.cif})` : ''}`);
        }

        reset({
          comercializadora_id: data.current_comercializadora_id ?? '',
          cliente_id: data.cliente_id,
          direccion: data.direccion ?? '',
          cups: data.cups ?? '',
          tarifa_acceso: data.tarifa_acceso ?? '',
          potencia_contratada_kw: data.potencia_contratada_kw === null ? null : Number(data.potencia_contratada_kw),
          consumo_anual_kwh: data.consumo_anual_kwh === null ? null : Number(data.consumo_anual_kwh),
          localidad: data.localidad ?? null,
          provincia: data.provincia ?? null,
          tipo_factura: (data.tipo_factura as TipoFactura) ?? null,
        });
      }
    })();
    return () => { alive = false; };
  }, [editing, id, reset, comercializadoras]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!values.cliente_id) {
      setError('cliente_id', { type: 'validate', message: 'Selecciona un cliente de la lista' });
      return;
    }
    
    // Filtramos el payload. Si estamos editando, NO enviamos current_comercializadora_id
    // para evitar sobrescribir la lógica de contratos por error.
    const payload: any = {
      cliente_id: values.cliente_id,
      direccion: values.direccion,
      cups: values.cups,
      tarifa_acceso: values.tarifa_acceso || null,
      potencia_contratada_kw: values.potencia_contratada_kw ?? null,
      consumo_anual_kwh: values.consumo_anual_kwh ?? null,
      localidad: values.localidad ?? null,
      provincia: values.provincia ?? null,
      tipo_factura: values.tipo_factura ?? null,
    };

    // Solo permitimos asignar comercializadora manualmente al CREAR
    if (!editing) {
        payload.current_comercializadora_id = values.comercializadora_id || null;
    }

    try {
        if (editing) {
          const { error } = await supabase.from('puntos_suministro').update(payload).eq('id', id!);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('puntos_suministro').insert(payload);
          if (error) throw error;
        }
        toast.success(editing ? 'Punto actualizado' : 'Punto creado');
        router.history.back();
    } catch (error: any) {
        console.error("Error al guardar punto:", error);
        toast.error(`Error al guardar: ${error.message}`);
    }
  };

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>
          {editing ? 'Editar Punto de Suministro' : 'Nuevo Punto de Suministro'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>

          <div className="form-row"> 
            
            {/* 1. Comercializadora (BLOQUEADA EN EDICIÓN) */}
            <div>
              <label htmlFor="comercializadora_id">
                Comercializadora {editing && <span style={{fontSize:'0.75em', fontWeight:400, color:'var(--muted)'}}>(Gestionada por contrato)</span>}
              </label>
              <div className="input-icon-wrapper">
                <Building size={18} className="input-icon" />
                <select 
                  id="comercializadora_id" 
                  {...register('comercializadora_id')} 
                  // Deshabilitado si estamos cargando O si estamos editando
                  disabled={loadingComercializadoras || editing}
                  style={editing ? { backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed', color: 'var(--muted)' } : {}}
                >
                  <option value="">{loadingComercializadoras ? 'Cargando...' : 'Selecciona comercializadora'}</option>
                  {comercializadoras.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              {/* Mensaje informativo en modo edición */}
              {editing && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--secondary)', backgroundColor: '#EFF6FF', padding: '0.5rem', borderRadius: '4px' }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Para cambiar la comercializadora, crea o actualiza un contrato.</span>
                </div>
              )}
              {errors.comercializadora_id && <p className="error-text">{errors.comercializadora_id.message}</p>}
            </div>

            {/* 2. Cliente */}
            <div>
              <label htmlFor="cliente_input">Cliente</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <HardHat size={18} className="input-icon" />
                <input
                  id="cliente_input"
                  type="text"
                  autoComplete="off"
                  value={clienteInput}
                  placeholder="Escribe para buscar cliente..."
                  onChange={(e) => {
                    setClienteInput(e.target.value);
                    setValue('cliente_id', '', { shouldDirty: true }); 
                    setClienteOpen(e.target.value.length >= 2);
                  }}
                  onFocus={() => { if (clienteInput.length >= 2) setClienteOpen(true); }}
                  onBlur={() => setTimeout(() => setClienteOpen(false), 200)}
                  style={{ paddingRight: '2rem' }}
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
          </div>

          <div>
            <label htmlFor="direccion">Dirección</label>
            <div className="input-icon-wrapper">
                <MapPin size={18} className="input-icon" />
                <input type="text" id="direccion" {...register('direccion')} />
            </div>
            {errors.direccion && <p className="error-text">{errors.direccion.message}</p>}
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="localidad">Localidad</label>
              <div className="input-icon-wrapper">
                <MapPin size={18} className="input-icon" />
                <input type="text" id="localidad" {...register('localidad')} />
              </div>
            </div>
            <div>
              <label htmlFor="provincia">Provincia</label>
              <div className="input-icon-wrapper">
                <MapPin size={18} className="input-icon" />
                <input type="text" id="provincia" {...register('provincia')} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="tipo_factura">Tipo Factura</label>
            <div className="input-icon-wrapper">
              <FileText size={18} className="input-icon" />
              <select id="tipo_factura" {...register('tipo_factura')}>
                <option value="">Selecciona (Luz/Gas)</option>
                <option value="Luz">Luz</option>
                <option value="Gas">Gas</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="cups">CUPS</label>
              <div className="input-icon-wrapper">
                <Barcode size={18} className="input-icon" />
                <input type="text" id="cups" {...register('cups')} />
              </div>
              {errors.cups && <p className="error-text">{errors.cups.message}</p>}
            </div>
            <div>
              <label htmlFor="tarifa_acceso">Tarifa de acceso</label>
              <div className="input-icon-wrapper">
                <Tags size={18} className="input-icon" />
                <input type="text" id="tarifa_acceso" {...register('tarifa_acceso')} />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="potencia_contratada_kw">Potencia contratada (kW)</label>
              <div className="input-icon-wrapper">
                <Zap size={18} className="input-icon" />
                <input type="number" id="potencia_contratada_kw" step="0.01" {...register('potencia_contratada_kw', { setValueAs: v => (v === '' || v === null ? null : Number(v)) })} />
              </div>
            </div>
            <div>
              <label htmlFor="consumo_anual_kwh">Consumo anual (kWh)</label>
              <div className="input-icon-wrapper">
                <TrendingUp size={18} className="input-icon" />
                <input type="number" id="consumo_anual_kwh" step="1" {...register('consumo_anual_kwh', { setValueAs: v => (v === '' || v === null ? null : Number(v)) })} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => router.history.back()}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || loadingComercializadoras}>
               {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear punto')}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}