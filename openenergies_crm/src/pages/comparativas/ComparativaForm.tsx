// openenergies_crm/src/pages/comparativas/ComparativaForm.tsx
import React, { useState, useEffect, useMemo } from "react";
// --- (1) Importar iconos y toast ---
import { Zap, Cog, Euro, Pencil, Loader2, FileDown, Database, ListChecks, TextCursorInput, Building2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from "@lib/supabase";
import { saveAs } from 'file-saver';
import { useQuery } from '@tanstack/react-query';
// --- (AHORA IMPORTA PreciosPotencia TAMBIÉN) ---
import { PreciosEnergia, PreciosPotencia } from '@lib/types'; 

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

const getPeriodKeys = (t: Tarifa) => {
  const esTarifaAlta = t === '6.1TD' || t === '3.0TD';
  // Claves de Potencia ("P1", "P2", ...)
  const potPeriodKeys = esTarifaAlta ? ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] : ['P1', 'P2'];
  // Claves de Energía (BBDD usa P1-P6)
  const engTableKeys = esTarifaAlta ? ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] : ['P1', 'P2', 'P3'];
  // Claves para el JSON del PDF (E1, E2...)
  const engPeriodKeys = engTableKeys.map((_, i) => `E${i + 1}`);
  
  return { potPeriodKeys, engPeriodKeys, engTableKeys };
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

// -----------------------------------------------------------------------------
// --- (INICIO) COMPONENTES MOVIDOS FUERA ---
// -----------------------------------------------------------------------------

// --- (REQ 6) Mapa de colores para los periodos ---
const periodColors = [
  '#2BB673', // P1 (Verde)
  '#2E87E5', // P2 (Azul)
  '#f39b03', // P3 (Ámbar)
  '#DC2626', // P4 (Rojo)
  '#8B5CF6', // P5 (Morado)
  '#64748b', // P6 (Gris)
];

// -----------------------------------------------------------------------------
// Tabla genérica - (MOVIDA FUERA)
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
  onRemoveColumn,
  // --- (REQ 4) Recibir nuevas props ---
  icon,
  accentColor,
  tituloActual, // Recibir título actual
}) => {
  const esTablaMensual = (titulo.startsWith("Energía consumida") || titulo.startsWith("Lectura Maxímetro") || titulo.startsWith("Potencia €/kW/año (Propuesta Mensual)") || titulo.startsWith("Energía €/kWh (Propuesta Mensual)")) && columnas[0]?.includes('/');
  
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
                                     titulo;
                  let key = '';
                  if (mostrarPrimeraColumnaComoFila) {
                    // Tablas mensuales: Clave = Tabla__Fila(P1=0)__Col(Header)
                    const pKey = String(fila[0]); // P1, P2...
                    key = `${baseTitulo}__${filaIndex}__${colHeader}`;
                  } else {
                    // Tablas únicas: Clave = Tabla__Fila(0)__Col(P1, P2...)
                    const pKey = colHeader; // P1, P2...
                    key = `${baseTitulo}__${filaIndex}__${pKey}`;
                  }                   
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
                                baseTitulo,
                                filaIndex,
                                // Pasamos la clave de la columna correcta
                                mostrarPrimeraColumnaComoFila ? colHeader : colHeader, // En ambos casos es colHeader
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


// -----------------------------------------------------------------------------
// --- (FIN) COMPONENTES MOVIDOS FUERA ---
// -----------------------------------------------------------------------------

interface PotenciaAnualInputBoxProps {
  tarifa: Tarifa;
  valores: Record<string, string>;
  onChangeCell: (tabla: string, fila: number, colHeader: string, valor: string) => void;
  accentColor: string;
}

const PotenciaAnualInputBox: React.FC<PotenciaAnualInputBoxProps> = ({
  tarifa,
  valores,
  onChangeCell,
  accentColor,
}) => {
  const { potPeriodKeys } = getPeriodKeys(tarifa);
  // --- (MODIFICACIÓN) Título base para la clave del estado ---
  const baseTitulo = "Potencia €/kW/año";
  
  return (
    <div style={{
      backgroundColor: 'var(--bg-muted)',
      borderRadius: '12px',
      overflow: 'hidden',
      borderTop: `4px solid ${accentColor}`,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      height: '100%' // Para que alinee con la tabla de energía
    }}>
      {/* Titulo */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '0.6rem',
        padding: '1rem', 
        color: 'var(--fg)',
      }}>
        <span style={{ color: accentColor }}><Euro size={18} /></span>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
          {baseTitulo} {/* Usamos el título base */}
          <span style={{
            color: accentColor,
            fontSize: '0.9em',
            fontWeight: 500,
            marginLeft: '0.4rem'
          }}></span>
        </span>
      </div>
      
      {/* --- (INICIO) SECCIÓN MODIFICADA: Usar <table> en lugar de <div> grid --- */}
      <div className="overflow-auto" style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
        <table className="min-w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          {/* Cabecera de la tabla (Peaje | Valor) */}
          <thead style={{ backgroundColor: 'transparent' }}>
            <tr>
              <th style={{ padding: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>Periodo</th>
              <th style={{ padding: '0.5rem', color: 'var(--muted)', fontSize: '0.75rem', border: '1px solid var(--border-color)', textAlign: 'left' }}>Valor</th>
            </tr>
          </thead>
          <tbody className="bg-white" style={{ backgroundColor: 'var(--bg-card)' }}>
            {potPeriodKeys.map((pKey, index) => {
              // Clave del estado (fila siempre 0 para tabla anual)
              const key = `${baseTitulo}__0__${pKey}`; 
              const value = valores[key] !== undefined ? valores[key] : "";
              
              return (
                <tr 
                  key={pKey}
                  // Borde de color lateral, igual que la tabla de energía
                  style={{ borderLeft: `4px solid ${periodColors[index % periodColors.length]}` }}
                >
                  {/* Celda del Peaje (P1, P2...) */}
                  <td style={{ padding: '0.5rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                    {pKey}
                  </td>
                  {/* Celda del Input */}
                  <td style={{ padding: '0', border: '1px solid var(--border-color)' }}>
                    <input
                      id={key}
                      value={value}
                      onChange={(e) =>
                        onChangeCell(
                          baseTitulo,
                          0, // Fila siempre es 0
                          pKey, // colHeader es el peaje (P1, P2...)
                          e.target.value
                        )
                      }
                      type="number"
                      step="0.000001" // Alta precisión
                      style={{ 
                        fontSize: '0.8rem', 
                        padding: '0.4rem 0.5rem',
                        textAlign: 'right',
                        backgroundColor: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        borderRadius: '0',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* --- (FIN) SECCIÓN MODIFICADA --- */}
    </div>
  );
};


interface RenderPropuestaOptionsProps {
  tarifa: Tarifa;
  pricingMode: 'manual_unico' | 'manual_mensual' | 'historico';
  selectedEmpresaPrecios: string;
  loadingEmpresasPrecios: boolean;
  loadingPrecios: boolean;
  empresasConPrecios: { id: string, nombre: string }[];
  dynamicMonthHeaders: string[];
  valoresTabla: Record<string, string>;
  setPricingMode: (mode: 'manual_unico' | 'manual_mensual' | 'historico') => void;
  setSelectedEmpresaPrecios: (id: string) => void;
  handleChangeCelda: (tabla: string, fila: number, colHeader: string, valor: string) => void;
}

const RenderPropuestaOptions: React.FC<RenderPropuestaOptionsProps> = ({
  tarifa,
  pricingMode,
  selectedEmpresaPrecios,
  loadingEmpresasPrecios,
  loadingPrecios,
  empresasConPrecios,
  dynamicMonthHeaders,
  valoresTabla,
  setPricingMode,
  setSelectedEmpresaPrecios,
  handleChangeCelda,
}) => {
    const warningColor = "#f39b03"; // Color amarillo/ámbar
    const { potPeriodKeys, engTableKeys } = getPeriodKeys(tarifa);

    // Claves de tabla para las nuevas tablas mensuales
    const engTablaKeyMensual = "Energía €/kWh (Propuesta Mensual)";
    
    // Claves de tabla para las tablas anuales
    const potTablaKeyAnual = "Potencia €/kW/año (Ofrecido)";
    const engTablaKeyAnual = "Energía €/kWh (Ofrecido)";


    return (
      <div style={{ display: 'grid', gap: '1.5rem', borderTop: '2px dashed var(--border-color)', paddingTop: '1.5rem' }}>
        
        {/* --- Título y Selectores de Modo --- */}
        <h3 className="section-title" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0, color: warningColor }}>
          Precios de Propuesta
        </h3>
        
        {/* Encabezado: radios + selector de empresa (siempre visible) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '1rem', 
          paddingLeft: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {/* Izquierda: radios */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',fontWeight:500,padding:'0.5rem'}}>
              <input 
                type="radio" 
                name="pricing_mode" 
                value="manual_unico" 
                checked={pricingMode === 'manual_unico'} 
                onChange={(e) => setPricingMode(e.target.value as any)} 
              />
              Fijos
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',fontWeight:500,padding:'0.5rem'}}>
              <input 
                type="radio" 
                name="pricing_mode" 
                value="manual_mensual" 
                checked={pricingMode === 'manual_mensual'} 
                onChange={(e) => setPricingMode(e.target.value as any)} 
              />
              Variables mensualmente
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',fontWeight:500,padding:'0.5rem'}}>
              <input 
                type="radio" 
                name="pricing_mode" 
                value="historico" 
                checked={pricingMode === 'historico'} 
                onChange={(e) => setPricingMode(e.target.value as any)} 
              />
              Según histórico guardado
            </label>
          </div>

          {/* Derecha: selector de empresa (siempre visible) */}
          <div style={{ minWidth: 280 }}>
            <label htmlFor="empresa_precios" className="block text-sm font-medium">Empresa (opcional)</label>
            <div className="input-icon-wrapper">
              <Building2 size={18} className="input-icon" />
              <select
                id="empresa_precios"
                value={selectedEmpresaPrecios}
                onChange={(e) => setSelectedEmpresaPrecios(e.target.value)}
                disabled={loadingEmpresasPrecios}
              >
                <option value="">{loadingEmpresasPrecios ? 'Cargando empresas...' : 'Sin empresa'}</option>
                {empresasConPrecios.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>


        {/* --- Renderizado Condicional de Opciones --- */}

        {/* Opción 1: Precios Manuales Únicos (Layout 50/50) */}
        {pricingMode === 'manual_unico' && (
          <div className="form-row">
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <TablaGenerica
                titulo="Potencia €/kW/año"
                icon={<Euro size={18} />}
                accentColor={warningColor}
                columnas={potPeriodKeys}
                filas={[Array(potPeriodKeys.length).fill("")]}
                editable={true}
                onChangeCell={handleChangeCelda}
                valores={valoresTabla}
              />
            </div>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <TablaGenerica
                titulo="Energía €/kWh"
                icon={<Euro size={18} />}
                accentColor={warningColor}
                columnas={engTableKeys}
                filas={[Array(engTableKeys.length).fill("")]}
                editable={true}
                onChangeCell={handleChangeCelda}
                valores={valoresTabla}
              />
            </div>
          </div>
        )}

        {/* Opción 2: Manual Mensual (Layout 33/66) */}
        {pricingMode === 'manual_mensual' && (
          // --- (LAYOUT MODIFICADO) Grid 1fr 4fr ---
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Columna 1: Potencia (ANUAL) */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <PotenciaAnualInputBox
                tarifa={tarifa}
                valores={valoresTabla}
                onChangeCell={handleChangeCelda}
                accentColor={warningColor}
              />
            </div>
            {/* Columna 2: Energía (MENSUAL) */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
               <TablaGenerica
                titulo="Energía €/kWh"
                icon={<Euro size={18} />}
                accentColor={warningColor}
                columnas={dynamicMonthHeaders}
                filas={engTableKeys.map((pKey) => [
                    pKey, 
                    ...Array(dynamicMonthHeaders.length).fill("")
                ])}
                mostrarPrimeraColumnaComoFila={true}
                editable={true} // Editable
                onChangeCell={handleChangeCelda}
                valores={valoresTabla}
              />
            </div>
          </div>
          // --- (FIN) Layout Grid ---
        )}

        {/* Opción 3: Histórico de Empresa (Layout 33/66) */}
        {pricingMode === 'historico' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>            
            {/* Tablas (Spinner o Tablas) */}
            {selectedEmpresaPrecios && (
              loadingPrecios ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /> Cargando precios...</div>
              ) : (
                // --- (LAYOUT MODIFICADO) Grid 1fr 4fr ---
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Columna 1: Potencia (ANUAL) */}
                  <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <PotenciaAnualInputBox
                      tarifa={tarifa}
                      valores={valoresTabla}
                      onChangeCell={handleChangeCelda}
                      accentColor={warningColor}
                    />
                  </div>
                  {/* Columna 2: Energía (MENSUAL) */}
                  <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <TablaGenerica
                      titulo="Energía €/kWh"
                      icon={<Euro size={18} />}
                      accentColor={warningColor}
                      columnas={dynamicMonthHeaders}
                      filas={engTableKeys.map((pKey) => [
                        pKey,
                        ...Array(dynamicMonthHeaders.length).fill("")
                      ])}
                      mostrarPrimeraColumnaComoFila={true}
                      editable={true} // Editable
                      onChangeCell={handleChangeCelda}
                      valores={valoresTabla}
                    />
                  </div>
                </div>
                // --- (FIN) Layout Grid ---
              )
            )}
          </div>
        )}

      </div>
    );
  };
// --- (FIN) SECCIÓN MODIFICADA ---


const ComparativaForm: React.FC = () => {
  
  const todayISO = new Date().toISOString().split('T')[0]!;
  const today = new Date(); // 2025-11-01
  const currentYearFull = today.getFullYear(); // 2025
  const currentYearYY_Str = currentYearFull.toString().slice(-2); // "25"
  const currentMonthMM_Str = (today.getMonth() + 1).toString().padStart(2, '0'); // "11"
  const [optimizacion, setOptimizacion] = useState(false);


  const [pricingMode, setPricingMode] = 
    useState<'manual_unico' | 'manual_mensual' | 'historico'>('manual_unico');
  
  const [selectedEmpresaPrecios, setSelectedEmpresaPrecios] = useState<string>('');

  // --- (MODIFICADO) Cache ahora es un objeto con dos claves ---
  const [preciosHistoricos, setPreciosHistoricos] = useState<{
    potencia: Record<string, PreciosPotencia>, // Cache Potencia: {"2025": {...}}
    energia: Record<string, PreciosEnergia>    // Cache Energía: {"10/25": {...}}
  }>({ potencia: {}, energia: {} });
  // ---
  
  const [loadingPrecios, setLoadingPrecios] = useState(false);

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
  useEffect(() => {
    if (tarifa === '2.0TD') setOptimizacion(false);
  }, [tarifa]);
  const { data: empresasConPrecios = [], isLoading: loadingEmpresasPrecios } = useQuery({
    queryKey: ['empresasConPrecios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('is_archived', false) 
        .order('nombre', { ascending: true });
      if (error) {
        console.error('Error fetching empresas:', error);
        return [];
      }
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000, // Cachear 1 hora
  });

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
      // 1. Obtén los encabezados de SIPS, máximo 12
      let newHeaders: string[] = [];

      if (sortedHeaders.length > 0) {
        // 1. Obtenemos el mes MÁS RECIENTE devuelto por SIPS
        const lastHeader = sortedHeaders[sortedHeaders.length - 1]; // Ej: "09/25"
        const [lastMonth, lastYear] = lastHeader!.split('/'); // ["09", "25"]

        if (lastMonth && lastYear) {
          // 2. Usamos la función existente para generar una parrilla de 12 meses
          //    basada en ese último mes.
          //    Esto genera ["10/24", "11/24", ..., "05/25", ..., "09/25"]
          newHeaders = generateManualHeaders(lastMonth, lastYear); 
        } else {
          // Fallback por si el header no tiene el formato esperado
          // (Toma los últimos 12 si SIPS devolvió más)
          newHeaders = sortedHeaders.length > 12 ? sortedHeaders.slice(-12) : sortedHeaders;
        }
      } else {
        // Fallback si SIPS no devuelve ningún mes (ej: sin consumos)
         newHeaders = defaultMesesDelAño;
      }

      // 3. Setea los encabezados (ahora siempre serán 12 y cronológicos)
      setDynamicMonthHeaders(newHeaders);
      // 7. El mapa de índices debe crearse DESPUÉS de definir newHeaders
      const headerToIndexMap = new Map(newHeaders.map((h, i) => [h, i]));

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

  // --- (INICIO) useEffect MODIFICADO PARA 'historico' ---
  useEffect(() => {
    // Solo actuar si el modo es 'historico' y tenemos los datos necesarios
    if (pricingMode !== 'historico' || !selectedEmpresaPrecios || !tarifa || dynamicMonthHeaders.length === 0) {
      setLoadingPrecios(false);
      if (pricingMode === 'historico' && !selectedEmpresaPrecios) {
        toast.error('Selecciona una empresa primero.');
      }
      return;
    }

    const fetchAndFillPrices = async () => {
      setLoadingPrecios(true);
      // Limpiamos solo los valores de la tabla, no el modo ni SIPS
      setValoresTabla(prev => {
        // Mantenemos los valores de SIPS (pot contratada, consumo, maxímetro)
        const newVals: Record<string, string> = {};
        Object.keys(prev).forEach(key => {
          if (key.startsWith("Potencias contratadas") || key.startsWith("Energía consumida") || key.startsWith("Lectura Maxímetro")) {
            // Aseguramos que siempre asignamos un string (evitar undefined)
            newVals[key] = prev[key] ?? '';
          }
        });
        return newVals;
      });
      
      setPreciosHistoricos({ potencia: {}, energia: {} }); // Limpiar caché de precios

      // 1. Extraer Años (para Potencia) y Fechas (para Energía)
      const yearsSet = new Set<number>();
      const fechasMesSet = new Set<string>();
      
      dynamicMonthHeaders.forEach(h => {
        const [m, y] = h.split('/');
        if (m && y && !isNaN(parseInt(m)) && !isNaN(parseInt(y))) {
          const fullYear = parseInt(`20${y}`, 10);
          yearsSet.add(fullYear);
          fechasMesSet.add(`${fullYear}-${m}-01`);
        }
      });
      
      const years = Array.from(yearsSet);
      const fechasMes = Array.from(fechasMesSet);

      if (fechasMes.length === 0 || years.length === 0) {
        setLoadingPrecios(false);
        return; // No hay fechas válidas para consultar
      }

      // 2. Fetch precios (Potencia y Energía en paralelo)
      const [potenciaResult, energiaResult] = await Promise.all([
        supabase
          .from('precios_potencia')
          .select('*')
          .eq('empresa_id', selectedEmpresaPrecios)
          .eq('tarifa', tarifa)
          .in('año', years),
        supabase
          .from('precios_energia')
          .select('*')
          .eq('empresa_id', selectedEmpresaPrecios)
          .eq('tarifa', tarifa)
          .in('fecha_mes', fechasMes)
      ]);

      if (potenciaResult.error) {
        toast.error(`Error al cargar precios de potencia: ${potenciaResult.error.message}`);
      }
      if (energiaResult.error) {
        toast.error(`Error al cargar precios de energía: ${energiaResult.error.message}`);
      }
      setLoadingPrecios(false);

      // 3. Mapear resultados a cachés
      const newPotenciaCache: Record<string, PreciosPotencia> = {};
      (potenciaResult.data || []).forEach(p => {
        newPotenciaCache[p.año.toString()] = p;
      });
      
      const newEnergiaCache: Record<string, PreciosEnergia> = {};
      (energiaResult.data || []).forEach(p => {
        const [y, m] = p.fecha_mes.split('-');
        const monthKey = `${m}/${y.slice(-2)}`; // "10/25"
        newEnergiaCache[monthKey] = p;
      });
      
      setPreciosHistoricos({ potencia: newPotenciaCache, energia: newEnergiaCache });

      // 4. Rellenar 'valoresTabla' con los datos (o con vacío si no hay datos)
      const newValoresTabla = { ...valoresTabla }; // Copiar estado existente
      const { potPeriodKeys, engTableKeys } = getPeriodKeys(tarifa);
      
      // --- Claves de las tablas de PROPUESTA ---
      const potTablaKey = "Potencia €/kW/año";
      const engTablaKey = "Energía €/kWh";

      // 4a. Rellenar Potencia (Anual)
      // Usamos el año del ÚLTIMO mes en la cabecera como referencia
      const lastHeader = dynamicMonthHeaders[dynamicMonthHeaders.length - 1] || "01/00";
      const lastYear = `20${lastHeader.split('/')[1]}`;
      const precioPotenciaDelAño = newPotenciaCache[lastYear];
      
      potPeriodKeys.forEach((pKey, filaIndex) => {
        // Clave para la tabla ANUAL: Tabla__Fila(0)__Col(P1, P2...)
        const tablaKey = `${potTablaKey}__${filaIndex}__${pKey}`; 
        const dbValue = precioPotenciaDelAño ? precioPotenciaDelAño[`precio_potencia_${pKey.toLowerCase()}` as keyof PreciosPotencia] : null;
        newValoresTabla[tablaKey] = dbValue !== null ? String(dbValue) : '';
      });
      
      // 4b. Rellenar Energía (Mensual)
      dynamicMonthHeaders.forEach(header => {
        const precioEnergiaDelMes = newEnergiaCache[header]; // Puede ser undefined
        
        engTableKeys.forEach((pKey, filaIndex) => {
          // Clave para la tabla MENSUAL: Tabla__Fila(P1=0)__Col(Header)
          const tablaKey = `${engTablaKey}__${filaIndex}__${header}`;
          const dbValue = precioEnergiaDelMes ? precioEnergiaDelMes[`precio_energia_${pKey.toLowerCase()}` as keyof PreciosEnergia] : null;
          newValoresTabla[tablaKey] = dbValue !== null ? String(dbValue) : '';
        });
      });

      setValoresTabla(newValoresTabla); // Actualizar la UI
      
      if ((potenciaResult.data?.length || 0) > 0 || (energiaResult.data?.length || 0) > 0) {
        toast.success(`Histórico de precios de ${empresasConPrecios.find(e => e.id === selectedEmpresaPrecios)?.nombre} cargado.`);
      } else {
        toast.error(`No se encontraron precios para ${empresasConPrecios.find(e => e.id === selectedEmpresaPrecios)?.nombre} en este período.`);
      }
    };

    fetchAndFillPrices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingMode, selectedEmpresaPrecios, tarifa, dynamicMonthHeaders]); // No incluir supabase/valoresTabla
  // --- (FIN) useEffect MODIFICADO ---


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
  
  // --- (3) INICIO: LÓGICA DE GENERACIÓN DE PDF (MODIFICADA) ---

  /** Helper para parsear números de forma segura desde el estado */
  const z = (val: string | undefined | null) => Number(val || '0') || 0;

  /**
   * Construye el objeto JSON para la API del PDF
   * --- AHORA CON EL NUEVO FORMATO DE PRECIOS Y LÓGICA ---
   */
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
      const filaIndex = idx; // E1 (json) -> P1 (tabla) -> fila 0
      energia_kwh_mes[jsonKey] = dynamicMonthHeaders.map(header => {
        const val = valoresTabla[`${tablaEnergiaKey}__${filaIndex}__${header}`];
        return z(val);
      });
    });

    // 1b. energia_kwh (total anual)
    const energia_kwh: Record<string, number> = {};
    for (const periodo in energia_kwh_mes) {
      energia_kwh[periodo] = (energia_kwh_mes[periodo] || []).reduce((acc, val) => acc + val, 0);
    }

    // 2. potencia_contratada_kw
    const tablaPotKey = (tarifa === '6.1TD' || tarifa === '3.0TD') ? "Potencias contratadas (P1-P6)" : "Potencias contratadas (P1-P2)";
    const potencia_contratada_kw: Record<string, number> = {};
    
    potPeriodKeys.forEach(periodKey => {
      const val = valoresTabla[`${tablaPotKey}__0__${periodKey}`];
      potencia_contratada_kw[periodKey] = z(val);
    });

    const tablaMaximetroKey = "Lectura Maxímetro (kW) - Opcional";
    const potencia_kw_mes: Record<string, number[]> = {};
    potPeriodKeys.forEach((pKey, filaIndex) => {
      potencia_kw_mes[pKey] = dynamicMonthHeaders.map((header) => {
        const val = valoresTabla[`${tablaMaximetroKey}__${filaIndex}__${header}`];
        return z(val); // mismo helper que usas para números
      });
    });

    // 3. actual y propuesta (con helper MODIFICADO)
    /**
     * Helper para construir los objetos de precios (MODIFICADO)
     * @param type - '(Actual)' o '(Ofrecido)'
     * @param potMode - 'unico' (lee tabla anual)
     * @param engMode - 'unico' (lee tabla anual) o 'mensual' (lee tabla mensual)
     */
    const getPriceData = (
      type: '(Actual)' | '(Ofrecido)', 
      potMode: 'unico', // Potencia siempre es 'unico' (anual)
      engMode: 'unico' | 'mensual'
    ) => {

      // --- (INICIO) CORRECCIÓN DE CLAVES ---
      // Las claves deben coincidir con las generadas por TablaGenerica
      let potTablaKeyAnual = '';
      let engTablaKeyAnual = '';
      let engTablaKeyMensual = ''; // Clave para energía MENSUAL

      if (type === '(Actual)') {
          // Estas claves las generan las tablas rojas (renderTablasTarifa_...)
          potTablaKeyAnual = "Término potencia (Actual)";
          engTablaKeyAnual = "Término energía (Actual)";
          // (engTablaKeyMensual no se usa para 'Actual')
      } else { 
          // type === '(Ofrecido)'
          // Estas claves las generan las tablas amarillas (RenderPropuestaOptions)
          // que *no* tienen el sufijo "(Ofrecido)"
          potTablaKeyAnual = "Potencia €/kW/año"; 
          engTablaKeyAnual = "Energía €/kWh";
          engTablaKeyMensual = "Energía €/kWh"; // Es la misma tabla en modo mensual
      }
      // --- (FIN) CORRECCIÓN DE CLAVES ---


      // --- (INICIO) MODIFICACIÓN: 'precio_potencia' ahora es Record<string, number> ---
      const precio_potencia: Record<string, number> = {};
      const precio_energia: Record<string, number[]> = {};

      // --- Potencia (Siempre modo 'unico' / ANUAL) ---
      // (Esta lógica ahora es correcta con las claves fijadas)
      potPeriodKeys.forEach((pKey) => { // pKey = "P1"
        const val = z(valoresTabla[`${potTablaKeyAnual}__0__${pKey}`]);
        precio_potencia[pKey] = val; 
      });
      // --- (FIN) MODIFICACIÓN ---
        
      // --- Energía (Modo 'unico' o 'mensual') ---
      if (engMode === 'unico') {
        // MODO ÚNICO: Leer de la tabla anual de energía
        engPeriodKeys.forEach((eKey, idx) => { // eKey = "E1"
          const tKey = engTableKeys[idx]; // tKey = "P1"
          const val = z(valoresTabla[`${engTablaKeyAnual}__0__${tKey}`]);
          precio_energia[eKey] = Array(12).fill(val); // [val, val, val, ...]
        });
      } else {
        // MODO MENSUAL: Leer de la tabla mensual de energía
        engPeriodKeys.forEach((eKey, filaIndex) => { // eKey = "E1", filaIndex = 0
          const monthlyValues: number[] = [];
          dynamicMonthHeaders.forEach(header => { // header = "09/24"...
            // Usamos la clave mensual correcta
            const val = z(valoresTabla[`${engTablaKeyMensual}__${filaIndex}__${header}`]);
            monthlyValues.push(val);
          });
          precio_energia[eKey] = monthlyValues; // [val1, val2, val3, ...]
        });
      }
      
      const cargos_fijos_anual_eur = z(datosSuministro.otrosConceptos);

      return { nombre: "", precio_potencia, precio_energia, cargos_fijos_anual_eur };
    };

    // --- (INICIO) LÓGICA FALTANTE ---
    // Esta es la parte que faltaba en tu función.
    // Aquí decidimos qué modos usar y llamamos a getPriceData.

    // 4. Determinar los modos de precios de la propuesta
    let propuestaEngMode: 'unico' | 'mensual' = 'unico';

    if (pricingMode === 'manual_mensual' || pricingMode === 'historico') {
        propuestaEngMode = 'mensual';
    }

    // 5. Construir los objetos 'actual' y 'propuesta'
    // 'Actual' siempre usa modo 'unico' para ambos
    const actual = getPriceData('(Actual)', 'unico', 'unico');
    
    // 'Propuesta' usa los modos dinámicos
    const propuesta = getPriceData('(Ofrecido)', 'unico', propuestaEngMode);

    // 6. Construir y devolver el payload final
    const payload = {
        // Datos Suministro
        cups: datosSuministro.cups,
        titular: datosSuministro.titular,
        dni_cif: datosSuministro.dniCif,
        direccion: datosSuministro.direccion,
        poblacion: datosSuministro.poblacion,
        fecha_estudio: datosSuministro.fechaEstudio,
        tarifa, // "2.0TD", "6.1TD", etc.

        // Impuestos
        iva_porciento: z(datosSuministro.iva),
        impuesto_electrico_porciento: z(datosSuministro.impuestoElectrico),
        
        // Periodos (Cabeceras de meses)
        periodos: dynamicMonthHeaders, // ["09/24", "10/24", ...]

        // Datos actuales
        potencia_contratada_kw,
        energia_kwh,
        energia_kwh_mes,
        optimizacion: tarifa !== '2.0TD' ? optimizacion : false,
        potencia_kw_mes,

        // Comparativa
        actual,
        propuesta,
    };
    (payload as any).empresa_id = selectedEmpresaPrecios || null;
    return payload;
  };

  /** Manejador del clic en el botón "Generar PDF" */
  const handleGeneratePdf = async () => {
    const payload = buildPdfJson();

    if (!payload) {
      return; // buildPdfJson ya mostró un toast de error
    }

    // --- (INICIO) MODIFICACIÓN REQUERIDA (MODO PRUEBA) ---
    // 1. Imprimir el payload en la consola
    console.log("--- INICIO PAYLOAD PDF (PRUEBA) ---");
    // Usamos JSON.stringify con 'null, 2' para una impresión bonita (pretty-print)
    console.log(JSON.stringify(payload, null, 2));
    console.log("--- FIN PAYLOAD PDF (PRUEBA) ---");
    setIsGeneratingPdf(true);

    try {
      if (!selectedEmpresaPrecios) {
        const ok = window.confirm('No has seleccionado ninguna empresa. ¿Deseas generar la comparativa sin marca (sin nombre ni logo)?');
        if (!ok) return;
      }
      // 1. Obtener la sesión actual para conseguir el Token de Autorización
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('No se pudo obtener la sesión de usuario. Por favor, inicia sesión de nuevo.');
      }

      // 2. Definir la URL de tu Edge Function
      // Usamos la variable de entorno VITE_SUPABASE_URL
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-comparison-pdf`;

      // 3. Llamar a la Edge Function usando fetch()
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Adjuntamos el token del usuario para que la Edge Function pueda autenticarlo
          'Authorization': `Bearer ${session.access_token}`,
          // ¡Ya NO enviamos el X-Internal-Auth-Token desde aquí!
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Si la Edge Function falla (error 500) o deniega el acceso (403)
        throw new Error(`Error del servidor (${response.status}): ${await response.text()}`);
      }

      // 4. La respuesta es el PDF binario (blob)
      const pdfBlob = await response.blob();

      // 5. Usar file-saver para iniciar la descarga
      // (Esta era tu lógica original, que ahora funciona de forma segura)
      saveAs(pdfBlob, `comparativa_${datosSuministro.cups || 'cliente'}.pdf`);

      // 6. Mostrar un toast de éxito genérico
      toast.success('PDF generado y descargado.');

    } catch (err: any) {
      console.error("Error al generar PDF:", err);
      toast.error(`Error al generar PDF: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
    // --- (FIN) MODIFICACIÓN REQUERIDA ---
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

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* --- Potencias Contratadas (Actual) --- */}
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

        {/* --- Energía y Maxímetro (Actual) --- */}
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

        {/* --- Precios (Actual) --- */}
        <div className="form-row">
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término potencia"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Color Rojo
              columnas={["P1", "P2"]}
              filas={[["", ""]]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <TablaGenerica
              titulo="Término energía"
              tituloActual="(Actual)"
              icon={<Euro size={18} />}
              accentColor={dangerColor} // Color Rojo
              columnas={["P1", "P2", "P3"]}
              filas={[["", "", ""]]}
              editable={esEditable}
              onChangeCell={handleChangeCelda}
              valores={valoresTabla}
            />
          </div>
        </div>
        
        {/* --- (NUEVO) Sección Opciones de Propuesta --- */}
        <RenderPropuestaOptions
          tarifa={tarifa}
          pricingMode={pricingMode}
          selectedEmpresaPrecios={selectedEmpresaPrecios}
          loadingEmpresasPrecios={loadingEmpresasPrecios}
          loadingPrecios={loadingPrecios}
          empresasConPrecios={empresasConPrecios}
          dynamicMonthHeaders={dynamicMonthHeaders}
          valoresTabla={valoresTabla}
          setPricingMode={setPricingMode}
          setSelectedEmpresaPrecios={setSelectedEmpresaPrecios}
          handleChangeCelda={handleChangeCelda}
        />

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

    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* --- Potencias Contratadas (Actual) --- */}
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
        
        {/* --- Energía y Maxímetro (Actual) --- */}
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
        
        {/* --- Precios (Actual) --- */}
        <div className="form-row">
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
          </div>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
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
        </div>

        {/* --- (NUEVO) Sección Opciones de Propuesta --- */}
        <RenderPropuestaOptions
          tarifa={tarifa}
          pricingMode={pricingMode}
          selectedEmpresaPrecios={selectedEmpresaPrecios}
          loadingEmpresasPrecios={loadingEmpresasPrecios}
          loadingPrecios={loadingPrecios}
          empresasConPrecios={empresasConPrecios}
          dynamicMonthHeaders={dynamicMonthHeaders}
          valoresTabla={valoresTabla}
          setPricingMode={setPricingMode}
          setSelectedEmpresaPrecios={setSelectedEmpresaPrecios}
          handleChangeCelda={handleChangeCelda}
        />

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
      <div className="flex justify-end" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
        {tarifa && tarifa !== '2.0TD' && (
          <label className="text-sm" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem' }}>
            <input
              type="checkbox"
              checked={optimizacion}
              onChange={(e) => setOptimizacion(e.target.checked)}
            />
            Optimización de Potencia
          </label>
        )}

        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
          {isGeneratingPdf ? 'Generando...' : 'Generar PDF'}
        </button>
      </div>
    </div>
  );
};

// Componente por defecto (sin cambios)
export default ComparativaForm;