// src/pages/empresas/PreciosEmpresaModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { TarifaElectrica } from '@lib/types';
import { toast } from 'react-hot-toast';
import { Loader2, Calendar, Tags, Euro, Zap, Flame, ArrowLeft } from 'lucide-react'; // Nuevos iconos

// --- Esquema de Validación (sigue siendo un superset) ---
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
  const [priceType, setPriceType] = useState<'potencia' | 'energia' | null>(null);
  const [selectedTarifa, setSelectedTarifa] = useState<TarifaElectrica | ''>('');
  const [selectedDate, setSelectedDate] = useState(''); // Formato 'YYYY-MM' (para Energía)
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString()); // (para Potencia)
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [existingPrecioId, setExistingPrecioId] = useState<string | null>(null);

  const tarifasDisponibles: TarifaElectrica[] = ['2.0TD', '3.0TD', '6.1TD'];
  
  // Opciones de año (ej: 5 años alrededor del actual)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    // Genera 5 años (ej: 2027, 2026, 2025(actual), 2024, 2023)
    return Array.from({ length: 5 }, (_, i) => (current + 2 - i).toString());
  }, []);


  // --- React Hook Form ---
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(preciosSchema),
    defaultValues: {},
  });

  // --- Lógica de Carga de Datos (Refactorizada) ---
  useEffect(() => {
    // Resetear si cambian las selecciones principales
    if (!priceType || !selectedTarifa) {
      reset(); 
      setExistingPrecioId(null);
      return;
    }

    const fetchPrecios = async () => {
      setIsLoading(true);
      setExistingPrecioId(null);
      reset(); // Limpia el formulario antes de cargar nuevos datos

      try {
        let data = null;
        let error = null;

        if (priceType === 'energia') {
          // --- ENERGÍA (MENSUAL) ---
          if (!selectedDate) { // Necesita 'YYYY-MM'
            setIsLoading(false);
            return; 
          }
          const fechaMes = `${selectedDate}-01`;
          
          const { data: d, error: e } = await supabase
            .from('precios_energia') // <-- Tabla Energía
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('tarifa', selectedTarifa)
            .eq('fecha_mes', fechaMes)
            .maybeSingle();
          data = d;
          error = e;

        } else if (priceType === 'potencia') {
          // --- POTENCIA (ANUAL) ---
          if (!selectedYear) { // Necesita 'YYYY'
            setIsLoading(false);
            return; 
          }
          const { data: d, error: e } = await supabase
            .from('precios_potencia') // <-- Tabla Potencia
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('tarifa', selectedTarifa)
            .eq('año', parseInt(selectedYear, 10))
            .maybeSingle();
          data = d;
          error = e;
        }

        if (error) throw error;

        if (data) {
          toast.success('Precios existentes cargados.');
          reset(data as FormValues); 
          setExistingPrecioId(data.id);
        } else {
          toast.success('No existen precios. Puedes rellenarlos.');
          // reset() ya se llamó arriba
        }
      } catch (e: any) {
        toast.error(`Error al consultar precios: ${e.message}`);
        reset();
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrecios();
  // Depende de todos los selectores
  }, [empresaId, priceType, selectedTarifa, selectedDate, selectedYear, reset]);

  // --- Lógica de Guardado (Submit) (Refactorizada) ---
  const onSubmit: SubmitHandler<FormValues> = async (formData) => {
    if (!priceType || !empresaId || !selectedTarifa) {
      toast.error('Faltan datos clave (Tipo, Empresa o Tarifa).');
      return;
    }
    
    setIsSubmitting(true);

    try {
      if (priceType === 'energia') {
        // --- GUARDAR ENERGÍA ---
        if (!selectedDate) {
          toast.error('Debes seleccionar un Mes/Año para precios de energía.');
          setIsSubmitting(false);
          return;
        }
        const fechaMes = `${selectedDate}-01`;
        
        // Payload solo con campos de energía
        const payload = {
          empresa_id: empresaId,
          tarifa: selectedTarifa,
          fecha_mes: fechaMes,
          precio_energia_p1: formData.precio_energia_p1 ?? null,
          precio_energia_p2: formData.precio_energia_p2 ?? null,
          precio_energia_p3: formData.precio_energia_p3 ?? null,
          precio_energia_p4: formData.precio_energia_p4 ?? null,
          precio_energia_p5: formData.precio_energia_p5 ?? null,
          precio_energia_p6: formData.precio_energia_p6 ?? null,
        };
        
        const { error } = await supabase
          .from('precios_energia') // <-- Tabla Energía
          .upsert(
            existingPrecioId ? { ...payload, id: existingPrecioId } : payload,
            { onConflict: 'empresa_id, tarifa, fecha_mes' } // Upsert
          );
        if (error) throw error;
        toast.success('Precios de energía guardados.');

      } else if (priceType === 'potencia') {
        // --- GUARDAR POTENCIA ---
         if (!selectedYear) {
          toast.error('Debes seleccionar un Año para precios de potencia.');
          setIsSubmitting(false);
          return;
        }
        
        // Payload solo con campos de potencia
        const payload = {
          empresa_id: empresaId,
          tarifa: selectedTarifa,
          año: parseInt(selectedYear, 10),
          precio_potencia_p1: formData.precio_potencia_p1 ?? null,
          precio_potencia_p2: formData.precio_potencia_p2 ?? null,
          precio_potencia_p3: formData.precio_potencia_p3 ?? null,
          precio_potencia_p4: formData.precio_potencia_p4 ?? null,
          precio_potencia_p5: formData.precio_potencia_p5 ?? null,
          precio_potencia_p6: formData.precio_potencia_p6 ?? null,
        };

        const { error } = await supabase
          .from('precios_potencia') // <-- Tabla Potencia
          .upsert(
            existingPrecioId ? { ...payload, id: existingPrecioId } : payload,
            { onConflict: 'empresa_id, tarifa, año' } // Upsert
          );
        if (error) throw error;
        toast.success('Precios de potencia guardados.');
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

  // Determina si los selectores de fecha/año deben mostrarse
  const showSelectors = priceType && selectedTarifa;
  // Determina si el formulario de precios debe mostrarse
  const showPriceForm = showSelectors && !isLoading && (
    (priceType === 'energia' && !!selectedDate) ||
    (priceType === 'potencia' && !!selectedYear)
  );
  
  // Determina si el botón de guardar debe estar activo
  const canSubmit = !isLoading && !isSubmitting && priceType && selectedTarifa && (
    (priceType === 'energia' && !!selectedDate) ||
    (priceType === 'potencia' && !!selectedYear)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="card" style={{ padding: 0 }}>
            {/* --- Cabecera --- */}
            <div className="page-header" style={{ padding: '1.5rem', marginBottom: 0, borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
              
              {/* Botón de Volver (si no estamos en el paso 1) */}
              {priceType !== null && (
                <button
                  type="button"
                  onClick={() => setPriceType(null)}
                  className="icon-button secondary"
                  title="Volver"
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              
              <div style={{ textAlign: 'center', width: '100%' }}>
                <h2 style={{ margin: 0 }}>Actualizar Precios</h2>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>{empresaNombre}</p>
              </div>
            </div>

            {/* --- Contenido del Modal --- */}
            <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="grid" style={{ gap: '1.5rem' }}>
                
                {/* --- PASO 1: Selección de Tipo --- */}
                {priceType === null && (
                  <div className="form-row" style={{ gap: '1rem' }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setPriceType('potencia')}
                      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%' }}
                    >
                      <Zap size={24} />
                      <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Precios Potencia</span>
                      <span style={{ fontSize: '0.9rem', color: '#d1d0d0ff' }}>(€/kW/Año)</span>
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setPriceType('energia')}
                      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%' }}
                    >
                      <Flame size={24} />
                      <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Precios Energía</span>
                      <span style={{ fontSize: '0.9rem', color: '#d1d0d0ff' }}>(€/kWh)</span>
                    </button>
                  </div>
                )}

                {/* --- PASO 2: Formulario --- */}
                {priceType !== null && (
                  <>
                    {/* --- Fila de Selectores (Tarifa y Fecha/Año) --- */}
                    <div className="form-row" style={{ alignItems: 'flex-end' }}>
                      {/* Selector de Tarifa */}
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
                      
                      {/* Selector de Mes (Energía) o Año (Potencia) */}
                      {priceType === 'energia' && (
                        <div>
                          <label htmlFor="fecha_mes">Mes y Año</label>
                          <div className="input-icon-wrapper">
                            <Calendar size={18} className="input-icon" />
                            <input
                              id="fecha_mes"
                              type="month"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              disabled={!selectedTarifa}
                            />
                          </div>
                        </div>
                      )}
                      
                      {priceType === 'potencia' && (
                         <div>
                          <label htmlFor="año">Año</label>
                          <div className="input-icon-wrapper">
                            <Calendar size={18} className="input-icon" />
                            <select
                              id="año"
                              value={selectedYear}
                              onChange={(e) => setSelectedYear(e.target.value)}
                              disabled={!selectedTarifa}
                            >
                              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* --- Separador --- */}
                    {showSelectors && <hr style={{ margin: '0.5rem 0' }} />}

                    {/* --- Contenedor de Carga --- */}
                    {isLoading && (
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" /> Consultando...
                      </div>
                    )}
                    
                    {/* --- Inputs de Precios --- */}
                    {showPriceForm && (
                      <div className="grid" style={{ gap: '1.5rem' }}>
                        
                        {/* --- Precios Potencia (Solo si priceType es 'potencia') --- */}
                        {priceType === 'potencia' && peajesActivos.potencia.length > 0 && (
                          <div>
                            <h4 style={{ margin: '0 0 1rem' }}>Término de Potencia (€/kW/Año)</h4>
                            <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                              {peajesActivos.potencia.map(p => renderPriceInput('potencia', p))}
                            </div>
                          </div>
                        )}
                        
                        {/* --- Precios Energía (Solo si priceType es 'energia') --- */}
                        {priceType === 'energia' && peajesActivos.energia.length > 0 && (
                          <div>
                            <h4 style={{ margin: '0 0 1rem' }}>Término de Energía (€/kWh)</h4>
                            <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                              {peajesActivos.energia.map(p => renderPriceInput('energia', p))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* --- Pie de Página (Acciones) --- */}
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              
              {/* Solo mostrar botón de Guardar si estamos en el paso 2 */}
              {priceType !== null && (
                <button
                  type="submit"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : (existingPrecioId ? 'Actualizar Precios' : 'Guardar Precios')}
                </button>
              )}
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}