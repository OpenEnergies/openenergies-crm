import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';

// === Schema del formulario ===
// Fechas en string (YYYY-MM-DD). El checkbox produce boolean.
// Si "aviso_renovacion" está activo, "fecha_aviso" es obligatoria.
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

// Importante: usa el **input** del schema para cuadrar con zodResolver
type FormValues = z.input<typeof schema>;

type PuntoOpt = { id: string; cups: string; direccion: string };
type EmpresaOpt = { id: string; nombre: string };

export default function ContratoForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [puntos, setPuntos] = useState<PuntoOpt[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      aviso_renovacion: false,
      estado: 'activo',
    },
  });

  const aviso = watch('aviso_renovacion');

  // Carga opciones de selects
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pRes, eRes] = await Promise.all([
        supabase.from('puntos_suministro').select('id,cups,direccion').order('cups', { ascending: true }),
        supabase.from('empresas').select('id,nombre').order('nombre', { ascending: true }),
      ]);
      if (!alive) return;
      if (!pRes.error && pRes.data) setPuntos(pRes.data as PuntoOpt[]);
      if (!eRes.error && eRes.data) setEmpresas(eRes.data as EmpresaOpt[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Carga contrato si edita
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    setLoading(true);
    setServerError(null);
    (async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select('id,punto_id,comercializadora_id,oferta,fecha_inicio,fecha_fin,aviso_renovacion,fecha_aviso,estado')
        .eq('id', id!)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        setServerError(error.message);
      } else if (data) {
        reset({
          punto_id: data.punto_id,
          comercializadora_id: data.comercializadora_id,
          oferta: data.oferta ?? null,
          fecha_inicio: data.fecha_inicio ?? '',
          fecha_fin: data.fecha_fin ?? null,
          aviso_renovacion: Boolean(data.aviso_renovacion),
          fecha_aviso: data.fecha_aviso ?? null,
          estado: (data.estado as string) ?? 'activo',
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [editing, id, reset]);

  // Evita el error 2345 usando una función tipada por inferencia
  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    // Normaliza opcionales a null si vienen vacíos
    const payload = {
      ...values,
      oferta: values.oferta?.toString().trim() || null,
      fecha_fin: values.fecha_fin?.toString().trim() || null,
      fecha_aviso: values.aviso_renovacion ? (values.fecha_aviso?.toString().trim() || null) : null,
    };

    if (editing) {
      const { error } = await supabase.from('contratos').update(payload).eq('id', id!);
      if (error) {
        setServerError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('contratos').insert(payload);
      if (error) {
        setServerError(error.message);
        return;
      }
    }

    navigate({ to: '/app/contratos' });
  };

  const puntoLabel = useMemo(
    () => (p: PuntoOpt) => `${p.cups} — ${p.direccion}`,
    []
  );

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">
        {editing ? 'Editar contrato' : 'Nuevo contrato'}
      </h1>

      {serverError && (
        <div role="alert" className="mb-4 rounded-lg p-3 bg-red-50 text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={isSubmitting || loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Punto de suministro</span>
            <select {...register('punto_id')} className="input">
              <option value="">— Selecciona —</option>
              {puntos.map((p) => (
                <option key={p.id} value={p.id}>
                  {puntoLabel(p)}
                </option>
              ))}
            </select>
            {errors.punto_id && <span className="text-sm text-red-700">{errors.punto_id.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Comercializadora</span>
            <select {...register('comercializadora_id')} className="input">
              <option value="">— Selecciona —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            {errors.comercializadora_id && <span className="text-sm text-red-700">{errors.comercializadora_id.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Fecha inicio</span>
            <input type="date" className="input" {...register('fecha_inicio')} />
            {errors.fecha_inicio && <span className="text-sm text-red-700">{errors.fecha_inicio.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Fecha fin (opcional)</span>
            <input type="date" className="input" {...register('fecha_fin')} />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm text-slate-700">Oferta (opcional)</span>
            <input type="text" className="input" placeholder="Nombre o referencia de la oferta" {...register('oferta')} />
          </label>

          <label className="inline-flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              {...register('aviso_renovacion')}
              onChange={(e) => setValue('aviso_renovacion', e.target.checked)}
            />
            <span>Aviso de renovación</span>
          </label>

          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-sm text-slate-700">Fecha aviso</span>
            <input type="date" className="input" disabled={!aviso} {...register('fecha_aviso')} />
            {errors.fecha_aviso && <span className="text-sm text-red-700">{errors.fecha_aviso.message}</span>}
          </label>

          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-sm text-slate-700">Estado</span>
            <input type="text" className="input" placeholder="activo" {...register('estado')} />
            {errors.estado && <span className="text-sm text-red-700">{errors.estado.message}</span>}
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || loading}
          >
            {editing ? 'Guardar cambios' : 'Crear contrato'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate({ to: '/app/contratos' })}
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
