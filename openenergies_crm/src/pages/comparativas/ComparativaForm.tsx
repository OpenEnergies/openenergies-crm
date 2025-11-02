// openenergies_crm/src/pages/comparativas/ComparativaForm.tsx
import React, { useState, useEffect } from "react";
// --- (1) Importar iconos y toast ---
import { Zap, Cog, Euro, Pencil, Loader2, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { saveAs } from 'file-saver';

type Tarifa = "2.0TD" | "3.0TD" | "6.1TD" | "";

// --- MODIFICADO: 'observaciones' eliminado ---
interface DatosSuministro {
  cups: string;
  titular: string;
  dniCif: string; 
  fechaEstudio: string; 
  direccion: string;
  poblacion: string;
  iva: string;
  impuestoElectrico: string;
  otrosConceptos: string;
}

interface SipsData {
  CUPS: string;
  Tarifa: Tarifa;
  PotContratada: Record<string, number>;
  ConsumoAnual: Record<string, number>;
  ConsumoMensual: Record<string, Record<string, number>>;
  PotenciaConsumida: Record<string, Record<string, number>>;
}

/** Parsea una fecha en formato "DD/MM/YYYY" a un objeto Date */
const parseDMY = (dateStr: string): Date => {
  const parts = dateStr.split('/');
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
};
/** Formatea un objeto Date a "MM/YY" */
const formatMMYY = (date: Date): string => {
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString().slice(-2);
  return `${m}/${y}`;
};

const defaultMesesDelAño = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/**
 * Genera un array de 12 cabeceras "MM/YY" terminando en el mes/año dado.
 * @param lastMonth "08"
 * @param lastYear "25"
 * @returns ["09/24", "10/24", ..., "08/25"]
 */
const generateManualHeaders = (lastMonth: string, lastYear: string): string[] => {
    let m = parseInt(lastMonth, 10);
    let y = parseInt(lastYear, 10);
    if (isNaN(m) || isNaN(y)) return defaultMesesDelAño; // Fallback

    const headers: string[] = [];

    for (let i = 0; i < 12; i++) {
        headers.push(`${m.toString().padStart(2, '0')}/${y.toString().padStart(2, '0')}`);
        m--;
        if (m === 0) {
            m = 12;
            y--;
        }
    }
    return headers.reverse(); // Ordena del más antiguo al más reciente
};


const ComparativaForm: React.FC = () => {
  
  const todayISO = new Date().toISOString().split('T')[0]!;
  const today = new Date(); // 2025-11-01
  const currentYearFull = today.getFullYear(); // 2025
  const currentYearYY_Str = currentYearFull.toString().slice(-2); // "25"
  const currentMonthMM_Str = (today.getMonth() + 1).toString().padStart(2, '0'); // "11"

  // Opciones estáticas para todos los meses
  const allMonthOptions = React.useMemo(() => 
    Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')), 
  []);
  
  // Opciones de año (ej: 8 años atrás hasta hoy)
  const yearOptions = React.useMemo(() => 
    // Genera 8 años empezando por el actual (2025) y yendo hacia atrás (2025, 2024, ...)
    Array.from({ length: 8 }, (_, i) => (currentYearFull - i)) 
        .map(year => year.toString().slice(-2)), // Convierte a "YY" -> ["25", "24", ...]
  [currentYearFull]);
  
  // --- MODIFICADO: 'observaciones' eliminado ---
  const [datosSuministro, setDatosSuministro] = useState<DatosSuministro>({
    cups: "",
    titular: "",
    dniCif: "", 
    fechaEstudio: todayISO, 
    direccion: "",
    poblacion: "",
    iva: "21",
    impuestoElectrico: "5.1127",
    otrosConceptos: "",
  });

  const [modo, setModo] = useState<"idle" | "auto" | "manual">("idle");
  const [tarifa, setTarifa] = useState<Tarifa>("");
  
  const [datosAuto, setDatosAuto] = useState<SipsData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // --- (2) Estado para el PDF ---

  const [valoresTabla, setValoresTabla] = useState<Record<string, string>>({});
  const [dynamicMonthHeaders, setDynamicMonthHeaders] = useState<string[]>(defaultMesesDelAño);
  const [sipsFirstMonth, setSipsFirstMonth] = useState<string | null>(null);

  const [manualLastMonth, setManualLastMonth] = useState<string>("");
  const [manualLastYear, setManualLastYear] = useState<string>("");

  const dynamicMonthOptions = React.useMemo(() => {
    if (manualLastYear === currentYearYY_Str) {
      // Si es el año actual, filtrar meses hasta el actual
      return allMonthOptions.filter(m => m <= currentMonthMM_Str);
    }
    // Si es un año pasado (o no hay año seleccionado), mostrar todos
    return allMonthOptions;
  }, [manualLastYear, currentYearYY_Str, currentMonthMM_Str, allMonthOptions]);

  // Efecto para resetear el mes si se vuelve inválido
  // (Ej: si el usuario selecciona "12/24" y luego cambia el año a "25", el mes "12" es inválido)
  useEffect(() => {
    if (manualLastYear === currentYearYY_Str && manualLastMonth > currentMonthMM_Str) {
      setManualLastMonth(""); // Resetea el mes
    }
  }, [manualLastYear, manualLastMonth, currentYearYY_Str, currentMonthMM_Str]);

  const handleChangeSuministro = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDatosSuministro((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAutocompletar = async () => {
    try {
      setModo("auto");
      setCargando(true);
      setError(null);
      setValoresTabla({});
      setTarifa(""); 

      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const cups = datosSuministro.cups;

      if (!functionsUrl) {
        console.error('Falta VITE_SUPABASE_FUNCTIONS_URL');
        alert('No está configurada la URL de las funciones');
        setCargando(false);
        return;
      }

      const res = await fetch(`${functionsUrl}/logosenergia-sips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
        },
        body: JSON.stringify({ cups }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Error en función:', res.status, text);
        setError('No se han podido obtener los datos del CUPS.');
        setCargando(false);
        return;
      }

      const data = await res.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        setError('Respuesta inválida del servidor de SIPS.');
        setCargando(false);
        return;
      }

      const sipsData: SipsData = data[0];
      console.log('Datos SIPS transformados:', sipsData);

      setDatosAuto(sipsData);
      setTarifa(sipsData.Tarifa || "");

      const newValoresTabla: Record<string, string> = {};

      // 2a. Generar cabeceras de meses dinámicas (LÓGICA CORREGIDA)
      const allMonthKeys = [
        ...Object.keys(sipsData.ConsumoMensual), 
        ...Object.keys(sipsData.PotenciaConsumida)
      ];
      const uniqueMonthKeys = [...new Set(allMonthKeys)]; 

      const sortMMYY = (a: string, b: string) => {
        const [mA, yA] = a.split('/');
        const [mB, yB] = b.split('/');
        const dateA = new Date(Number('20' + yA), Number(mA) - 1);
        const dateB = new Date(Number('20' + yB), Number(mB) - 1);
        return dateA.getTime() - dateB.getTime();
      };
      
      const sortedHeaders = uniqueMonthKeys.sort(sortMMYY);
      // --- CORRECCIÓN: Usar los últimos 12 meses si hay más de 12 ---
      const newHeaders = sortedHeaders.length > 12 ? sortedHeaders.slice(-12) : sortedHeaders;

      const headerToIndexMap = new Map(newHeaders.map((h, i) => [h, i]));

      setDynamicMonthHeaders(newHeaders); 

      // 2b. Rellenar "Potencias contratadas"
      const potencias = sipsData.PotContratada;
      
      // --- (INICIO) MODIFICACIÓN LÓGICA TARIFAS 3.0/6.1 ---
      const esTarifaAlta = sipsData.Tarifa === '6.1TD' || sipsData.Tarifa === '3.0TD';
      const periodosPotencia = esTarifaAlta ? 6 : 2;
      const tablaPotencias = esTarifaAlta ? "Potencias contratadas (P1-P6)" : "Potencias contratadas (P1-P2)";
      // --- (FIN) MODIFICACIÓN LÓGICA TARIFAS ---
      
      // --- (FIX 1) CORRECCIÓN LÓGICA DE CLAVE ---
      for (let i = 1; i <= periodosPotencia; i++) {
          const periodName = `P${i}`; // "P1", "P2", etc.
          // La clave debe coincidir con la que espera TablaGenerica: ${titulo}__${filaIndex}__${colHeader}
          // Título = tablaPotencias, filaIndex = 0, colHeader = periodName ("P1", "P2"...)
          const key = `${tablaPotencias}__0__${periodName}`; // Usar el nombre del periodo
          newValoresTabla[key] = String(potencias[periodName] || '0');
      }
      // --- FIN FIX 1 ---

      // 2c. Rellenar "Energía consumida"
      const tablaEnergia = "Energía consumida (kWh)";
      const consumoMensual = sipsData.ConsumoMensual;
      
      // --- (INICIO) MODIFICACIÓN LÓGICA TARIFAS 3.0/6.1 ---
      const periodosEnergiaConsumo = esTarifaAlta ? 6 : 3;
      // --- (FIN) MODIFICACIÓN LÓGICA TARIFAS ---
      
      for (const [monthKey, consumos] of Object.entries(consumoMensual)) {
          // const colIndex = headerToIndexMap.get(monthKey); // Ya no necesitamos el índice aquí
          if (!headerToIndexMap.has(monthKey)) continue; // Solo comprobamos si está en las cabeceras visibles

          for (let i = 1; i <= periodosEnergiaConsumo; i++) { // <-- Usar variable corregida
              // --- CAMBIO CLAVE: Usar monthKey en lugar de colIndex ---
              const key = `${tablaEnergia}__${i-1}__${monthKey}`; 
              newValoresTabla[key] = String(consumos[`P${i}`] || '0');
          }
      }
      
      // 2d. Rellenar "Potencia consumida" (Maxímetro)
      const tablaPotenciaConsumida = "Lectura Maxímetro (kW) - Opcional";
      const potenciaConsumida = sipsData.PotenciaConsumida;

      // --- (INICIO) MODIFICACIÓN LÓGICA TARIFAS 3.0/6.1 ---
      const periodosEnergiaPotencia = esTarifaAlta ? 6 : 3;
      // --- (FIN) MODIFICACIÓN LÓGICA TARIFAS ---
      
      for (const [monthKey, potencias] of Object.entries(potenciaConsumida)) {
          // const colIndex = headerToIndexMap.get(monthKey); // Ya no necesitamos el índice aquí
          if (!headerToIndexMap.has(monthKey)) continue; // Solo comprobamos si está en las cabeceras visibles

          for (let i = 1; i <= periodosEnergiaPotencia; i++) { // <-- Usar variable corregida
              // --- CAMBIO CLAVE: Usar monthKey en lugar de colIndex ---
              const key = `${tablaPotenciaConsumida}__${i-1}__${monthKey}`;
              newValoresTabla[key] = String(potencias[`P${i}`] || '0');
          }
      }

      setSipsFirstMonth(newHeaders[0] || null); // <-- AÑADIR: Guardar primer mes
      setValoresTabla(newValoresTabla);

    } catch (err) {
      console.error(err);
      setError('Error al conectar con el backend.');
    } finally {
      setCargando(false);
    }
  };

  const handleRellenarManual = () => {
    setModo("manual");
    setError(null);
    setTarifa("");
    setDatosAuto(null);
    setValoresTabla({});
    setDynamicMonthHeaders(defaultMesesDelAño);
    setManualLastMonth("");
    setManualLastYear("");
    setSipsFirstMonth(null); // <-- AÑADIR
  };

  const handleAvanzarMes = () => {
    // 1. Calcular el nuevo mes
    const lastHeader = dynamicMonthHeaders[dynamicMonthHeaders.length - 1];
    // No hacer nada si las cabeceras no son "MM/YY" (modo SIPS sin datos o modo manual inicial)
    if (!lastHeader || !lastHeader.includes('/')) return; 

    const [lastMonth, lastYear] = lastHeader.split('/');
    let m = parseInt(lastMonth!, 10);
    let y = parseInt(lastYear!, 10);

    m++; // Avanzar un mes
    if (m > 12) {
        m = 1;
        y++; // Avanzar un año
    }

    // Formatear el nuevo header
    const newHeader = `${m.toString().padStart(2, '0')}/${y.toString().padStart(2, '0')}`;

    // 2. Actualizar headers (quitar primero, añadir nuevo al final)
    const newHeaders = [...dynamicMonthHeaders.slice(1), newHeader];
    setDynamicMonthHeaders(newHeaders);
  };

  // --- (1) AÑADIR NUEVA FUNCIÓN 'handleRetrocederMes' ---
  const handleRetrocederMes = () => {
    // 1. Calcular el nuevo mes (anterior)
    const firstHeader = dynamicMonthHeaders[0];
    if (!firstHeader || !firstHeader.includes('/')) return;

    const [firstMonth, firstYear] = firstHeader.split('/');
    let m = parseInt(firstMonth!, 10);
    let y = parseInt(firstYear!, 10);

    m--; // Retroceder un mes
    if (m < 1) {
        m = 12;
        y--; // Retroceder un año
    }

    const newHeader = `${m.toString().padStart(2, '0')}/${y.toString().padStart(2, '0')}`;

    // 2. Actualizar headers (quitar último, añadir nuevo al principio)
    const newHeaders = [newHeader, ...dynamicMonthHeaders.slice(0, -1)];
    setDynamicMonthHeaders(newHeaders);
  };
  // --- FIN (1) ---

  useEffect(() => {
      if (modo === "manual" && tarifa && manualLastMonth && manualLastYear) {
          const headers = generateManualHeaders(manualLastMonth, manualLastYear);
          setDynamicMonthHeaders(headers);
          setValoresTabla({});
      } else if (modo === "manual") {
          setDynamicMonthHeaders(defaultMesesDelAño);
      }
  }, [modo, tarifa, manualLastMonth, manualLastYear]);


  // --- (FIX 2) CORRECCIÓN LÓGICA DE CLAVE (recibe colHeader) ---
  const handleChangeCelda = (
    tabla: string,
    fila: number,
    colHeader: string, // <-- (FIX 2) Ahora recibimos el string del header
    valor: string
  ) => {
    // Ya no se necesita traducción de índice
    const key = `${tabla}__${fila}__${colHeader}`; // <-- Usar cabecera directamente
    setValoresTabla((prev) => ({
      ...prev,
      [key]: valor,
    }));
  };
  // --- FIN FIX 2 ---
  
  // --- (3) INICIO: LÓGICA DE GENERACIÓN DE PDF ---

  /** Helper para parsear números de forma segura desde el estado */
  const z = (val: string | undefined | null) => Number(val || '0') || 0;

  /** Helper para obtener las claves de periodo correctas según la tarifa */
  const getPeriodKeys = (t: Tarifa) => {
    const esTarifaAlta = t === '6.1TD' || t === '3.0TD';
    // Claves de Potencia ("P1", "P2", ...)
    const potPeriodKeys = esTarifaAlta ? ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] : ['P1', 'P2'];
    // Claves de Energía para el JSON ("E1", "E2", ...)
    const engPeriodKeys = esTarifaAlta ? ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'] : ['E1', 'E2', 'E3'];
    // Claves de Energía como se usan en las tablas ("P1", "P2", ...)
    const engTableKeys = engPeriodKeys.map((_, i) => `P${i + 1}`); // [P1, P2, P3...]
    
    return { potPeriodKeys, engPeriodKeys, engTableKeys };
  };
  
  /** Construye el objeto JSON para la API del PDF */
  const buildPdfJson = () => {
    if (!tarifa) {
      toast.error("Selecciona una tarifa antes de generar el PDF.");
      return null;
    }
    
    const { potPeriodKeys, engPeriodKeys, engTableKeys } = getPeriodKeys(tarifa);
    
    // 1. energia_kwh_mes
    const tablaEnergiaKey = "Energía consumida (kWh)";
    const energia_kwh_mes: Record<string, number[]> = {};
    
    engPeriodKeys.forEach((jsonKey, idx) => {
      const filaIndex = idx; // P1 es fila 0, P2 es fila 1...
      // Mapea sobre las 12 cabeceras de meses (dynamicMonthHeaders)
      energia_kwh_mes[jsonKey] = dynamicMonthHeaders.map(header => {
        const val = valoresTabla[`${tablaEnergiaKey}__${filaIndex}__${header}`];
        return z(val);
      });
    });

    const energia_kwh: Record<string, number> = {};
    for (const periodo in energia_kwh_mes) {
      energia_kwh[periodo] = (energia_kwh_mes[periodo] || []).reduce((acc, val) => acc + val, 0);
    }

    // 2. potencia_contratada_kw
    const tablaPotKey = tarifa === '2.0TD' ? "Potencias contratadas (P1-P2)" : "Potencias contratadas (P1-P6)";
    const potencia_contratada_kw: Record<string, number> = {};
    
    potPeriodKeys.forEach(periodKey => {
      const val = valoresTabla[`${tablaPotKey}__0__${periodKey}`];
      potencia_contratada_kw[periodKey] = z(val);
    });

    // 3. actual y propuesta (con helper)
    const getPriceData = (type: '(Actual)' | '(Ofrecido)') => {
      const potTablaKey = `Término potencia ${type}`;
      const engTablaKey = `Término energía ${type}`;
      
      const precio_potencia: Record<string, number> = {};
      potPeriodKeys.forEach(periodKey => {
         const val = valoresTabla[`${potTablaKey}__0__${periodKey}`];
         precio_potencia[periodKey] = z(val);
      });
      
      const precio_energia: Record<string, number> = {};
      engPeriodKeys.forEach((jsonKey, idx) => {
        const colKey = engTableKeys[idx]; // P1, P2...
        const val = valoresTabla[`${engTablaKey}__0__${colKey}`];
        precio_energia[jsonKey] = z(val);
      });
      
      // El cargo fijo es el mismo para ambos, viene de datosSuministro
      const cargos_fijos_anual_eur = z(datosSuministro.otrosConceptos);

      return { nombre: "", precio_potencia, precio_energia, cargos_fijos_anual_eur };
    };

    // 4. Impuestos
    const iva_pct = z(datosSuministro.iva) / 100;
    const impuesto_electricidad_pct = z(datosSuministro.impuestoElectrico) / 100;
    
    // 5. Suministro
    const suministro = {
      direccion: datosSuministro.direccion,
      poblacion: datosSuministro.poblacion,
      cif: datosSuministro.dniCif, // Mapeado desde dniCif
      fecha_estudio: datosSuministro.fechaEstudio,
      cups: datosSuministro.cups,
      nombre_cliente: datosSuministro.titular, // Mapeado desde titular
      // 'poblacion' no está en datosSuministro, se omite
    };

    // 6. Ensamblar JSON final
    return {
      tarifa,
      energia_kwh_mes,
      energia_kwh,
      potencia_contratada_kw,
      actual: getPriceData('(Actual)'),
      propuesta: getPriceData('(Ofrecido)'),
      iva_pct: isNaN(iva_pct) ? 0.21 : iva_pct, // Default
      impuesto_electricidad_pct: isNaN(impuesto_electricidad_pct) ? 0.051127 : impuesto_electricidad_pct, // Default
      suministro,
    };
  };

  /** Manejador del clic en el botón "Generar PDF" */
  const handleGeneratePdf = async () => {
    const payload = buildPdfJson();
    
    if (!payload) {
      return; // buildPdfJson ya mostró un toast de error
    }
    
    setIsGeneratingPdf(true);
    const pdfUrl = "https://pdf-generator-service-481260464317.europe-west1.run.app/generate-report";
    const authToken = "tyXk7pM355t2yYmeqEOc0hIMMJYYZ5dPL0SXwpVdVHo=";

    try {
      // console.log("Enviando JSON para PDF:", JSON.stringify(payload, null, 2));

      const response = await fetch(pdfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth-Token': authToken,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Intentar leer el error del cuerpo si es posible
        const errorText = await response.text();
        console.error("Error del servidor PDF:", errorText);
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }

      const blob = await response.blob();
      
      if (blob.type !== 'application/pdf') {
        throw new Error("La respuesta del servidor no fue un archivo PDF.");
      }

      // Usar file-saver para descargar el PDF
      saveAs(blob, `comparativa_${datosSuministro.cups || 'report'}.pdf`);
      toast.success("PDF generado con éxito.");

    } catch (err: any) {
      console.error("Error al generar PDF:", err);
      toast.error(`Error al generar PDF: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  // --- (3) FIN: LÓGICA DE GENERACIÓN DE PDF ---


  // --- (INICIO) MODIFICACIÓN renderTablasTarifa_20_30 ---
  const renderTablasTarifa_20_30 = () => {
    const esEditable = modo === "manual" || modo === "auto";
    const puedeAvanzar = modo === "auto" || (modo === "manual" && tarifa && manualLastMonth && manualLastYear);
    const canRetroceder = puedeAvanzar && (
        modo === 'manual' || 
        !sipsFirstMonth || 
        (dynamicMonthHeaders[0] !== sipsFirstMonth)
    );
    const dangerColor = "var(--danger-color, #DC2626)"; // Color rojo
    const warningColor = "#f39b03"; // Color amarillo/ámbar

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>

        <div style={{ marginTop: '1rem' }}>
           <TablaGenerica
            titulo="Potencias contratadas (P1-P2)"
            icon={<Cog size={18} />}
            accentColor="var(--muted)"
            columnas={["P1", "P2"]}
            filas={[["", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>        
        {/* Fila 1 (Bloque Consumos, Vertical) */}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', paddingLeft: '0.5rem', marginTop: 0, marginBottom: '0.5rem' }}>
            Detalle mensual según la tarifa. {modo === 'manual' ? 'Valores editables.' : 'Valores autocompletados.'}
          </p>
          <TablaGenerica
            titulo="Energía consumida (kWh)"
            icon={<Zap size={18} />}
            accentColor="var(--primary)"
            columnas={dynamicMonthHeaders}
            filas={[
              ["P1", ...Array(dynamicMonthHeaders.length).fill("")],
              ["P2", ...Array(dynamicMonthHeaders.length).fill("")],
              ["P3", ...Array(dynamicMonthHeaders.length).fill("")],
            ]}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
            onAddColumn={puedeAvanzar ? handleAvanzarMes : undefined}
            onRemoveColumn={canRetroceder ? handleRetrocederMes : undefined}
          />
          <TablaGenerica
            titulo="Lectura Maxímetro (kW) - Opcional"
            icon={<Zap size={18} />}
            accentColor="var(--primary)"
            columnas={dynamicMonthHeaders}
            filas={[
              ["P1", ...Array(dynamicMonthHeaders.length).fill("")],
              ["P2", ...Array(dynamicMonthHeaders.length).fill("")],
              ["P3", ...Array(dynamicMonthHeaders.length).fill("")],
            ]}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>

        {/* Fila 2 (Bloque Precios, 2x2 Grid) */}
        {/* Usamos form-row que es un grid de 2 columnas (1fr 1fr) */}
        <div className="form-row">
          
          {/* Columna Izquierda: Precios (Actual) */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término potencia"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Color Rojo
              columnas={["P1", "P2"]} // <-- 2 CAMPOS
              filas={[["", ""]]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
            <TablaGenerica
              titulo="Término energía"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Color Rojo
              columnas={["P1", "P2", "P3"]} // <-- 3 CAMPOS
              filas={[["", "", ""]]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
          
          {/* Columna Derecha: Precios (Ofrecido) */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término potencia"
              tituloOfrecido="(Ofrecido)" // Título rojo
              icon={<Euro size={18} />}
              accentColor={warningColor} // Color Amarillo
              columnas={["P1", "P2"]} // <-- 2 CAMPOS
              filas={[["", ""]]}
              editable={true} // El ofrecido siempre es editable
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
            <TablaGenerica
              titulo="Término energía"
              tituloOfrecido="(Ofrecido)" // Título rojo
              icon={<Euro size={18} />}
              accentColor={warningColor} // Color Amarillo
              columnas={["P1", "P2", "P3"]} // <-- 3 CAMPOS
              filas={[["", "", ""]]}
              editable={true} // El ofrecido siempre es editable
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
        </div>
      </div>
    );
  };
  // --- (FIN) MODIFICACIÓN renderTablasTarifa_20_30 ---

  // --- (INICIO) MODIFICACIÓN renderTablasTarifa_61 ---
  const renderTablasTarifa_61 = () => {
    const esEditable = modo === "manual" || modo === "auto";
    const puedeAvanzar = modo === "auto" || (modo === "manual" && tarifa && manualLastMonth && manualLastYear);
    const canRetroceder = puedeAvanzar && (
        modo === 'manual' || 
        !sipsFirstMonth || 
        (dynamicMonthHeaders[0] !== sipsFirstMonth)
    );
    const dangerColor = "var(--danger-color, #DC2626)"; // Color rojo
    const warningColor = "#f39b03"; // Color amarillo/ámbar

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ marginTop: '1rem' }}>
          <TablaGenerica
            titulo="Potencias contratadas (P1-P6)"
            icon={<Cog size={18} />}
            accentColor="var(--muted)"
            columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
            filas={[["", "", "", "", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>
        
        {/* Fila 1 (Bloque Consumos, Vertical) */}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', paddingLeft: '0.5rem', marginTop: 0, marginBottom: '0.5rem' }}>
            Detalle mensual según la tarifa. {modo === 'manual' ? 'Valores editables.' : 'Valores autocompletados.'}
          </p>
          <TablaGenerica
            titulo="Energía consumida (kWh)"
            icon={<Zap size={18} />}
            accentColor="var(--primary)"
            columnas={dynamicMonthHeaders}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p, ...Array(dynamicMonthHeaders.length).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
            onAddColumn={puedeAvanzar ? handleAvanzarMes : undefined}
            onRemoveColumn={canRetroceder ? handleRetrocederMes : undefined}
          />
          <TablaGenerica
            titulo="Lectura Maxímetro (kW) - Opcional"
            icon={<Zap size={18} />}
            accentColor="var(--primary)"
            columnas={dynamicMonthHeaders}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p, ...Array(dynamicMonthHeaders.length).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>
        
        {/* Fila 2 (Bloque Precios, 2x2 Grid) */}
        <div className="form-row"> {/* 2 columnas (Actual | Ofrecido) */}
          
          {/* Columna Izquierda: Precios (Actual) */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término potencia"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Rojo
              columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
              filas={[Array(6).fill("")]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
            <TablaGenerica
              titulo="Término energía"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Rojo
              columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
              filas={[Array(6).fill("")]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
          
          {/* Columna Derecha: Precios (Ofrecido) */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término potencia"
              tituloOfrecido="(Ofrecido)"
              icon={<Euro size={18} />}
              accentColor={warningColor} // Amarillo
              columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
              filas={[Array(6).fill("")]}
              editable={true} // Siempre editable
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
            <TablaGenerica
              titulo="Término energía"
              tituloOfrecido="(Ofrecido)"
              icon={<Euro size={18} />}
              accentColor={warningColor} // Amarillo
              columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
              filas={[Array(6).fill("")]}
              editable={true} // Siempre editable
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
        </div>
      </div>
    );
  };
  // --- (FIN) MODIFICACIÓN renderTablasTarifa_61 ---

  const renderZonaTablas = () => {
    if (cargando && modo === "auto") {
            return (
                <div 
                  className="text-center p-8"
                  style={{
                    display: 'flex',
                    flexDirection: 'column', // Apila el icono y el texto
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem', // Espacio entre el icono y el texto
                    color: 'var(--muted)', // Usa el color de texto silenciado
                    padding: '2rem' // Asegura un buen padding
                  }}
                >
                    {/* 1. Añade el icono Loader2 con la animación de giro */}
                    <Loader2 className="animate-spin" size={32} />
                    
                    {/* 2. Añade la clase 'pulsing-text' al párrafo */}
                    <p className="pulsing-text" style={{ margin: 0, fontWeight: 500, fontSize: '1.1rem' }}>
                      Consultando SIPS...
                    </p>
                </div>
            )
    }
    
    if (!tarifa || (modo === "manual" && (!manualLastMonth || !manualLastYear))) {
      return (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
          {modo === "manual"
            ? "Selecciona tarifa y último mes para ver las tablas."
            : "Autocompleta o rellena manually para ver las tablas."
          }
        </p>
      );
    }

    // --- (INICIO) MODIFICACIÓN LÓGICA DE RENDERIZADO ---
    if (tarifa === "2.0TD") {
      return renderTablasTarifa_20_30();
    }

    if (tarifa === "3.0TD" || tarifa === "6.1TD") {
      return renderTablasTarifa_61();
    }
    // --- (FIN) MODIFICACIÓN LÓGICA DE RENDERIZADO ---

    return null;
  };

  // --- (REQ 1) Estilo para los chips de modo ---
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 500,
    lineHeight: 1.4
  };

  const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border-color)', // Borde estándar
    borderRadius: '0.5rem', // Borde redondeado estándar
    backgroundColor: 'white', // Fondo blanco estándar
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', // Sombra interna sutil
  };

  const inputInGroupStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    padding: '0.65rem 0.8rem', // Padding estándar
    width: '100%',
    flex: 1,
    boxShadow: 'none',
    outline: 'none',
    fontSize: '0.95rem', // Tamaño de fuente estándar
  };

  const suffixStyle: React.CSSProperties = {
    paddingRight: '0.8rem',
    color: 'var(--muted)',
    fontWeight: 500,
    fontSize: '0.9rem',
  };

  return (
    <div className="grid p-6 space-y-6"> 

      {/* 2. Añade el título estándar de la página */}
      <div className="page-header">
        <h2 style={{ margin: 0 }}>Comparativas</h2>
         <div className="page-actions"></div>
      </div>

      {/* 3. Envuelve los datos del suministro en su propia tarjeta 'card' */}
      <div className="card">
        
        {/* 4. Usa un título de sección (h3) para "Datos del suministro" */}
        <h3 className="section-title" style={{ 
            marginTop: 0, 
            borderBottom: 'none', // Quitamos la línea si no la quieres
            paddingBottom: 0,     // Quitamos padding
            marginBottom: '1.5rem' // Añadimos espacio antes del formulario
          }}>
          Datos del suministro
        </h3>
        
        {/* --- INICIO: SECCIÓN MODIFICADA (SIN TAILWIND) --- */}
        {/* Usamos un grid CSS simple (gap) para apilar las filas */}
        <div style={{ display: 'grid', gap: '1rem' }}> {/* Ajusta '1rem' si usas otra variable */}
          
          {/* Fila 1: Titular y DNI/CIF */}
          <div className="form-row" style={{ gap: '1rem' }}> {/* Reutilizamos form-row para las 2 columnas */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="titular">
                Titular
              </label>
              <input
                id="titular"
                name="titular"
                value={datosSuministro.titular}
                onChange={handleChangeSuministro}
                className="w-full border rounded-md px-3 py-2 text-sm" // Estas clases parecen ser custom
                placeholder="Nombre del titular"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="dniCif">
                DNI/CIF
              </label>
              <input
                id="dniCif"
                name="dniCif"
                value={datosSuministro.dniCif}
                onChange={handleChangeSuministro}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="DNI o CIF del titular"
              />
            </div>
          </div>

          {/* Fila 2: Dirección (Ocupa todo el ancho) */}
          <div className="form-row" style={{ gap: '1rem' }}>
            {/* Campo Dirección (sin CP/municipio) */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="direccion">
                Dirección (Calle y Número)
              </label>
              <input
                id="direccion"
                name="direccion"
                value={datosSuministro.direccion}
                onChange={handleChangeSuministro}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Calle, número, piso..."
              />
            </div>
            {/* Campo Población (NUEVO) */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="poblacion">
                Población (CP y Municipio)
              </label>
              <input
                id="poblacion"
                name="poblacion"
                value={datosSuministro.poblacion}
                onChange={handleChangeSuministro}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Ej: 28001 Madrid"
              />
            </div>
          </div>

          {/* Fila 3: CUPS y Fecha de Estudio */}
          <div className="form-row" style={{ gap: '1rem' }}> {/* Reutilizamos form-row */}
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="cups">CUPS</label>
              <input
                type="text"
                id="cups"
                name="cups"
                value={datosSuministro.cups}
                onChange={handleChangeSuministro}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="ES00XXXXXXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="fechaEstudio">
                Fecha de estudio
              </label>
              <input
                type="date"
                id="fechaEstudio"
                name="fechaEstudio"
                value={datosSuministro.fechaEstudio}
                onChange={handleChangeSuministro}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', // 3 columnas
            gap: '1rem' 
          }}>
            
            {/* 1. IVA */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="iva">IVA</label>
              <div style={inputGroupStyle}>
                <input
                  type="text"
                  inputMode="decimal"
                  id="iva"
                  name="iva"
                  value={datosSuministro.iva}
                  onChange={handleChangeSuministro}
                  placeholder="21.00"
                  style={inputInGroupStyle}
                />
                <span style={suffixStyle}>%</span>
              </div>
            </div>

            {/* 2. IMPUESTO ELÉCTRICO */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="impuestoElectrico">Impuesto eléctrico</label>
              <div style={inputGroupStyle}>
                <input
                  type="text"
                  inputMode="decimal"
                  id="impuestoElectrico"
                  name="impuestoElectrico"
                  value={datosSuministro.impuestoElectrico}
                  onChange={handleChangeSuministro}
                  placeholder="5.1127"
                  style={inputInGroupStyle}
                />
                <span style={suffixStyle}>%</span>
              </div>
            </div>

            {/* 3. OTROS CONCEPTOS */}
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="otrosConceptos">Otros conceptos</label>
              <div style={inputGroupStyle}>
                <input
                  type="text"
                  inputMode="decimal"
                  id="otrosConceptos"
                  name="otrosConceptos"
                  value={datosSuministro.otrosConceptos}
                  onChange={handleChangeSuministro}
                  placeholder="0.00"
                  style={inputInGroupStyle}
                />
                <span style={suffixStyle}>€</span>
              </div>
            </div>

          </div>
            
        </div>
        {/* --- FIN: SECCIÓN MODIFICADA --- */}
        
      </div>


      {/* BOTONES */}
      {/* --- (REQ 1) DIV MODIFICADO CON CHIPS DE MODO --- */}
      <div 
        style={{ 
          display: 'flex',
          flexWrap: 'wrap', // Para que los chips se ajusten en móvil
          gap: '1rem',
          marginTop: '1rem', 
          marginBottom: '1.5rem', // <-- AÑADIDO MÁRGEN
          justifyContent: 'space-between', // Separa botones y chips
          alignItems: 'center'
        }}
      >
        {/* Grupo de botones a la izquierda */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleAutocompletar}
            disabled={cargando || !datosSuministro.cups}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
            title={!datosSuministro.cups ? "Introduce un CUPS para autocompletar" : ""}
          >
            {cargando && modo === "auto" ? "Consultando..." : "Autocompletar"}
          </button>
          <button
            type="button"
            onClick={handleRellenarManual}
            disabled={cargando}
            className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 py-2 rounded-md disabled:opacity-50"
          >
            Rellenar manualmente
          </button>
        </div>

        {/* Grupo de chips a la derecha (visible solo si hay un modo) */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {modo === 'auto' && (
            <span style={{...chipStyle, backgroundColor: 'var(--primary-light)', color: 'var(--primary-600)'}}>
              <Zap size={14} /> Autocompletado
            </span>
          )}
          {modo === 'manual' && (
            <span style={{...chipStyle, backgroundColor: '#FFFBEB', color: '#B45309'}}>
              <Pencil size={14} /> Manual
            </span>
          )}
        </div>
      </div>
      {/* --- FIN DIV MODIFICADO --- */}


      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* Interfaz de selección MODO MANUAL */}
      {modo === "manual" ? (
        <div className="card"> {/* Usamos card para consistencia */}
          
          {/* --- (INICIO) BLOQUE MODIFICADO --- */}
          {/* Usamos un grid de 3 columnas (1fr 1fr 1fr) con 1rem de gap */}
          <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', // Tres columnas de igual ancho
              gap: '1rem',                         // Separación de 1rem
              alignItems: 'flex-end'             // Alinea elementos al final (como antes)
          }}>
            
            {/* Columna 1: Tarifa */}
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-tarifa">1. Selecciona la tarifa</label>
              <select
                id="manual-tarifa" 
                value={tarifa}
                onChange={(e) => setTarifa(e.target.value as Tarifa)}
                className="border rounded-md px-3 py-2 text-sm mt-1"
                style={{ width: '100%' }} // Asegura que ocupe el 1fr
              >
                <option value="">-- Selecciona --</option>
                <option value="2.0TD">2.0TD</option>
                <option value="3.0TD">3.0TD</option>
                <option value="6.1TD">6.1TD</option>
              </select>
            </div>
            
            {/* Columna 2: Último Mes */}
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-mes">2. Último mes (MM)</label>
              <select
                id="manual-mes"
                value={manualLastMonth}
                onChange={(e) => setManualLastMonth(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm mt-1"
                disabled={!tarifa}
                title={!tarifa ? "Selecciona una tarifa primero" : "Mes"}
                style={{ width: '100%' }} // Asegura que ocupe el 1fr
              >
                <option value="">Mes</option>
                {dynamicMonthOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            {/* Columna 3: Último Año */}
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-ano">3. Último año (YY)</label>
              <select
                id="manual-ano"
                value={manualLastYear}
                onChange={(e) => setManualLastYear(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm mt-1"
                disabled={!tarifa}
                title={!tarifa ? "Selecciona una tarifa primero" : "Año"}
                style={{ width: '100%' }} // Asegura que ocupe el 1fr
              >
                <option value="">Año</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
          </div>
          {/* --- (FIN) BLOQUE MODIFICADO --- */}

          <p className="text-xs text-gray-500 mt-2" style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            En función de la tarifa y el mes se mostrarán las tablas.
          </p>
        </div>
      // --- (FIN) CORRECCIÓN BUG LABEL ---
      // Mostrar tarifa en MODO AUTO
      ) : (modo === "auto" && tarifa) ? (
        <div className="card" style={{ padding: '1rem' }}>
            <p className="text-sm font-medium text-gray-700" style={{ margin: 0, fontSize: '0.9rem' }}>
                Tarifa detectada (SIPS): <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1rem' }}>{tarifa}</span>
            </p>
        </div>
      ) : null}


      {/* TABLAS */}
      {/* (REQ 2 y 3) El layout se aplica en las funciones renderTablas... */}
      <div className="comparativa-tablas-layout">{renderZonaTablas()}</div>

      {/* BOTÓN PDF */}
      <div className="flex justify-end" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        {/* --- (4) BOTÓN PDF MODIFICADO --- */}
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf || !tarifa}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isGeneratingPdf ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileDown size={18} />
          )}
          {isGeneratingPdf ? 'Generando...' : 'Generar PDF'}
        </button>
        {/* --- FIN BOTÓN PDF --- */}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Tabla genérica - MODIFICADA
// -----------------------------------------------------------------------------
interface TablaGenericaProps {
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
  mostrarPrimeraColumnaComoFila?: boolean;
  editable?: boolean;
  valores?: Record<string, string>;
  onChangeCell?: (
    tabla: string,
    fila: number,
    colHeader: string, // <-- (FIX 2) Cambiado de col (number) a colHeader (string)
    valor: string
  ) => void;
  onAddColumn?: () => void;
  onRemoveColumn?: () => void;
  // --- (REQ 4) Nuevas props de estilo ---
  icon: React.ReactNode;
  accentColor: string;
  tituloActual?: string; // Prop opcional para el texto "(Actual)"
  tituloOfrecido?: string; // Prop opcional para el texto "(Ofrecido)"
}

// --- (REQ 6) Mapa de colores para los periodos ---
const periodColors = [
  '#2BB673', // P1 (Verde)
  '#2E87E5', // P2 (Azul)
  '#f39b03', // P3 (Ámbar)
  '#DC2626', // P4 (Rojo)
  '#8B5CF6', // P5 (Morado)
  '#64748b', // P6 (Gris)
];

const TablaGenerica: React.FC<TablaGenericaProps> = ({
  titulo,
  columnas,
  filas,
  mostrarPrimeraColumnaComoFila = false,
  editable = false,
  valores = {},
  onChangeCell,
  onAddColumn,
  onRemoveColumn,
  // --- (REQ 4) Recibir nuevas props ---
  icon,
  accentColor,
  tituloActual, // Recibir título actual
  tituloOfrecido, // Recibir título ofrecido
}) => {
  const esTablaMensual = (titulo.startsWith("Energía consumida") || titulo.startsWith("Lectura Maxímetro")) && columnas[0]?.includes('/');
  
  const buttonStyle: React.CSSProperties = {
    background: 'none', 
    border: 'none', 
    cursor: 'pointer', 
    color: 'var(--primary, #10B981)',
    lineHeight: 1,
    padding: '2px'
  };

  const svgIconStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  
  // Estilo para el texto "(Ofrecido)"
  const suffixStyle: React.CSSProperties = {
    color: accentColor,
    fontSize: '0.9em',
    fontWeight: 500,
    marginLeft: '0.4rem'
  };

  return (
    // --- (REQ 4 y 8) Estilo de Tarjeta/Bloque ---
    <div style={{
      backgroundColor: 'var(--bg-muted)', // Fondo gris muy pálido
      borderRadius: '12px',
      overflow: 'hidden',
      borderTop: `4px solid ${accentColor}`,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    }}>
      
      {/* --- (REQ 4) Título con icono --- */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1rem', // Más padding
          color: 'var(--fg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ color: accentColor }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>
            {titulo}
            {/* Añadir el span (Actual) si existe */}
            {tituloActual && <span style={suffixStyle}>{tituloActual}</span>}
            {/* Añadir el span (Ofrecido) si existe */}
            {tituloOfrecido && <span style={suffixStyle}>{tituloOfrecido}</span>}
          </span>
        </div>
        
        {esTablaMensual && (onAddColumn || onRemoveColumn) && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {onRemoveColumn && (
              <button
                type="button"
                onClick={onRemoveColumn}
                title="Retroceder un mes"
                className="p-1 rounded-full hover:bg-slate-200"
                style={{...buttonStyle, color: 'var(--muted)'}}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={svgIconStyle}>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            )}
            {onAddColumn && (
              <button
                type="button"
                onClick={onAddColumn}
                title="Avanzar un mes"
                className="p-1 rounded-full hover:bg-slate-200"
                style={{...buttonStyle, color: 'var(--muted)'}}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={svgIconStyle}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Contenedor de la tabla con overflow */}
      <div className="overflow-auto" style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
        <table className="min-w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'transparent' }}>
            <tr>
              {mostrarPrimeraColumnaComoFila ? (
                <th className="px-2 py-1 text-left" style={{ padding: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>Periodo</th>
              ) : null}
              {columnas.map((col, index) => (
                <th key={`${col}-${index}`} className="px-2 py-1 text-left" style={{ padding: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white" style={{ backgroundColor: 'var(--bg-card)' }}>
            {filas.map((fila, filaIndex) => (
              <tr 
                key={filaIndex}
                // --- (REQ 6) Borde de color por periodo ---
                style={mostrarPrimeraColumnaComoFila ? {
                  borderLeft: `4px solid ${periodColors[filaIndex % periodColors.length]}`
                } : {}}
              >
                {mostrarPrimeraColumnaComoFila ? (
                  <td className="px-2 py-1 font-semibold" style={{ padding: '0.5rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                    {String(fila[0])}
                  </td>
                ) : null}
                
                {columnas.map((colHeader, colIndex) => { // <-- Obtener colHeader y colIndex
                  
                  // --- (FIX 1) CORRECCIÓN LÓGICA DE CLAVE ---
                  // La clave se construye con el Título, el índice de Fila y el String de la Cabecera de Columna
                  
                  // --- (INICIO) MODIFICACIÓN NOMBRE DE CLAVE ---
                  // Si el título tiene (Ofrecido), usamos el título base para la clave,
                  // para que ambas tablas (Actual y Ofrecido) escriban en campos diferentes.
                  const baseTitulo = tituloActual ? `${titulo} ${tituloActual}` :
                                     tituloOfrecido ? `${titulo} ${tituloOfrecido}` : 
                                     titulo;
                  const key = `${baseTitulo}__${filaIndex}__${colHeader}`;
                  // --- (FIN) MODIFICACIÓN NOMBRE DE CLAVE ---
                  
                  
                  const originalCeldaValue = (fila[colIndex + (mostrarPrimeraColumnaComoFila ? 1 : 0)] as string) || "";
                  
                  // Leer el valor del estado usando la clave con cabecera
                  const value = valores[key] !== undefined ? valores[key] : originalCeldaValue;

                    return (
                      <td key={colIndex} className="px-2 py-1" style={{ padding: '0', border: '1px solid var(--border-color)' }}>
                        {editable ? (
                          <input
                            value={value}
                            onChange={(e) =>
                              onChangeCell &&
                              // --- (FIX 2) CORRECCIÓN HANDLER ---
                              onChangeCell(
                                baseTitulo, // <-- (INICIO) MODIFICACIÓN NOMBRE DE CLAVE
                                filaIndex,
                                colHeader, // <-- (FIX 2) Pasamos el string del header
                                e.target.value
                              )
                            }
                            // --- (REQ 4) Estilo de celda ---
                            className="w-full border rounded-sm px-1 py-0.5 text-xs" // Mantenemos clases base
                            style={{ 
                              fontSize: '0.8rem', 
                              padding: '0.4rem 0.5rem', // Ajustamos padding vertical
                              textAlign: 'right',
                              backgroundColor: 'transparent', // Fondo transparente
                              border: 'none', // Quitamos el borde del input
                              boxShadow: 'none', // Quitamos cualquier sombra
                              borderRadius: '0', // Quitamos el redondeo del input
                              width: '100%',
                              height: '100%' // Hacemos que ocupe toda la celda
                            }}
                          />
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparativaForm;