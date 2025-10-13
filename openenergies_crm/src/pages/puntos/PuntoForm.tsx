// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { User, HardHat, MapPin, Barcode, Tags, Zap, TrendingUp } from 'lucide-react';

const schema = z.object({
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  titular: z.string().min(1, 'Titular obligatorio'),
  direccion: z.string().min(1, 'Dirección obligatoria'),
  cups: z.string().min(5, 'CUPS obligatorio'),
  tarifa_acceso: z.string().min(1, 'Tarifa obligatoria'),
  // Importante: SIN preprocess -> evita "unknown"
  potencia_contratada_kw: z.number().nullable().optional(),
  consumo_anual_kwh: z.number().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;
type ClienteOpt = { id: string; nombre: string; cif: string | null };

export default function PuntoForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Opciones de clientes
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id,nombre,cif')
        .order('nombre', { ascending: true });
      if (!alive) return;
      if (!error && data) setClientes(data as ClienteOpt[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Carga punto si edita
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    setLoading(true);
    setServerError(null);
    (async () => {
      const { data, error } = await supabase
        .from('puntos_suministro')
        .select(
          'id,cliente_id,titular,direccion,cups,tarifa_acceso,potencia_contratada_kw,consumo_anual_kwh'
        )
        .eq('id', id!)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setServerError(error.message);
      } else if (data) {
        reset({
          cliente_id: data.cliente_id,
          titular: data.titular ?? '',
          direccion: data.direccion ?? '',
          cups: data.cups ?? '',
          tarifa_acceso: data.tarifa_acceso ?? '',
          potencia_contratada_kw:
            data.potencia_contratada_kw === null || data.potencia_contratada_kw === undefined
              ? null
              : Number(data.potencia_contratada_kw),
          consumo_anual_kwh:
            data.consumo_anual_kwh === null || data.consumo_anual_kwh === undefined
              ? null
              : Number(data.consumo_anual_kwh),
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [editing, id, reset]);

  // Tipamos el submit con el mismo FormValues del useForm
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setServerError(null);

    // Normaliza undefined -> null para columnas opcionales
    const payload: FormValues = {
      ...values,
      potencia_contratada_kw:
        values.potencia_contratada_kw === undefined ? null : values.potencia_contratada_kw,
      consumo_anual_kwh:
        values.consumo_anual_kwh === undefined ? null : values.consumo_anual_kwh,
    };

    if (editing) {
      const { error } = await supabase
        .from('puntos_suministro')
        .update(payload)
        .eq('id', id!);
      if (error) {
        setServerError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('puntos_suministro').insert(payload);
      if (error) {
        setServerError(error.message);
        return;
      }
    }

    navigate({ to: '/app/puntos' });
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
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}
          
          <div className="form-row">
            <div>
              <label htmlFor="cliente_id">Cliente</label>
              <div className="input-icon-wrapper">
                <HardHat size={18} className="input-icon" />
                <select id="cliente_id" {...register('cliente_id')}>
                  <option value=""> Selecciona </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.cif ? `(${c.cif})` : ''}</option>
                  ))}
                </select>
              </div>
              {errors.cliente_id && <p className="error-text">{errors.cliente_id.message}</p>}
            </div>
            <div>
              <label htmlFor="titular">Titular</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input type="text" id="titular" {...register('titular')} />
              </div>
              {errors.titular && <p className="error-text">{errors.titular.message}</p>}
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
              {errors.tarifa_acceso && <p className="error-text">{errors.tarifa_acceso.message}</p>}
            </div>
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="potencia_contratada_kw">Potencia contratada (kW)</label>
              <div className="input-icon-wrapper">
                <Zap size={18} className="input-icon" />
                <input type="number" id="potencia_contratada_kw" step="0.01" {...register('potencia_contratada_kw', { setValueAs: v => (v === '' ? null : Number(v)) })} />
              </div>
            </div>
            <div>
              <label htmlFor="consumo_anual_kwh">Consumo anual (kWh)</label>
              <div className="input-icon-wrapper">
                <TrendingUp size={18} className="input-icon" />
                <input type="number" id="consumo_anual_kwh" step="1" {...register('consumo_anual_kwh', { setValueAs: v => (v === '' ? null : Number(v)) })} />
              </div>
            </div>
          </div>
        
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem' }}>
            <button type="submit" className="btn-primary" disabled={isSubmitting || loading}>
            {editing ? 'Guardar cambios' : 'Crear punto'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate({ to: '/app/puntos' })}
          >
            Cancelar
          </button>
          </div>

          
        </div>
      </form>
    </div>
  );
}
