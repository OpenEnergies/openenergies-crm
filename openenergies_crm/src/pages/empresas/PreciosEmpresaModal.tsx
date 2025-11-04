// src/pages/empresas/PreciosEmpresaModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { TarifaElectrica, PreciosEmpresa } from '@lib/types';
import { toast } from 'react-hot-toast';
import { Loader2, Calendar, Tags, Euro } from 'lucide-react';

// --- Esquema de Validación con Zod ---
// Define todos los campos de precio como números opcionales
const preciosSchema = z.object({
  precio_potencia_p1: z.number().nullable().optional(),
  precio_potencia_p2: z.number().nullable().optional(),
  precio_potencia_p3: z.number().nullable().optional(),
  precio_potencia_p4: z.number().nullable().optional(),
  precio_potencia_p5: z.number().nullable().optional(),
  precio_potencia_p6: z.number().nullable().optional(),
  precio_energia_p1: z.number().nullable().optional(),
  precio_energia_p2: z.number().nullable().optional(),
  precio_energia_p3: z.number().nullable().optional(),
  precio_energia_p4: z.number().nullable().optional(),
  precio_energia_p5: z.number().nullable().optional(),
  precio_energia_p6: z.number().nullable().optional(),
});

type FormValues = z.infer<typeof preciosSchema>;

// --- Props del Modal ---
interface Props {
  empresaId: string;
  empresaNombre: string;
  onClose: () => void;
}

// --- Helper para saber qué peajes mostrar ---
const getPeajesActivos = (tarifa: TarifaElectrica) => {
  const peajes = {
    potencia: [] as string[],
    energia: [] as string[],
  };
  switch (tarifa) {
    case '2.0TD':
      peajes.potencia = ['p1', 'p2'];
      peajes.energia = ['p1', 'p2', 'p3'];
      break;
    case '3.0TD':
    case '6.1TD':
      peajes.potencia = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      peajes.energia = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      break;
  }
  return peajes;
};

// --- Componente Principal del Modal ---
export default function PreciosEmpresaModal({ empresaId, empresaNombre, onClose }: Props) {
  // --- Estados ---
  const [selectedTarifa, setSelectedTarifa] = useState<TarifaElectrica | ''>('');
  const [selectedDate, setSelectedDate] = useState(''); // Formato 'YYYY-MM'
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Guarda el ID del registro de precios existente (si se encuentra)
  const [existingPrecioId, setExistingPrecioId] = useState<string | null>(null);

  const tarifasDisponibles: TarifaElectrica[] = ['2.0TD', '3.0TD', '6.1TD'];

  // --- React Hook Form ---
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(preciosSchema),
    defaultValues: {
      precio_potencia_p1: null,
      precio_potencia_p2: null,
      // ... (todos los demás en null)
    },
  });

  // --- Lógica de Carga de Datos ---
  useEffect(() => {
    // Solo busca si tenemos los 3 datos
    if (!empresaId || !selectedTarifa || !selectedDate) {
      reset(); // Limpia el formulario si cambian los selectores
      setExistingPrecioId(null);
      return;
    }

    const fetchPrecios = async () => {
      setIsLoading(true);
      setExistingPrecioId(null);
      
      // Convierte 'YYYY-MM' a 'YYYY-MM-01'
      const fechaMes = `${selectedDate}-01`;

      try {
        const { data, error } = await supabase
          .from('precios_empresa')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('tarifa', selectedTarifa)
          .eq('fecha_mes', fechaMes)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // --- DATOS ENCONTRADOS ---
          toast.success('Precios existentes cargados.');
          // Casteamos data a FormValues (los tipos coinciden)
          reset(data as FormValues); 
          setExistingPrecioId(data.id);
        } else {
          // --- NO SE ENCONTRARON DATOS ---
          toast.success('No existen precios. Puedes rellenarlos.');
          reset(); // Limpia el formulario a los defaultValues (null)
        }
      } catch (e: any) {
        toast.error(`Error al consultar precios: ${e.message}`);
        reset();
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrecios();
  }, [empresaId, selectedTarifa, selectedDate, reset]);

  // --- Lógica de Guardado (Submit) ---
  const onSubmit: SubmitHandler<FormValues> = async (formData) => {
    if (!empresaId || !selectedTarifa || !selectedDate) {
      toast.error('Faltan Empresa, Tarifa o Fecha.');
      return;
    }
    
    setIsSubmitting(true);
    const fechaMes = `${selectedDate}-01`;

    const payload: Omit<PreciosEmpresa, 'id' | 'creado_en'> = {
      empresa_id: empresaId,
      tarifa: selectedTarifa,
      fecha_mes: fechaMes,
      precio_potencia_p1: formData.precio_potencia_p1 ?? null,
      precio_potencia_p2: formData.precio_potencia_p2 ?? null,
      precio_potencia_p3: formData.precio_potencia_p3 ?? null,
      precio_potencia_p4: formData.precio_potencia_p4 ?? null,
      precio_potencia_p5: formData.precio_potencia_p5 ?? null,
      precio_potencia_p6: formData.precio_potencia_p6 ?? null,
      precio_energia_p1: formData.precio_energia_p1 ?? null,
      precio_energia_p2: formData.precio_energia_p2 ?? null,
      precio_energia_p3: formData.precio_energia_p3 ?? null,
      precio_energia_p4: formData.precio_energia_p4 ?? null,
      precio_energia_p5: formData.precio_energia_p5 ?? null,
      precio_energia_p6: formData.precio_energia_p6 ?? null,
    };

    try {
      if (existingPrecioId) {
        // --- ACTUALIZAR (UPDATE) ---
        const { error } = await supabase
          .from('precios_empresa')
          .update(payload)
          .eq('id', existingPrecioId);
        if (error) throw error;
        toast.success('Precios actualizados correctamente.');
      } else {
        // --- CREAR (INSERT) ---
        const { error } = await supabase
          .from('precios_empresa')
          .insert(payload);
        if (error) throw error;
        toast.success('Nuevos precios guardados.');
      }
      onClose(); // Cierra el modal al tener éxito
    } catch (e: any) {
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Renderizado Condicional de Inputs ---
  const peajesActivos = useMemo(() => {
    return selectedTarifa ? getPeajesActivos(selectedTarifa) : { potencia: [], energia: [] };
  }, [selectedTarifa]);

  // Helper para renderizar un campo de precio
  const renderPriceInput = (tipo: 'potencia' | 'energia', peaje: string) => {
    const fieldName = `precio_${tipo}_${peaje}` as keyof FormValues;
    const label = `P${peaje.substring(1)} (${tipo === 'potencia' ? 'kW/año' : 'kWh'})`;

    return (
      <div key={fieldName}>
        <label htmlFor={fieldName}>{label}</label>
        <div className="input-icon-wrapper">
          <Euro size={18} className="input-icon" />
          <input
            id={fieldName}
            type="number"
            step="0.000001" // Alta precisión
            {...register(fieldName, { setValueAs: v => (v === "" ? null : parseFloat(v)) })}
            placeholder="0.00"
            disabled={isLoading || isSubmitting}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="card" style={{ padding: 0 }}>
            {/* --- Cabecera --- */}
            <div className="page-header" style={{ padding: '1.5rem', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h2 style={{ margin: 0 }}>Actualizar Precios</h2>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>{empresaNombre}</p>
              </div>
            </div>

            {/* --- Selectores y Formulario --- */}
            <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="grid" style={{ gap: '1.5rem' }}>
                
                {/* --- Fila de Selectores --- */}
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <label htmlFor="tarifa">Tarifa</label>
                    <div className="input-icon-wrapper">
                      <Tags size={18} className="input-icon" />
                      <select
                        id="tarifa"
                        value={selectedTarifa}
                        onChange={(e) => setSelectedTarifa(e.target.value as TarifaElectrica | '')}
                      >
                        <option value="">Selecciona tarifa...</option>
                        {tarifasDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="fecha_mes">Mes y Año</label>
                    <div className="input-icon-wrapper">
                      <Calendar size={18} className="input-icon" />
                      <input
                        id="fecha_mes"
                        type="month" // Input nativo de mes/año
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        disabled={!selectedTarifa}
                      />
                    </div>
                  </div>
                </div>

                {/* --- Separador --- */}
                {(selectedTarifa && selectedDate) && <hr style={{ margin: '0.5rem 0' }} />}

                {/* --- Contenedor de Carga o Inputs --- */}
                {isLoading ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" /> Consultando...
                  </div>
                ) : (selectedTarifa && selectedDate) && (
                  <div className="grid" style={{ gap: '1.5rem' }}>
                    {/* --- Precios Potencia --- */}
                    {peajesActivos.potencia.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 1rem' }}>Término de Potencia</h4>
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                          {peajesActivos.potencia.map(p => renderPriceInput('potencia', p))}
                        </div>
                      </div>
                    )}
                    {/* --- Precios Energía --- */}
                    {peajesActivos.energia.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 1rem' }}>Término de Energía</h4>
                        <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                          {peajesActivos.energia.map(p => renderPriceInput('energia', p))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* --- Pie de Página (Acciones) --- */}
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || isSubmitting || !selectedTarifa || !selectedDate}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : (existingPrecioId ? 'Actualizar Precios' : 'Guardar Precios')}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}