// src/pages/puntos/PuntoForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { router } from '@router/routes'; // <-- (1) Importar router
// --- Importa Controller ---
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
// --- Importa iconos y tipos necesarios ---
import { User, HardHat, MapPin, Barcode, Tags, Zap, TrendingUp, FileText, Building } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import type { Cliente, Empresa, TipoFactura } from '@lib/types'; // Asegúrate que TipoFactura esté en types.ts

// --- Schema de Zod actualizado ---
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
// ------------------------------

type FormValues = z.infer<typeof schema>;
// Tipos para los desplegables
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif'>;
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;

// --- Funciones para fetching con React Query ---
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('tipo', 'comercializadora')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function fetchAllClientes(): Promise<ClienteOpt[]> {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}
// ---------------------------------------------

function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    // elimina marcas diacríticas
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}


export default function PuntoForm({ id }: { id?: string }) {
  const editing = Boolean(id);

  // --- Fetching de datos con React Query ---
  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
      queryKey: ['comercializadoras'],
      queryFn: fetchComercializadoras,
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
      queryKey: ['allClientesForPuntoForm'],
      queryFn: fetchAllClientes,
  });

  // Estado del input visible (texto) y del dropdown
  const [clienteInput, setClienteInput] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);

  // Sugerencias filtradas (desde 1 carácter)
  const filteredClientes = useMemo(() => {
    const q = normalize(clienteInput.trim());
    if (!q) return [];
    // nombre + cif opcional
    return allClientes
      .filter(c => normalize(`${c.nombre} ${c.cif ?? ''}`).includes(q))
      .slice(0, 12); // limite razonable
  }, [clienteInput, allClientes]);

  // ---------------------------------------

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

  // Carga punto si está en modo edición
  useEffect(() => {
    if (!editing || !id) return;
    if (comercializadoras.length === 0 || allClientes.length === 0) return;

    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('puntos_suministro')
        .select('id, cliente_id, current_comercializadora_id, direccion, cups, tarifa_acceso, potencia_contratada_kw, consumo_anual_kwh, localidad, provincia, tipo_factura')
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        toast.error(`Error al cargar datos para editar: ${error.message}`);
      } else if (data) {
        // Usar current_comercializadora_id directamente
        const initialComercializadoraId = data.current_comercializadora_id ?? '';
        const cli = allClientes.find(c => c.id === data.cliente_id);
        setClienteInput(cli ? `${cli.nombre}${cli.cif ? ` (${cli.cif})` : ''}` : '');

        // Resetea el formulario con los datos cargados
        reset({
          comercializadora_id: initialComercializadoraId,
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
  }, [editing, id, reset, comercializadoras, allClientes]);


  // --- Función onSubmit ---
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (!values.cliente_id) {
      setError('cliente_id', { type: 'validate', message: 'Selecciona un cliente de la lista' });
      return;
    }
    // Prepara el payload para la BBDD
    const payload = {
      cliente_id: values.cliente_id,
      current_comercializadora_id: values.comercializadora_id || null,
      direccion: values.direccion,
      cups: values.cups,
      tarifa_acceso: values.tarifa_acceso || null,
      potencia_contratada_kw: values.potencia_contratada_kw ?? null,
      consumo_anual_kwh: values.consumo_anual_kwh ?? null,
      localidad: values.localidad ?? null,
      provincia: values.provincia ?? null,
      tipo_factura: values.tipo_factura ?? null,
    };

    try {
        if (editing) { // Actualiza si estamos editando
          const { error } = await supabase.from('puntos_suministro').update(payload).eq('id', id!);
          if (error) throw error;
        } else { // Inserta si estamos creando
          const { error } = await supabase.from('puntos_suministro').insert(payload);
          if (error) throw error;
        }
        toast.success(editing ? 'Punto actualizado correctamente' : 'Punto creado correctamente');
        router.history.back(); // <-- (3) CAMBIO: Volver atrás
    } catch (error: any) {
        console.error("Error al guardar punto:", error);
        toast.error(`Error al guardar: ${error.message}`);
    }
  };
  // -----------------------

  return (
    <div className="grid">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>
          {editing ? 'Editar Punto de Suministro' : 'Nuevo Punto de Suministro'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>

          {/* --- CAMPOS REORDENADOS --- */}
          <div className="form-row"> {/* Usa form-row para ponerlos lado a lado */}

            {/* Columna Izquierda: Comercializadora (Opcional) */}
            <div>
              <label htmlFor="comercializadora_id">Comercializadora (Opcional)</label>
              <div className="input-icon-wrapper">
                <Building size={18} className="input-icon" />
                <select id="comercializadora_id" {...register('comercializadora_id')} disabled={loadingComercializadoras}>
                  <option value="">{loadingComercializadoras ? 'Cargando...' : 'Selecciona comercializadora (opcional)'}</option>
                  {comercializadoras.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              {errors.comercializadora_id && <p className="error-text">{errors.comercializadora_id.message}</p>}
            </div>

            {/* Columna Derecha: Cliente (Siempre habilitado) */}
            <div>
              <label htmlFor="cliente_input">Cliente</label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <HardHat size={18} className="input-icon" />

                {/* Input visible (texto) */}
                <input
                  id="cliente_input"
                  type="text"
                  autoComplete="off"
                  value={clienteInput}
                  placeholder={loadingClientes ? 'Cargando clientes...' : 'Escribe para buscar cliente'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClienteInput(v);
                    // Invalida selección previa hasta que elija una sugerencia
                    setValue('cliente_id', '' as any, { shouldValidate: true, shouldDirty: true });
                    setError('cliente_id', { type: 'validate', message: 'Selecciona un cliente de la lista' });
                    setClienteOpen(normalize(v).length >= 1);
                  }}
                  onFocus={() => {
                    if (normalize(clienteInput).length >= 1) setClienteOpen(true);
                  }}
                  onBlur={() => {
                    // pequeño delay para permitir onMouseDown en la lista
                    setTimeout(() => setClienteOpen(false), 150);
                  }}
                  style={{ paddingRight: '2rem' }}
                />

                {/* Campo real del formulario (oculto) — mantiene el UUID */}
                <Controller
                  name="cliente_id"
                  control={control}
                  render={({ field }) => (
                    <input type="hidden" {...field} />
                  )}
                />

                {/* Dropdown de sugerencias */}
                {clienteOpen && filteredClientes.length > 0 && (
                  <ul
                    role="listbox"
                    className="typeahead-list"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      background: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      borderTop: 'none',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    }}
                  >
                    {filteredClientes.map((c) => (
                      <li
                        key={c.id}
                        role="option"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          // onMouseDown para que ocurra antes del blur del input
                          e.preventDefault();
                          const label = `${c.nombre}${c.cif ? ` (${c.cif})` : ''}`;
                          setClienteInput(label);
                          setValue('cliente_id', c.id, { shouldValidate: true, shouldDirty: true });
                          clearErrors('cliente_id');
                          setClienteOpen(false);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          borderTop: '1px solid var(--border-color, #e5e7eb)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted, #f6f7f9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {c.nombre} {c.cif ? <span style={{ opacity: 0.7 }}>({c.cif})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.cliente_id && <p className="error-text">{errors.cliente_id.message}</p>}
            </div>
          </div>
          {/* --------------------------- */}

          {/* Campo Titular Eliminado */}

          {/* Resto de campos (Dirección, Localidad, etc.) */}
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
              <FileText size={18} className="input-icon" />
              <select id="tipo_factura" {...register('tipo_factura')}>
                <option value="">Selecciona (Luz/Gas)</option>
                <option value="Luz">Luz</option>
                <option value="Gas">Gas</option>
              </select>
            </div>
            {errors.tipo_factura && <p className="error-text">{errors.tipo_factura.message}</p>}
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
                <input type="number" id="potencia_contratada_kw" step="0.01" {...register('potencia_contratada_kw', { setValueAs: v => (v === '' || v === null ? null : Number(v)) })} />
              </div>
              {/* El error de tipo ya lo maneja Zod, no necesitamos error específico aquí */}
            </div>
            <div>
              <label htmlFor="consumo_anual_kwh">Consumo anual (kWh)</label>
              <div className="input-icon-wrapper">
                <TrendingUp size={18} className="input-icon" />
                <input type="number" id="consumo_anual_kwh" step="1" {...register('consumo_anual_kwh', { setValueAs: v => (v === '' || v === null ? null : Number(v)) })} />
              </div>
              {/* El error de tipo ya lo maneja Zod */}
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => router.history.back()} // <-- (4) CAMBIO: Volver atrás
            >
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || loadingComercializadoras || loadingClientes}>
               {isSubmitting ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear punto')}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}