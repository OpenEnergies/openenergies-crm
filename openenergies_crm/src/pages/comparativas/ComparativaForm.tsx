// src/pages/comparativas/ComparativaForm.tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, FileText, Calendar, Zap, TrendingUp, User, Home, Hash, MapPin, Building } from 'lucide-react';

// --- Schemas de validación con Zod ---
const planSchema = z.object({
  nombre: z.string().default(''),
  precio_potencia: z.record(z.coerce.number().min(0, "Debe ser positivo")),
  precio_energia: z.record(z.coerce.number().min(0, "Debe ser positivo")),
  cargos_fijos_anual_eur: z.coerce.number().min(0).default(0),
});

const suministroSchema = z.object({
  nombre_cliente: z.string().optional(),
  cif: z.string().min(1, 'CIF/DNI es obligatorio'),
  direccion: z.string().min(1, 'Dirección es obligatoria'),
  poblacion: z.string().min(1, 'Población es obligatoria'),
  cups: z.string().min(1, 'CUPS es obligatorio'),
  fecha_estudio: z.string().min(1, 'Fecha es obligatoria'),
});

const formSchema = z.object({
  tarifa: z.enum(['2.0TD', '3.0TD', '6.1TD']),
  potencia_contratada_kw: z.record(z.coerce.number().min(0, "Debe ser positivo")),
  energia_kwh_mes: z.record(z.array(z.coerce.number().min(0).default(0)).length(12)),
  actual: planSchema,
  propuesta: planSchema,
  suministro: suministroSchema,
  iva_pct: z.coerce.number().min(0).default(0.21),
  impuesto_electricidad_pct: z.coerce.number().min(0).default(0.05112),
});

type FormData = z.infer<typeof formSchema>;

// --- Lógica de la mutación ---
async function generateComparison(payload: FormData) {
  const { data, error } = await supabase.functions.invoke('generate-comparison-pdf', {
    body: payload,
  });

  // Si hay un error en la invocación, la respuesta detallada está en 'data'
  if (error) {
    // Intentamos extraer el mensaje de error detallado que hemos preparado en la Edge Function
    const errorDetails = data?.details || error.message;
    throw new Error(errorDetails);
  }
  
  return data;
}

export default function ComparativaForm() {
  const [downloadLink, setDownloadLink] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tarifa: '2.0TD',
      potencia_contratada_kw: { P1: 0, P2: 0 },
      energia_kwh_mes: { E1: Array(12).fill(0), E2: Array(12).fill(0), E3: Array(12).fill(0) },
      actual: { nombre: 'Plan Actual', precio_potencia: { P1: 0, P2: 0 }, precio_energia: { E1: 0, E2: 0, E3: 0 } },
      propuesta: { nombre: 'Plan Propuesto', precio_potencia: { P1: 0, P2: 0 }, precio_energia: { E1: 0, E2: 0, E3: 0 } },
      suministro: { fecha_estudio: new Date().toISOString().split('T')[0] },
      iva_pct: 0.21,
      impuesto_electricidad_pct: 0.05112,
    },
  });

  const mutation = useMutation({
    mutationFn: generateComparison,
    onSuccess: async (data) => {
      alert('¡Comparativa generada con éxito!');
      const { data: urlData } = await supabase.storage
        .from('documentos')
        .createSignedUrl(data.filePath, 300);
      if (urlData) setDownloadLink(urlData.signedUrl);
    },
    onError: (error) => {
      alert(`Error al generar la comparativa: ${error.message}`);
    },
  });

  const onSubmit = (data: FormData) => {
    setDownloadLink(null);
    mutation.mutate(data);
  };

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const periodosPotencia = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const periodosEnergia = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Nueva Comparativa Energética</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '2.5rem' }}>

          {/* === Sección de Datos del Suministro === */}
          <section>
            <h3 className="section-title"><FileText size={20} /> Datos del Suministro</h3>
            <div className="grid form-section">
              <div className="form-row">
                <div><label>Nombre Cliente (Opcional)</label><div className="input-icon-wrapper"><User size={18} className="input-icon" /><input {...register('suministro.nombre_cliente')} /></div></div>
                <div><label>CIF / DNI</label><div className="input-icon-wrapper"><Hash size={18} className="input-icon" /><input {...register('suministro.cif')} /></div>{errors.suministro?.cif && <p className="error-text">{errors.suministro.cif.message}</p>}</div>
              </div>
              <div className="form-row">
                <div><label>Dirección</label><div className="input-icon-wrapper"><Home size={18} className="input-icon" /><input {...register('suministro.direccion')} /></div>{errors.suministro?.direccion && <p className="error-text">{errors.suministro.direccion.message}</p>}</div>
                <div><label>Población</label><div className="input-icon-wrapper"><MapPin size={18} className="input-icon" /><input {...register('suministro.poblacion')} /></div>{errors.suministro?.poblacion && <p className="error-text">{errors.suministro.poblacion.message}</p>}</div>
              </div>
              <div className="form-row">
                <div><label>CUPS</label><div className="input-icon-wrapper"><Building size={18} className="input-icon" /><input {...register('suministro.cups')} /></div>{errors.suministro?.cups && <p className="error-text">{errors.suministro.cups.message}</p>}</div>
                <div><label>Fecha Estudio</label><div className="input-icon-wrapper"><Calendar size={18} className="input-icon" /><input type="date" {...register('suministro.fecha_estudio')} /></div>{errors.suministro?.fecha_estudio && <p className="error-text">{errors.suministro.fecha_estudio.message}</p>}</div>
              </div>
            </div>
          </section>

          {/* === Sección de Potencia y Consumo === */}
          <section>
            <h3 className="section-title"><Zap size={20} /> Potencia y Consumo Mensual (kWh)</h3>
            <div className="grid form-section">
              <div>
                <label>Potencia Contratada (kW)</label>
                <div className="table-wrapper">
                  <table className="form-table">
                    <thead><tr>{periodosPotencia.map(p => <th key={p}>{p}</th>)}</tr></thead>
                    <tbody><tr>{periodosPotencia.map(p => <td key={p}><input type="number" step="0.01" {...register(`potencia_contratada_kw.${p}`)} /></td>)}</tr></tbody>
                  </table>
                </div>
              </div>
              <div>
                <label>Consumo Mensual por Periodo (kWh)</label>
                <div className="table-wrapper">
                  <table className="form-table">
                    <thead><tr><th>Periodo</th>{meses.map(m => <th key={m}>{m}</th>)}</tr></thead>
                    <tbody>
                      {periodosEnergia.map(p => (
                        <tr key={p}>
                          <td><strong>{p}</strong></td>
                          {meses.map((_, i) => <td key={i}><input type="number" step="0.01" {...register(`energia_kwh_mes.${p}.${i}`)} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* === Sección de Precios === */}
          <section>
            <h3 className="section-title"><TrendingUp size={20} /> Precios de los Planes</h3>
            <div className="form-row">
              {/* Plan Actual */}
              <div className="panel">
                <h4>Plan Actual</h4>
                <div className="grid" style={{ gap: '1rem' }}>
                  <div><label>Precio Potencia (€/kW·año)</label><div className="table-wrapper"><table className="form-table"><thead><tr>{periodosPotencia.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody><tr>{periodosPotencia.map(p => <td key={p}><input type="number" step="0.0001" {...register(`actual.precio_potencia.${p}`)} /></td>)}</tr></tbody></table></div></div>
                  <div><label>Precio Energía (€/kWh)</label><div className="table-wrapper"><table className="form-table"><thead><tr>{periodosEnergia.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody><tr>{periodosEnergia.map(p => <td key={p}><input type="number" step="0.0001" {...register(`actual.precio_energia.${p}`)} /></td>)}</tr></tbody></table></div></div>
                </div>
              </div>
              {/* Plan Propuesto */}
              <div className="panel">
                <h4>Plan Propuesto</h4>
                <div className="grid" style={{ gap: '1rem' }}>
                  <div><label>Precio Potencia (€/kW·año)</label><div className="table-wrapper"><table className="form-table"><thead><tr>{periodosPotencia.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody><tr>{periodosPotencia.map(p => <td key={p}><input type="number" step="0.0001" {...register(`propuesta.precio_potencia.${p}`)} /></td>)}</tr></tbody></table></div></div>
                  <div><label>Precio Energía (€/kWh)</label><div className="table-wrapper"><table className="form-table"><thead><tr>{periodosEnergia.map(p => <th key={p}>{p}</th>)}</tr></thead><tbody><tr>{periodosEnergia.map(p => <td key={p}><input type="number" step="0.0001" {...register(`propuesta.precio_energia.${p}`)} /></td>)}</tr></tbody></table></div></div>
                </div>
              </div>
            </div>
          </section>

          {/* Botón de envío y descarga */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Generando...' : 'Generar PDF'}
            </button>
            {downloadLink && (
              <a href={downloadLink} target="_blank" rel="noopener noreferrer" className="button secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={18} /> Descargar PDF
              </a>
            )}
          </div>

        </div>
      </form>
    </div>
  );
}