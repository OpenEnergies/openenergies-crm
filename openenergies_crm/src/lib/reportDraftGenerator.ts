// openenergies_crm/src/lib/reportDraftGenerator.ts
// LÃ³gica de generaciÃ³n automÃ¡tica de ReportDraft con narrativa basada en reglas

import type {
  ReportDraft,
  KPIsGlobales,
  DatosTarifaDraft,
  DatoMensualTarifaDraft,
  PotenciasTarifaDraft,
  ExtremosTarifaDraft,
  NarrativeSection,
} from './reportDraftTypes';
import {
  createEmptyReportDraft,
  createEmptyNarrativeSection,
} from './reportDraftTypes';
import {
  CATALOGO_PLANTILLAS,
  interpolatePlantilla,
  formatFecha,
  formatMesNombre,
  maskCUPS,
} from './reportTemplates';
import type { AuditoriaEnergeticaData, ResumenPorTarifa, InventarioSuministro } from './informesTypes';
import type { UUID } from './types';

// ============================================================================
// CONSTANTES DE CONFIGURACIÃ“N
// ============================================================================

/** Umbral para considerar datos incompletos (%) */
const UMBRAL_DATOS_INCOMPLETOS = 10;

/** Umbral para considerar potencias incompletas (%) */
const UMBRAL_POTENCIAS_INCOMPLETAS = 30;

/** Ratio consumo/potencia para alertar (kWh por kW contratado al aÃ±o) */
const RATIO_POTENCIA_ELEVADA = 1000; // Si potencia > consumo/ratio, alertar

// ============================================================================
// FUNCIONES AUXILIARES DE CÃLCULO
// ============================================================================

/** * Genera lista de desviaciones sugeridas autom\u00e1ticamente basadas en reglas simples
 */
function generarDesviacionesSugeridas(
  tarifas: { tarifa: string; total_coste: number; total_consumo: number; precio_medio: number }[],
  meses: { mes: string; mes_nombre: string; consumo: number; coste: number; precio: number }[],
  costeTotal: number,
  consumoTotal: number,
  mesesN: number,
  potenciasDisponiblesPct: number
): string[] {
  const desviaciones: string[] = [];
  
  // Regla 1: Periodo con un \u00fanico mes
  if (mesesN === 1) {
    desviaciones.push('Periodo analizado comprende un \u00fanico mes, lo que limita el an\u00e1lisis de tendencias.');
  }
  
  // Regla 2: Alta concentración en una tarifa (> 70% del coste)
  if (tarifas.length > 1 && tarifas[0]) {
    const tarifaTop = tarifas.reduce((max, t) => t.total_coste > max.total_coste ? t : max, tarifas[0]);
    const pct = costeTotal > 0 ? (tarifaTop.total_coste / costeTotal) * 100 : 0;
    if (pct > 70) {
      desviaciones.push(`Alta concentración de coste en tarifa ${tarifaTop.tarifa} (${pct.toFixed(0)}% del total).`);
    }
  }
  
  // Regla 3: Pico de coste mensual significativo (> 150% de la media)
  if (meses.length > 1) {
    const costeMedio = costeTotal / meses.length;
    const mesesPico = meses.filter(m => m.coste > costeMedio * 1.5);
    if (mesesPico.length > 0) {
      const nombresMeses = mesesPico.map(m => m.mes_nombre).join(', ');
      desviaciones.push(`Pico de coste detectado en ${nombresMeses}, significativamente superior a la media del periodo.`);
    }
  }
  
  // Regla 4: Diferencias relevantes de precio medio entre tarifas
  if (tarifas.length > 1) {
    const precioMax = Math.max(...tarifas.map(t => t.precio_medio));
    const precioMin = Math.min(...tarifas.map(t => t.precio_medio));
    if (precioMax > precioMin * 1.3) {
      desviaciones.push(`Diferencia relevante de precio medio entre tarifas: variaci\u00f3n superior al 30%.`);
    }
  }
  
  // Regla 5: Cobertura incompleta de potencias
  if (potenciasDisponiblesPct < 60) {
    desviaciones.push(`Cobertura de potencias incompleta (${potenciasDisponiblesPct.toFixed(0)}%), lo que limita conclusiones t\u00e9cnicas sobre dimensionamiento.`);
  }
  
  // Regla 6: Pico de precio medio mensual
  if (meses.length > 2) {
    const precioMedio = meses.reduce((sum, m) => sum + m.precio, 0) / meses.length;
    const mesesPrecioPico = meses.filter(m => m.precio > precioMedio * 1.2);
    if (mesesPrecioPico.length > 0) {
      const nombresMeses = mesesPrecioPico.map(m => m.mes_nombre).join(', ');
      desviaciones.push(`Precio medio del kWh elevado en ${nombresMeses} respecto a la media del periodo.`);
    }
  }
  
  return desviaciones;
}

/** * Calcula los KPIs globales a partir de los datos de auditorÃ­a
 */
function calcularKPIsGlobales(
  data: AuditoriaEnergeticaData,
  clienteNombre: string
): KPIsGlobales {
  const { resumen_por_tarifa, inventario_suministros, fecha_inicio, fecha_fin } = data;
  
  // Calcular totales
  const consumo_total_kwh = resumen_por_tarifa.reduce((sum, t) => sum + t.total_consumo, 0);
  const coste_total_eur = resumen_por_tarifa.reduce((sum, t) => sum + t.total_coste, 0);
  const precio_medio_eur_kwh = consumo_total_kwh > 0 ? coste_total_eur / consumo_total_kwh : 0;
  
  // Contar facturas y meses Ãºnicos
  const mesesSet = new Set<string>();
  let facturasTotal = 0;
  resumen_por_tarifa.forEach(t => {
    t.datos_mensuales.forEach(m => {
      mesesSet.add(m.mes);
      facturasTotal += m.puntos_activos; // AproximaciÃ³n
    });
  });
  
  // Encontrar mes con mÃ¡ximo coste/consumo/precio
  const todosMeses: { mes: string; mes_nombre: string; consumo: number; coste: number; precio: number }[] = [];
  resumen_por_tarifa.forEach(t => {
    t.datos_mensuales.forEach(m => {
      const existing = todosMeses.find(x => x.mes === m.mes);
      if (existing) {
        existing.consumo += m.consumo_total;
        existing.coste += m.coste_total;
      } else {
        todosMeses.push({
          mes: m.mes,
          mes_nombre: m.mes_nombre,
          consumo: m.consumo_total,
          coste: m.coste_total,
          precio: m.precio_medio_kwh,
        });
      }
    });
  });
  
  // Recalcular precio medio por mes
  todosMeses.forEach(m => {
    m.precio = m.consumo > 0 ? m.coste / m.consumo : 0;
  });
  
  const defaultMes = { mes: '', mes_nombre: '', coste: 0, consumo: 0, precio: 0 };
  const mesMaxCoste = todosMeses.reduce((max, m) => m.coste > max.coste ? m : max, todosMeses[0] ?? defaultMes);
  const mesMaxConsumo = todosMeses.reduce((max, m) => m.consumo > max.consumo ? m : max, todosMeses[0] ?? defaultMes);
  const mesMaxPrecio = todosMeses.reduce((max, m) => m.precio > max.precio ? m : max, todosMeses[0] ?? defaultMes);
  
  // Default para tarifas
  const defaultTarifa = { tarifa: '', total_consumo: 0, total_coste: 0, precio_medio: 0, facturas_count: 0, puntos_count: 0 };
  
  // Encontrar tarifa top en coste y consumo
  const tarifaTopCoste = resumen_por_tarifa.reduce((max, t) => t.total_coste > max.total_coste ? t : max, resumen_por_tarifa[0] ?? defaultTarifa);
  const tarifaTopConsumo = resumen_por_tarifa.reduce((max, t) => t.total_consumo > max.total_consumo ? t : max, resumen_por_tarifa[0] ?? defaultTarifa);
  
  // Encontrar tarifas con precio extremo
  const tarifaMaxPrecio = resumen_por_tarifa.reduce((max, t) => t.precio_medio > max.precio_medio ? t : max, resumen_por_tarifa[0] ?? defaultTarifa);
  const tarifaMinPrecio = resumen_por_tarifa.reduce((min, t) => t.precio_medio < min.precio_medio ? t : min, resumen_por_tarifa[0] ?? defaultTarifa);
  
  // Calidad de datos - estimaciÃ³n simple
  const puntosConPotencia = inventario_suministros.filter(p => 
    p.potencias_contratadas.p1 !== null || p.potencias_contratadas.p2 !== null
  ).length;
  const potencias_disponibles_pct = inventario_suministros.length > 0 
    ? (puntosConPotencia / inventario_suministros.length) * 100 
    : 0;
  
  // Generar desviaciones sugeridas autom\u00e1ticamente
  const desviaciones_sugeridas = generarDesviacionesSugeridas(
    resumen_por_tarifa,
    todosMeses,
    coste_total_eur,
    consumo_total_kwh,
    mesesSet.size,
    potencias_disponibles_pct
  );
  
  return {
    cliente_nombre: clienteNombre,
    fecha_inicio: formatFecha(fecha_inicio),
    fecha_fin: formatFecha(fecha_fin),
    meses_n: mesesSet.size,
    facturas_n: facturasTotal,
    puntos_n: inventario_suministros.length,
    tarifas_n: resumen_por_tarifa.length,
    consumo_total_kwh,
    coste_total_eur,
    precio_medio_eur_kwh,
    mes_coste_max_nombre: mesMaxCoste?.mes_nombre || '',
    mes_coste_max_eur: mesMaxCoste?.coste || 0,
    mes_consumo_max_nombre: mesMaxConsumo?.mes_nombre || '',
    mes_consumo_max_kwh: mesMaxConsumo?.consumo || 0,
    mes_precio_max_nombre: mesMaxPrecio?.mes_nombre || '',
    mes_precio_max_eur_kwh: mesMaxPrecio?.precio || 0,
    tarifa_top_coste: tarifaTopCoste?.tarifa || '',
    tarifa_top_coste_eur: tarifaTopCoste?.total_coste || 0,
    tarifa_top_coste_pct: coste_total_eur > 0 ? (tarifaTopCoste?.total_coste || 0) / coste_total_eur * 100 : 0,
    tarifa_top_consumo: tarifaTopConsumo?.tarifa || '',
    tarifa_top_consumo_kwh: tarifaTopConsumo?.total_consumo || 0,
    tarifa_top_consumo_pct: consumo_total_kwh > 0 ? (tarifaTopConsumo?.total_consumo || 0) / consumo_total_kwh * 100 : 0,
    tarifa_precio_max: tarifaMaxPrecio?.tarifa || '',
    tarifa_precio_max_eur_kwh: tarifaMaxPrecio?.precio_medio || 0,
    tarifa_precio_min: tarifaMinPrecio?.tarifa || '',
    tarifa_precio_min_eur_kwh: tarifaMinPrecio?.precio_medio || 0,
    calidad_consumo_pct_faltante: 0, // Se calcular\u00eda con datos m\u00e1s detallados
    calidad_precio_pct_faltante: 0,
    potencias_disponibles_pct,
    potencias_faltantes_pct: 100 - potencias_disponibles_pct,
    desviaciones_sugeridas,
  };
}

/**
 * Calcula las potencias agregadas por tarifa con cobertura
 */
function calcularPotenciasTarifa(
  tarifa: string,
  inventario: InventarioSuministro[]
): PotenciasTarifaDraft {
  const puntosTarifa = inventario.filter(p => p.tarifa === tarifa);
  const puntosTotales = puntosTarifa.length;
  
  // Contar puntos con al menos una potencia vÃ¡lida
  const puntosConPotencia = puntosTarifa.filter(p => 
    p.potencias_contratadas.p1 !== null || 
    p.potencias_contratadas.p2 !== null ||
    p.potencias_contratadas.p3 !== null ||
    p.potencias_contratadas.p4 !== null ||
    p.potencias_contratadas.p5 !== null ||
    p.potencias_contratadas.p6 !== null
  ).length;
  
  const cobertura_pct = puntosTotales > 0 ? (puntosConPotencia / puntosTotales) * 100 : 0;
  
  const sumarPotencia = (key: keyof InventarioSuministro['potencias_contratadas']) => {
    const valores = puntosTarifa
      .map(p => p.potencias_contratadas[key])
      .filter((v): v is number => v !== null);
    return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) : null;
  };
  
  const potencias: PotenciasTarifaDraft = {
    p1_kw: sumarPotencia('p1'),
    p2_kw: sumarPotencia('p2'),
    p3_kw: sumarPotencia('p3'),
    p4_kw: sumarPotencia('p4'),
    p5_kw: sumarPotencia('p5'),
    p6_kw: sumarPotencia('p6'),
    periodos_disponibles: 0,
    periodos_totales: 6,
    puntos_con_potencia: puntosConPotencia,
    puntos_totales: puntosTotales,
    cobertura_pct,
    alerta_resumen: null,
  };
  
  // Contar periodos disponibles
  potencias.periodos_disponibles = [
    potencias.p1_kw,
    potencias.p2_kw,
    potencias.p3_kw,
    potencias.p4_kw,
    potencias.p5_kw,
    potencias.p6_kw,
  ].filter(v => v !== null).length;
  
  // Generar alerta segÃºn cobertura
  if (cobertura_pct < 10) {
    potencias.alerta_resumen = `Cobertura muy baja: ${cobertura_pct.toFixed(0)}% (${puntosConPotencia}/${puntosTotales} puntos)`;
  } else if (cobertura_pct < 60) {
    potencias.alerta_resumen = `Cobertura limitada: ${cobertura_pct.toFixed(0)}% (${puntosConPotencia}/${puntosTotales} puntos)`;
  } else if (potencias.periodos_disponibles < 3) {
    potencias.alerta_resumen = 'Potencias incompletas por periodo';
  }
  
  return potencias;
}

/**
 * Calcula los extremos Top3/Bottom3 por tarifa
 * NOTA: Los CUPS se almacenan SIN ENMASCARAR. El enmascarado se hace solo en UI si es necesario.
 */
function calcularExtremosTarifa(
  tarifa: ResumenPorTarifa,
  inventario: InventarioSuministro[],
  facturacionPorPunto: Map<string, { consumo: number; coste: number; precio: number }>
): ExtremosTarifaDraft | null {
  const puntosTarifa = inventario.filter(p => p.tarifa === tarifa.tarifa);
  if (puntosTarifa.length === 0) return null;
  
  // Obtener datos de facturación por punto
  const puntosConDatos = puntosTarifa
    .map(p => ({
      cups: p.cups,  // SIN enmascarar
      ...facturacionPorPunto.get(p.punto_id) || { consumo: 0, coste: 0, precio: 0 },
    }))
    .filter(p => p.consumo > 0 || p.coste > 0);
  
  if (puntosConDatos.length === 0) return null;
  
  // Ordenar por consumo (descendente)
  const porConsumo = [...puntosConDatos].sort((a, b) => b.consumo - a.consumo);
  const top_consumo = porConsumo.slice(0, 3).map(p => ({
    cups: p.cups,
    valor: p.consumo,
    precio_medio_eur_kwh: p.precio,
  }));
  const bottom_consumo = porConsumo.slice(-3).reverse().map(p => ({
    cups: p.cups,
    valor: p.consumo,
    precio_medio_eur_kwh: p.precio,
  }));
  
  // Ordenar por coste (descendente)
  const porCoste = [...puntosConDatos].sort((a, b) => b.coste - a.coste);
  const top_coste = porCoste.slice(0, 3).map(p => ({
    cups: p.cups,
    valor: p.coste,
    precio_medio_eur_kwh: p.precio,
  }));
  const bottom_coste = porCoste.slice(-3).reverse().map(p => ({
    cups: p.cups,
    valor: p.coste,
    precio_medio_eur_kwh: p.precio,
  }));
  
  return {
    top_consumo,
    bottom_consumo,
    top_coste,
    bottom_coste,
  };
}

/**
 * Transforma datos de auditorÃ­a a formato de tarifa del draft
 */
function transformarDatosTarifa(
  tarifa: ResumenPorTarifa,
  inventario: InventarioSuministro[],
  facturacionPorPunto: Map<string, { consumo: number; coste: number; precio: number }>
): DatosTarifaDraft {
  const puntosTarifa = inventario.filter(p => p.tarifa === tarifa.tarifa);
  
  const defaultMensual = { mes: '', mes_nombre: '', consumo_total: 0, coste_total: 0, precio_medio_kwh: 0, puntos_activos: 0 };
  // Encontrar mes con mÃ¡ximos
  const mesMaxCoste = tarifa.datos_mensuales.reduce((max, m) => 
    m.coste_total > max.coste_total ? m : max, tarifa.datos_mensuales[0] ?? defaultMensual);
  const mesMaxConsumo = tarifa.datos_mensuales.reduce((max, m) => 
    m.consumo_total > max.consumo_total ? m : max, tarifa.datos_mensuales[0] ?? defaultMensual);
  const mesMaxPrecio = tarifa.datos_mensuales.reduce((max, m) => 
    m.precio_medio_kwh > max.precio_medio_kwh ? m : max, tarifa.datos_mensuales[0] ?? defaultMensual);
  
  return {
    tarifa_nombre: tarifa.tarifa,
    consumo_kwh: tarifa.total_consumo,
    coste_eur: tarifa.total_coste,
    precio_eur_kwh: tarifa.precio_medio,
    facturas_n: tarifa.datos_mensuales.reduce((sum, m) => sum + m.puntos_activos, 0),
    puntos_n: puntosTarifa.length,
    mes_coste_max_nombre: mesMaxCoste?.mes_nombre || '',
    mes_coste_max_eur: mesMaxCoste?.coste_total || 0,
    mes_consumo_max_nombre: mesMaxConsumo?.mes_nombre || '',
    mes_consumo_max_kwh: mesMaxConsumo?.consumo_total || 0,
    mes_precio_max_nombre: mesMaxPrecio?.mes_nombre || '',
    mes_precio_max_eur_kwh: mesMaxPrecio?.precio_medio_kwh || 0,
    datos_mensuales: tarifa.datos_mensuales.map(m => ({
      mes: m.mes,
      mes_nombre: m.mes_nombre,
      consumo_kwh: m.consumo_total,
      coste_eur: m.coste_total,
      precio_eur_kwh: m.precio_medio_kwh,
      facturas_n: m.puntos_activos,
    })),
    potencias: calcularPotenciasTarifa(tarifa.tarifa, inventario),
    extremos: calcularExtremosTarifa(tarifa, inventario, facturacionPorPunto),
  };
}

// ============================================================================
// GENERACIÃ“N DE NARRATIVA
// ============================================================================

/**
 * Genera la narrativa para la secciÃ³n de portada
 */
function generarNarrativaPortada(kpis: KPIsGlobales): NarrativeSection {
  const texto = interpolatePlantilla(CATALOGO_PLANTILLAS.PORTADA.base, kpis);
  return createEmptyNarrativeSection(texto);
}

function generarNarrativaPortadaSublinea(): NarrativeSection {
  return createEmptyNarrativeSection(CATALOGO_PLANTILLAS.PORTADA.sublinea);
}

/**
 * Genera la narrativa para la secciÃ³n de alcance
 */
function generarNarrativaAlcance(kpis: KPIsGlobales): NarrativeSection {
  const template = kpis.meses_n === 1 
    ? CATALOGO_PLANTILLAS.ALCANCE.variante_1_mes 
    : CATALOGO_PLANTILLAS.ALCANCE.base;
  const texto = interpolatePlantilla(template, kpis);
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para la secciÃ³n de metodologÃ­a
 */
function generarNarrativaMetodologia(kpis: KPIsGlobales): NarrativeSection {
  let texto = CATALOGO_PLANTILLAS.METODOLOGIA.base;
  
  // AÃ±adir variante si hay datos incompletos
  if (kpis.calidad_consumo_pct_faltante > UMBRAL_DATOS_INCOMPLETOS || 
      kpis.calidad_precio_pct_faltante > UMBRAL_DATOS_INCOMPLETOS) {
    texto += '\n\n' + CATALOGO_PLANTILLAS.METODOLOGIA.variante_datos_incompletos;
  }
  
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para el resumen ejecutivo
 */
function generarNarrativaResumenEjecutivo(kpis: KPIsGlobales): NarrativeSection {
  let texto = interpolatePlantilla(CATALOGO_PLANTILLAS.RESUMEN_EJECUTIVO.base, kpis);
  
  // AÃ±adir variante segÃºn nÃºmero de tarifas
  if (kpis.tarifas_n === 1) {
    texto += '\n\n' + interpolatePlantilla(CATALOGO_PLANTILLAS.RESUMEN_EJECUTIVO.variante_1_tarifa, kpis);
  } else {
    texto += '\n\n' + interpolatePlantilla(CATALOGO_PLANTILLAS.RESUMEN_EJECUTIVO.variante_multitarifa, kpis);
  }
  
  // AÃ±adir nota de calidad de datos si aplica
  if (kpis.calidad_consumo_pct_faltante > UMBRAL_DATOS_INCOMPLETOS || 
      kpis.calidad_precio_pct_faltante > UMBRAL_DATOS_INCOMPLETOS) {
    texto += '\n\n' + interpolatePlantilla(CATALOGO_PLANTILLAS.RESUMEN_EJECUTIVO.variante_calidad_datos, kpis);
  }
  
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para el anÃ¡lisis de tarifas
 */
function generarNarrativaAnalisisTarifas(kpis: KPIsGlobales): NarrativeSection {
  const template = kpis.tarifas_n === 1 
    ? CATALOGO_PLANTILLAS.ANALISIS_TARIFAS.variante_1_tarifa 
    : CATALOGO_PLANTILLAS.ANALISIS_TARIFAS.base;
  const texto = interpolatePlantilla(template, kpis);
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para la evoluciÃ³n mensual
 */
function generarNarrativaEvolucionMensual(kpis: KPIsGlobales): NarrativeSection {
  const template = kpis.meses_n === 1 
    ? CATALOGO_PLANTILLAS.EVOLUCION_MENSUAL.variante_1_mes 
    : CATALOGO_PLANTILLAS.EVOLUCION_MENSUAL.base;
  const texto = interpolatePlantilla(template, kpis);
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para el anÃ¡lisis de potencias
 */
function generarNarrativaPotencias(kpis: KPIsGlobales): NarrativeSection {
  let texto = interpolatePlantilla(CATALOGO_PLANTILLAS.POTENCIAS.base, kpis);
  
  // AÃ±adir variante si potencias incompletas
  if (kpis.potencias_faltantes_pct > UMBRAL_POTENCIAS_INCOMPLETAS) {
    texto += '\n\n' + CATALOGO_PLANTILLAS.POTENCIAS.variante_potencias_incompletas;
  }
  
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para la secciÃ³n de extremos
 */
function generarNarrativaExtremos(): NarrativeSection {
  return createEmptyNarrativeSection(CATALOGO_PLANTILLAS.EXTREMOS.base);
}

/**
 * Genera la narrativa para limitaciones
 */
function generarNarrativaLimitaciones(): NarrativeSection {
  return createEmptyNarrativeSection(CATALOGO_PLANTILLAS.LIMITACIONES.sugerencia);
}

/**
 * Genera la narrativa para desviaciones (incluye texto base + lista autogenerada)
 */
function generarNarrativaDesviaciones(kpis: KPIsGlobales): NarrativeSection {
  let texto = CATALOGO_PLANTILLAS.DESVIACIONES.base;
  
  // Añadir desviaciones autogeneradas
  if (kpis.desviaciones_sugeridas.length > 0) {
    texto += '\n\nDesviaciones identificadas:\n';
    kpis.desviaciones_sugeridas.forEach((desv, idx) => {
      texto += `${idx + 1}. ${desv}\n`;
    });
  }
  
  return createEmptyNarrativeSection(texto);
}

/**
 * Genera la narrativa para la conclusiÃ³n
 */
function generarNarrativaConclusion(kpis: KPIsGlobales): NarrativeSection {
  let texto: string;
  
  if (kpis.tarifas_n === 1) {
    texto = interpolatePlantilla(CATALOGO_PLANTILLAS.CONCLUSION.variante_1_tarifa, kpis);
  } else {
    texto = interpolatePlantilla(CATALOGO_PLANTILLAS.CONCLUSION.base, kpis);
  }
  
  // AÃ±adir nota de calidad si aplica
  if (kpis.calidad_consumo_pct_faltante > UMBRAL_DATOS_INCOMPLETOS || 
      kpis.calidad_precio_pct_faltante > UMBRAL_DATOS_INCOMPLETOS) {
    texto += '\n\n' + CATALOGO_PLANTILLAS.CONCLUSION.variante_calidad_datos;
  }
  
  return createEmptyNarrativeSection(texto);
}

// ============================================================================
// FUNCIÃ“N PRINCIPAL DE GENERACIÃ“N
// ============================================================================

/**
 * Genera un ReportDraft completo a partir de los datos de auditorÃ­a
 */
export function generateReportDraft(
  auditoriaData: AuditoriaEnergeticaData,
  config: {
    clienteId: UUID;
    clienteNombre: string;
    puntoIds: UUID[];
    fechaInicio: string;
    fechaFin: string;
    titulo: string;
  }
): ReportDraft {
  // Crear draft vacÃ­o inicial
  const draft = createEmptyReportDraft(
    config.clienteId,
    config.puntoIds,
    config.fechaInicio,
    config.fechaFin,
    config.titulo,
    config.clienteNombre
  );
  
  // Calcular KPIs globales
  const kpis = calcularKPIsGlobales(auditoriaData, config.clienteNombre);
  draft.kpis_globales = kpis;
  
  // Construir mapa de facturación por punto desde datos REALES de la RPC
  const facturacionPorPunto = new Map<string, { consumo: number; coste: number; precio: number }>();
  if (auditoriaData.facturacion_por_punto) {
    auditoriaData.facturacion_por_punto.forEach(punto => {
      facturacionPorPunto.set(punto.punto_id, {
        consumo: punto.consumo_total,
        coste: punto.coste_total,
        precio: punto.precio_medio,
      });
    });
  }
  
  // Transformar datos por tarifa
  draft.por_tarifa = auditoriaData.resumen_por_tarifa.map(t => 
    transformarDatosTarifa(t, auditoriaData.inventario_suministros, facturacionPorPunto)
  );
  
  // Generar narrativa
  draft.narrativa = {
    portada: generarNarrativaPortada(kpis),
    portada_sublinea: generarNarrativaPortadaSublinea(),
    alcance: generarNarrativaAlcance(kpis),
    metodologia: generarNarrativaMetodologia(kpis),
    resumen_ejecutivo: generarNarrativaResumenEjecutivo(kpis),
    analisis_tarifas: generarNarrativaAnalisisTarifas(kpis),
    evolucion_mensual: generarNarrativaEvolucionMensual(kpis),
    potencias: generarNarrativaPotencias(kpis),
    extremos: generarNarrativaExtremos(),
    limitaciones: generarNarrativaLimitaciones(),
    desviaciones: generarNarrativaDesviaciones(kpis),
    conclusion: generarNarrativaConclusion(kpis),
  };
  
  return draft;
}

// ============================================================================
// FUNCIÃ“N PARA CONSTRUIR PAYLOAD FINAL
// ============================================================================

import type { FinalReportPayload, ReportPayloadTarifa } from './reportDraftTypes';
import { getFinalText } from './reportDraftTypes';

/**
 * Construye el payload final para enviar a la Edge Function de generaciÃ³n de PDF
 */
export function buildFinalReportPayload(draft: ReportDraft): FinalReportPayload {
  const secciones: FinalReportPayload['secciones'] = {
    portada: getFinalText(draft.narrativa.portada),
    portada_sublinea: getFinalText(draft.narrativa.portada_sublinea),
    alcance: getFinalText(draft.narrativa.alcance),
    metodologia: getFinalText(draft.narrativa.metodologia),
    resumen_ejecutivo: getFinalText(draft.narrativa.resumen_ejecutivo),
    analisis_tarifas: getFinalText(draft.narrativa.analisis_tarifas),
    evolucion_mensual: getFinalText(draft.narrativa.evolucion_mensual),
    potencias: getFinalText(draft.narrativa.potencias),
    extremos: getFinalText(draft.narrativa.extremos),
    limitaciones: getFinalText(draft.narrativa.limitaciones),
    desviaciones: getFinalText(draft.narrativa.desviaciones),
    conclusion: getFinalText(draft.narrativa.conclusion),
  };
  
  // Incluir recomendaciones SOLO si estÃ¡ habilitado
  if (draft.recomendaciones_enabled && draft.recomendaciones_text.trim()) {
    secciones.recomendaciones = draft.recomendaciones_text;
  }
  
  const tarifas: ReportPayloadTarifa[] = draft.por_tarifa.map(t => ({
    tarifa_nombre: t.tarifa_nombre,
    consumo_kwh: t.consumo_kwh,
    coste_eur: t.coste_eur,
    precio_eur_kwh: t.precio_eur_kwh,
    datos_mensuales: t.datos_mensuales,
    potencias: t.potencias,
    extremos: t.extremos,
  }));
  
  return {
    metadata: {
      titulo: draft.metadata.titulo,
      cliente_id: draft.metadata.cliente_id,
      punto_ids: draft.metadata.punto_ids,
      fecha_inicio: draft.metadata.fecha_inicio,
      fecha_fin: draft.metadata.fecha_fin,
    },
    kpis: draft.kpis_globales,
    secciones,
    tarifas,
  };
}


