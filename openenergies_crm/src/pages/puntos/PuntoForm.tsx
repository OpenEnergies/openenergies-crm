// src/pages/puntos/PuntoForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
  comercializadora_id: z.string().uuid({ message: 'Comercializadora obligatoria' }), // Nuevo campo
  cliente_id: z.string().uuid({ message: 'Cliente obligatorio' }),
  // 'titular' se elimina del schema, se obtendrá de la comercializadora
  direccion: z.string().min(1, 'Dirección obligatoria'),
  cups: z.string().min(5, 'CUPS obligatorio'),
  tarifa_acceso: z.string().min(1, 'Tarifa obligatoria'),
  potencia_contratada_kw: z.number().nullable().optional(),
  consumo_anual_kwh: z.number().nullable().optional(),
  localidad: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  tipo_factura: z.enum(['Luz', 'Gas'], { invalid_type_error: 'Debes seleccionar Luz o Gas' }).optional().nullable(),
});
// ------------------------------

type FormValues = z.infer<typeof schema>;
// Tipos para los desplegables
type ClienteOpt = Pick<Cliente, 'id' | 'nombre' | 'cif' | 'empresa_id'>;
type ComercializadoraOpt = Pick<Empresa, 'id' | 'nombre'>;

// --- Funciones para fetching con React Query ---
async function fetchComercializadoras(): Promise<ComercializadoraOpt[]> {
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        // Filtra por tipo 'externa' (el tipo ENUM que usamos para comercializadoras)
        .eq('tipo', 'comercializadora')
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function fetchAllClientes(): Promise<ClienteOpt[]> {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif, empresa_id') // Necesitamos empresa_id para filtrar
        .order('nombre', { ascending: true });
    if (error) throw error;
    return data || [];
}
// ---------------------------------------------

export default function PuntoForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);

  // --- Estados para manejar la lógica de los desplegables ---
  const [selectedComercializadoraId, setSelectedComercializadoraId] = useState<string | null>(null);
  const [filteredClientes, setFilteredClientes] = useState<ClienteOpt[]>([]);
  // -----------------------------------------------------------

  // --- Fetching de datos con React Query ---
  const { data: comercializadoras = [], isLoading: loadingComercializadoras } = useQuery({
      queryKey: ['comercializadoras'], // Clave para la caché
      queryFn: fetchComercializadoras, // Función que obtiene los datos
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery({
      queryKey: ['allClientesForPuntoForm'], // Clave distinta para evitar colisiones
      queryFn: fetchAllClientes, // Obtiene TODOS los clientes una vez
  });
  // ---------------------------------------

  const {
    register,
    handleSubmit,
    reset,
    control, // Necesario para Controller (select de cliente)
    setValue, // Para limpiar cliente_id
    watch, // Para observar cambios en comercializadora_id
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Podrías añadir defaultValues si es necesario
  });

  // --- Observa el valor seleccionado en el desplegable de comercializadora ---
  const watchedComercializadoraId = watch('comercializadora_id');
  // ----------------------------------------------------------------------

  // --- Efecto para filtrar Clientes cuando cambia la Comercializadora ---
  useEffect(() => {
      // Si hay una comercializadora seleccionada en el form...
      if (watchedComercializadoraId) {
          setSelectedComercializadoraId(watchedComercializadoraId); // Actualiza estado local
          // Filtra la lista completa de clientes
          const filtered = allClientes.filter(c => c.empresa_id === watchedComercializadoraId);
          setFilteredClientes(filtered);
          // Resetea el valor del campo cliente_id en el formulario
          setValue('cliente_id', '', { shouldValidate: false }); // No validar al resetear
      } else {
          // Si no hay comercializadora, vacía la lista y resetea
          setSelectedComercializadoraId(null);
          setFilteredClientes([]);
          setValue('cliente_id', '', { shouldValidate: false });
      }
  // Se ejecuta cuando cambia la selección o cuando carga la lista completa de clientes
  }, [watchedComercializadoraId, allClientes, setValue]);
  // -------------------------------------------------------------------

  // Carga punto si está en modo edición
  useEffect(() => {
    if (!editing || !id) return; // Sal si no estamos editando o no hay ID
    if (comercializadoras.length === 0 || allClientes.length === 0) return; // Espera a que carguen los selects

    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('puntos_suministro')
        // Selecciona todos los campos necesarios
        .select('id, cliente_id, titular, direccion, cups, tarifa_acceso, potencia_contratada_kw, consumo_anual_kwh, localidad, provincia, tipo_factura')
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        toast.error(`Error al cargar datos para editar: ${error.message}`);
      } else if (data) {
        // Busca el ID de la comercializadora basándose en el nombre guardado en 'titular'
        const matchingComercializadora = comercializadoras.find(c => c.nombre === data.titular);
        const initialComercializadoraId = matchingComercializadora?.id ?? '';

        // Resetea el formulario con los datos cargados
        reset({
          comercializadora_id: initialComercializadoraId, // Preselecciona comercializadora
          cliente_id: data.cliente_id,
          // 'titular' ya no está en el form
          direccion: data.direccion ?? '',
          cups: data.cups ?? '',
          tarifa_acceso: data.tarifa_acceso ?? '',
          potencia_contratada_kw: data.potencia_contratada_kw === null ? null : Number(data.potencia_contratada_kw),
          consumo_anual_kwh: data.consumo_anual_kwh === null ? null : Number(data.consumo_anual_kwh),
          localidad: data.localidad ?? null,
          provincia: data.provincia ?? null,
          tipo_factura: (data.tipo_factura as TipoFactura) ?? null, // Cast al tipo ENUM
        });

        // Si encontramos una comercializadora, filtramos los clientes iniciales
        if (initialComercializadoraId) {
            setSelectedComercializadoraId(initialComercializadoraId);
            const initialFiltered = allClientes.filter(c => c.empresa_id === initialComercializadoraId);
            setFilteredClientes(initialFiltered);
            // Aseguramos que el cliente_id correcto siga seleccionado después del reset/filtro
            setValue('cliente_id', data.cliente_id, { shouldDirty: false });
        }
      }
    })();
    return () => { alive = false; };
  // Dependencias clave: id, reset, y las listas cargadas
  }, [editing, id, reset, comercializadoras, allClientes, setValue]);


  // --- Función onSubmit ---
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    // 1. Obtiene el NOMBRE de la comercializadora seleccionada
    const selectedComercializadora = comercializadoras.find(c => c.id === values.comercializadora_id);
    if (!selectedComercializadora) {
        toast.error("Comercializadora seleccionada no es válida.");
        return;
    }
    const titularNombre = selectedComercializadora.nombre;

    // 2. Prepara el payload para la BBDD
    const payload = {
      cliente_id: values.cliente_id,
      titular: titularNombre, // Guarda el NOMBRE como titular
      direccion: values.direccion,
      cups: values.cups,
      tarifa_acceso: values.tarifa_acceso,
      potencia_contratada_kw: values.potencia_contratada_kw ?? null, // Asegura null si es undefined/vacío
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
        // Navega a la lista general de puntos (o donde prefieras)
        navigate({ to: '/app/puntos' });
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

            {/* Columna Izquierda: Comercializadora */}
            <div>
              <label htmlFor="comercializadora_id">Comercializadora</label>
              <div className="input-icon-wrapper">
                <Building size={18} className="input-icon" />
                <select id="comercializadora_id" {...register('comercializadora_id')} disabled={loadingComercializadoras}>
                  <option value="">{loadingComercializadoras ? 'Cargando...' : 'Selecciona comercializadora'}</option>
                  {comercializadoras.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              {errors.comercializadora_id && <p className="error-text">{errors.comercializadora_id.message}</p>}
            </div>

            {/* Columna Derecha: Cliente (Filtrado y Controlado) */}
            <div>
              <label htmlFor="cliente_id">Cliente</label>
              {/* Div wrapper para capturar clic y mostrar tooltip */}
              <div
                  className="input-icon-wrapper"
                  // Captura el clic ANTES de que el select intente abrirse
                  onMouseDownCapture={(e) => {
                      if (!selectedComercializadoraId) {
                          e.preventDefault(); // Evita que el select se abra
                          toast.error('Selecciona primero una comercializadora.');
                      }
                  }}
                  title={!selectedComercializadoraId ? 'Selecciona primero una comercializadora' : undefined}
              >
                <HardHat size={18} className="input-icon" />
                {/* Controller para gestionar el 'disabled' dinámico */}
                <Controller
                    name="cliente_id"
                    control={control}
                    render={({ field }) => (
                        <select
                            id="cliente_id"
                            {...field}
                            // Deshabilitado si no hay comercializadora o si los clientes están cargando
                            disabled={!selectedComercializadoraId || loadingClientes}
                            style={{ cursor: !selectedComercializadoraId ? 'not-allowed' : 'default' }}
                        >
                            <option value="">
                                {/* Mensaje dinámico en la opción por defecto */}
                                {!selectedComercializadoraId
                                    ? '← Selecciona comercializadora'
                                    : loadingClientes
                                    ? 'Cargando clientes...'
                                    : filteredClientes.length === 0
                                    ? 'No hay clientes para esta comercializadora'
                                    : 'Selecciona cliente'}
                            </option>
                            {/* Mapea sobre los clientes FILTRADOS */}
                            {filteredClientes.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre} {c.cif ? `(${c.cif})` : ''}</option>
                            ))}
                        </select>
                    )}
                />
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
              onClick={() => navigate({ to: '/app/puntos' })} // O volver a la lista de clientes si vienes de ahí
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