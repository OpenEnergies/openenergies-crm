// openenergies_crm/src/pages/comparativas/ComparativaForm.tsx
import React, { useState } from "react";

type Tarifa = "2.0TD" | "3.0TD" | "6.1TD" | "";

interface DatosSuministro {
  cups: string;
  titular: string;
  direccion: string;
  observaciones: string;
}

interface DatosAutocompletados {
  tarifa: Tarifa;
  consumoMensual?: Record<string, any>;
  potenciaConsumida?: Record<string, any>;
}

const ComparativaForm: React.FC = () => {
  const [datosSuministro, setDatosSuministro] = useState<DatosSuministro>({
    cups: "",
    titular: "",
    direccion: "",
    observaciones: "",
  });

  const [modo, setModo] = useState<"idle" | "auto" | "manual">("idle");
  const [tarifa, setTarifa] = useState<Tarifa>("");
  const [datosAuto, setDatosAuto] = useState<DatosAutocompletados | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // aquí guardamos lo que el usuario va escribiendo en las tablas
  // clave: "tituloTabla__fila__col"
  const [valoresTabla, setValoresTabla] = useState<Record<string, string>>({});

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
      const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const cups = datosSuministro.cups; // o de donde lo estés guardando

      if (!functionsUrl) {
        console.error('Falta VITE_SUPABASE_FUNCTIONS_URL');
        alert('No está configurada la URL de las funciones');
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
        alert('No se han podido obtener los datos del CUPS');
        return;
      }

      const data = await res.json();

      // aquí ya haces lo que tenías: setDatosAuto(data), mostrar tablas, etc.
      console.log('datos CRM', data);
      // ...
    } catch (err) {
      console.error(err);
      alert('Error llamando al backend');
    }
  };



  const handleRellenarManual = () => {
    setModo("manual");
    setError(null);
    setTarifa("");
    // si quieres limpiar lo que había antes:
    // setValoresTabla({});
  };

  // se llama desde las tablas cuando el usuario escribe
  const handleChangeCelda = (
    tabla: string,
    fila: number,
    col: number,
    valor: string
  ) => {
    const key = `${tabla}__${fila}__${col}`;
    setValoresTabla((prev) => ({
      ...prev,
      [key]: valor,
    }));
  };

  const renderTablasTarifa_20_30 = () => {
    const esEditable = modo === "manual";

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
            columnas={mesesDelAño}
            filas={[
              ["P1", ...Array(12).fill("")],
              ["P2", ...Array(12).fill("")],
              ["P3", ...Array(12).fill("")],
            ]}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />

          <TablaGenerica
            titulo="Potencia consumida (kW) por mes y periodo"
            columnas={mesesDelAño}
            filas={[
              ["P1", ...Array(12).fill("")],
              ["P2", ...Array(12).fill("")],
              ["P3", ...Array(12).fill("")],
            ]}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4 mt-6">
          <TablaGenerica
            titulo="Término potencia"
            columnas={["P1", "P2", "P3"]}
            filas={[["", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Término energía"
            columnas={["P1", "P2", "P3"]}
            filas={[["", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Excesos"
            columnas={["P1", "P2", "P3"]}
            filas={[["", "", ""]]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Otros"
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
    const esEditable = modo === "manual";

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
            columnas={mesesDelAño}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p,
              ...Array(12).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />

          <TablaGenerica
            titulo="Potencia consumida (kW) por mes y periodo"
            columnas={mesesDelAño}
            filas={["P1", "P2", "P3", "P4", "P5", "P6"].map((p) => [
              p,
              ...Array(12).fill(""),
            ])}
            mostrarPrimeraColumnaComoFila
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4 mt-6">
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
          <TablaGenerica
            titulo="Excesos"
            columnas={["P1", "P2", "P3", "P4", "P5", "P6"]}
            filas={[Array(6).fill("")]}
            editable={esEditable}
            onChangeCell={handleChangeCelda}
            valores={valoresTabla}
          />
          <TablaGenerica
            titulo="Otros"
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
    if (!tarifa) {
      return (
        <p className="text-sm text-gray-500 mt-4">
          Selecciona una tarifa o autocompleta para ver las tablas.
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
    <div className="p-6 space-y-6">
      {/* DATOS DEL SUMINISTRO */}
      <div className="bg-white rounded-md shadow-sm p-4 space-y-4">
        <h1 className="text-lg font-semibold">Datos del suministro</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">CUPS</label>
            <input
              type="text"
              name="cups"
              value={datosSuministro.cups}
              onChange={handleChangeSuministro}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="ES00XXXXXXXXXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="titular">
              Titular
            </label>
            <input
              id="titular"
              name="titular"
              value={datosSuministro.titular}
              onChange={handleChangeSuministro}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Nombre del titular"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1" htmlFor="direccion">
              Dirección
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
          <div className="md:col-span-2">
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="observaciones"
            >
              Observaciones
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              value={datosSuministro.observaciones}
              onChange={handleChangeSuministro}
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={2}
              placeholder="Cualquier dato adicional..."
            />
          </div>
        </div>
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleAutocompletar}
          disabled={cargando}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
        >
          {cargando && modo === "auto" ? "Consultando..." : "Autocompletar"}
        </button>
        <button
          type="button"
          onClick={handleRellenarManual}
          className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 py-2 rounded-md"
        >
          Rellenar manualmente
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* SELECT TARIFA (solo manual) */}
      {modo === "manual" ? (
        <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
          <label className="block text-sm font-medium">Selecciona la tarifa</label>
          <select
            value={tarifa}
            onChange={(e) => setTarifa(e.target.value as Tarifa)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="">-- Selecciona --</option>
            <option value="2.0TD">2.0TD</option>
            <option value="3.0TD">3.0TD</option>
            <option value="6.1TD">6.1TD</option>
          </select>
          <p className="text-xs text-gray-500">
            En función de la tarifa se mostrarán las tablas con las dimensiones que
            definiste.
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

      {/* DEBUG */}
      {datosAuto ? (
        <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-md overflow-auto">
{JSON.stringify(datosAuto, null, 2)}
        </pre>
      ) : null}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Tabla genérica pero ahora con modo editable
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
}

const TablaGenerica: React.FC<TablaGenericaProps> = ({
  titulo,
  columnas,
  filas,
  mostrarPrimeraColumnaComoFila = false,
  editable = false,
  valores = {},
  onChangeCell,
}) => {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-slate-50 px-3 py-2 text-sm font-medium">{titulo}</div>
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100">
            <tr>
              {mostrarPrimeraColumnaComoFila ? (
                <th className="px-2 py-1 text-left">Periodo</th>
              ) : null}
              {columnas.map((col) => (
                <th key={col} className="px-2 py-1 text-left">
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
                {fila
                  .slice(mostrarPrimeraColumnaComoFila ? 1 : 0)
                  .map((celda, colIndex) => {
                    const realColIndex =
                      colIndex + (mostrarPrimeraColumnaComoFila ? 1 : 0);
                    const key = `${titulo}__${filaIndex}__${realColIndex}`;
                    const value = valores[key] ?? (celda as string);

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
                                realColIndex,
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

const mesesDelAño = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export default ComparativaForm;
