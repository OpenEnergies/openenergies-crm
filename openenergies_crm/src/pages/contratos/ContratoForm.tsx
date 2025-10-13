import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { Plug, Building2, Calendar, Tag, Activity, BellRing } from 'lucide-react';

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
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}

          <div className="form-row">
            <div>
              <label htmlFor="punto_id">Punto de suministro</label>
              <div className="input-icon-wrapper">
                <Plug size={18} className="input-icon" />
                <select id="punto_id" {...register('punto_id')}>
                  <option value=""> Selecciona </option>
                  {puntos.map((p) => <option key={p.id} value={p.id}>{puntoLabel(p)}</option>)}
                </select>
              </div>
              {errors.punto_id && <p className="error-text">{errors.punto_id.message}</p>}
            </div>
            <div>
              <label htmlFor="comercializadora_id">Comercializadora</label>
              <div className="input-icon-wrapper">
                <Building2 size={18} className="input-icon" />
                <select id="comercializadora_id" {...register('comercializadora_id')}>
                  <option value=""> Selecciona </option>
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {errors.comercializadora_id && <p className="error-text">{errors.comercializadora_id.message}</p>}
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
                    <input type="text" id="estado" placeholder="Ej: activo, finalizado, pendiente" {...register('estado')} />
                  </div>
                  {errors.estado && <p className="error-text">{errors.estado.message}</p>}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
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
        </div>
      </form>
    </div>
  );
}
