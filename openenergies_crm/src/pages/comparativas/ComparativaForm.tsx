// openenergies_crm/src/pages/comparativas/ComparativaForm.tsx
import React, { useState, useEffect } from "react";

type Tarifa = "2.0TD" | "3.0TD" | "6.1TD" | "";

// --- MODIFICADO: 'observaciones' eliminado ---
interface DatosSuministro {
  cups: string;
  titular: string;
  dniCif: string; 
  fechaEstudio: string; 
  direccion: string;
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

const monthOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const currentYearYY = new Date().getFullYear();
const yearOptions = Array.from({ length: 8 }, (_, i) => (currentYearYY - 3 + i).toString().slice(-2));

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
  
  // --- MODIFICADO: 'observaciones' eliminado ---
  const [datosSuministro, setDatosSuministro] = useState<DatosSuministro>({
    cups: "",
    titular: "",
    dniCif: "", 
    fechaEstudio: todayISO, 
    direccion: "",
  });

  const [modo, setModo] = useState<"idle" | "auto" | "manual">("idle");
  const [tarifa, setTarifa] = useState<Tarifa>("");
  
  const [datosAuto, setDatosAuto] = useState<SipsData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [valoresTabla, setValoresTabla] = useState<Record<string, string>>({});
  const [dynamicMonthHeaders, setDynamicMonthHeaders] = useState<string[]>(defaultMesesDelAño);
  const [sipsFirstMonth, setSipsFirstMonth] = useState<string | null>(null);

  const [manualLastMonth, setManualLastMonth] = useState<string>("");
  const [manualLastYear, setManualLastYear] = useState<string>("");

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
      const esTarifa61 = sipsData.Tarifa === '6.1TD';
      const periodosPotencia = esTarifa61 ? 6 : 2;
      const tablaPotencias = esTarifa61 ? "Potencias contratadas (P1-P6)" : "Potencias contratadas (P1-P2)";
      
      for (let i = 1; i <= periodosPotencia; i++) {
          const key = `${tablaPotencias}__0__${i-1}`;
          newValoresTabla[key] = String(potencias[`P${i}`] || '0');
      }

      // 2c. Rellenar "Energía consumida"
      const tablaEnergia = "Energía consumida (kWh) por mes y periodo";
      const consumoMensual = sipsData.ConsumoMensual;
      const periodosEnergia = esTarifa61 ? 6 : 3;
      
      for (const [monthKey, consumos] of Object.entries(consumoMensual)) {
          // const colIndex = headerToIndexMap.get(monthKey); // Ya no necesitamos el índice aquí
          if (!headerToIndexMap.has(monthKey)) continue; // Solo comprobamos si está en las cabeceras visibles

          for (let i = 1; i <= periodosEnergia; i++) {
              // --- CAMBIO CLAVE: Usar monthKey en lugar de colIndex ---
              const key = `${tablaEnergia}__${i-1}__${monthKey}`; 
              newValoresTabla[key] = String(consumos[`P${i}`] || '0');
          }
      }
      
      // 2d. Rellenar "Potencia consumida" (Maxímetro)
      const tablaPotenciaConsumida = "Potencia consumida (kW) por mes y periodo";
      const potenciaConsumida = sipsData.PotenciaConsumida;
      
      for (const [monthKey, potencias] of Object.entries(potenciaConsumida)) {
          // const colIndex = headerToIndexMap.get(monthKey); // Ya no necesitamos el índice aquí
          if (!headerToIndexMap.has(monthKey)) continue; // Solo comprobamos si está en las cabeceras visibles

          for (let i = 1; i <= periodosEnergia; i++) {
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


  const handleChangeCelda = (
    tabla: string,
    fila: number,
    col: number, // Esto sigue siendo el ÍNDICE (0-11)
    valor: string
  ) => {
    // --- CAMBIO: Traducir índice a cabecera ---
    const colHeader = dynamicMonthHeaders[col];
    if (!colHeader) return; // Seguridad
    
    const key = `${tabla}__${fila}__${colHeader}`; // <-- Usar cabecera
    setValoresTabla((prev) => ({
      ...prev,
      [key]: valor,
    }));
  };

  const renderTablasTarifa_20_30 = () => {
    const esEditable = modo === "manual" || modo === "auto";
    const puedeAvanzar = modo === "auto" || (modo === "manual" && tarifa && manualLastMonth && manualLastYear);

    // --- AÑADIR: Lógica para desactivar el botón "retroceder" ---
    const canRetroceder = puedeAvanzar && (
        modo === 'manual' || // Siempre se puede en modo manual
        !sipsFirstMonth || // Si no hay SIPS data
        (dynamicMonthHeaders[0] !== sipsFirstMonth) // O si el mes visible NO es el primer mes de SIPS
    );

    return (
      <>
        <div className="grid gap-4 md:grid-cols-3">
          <TablaGenerica
            titulo="Potencias contratadas (P1-P2)"
            columnas={["P1", "P2"]}
            filas={[["", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />

          <TablaGenerica
            titulo="Energía consumida (kWh) por mes y periodo"
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
            // --- (4) PASAR LA FUNCIÓN DE RETROCESO ---
            onRemoveColumn={canRetroceder ? handleRetrocederMes : undefined}
            // --- FIN (4) ---
          />

          <TablaGenerica
            titulo="Potencia consumida (kW) por mes y periodo"
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

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <TablaGenerica
            titulo="Precio Potencia (€/kW)"
            columnas={["P1", "P2", "P3"]}
            filas={[["", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Precio Energía (€/kWh)"
            columnas={["P1", "P2", "P3"]}
            filas={[["", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>
      </>
    );
  };

  const renderTablasTarifa_61 = () => {
    const esEditable = modo === "manual" || modo === "auto";
    const puedeAvanzar = modo === "auto" || (modo === "manual" && tarifa && manualLastMonth && manualLastYear);

    // --- AÑADIR: Lógica para desactivar el botón "retroceder" ---
    const canRetroceder = puedeAvanzar && (
        modo === 'manual' || 
        !sipsFirstMonth || 
        (dynamicMonthHeaders[0] !== sipsFirstMonth)
    );

    return (
      <>
        <div className="grid gap-4 md:grid-cols-3">
          <TablaGenerica
            titulo="Potencias contratadas (P1-P6)"
            columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
            filas={[["", "", "", "", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />

          <TablaGenerica
            titulo="Energía consumida (kWh) por mes y periodo"
            columnas={dynamicMonthHeaders}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p,
              ...Array(dynamicMonthHeaders.length).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
            onAddColumn={puedeAvanzar ? handleAvanzarMes : undefined}
            // --- (4) PASAR LA FUNCIÓN DE RETROCESO ---
            onRemoveColumn={canRetroceder ? handleRetrocederMes : undefined}
            // --- FIN (4) ---
          />

          <TablaGenerica
            titulo="Potencia consumida (kW) por mes y periodo"
            columnas={dynamicMonthHeaders}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p,
              ...Array(dynamicMonthHeaders.length).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <TablaGenerica
            titulo="Término potencia"
            columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
            filas={[Array(6).fill("")]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Término energía"
            columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
            filas={[Array(6).fill("")]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>
      </>
    );
  };

  const renderZonaTablas = () => {
    if (cargando && modo === "auto") {
        return (
            <div className="text-center p-8">
                <p>Consultando SIPS...</p>
            </div>
        )
    }
    
    if (!tarifa || (modo === "manual" && (!manualLastMonth || !manualLastYear))) {
      return (
        <p className="text-sm text-gray-500 mt-4">
          {modo === "manual"
            ? "Selecciona tarifa y último mes para ver las tablas."
            : "Autocompleta para ver las tablas."
          }
        </p>
      );
    }

    if (tarifa === "2.0TD" || tarifa === "3.0TD") {
      return renderTablasTarifa_20_30();
    }

    if (tarifa === "6.1TD") {
      return renderTablasTarifa_61();
    }

    return null;
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
          <div> {/* Un div simple, sin 'form-row' */}
            <label className="block text-sm font-medium mb-1" htmlFor="direccion">
              Dirección de Suministro
            </label>
            <input
              id="direccion"
              name="direccion"
              value={datosSuministro.direccion}
              onChange={handleChangeSuministro}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Calle, número, CP, municipio"
            />
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
            
        </div>
        {/* --- FIN: SECCIÓN MODIFICADA --- */}
        
      </div>


      {/* BOTONES */}
      {/* --- DIV MODIFICADO CON ESTILOS EN LÍNEA --- */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '1rem',     // Más espacio entre botones
          marginTop: '1rem'  // Más espacio arriba de los botones
        }}
      >
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* --- (INICIO) CORRECCIÓN BUG LABEL --- */}
      {/* Interfaz de selección MODO MANUAL */}
      {modo === "manual" ? (
        <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-tarifa">1. Selecciona la tarifa</label>
              <select
                id="manual-tarifa" 
                value={tarifa}
                onChange={(e) => setTarifa(e.target.value as Tarifa)}
                className="border rounded-md px-3 py-2 text-sm mt-1"
              >
                <option value="">-- Selecciona --</option>
                <option value="2.0TD">2.0TD</option>
                <option value="3.0TD">3.0TD</option>
                <option value="6.1TD">6.1TD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="manual-mes">2. Último mes (MM/YY)</label>
              <div className="flex gap-2 mt-1">
                <select
                  id="manual-mes"
                  value={manualLastMonth}
                  onChange={(e) => setManualLastMonth(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm"
                  disabled={!tarifa}
                  title={!tarifa ? "Selecciona una tarifa primero" : "Mes"}
                >
                  <option value="">Mes</option>
                  {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
                  id="manual-ano"
                  value={manualLastYear}
                  onChange={(e) => setManualLastYear(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm"
                  disabled={!tarifa}
                  title={!tarifa ? "Selecciona una tarifa primero" : "Año"}
                >
                  <option value="">Año</option>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            En función de la tarifa y el mes se mostrarán las tablas.
          </p>
        </div>
      // --- (FIN) CORRECCIÓN BUG LABEL ---
      // Mostrar tarifa en MODO AUTO
      ) : (modo === "auto" && tarifa) ? (
        <div className="bg-white rounded-md shadow-sm p-4">
            <p className="text-sm font-medium text-gray-700">
                Tarifa detectada (SIPS): <span className="font-bold text-emerald-600 text-base">{tarifa}</span>
            </p>
        </div>
      ) : null}


      {/* TABLAS */}
      <div className="bg-white rounded-md shadow-sm p-4">{renderZonaTablas()}</div>

      {/* BOTÓN PDF */}
      <div className="flex justify-end">
        <button
          type="button"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md"
        >
          Generar PDF
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Tabla genérica
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
    col: number,
    valor: string
  ) => void;
  onAddColumn?: () => void;
  // --- (2) AÑADIR NUEVA PROP 'onRemoveColumn' ---
  onRemoveColumn?: () => void;
  // --- FIN (2) ---
}

const TablaGenerica: React.FC<TablaGenericaProps> = ({
  titulo,
  columnas,
  filas,
  mostrarPrimeraColumnaComoFila = false,
  editable = false,
  valores = {},
  onChangeCell,
  onAddColumn,
  // --- (2) AÑADIR NUEVA PROP 'onRemoveColumn' ---
  onRemoveColumn,
  // --- FIN (2) ---
}) => {
  const esTablaMensual = (titulo.startsWith("Energía consumida") || titulo.startsWith("Potencia consumida")) && columnas[0]?.includes('/');
  
  // --- (3) ESTILOS PARA LOS BOTONES (para evitar repetición) ---
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
  // --- FIN (3) ---

  return (
    <div className="border rounded-md overflow-hidden">
      {/* --- (3) MODIFICAR DIV DEL TÍTULO --- */}
      <div 
        className="bg-slate-50 px-3 py-2 text-sm font-medium" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{titulo}</span>
        {/* Mostrar botones si es tabla mensual y alguna función existe */}
        {esTablaMensual && (onAddColumn || onRemoveColumn) && (
          <div style={{ display: 'flex', gap: '4px' }}>
            
            {/* Botón MENOS (NUEVO) */}
            {onRemoveColumn && (
              <button
                type="button"
                onClick={onRemoveColumn}
                title="Retroceder un mes"
                className="p-1 rounded-full hover:bg-slate-200"
                style={buttonStyle}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={svgIconStyle}>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            )}

            {/* Botón MÁS (Existente, ahora usa estilos) */}
            {onAddColumn && (
              <button
                type="button"
                onClick={onAddColumn}
                title="Avanzar un mes"
                className="p-1 rounded-full hover:bg-slate-200"
                style={buttonStyle}
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
      {/* --- FIN (3) --- */}
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100">
            <tr>
              {mostrarPrimeraColumnaComoFila ? (
                <th className="px-2 py-1 text-left">Periodo</th>
              ) : null}
              {columnas.map((col, index) => (
                <th key={`${col}-${index}`} className="px-2 py-1 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filas.map((fila, filaIndex) => (
              <tr key={filaIndex}>
                {mostrarPrimeraColumnaComoFila ? (
                  <td className="px-2 py-1 font-semibold">
                    {String(fila[0])}
                  </td>
                ) : null}
                {/* --- MODIFICACIÓN EN EL MAP DE COLUMNAS --- */}
                {columnas.map((colHeader, colIndex) => { // <-- Obtener colHeader y colIndex
                  
                  // --- CAMBIO CLAVE: Construir la clave con colHeader ---
                  const key = `${titulo}__${filaIndex}__${colHeader}`;
                  
                  const originalCeldaValue = (fila[colIndex + (mostrarPrimeraColumnaComoFila ? 1 : 0)] as string) || "";
                  
                  // Leer el valor del estado usando la clave con cabecera
                  const value = valores[key] !== undefined ? valores[key] : originalCeldaValue;

                    return (
                      <td key={colIndex} className="px-2 py-1">
                        {editable ? (
                          <input
                            value={value}
                            onChange={(e) =>
                              onChangeCell &&
                              onChangeCell(
                                titulo,
                                filaIndex,
                                colIndex, // <-- Pasamos el ÍNDICE (0-11) al handler
                                e.target.value
                              )
                            }
                            className="w-full border rounded-sm px-1 py-0.5 text-xs"
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