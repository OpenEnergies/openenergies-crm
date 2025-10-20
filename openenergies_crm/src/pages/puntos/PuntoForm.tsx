// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { User, HardHat, MapPin, Barcode, Tags, Zap, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';


const schema = z.object({
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  titular: z.string().min(1, 'Titular obligatorio'),
  direccion: z.string().min(1, 'Dirección obligatoria'),
  cups: z.string().min(5, 'CUPS obligatorio'),
  tarifa_acceso: z.string().min(1, 'Tarifa obligatoria'),
  // Importante: SIN preprocess -> evita "unknown"
  potencia_contratada_kw: z.number().nullable().optional(),
  consumo_anual_kwh: z.number().nullable().optional(),
  localidad: z.string().optional().nullable(),
   provincia: z.string().optional().nullable(),
   tipo_factura: z.enum(['Luz', 'Gas'], { invalid_type_error: 'Debes seleccionar Luz o Gas' }).optional().nullable(),
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
          'id,cliente_id,titular,direccion,cups,tarifa_acceso,potencia_contratada_kw,consumo_anual_kwh,localidad,provincia,tipo_factura'
        )
        .eq('id', id!)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        toast.error(`Error al cargar: ${error.message}`);
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
          localidad: data.localidad ?? null,
          provincia: data.provincia ?? null,
          tipo_factura: data.tipo_factura ?? null,
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
    const payload = {
      cliente_id: values.cliente_id,
      titular: values.titular,
      direccion: values.direccion,
      cups: values.cups,
      tarifa_acceso: values.tarifa_acceso,
      potencia_contratada_kw: values.potencia_contratada_kw === undefined ? null : values.potencia_contratada_kw,
      consumo_anual_kwh: values.consumo_anual_kwh === undefined ? null : values.consumo_anual_kwh,
     localidad: values.localidad === undefined ? null : values.localidad,
     provincia: values.provincia === undefined ? null : values.provincia,
     tipo_factura: values.tipo_factura === undefined ? null : values.tipo_factura,
    };

    try { // <-- Añadir try/catch
        if (editing) {
          const { error } = await supabase
            .from('puntos_suministro')
            .update(payload) // <-- payload ya incluye los nuevos campos
            .eq('id', id!);
          if (error) throw error; // Lanzamos error para el catch
        } else {
          const { error } = await supabase.from('puntos_suministro').insert(payload); // <-- payload ya incluye los nuevos campos
          if (error) throw error; // Lanzamos error para el catch
        }
        toast.success(editing ? 'Punto actualizado' : 'Punto creado'); // <-- Toast de éxito
        navigate({ to: '/app/puntos' });
    } catch (error: any) { // <-- Añadir catch
        console.error("Error al guardar punto:", error);
        toast.error(`Error al guardar: ${error.message}`); // <-- Toast de error
    } finally { // <-- Añadir finally (opcional, para quitar estado de carga si lo hubiera)
        // setLoading(false); // Si usaras un estado de carga global
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
            <div className="form-row">
            <div>
              <label htmlFor="localidad">Localidad</label>
              <div className="input-icon-wrapper">
                {/* Puedes elegir un icono adecuado, ej: MapPin o Building */}
                <MapPin size={18} className="input-icon" />
                <input type="text" id="localidad" {...register('localidad')} />
              </div>
              {errors.localidad && <p className="error-text">{errors.localidad.message}</p>}
            </div>
            <div>
              <label htmlFor="provincia">Provincia</label>
              <div className="input-icon-wrapper">
                <MapPin size={18} className="input-icon" />
                <input type="text" id="provincia" {...register('provincia')} />
              </div>
              {errors.provincia && <p className="error-text">{errors.provincia.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="tipo_factura">Tipo Factura</label>
            <div className="input-icon-wrapper">
              {/* Icono ejemplo: FileText, List, etc. */}
              <FileText size={18} className="input-icon" />
              <select id="tipo_factura" {...register('tipo_factura')}>
                <option value="">Selecciona (Luz/Gas)</option>
                <option value="Luz">Luz</option>
                <option value="Gas">Gas</option>
              </select>
            </div>
            {errors.tipo_factura && <p className="error-text">{errors.tipo_factura.message}</p>}
          </div>
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
