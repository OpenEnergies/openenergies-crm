// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';

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
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">
        {editing ? 'Editar punto de suministro' : 'Nuevo punto de suministro'}
      </h1>

      {serverError && (
        <div role="alert" className="mb-4 rounded-lg p-3 bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={isSubmitting || loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Cliente</span>
            <select className="input" {...register('cliente_id')}>
              <option value="">— Selecciona —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.cif ? `(${c.cif})` : ''}
                </option>
              ))}
            </select>
            {errors.cliente_id && <span className="text-sm text-red-700">{errors.cliente_id.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Titular</span>
            <input type="text" className="input" {...register('titular')} />
            {errors.titular && <span className="text-sm text-red-700">{errors.titular.message}</span>}
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm text-slate-700">Dirección</span>
            <input type="text" className="input" {...register('direccion')} />
            {errors.direccion && <span className="text-sm text-red-700">{errors.direccion.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">CUPS</span>
            <input type="text" className="input" {...register('cups')} />
            {errors.cups && <span className="text-sm text-red-700">{errors.cups.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Tarifa de acceso</span>
            <input type="text" className="input" {...register('tarifa_acceso')} />
            {errors.tarifa_acceso && (
              <span className="text-sm text-red-700">{errors.tarifa_acceso.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Potencia contratada (kW)</span>
            <input
              type="number"
              step="0.01"
              className="input"
              {...register('potencia_contratada_kw', {
                setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
              })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Consumo anual (kWh)</span>
            <input
              type="number"
              step="1"
              className="input"
              {...register('consumo_anual_kwh', {
                setValueAs: (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
              })}
            />
          </label>
        </div>

        <div className="flex gap-3 pt-2">
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
      </form>
    </main>
  );
}

/* --- estilos utilitarios (si no los tienes en tu CSS global) ---
.input { @apply w-full rounded-lg border border-slate-300 px-3 py-2 bg-white; }
.btn-primary { @apply inline-flex items-center rounded-lg bg-[#2BB673] hover:bg-[#1F9E61] text-white px-4 py-2; }
.btn-secondary { @apply inline-flex items-center rounded-lg bg-[#2E87E5] hover:bg-[#1F6EC2] text-white px-4 py-2; }
-------------------------------------------------------------------*/
