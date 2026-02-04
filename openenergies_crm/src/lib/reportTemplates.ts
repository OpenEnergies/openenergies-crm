// openenergies_crm/src/lib/reportTemplates.ts
// Catálogo de plantillas para generación de narrativa de informes

// ============================================================================
// CATÁLOGO DE PLANTILLAS
// ============================================================================

export const CATALOGO_PLANTILLAS = {
  // -------------------------------------------------------------------------
  // A) PORTADA
  // -------------------------------------------------------------------------
  PORTADA: {
    base: `Informe de auditoría energética de {cliente_nombre}. Periodo analizado: {fecha_inicio} – {fecha_fin}.`,
    sublinea: `Resumen de consumos, costes, precio medio del kWh y potencias demandadas a partir de la facturación registrada.`,
  },

  // -------------------------------------------------------------------------
  // B) ALCANCE DEL ESTUDIO
  // -------------------------------------------------------------------------
  ALCANCE: {
    base: `Este informe analiza la facturación energética del cliente {cliente_nombre} durante el periodo {fecha_inicio} – {fecha_fin}. El análisis se realiza a partir de {tarifas_n} tarifas con facturación registrada, que incluyen {puntos_n} puntos de suministro y {facturas_n} facturas.
Se incluyen indicadores de consumo (kWh), coste total (€), precio medio del kWh (€/kWh) y un análisis agregado de potencias contratadas por tarifa.`,
    variante_1_mes: `Este informe analiza la facturación energética del cliente {cliente_nombre} en el mes incluido en el periodo {fecha_inicio} – {fecha_fin}. Los resultados se muestran agregados por tarifa con énfasis en los principales indicadores del mes.`,
  },

  // -------------------------------------------------------------------------
  // C) METODOLOGÍA
  // -------------------------------------------------------------------------
  METODOLOGIA: {
    base: `La información se ha procesado con criterios homogéneos para garantizar comparabilidad:

• Agregación por tarifa y por mes de consumo, coste y precio medio.
• Cálculo del precio medio del kWh como media ponderada por consumo cuando la información está disponible.
• Evaluación de potencias demandadas a partir de los datos de puntos de suministro (p1–p6), agregadas por tarifa.
• Identificación de valores extremos (máximos y mínimos) por tarifa para consumo y coste, sin realizar un desglose punto a punto más allá de dichos extremos.`,
    variante_datos_incompletos: `Nota sobre calidad de datos: parte de las facturas no contienen información completa de consumo o precio. En esos casos, los indicadores que dependen de dichas magnitudes se han calculado únicamente con el subconjunto de registros con datos disponibles, evitando suposiciones.`,
  },

  // -------------------------------------------------------------------------
  // D) RESUMEN EJECUTIVO
  // -------------------------------------------------------------------------
  RESUMEN_EJECUTIVO: {
    base: `Durante el periodo {fecha_inicio} – {fecha_fin}, el cliente {cliente_nombre} presenta un consumo total de {consumo_total_kwh} kWh y un coste total de {coste_total_eur} €. El precio medio del kWh en el periodo se sitúa en {precio_medio_eur_kwh} €/kWh.
El análisis incluye {tarifas_n} tarifas y {puntos_n} puntos de suministro con facturación en el periodo.`,
    variante_multitarifa: `La tarifa con mayor peso en el coste total es {tarifa_top_coste}, con {tarifa_top_coste_eur} € ({tarifa_top_coste_pct}% del coste). En consumo, destaca {tarifa_top_consumo} con {tarifa_top_consumo_kwh} kWh ({tarifa_top_consumo_pct}% del total).
El mes con mayor coste es {mes_coste_max_nombre} ({mes_coste_max_eur} €) y el mes con mayor consumo es {mes_consumo_max_nombre} ({mes_consumo_max_kwh} kWh).`,
    variante_1_tarifa: `En el periodo analizado, toda la facturación se concentra en una única tarifa, lo que facilita la comparación mensual de consumo, coste y precio. El mes con mayor coste es {mes_coste_max_nombre} ({mes_coste_max_eur} €) y el mes con mayor consumo es {mes_consumo_max_nombre} ({mes_consumo_max_kwh} kWh).`,
    variante_calidad_datos: `Calidad de datos: {calidad_consumo_pct_faltante}% de las facturas no incluyen consumo y {calidad_precio_pct_faltante}% no incluyen precio. Los indicadores de precio medio se basan en los registros con información completa.`,
  },

  // -------------------------------------------------------------------------
  // E) ANÁLISIS POR TARIFAS
  // -------------------------------------------------------------------------
  ANALISIS_TARIFAS: {
    base: `La distribución por tarifas permite identificar diferencias relevantes en consumo, coste y precio medio del kWh. En el periodo analizado, la tarifa con mayor precio medio es {tarifa_precio_max} ({tarifa_precio_max_eur_kwh} €/kWh), mientras que la más competitiva en precio medio es {tarifa_precio_min} ({tarifa_precio_min_eur_kwh} €/kWh).
Estas diferencias pueden deberse a cambios de precio entre meses y a la composición del consumo facturado en cada tarifa, por lo que se recomienda interpretar los resultados conjuntamente con la evolución mensual.`,
    variante_1_tarifa: `Al existir una única tarifa en el periodo, el análisis se centra en la evolución mensual de consumo, coste y precio medio del kWh, identificando los meses con mayor desviación respecto a la media del periodo.`,
  },

  // -------------------------------------------------------------------------
  // F) EVOLUCIÓN MENSUAL
  // -------------------------------------------------------------------------
  EVOLUCION_MENSUAL: {
    base: `La evolución mensual muestra variaciones en consumo, coste y precio medio. En el periodo analizado, el mayor coste se registra en {mes_coste_max_nombre} ({mes_coste_max_eur} €) y el mayor consumo en {mes_consumo_max_nombre} ({mes_consumo_max_kwh} kWh).
El precio medio mensual alcanza su máximo en {mes_precio_max_nombre} ({mes_precio_max_eur_kwh} €/kWh), lo que sugiere la conveniencia de revisar ese intervalo para entender su impacto en el coste total.`,
    variante_1_mes: `Dado que el periodo incluye un único mes, el análisis se centra en el reparto del consumo y coste entre tarifas, así como en el precio medio observado para el mes.`,
  },

  // -------------------------------------------------------------------------
  // G) ANÁLISIS DE POTENCIAS
  // -------------------------------------------------------------------------
  POTENCIAS: {
    titulo_fijo: `Potencia contratada agregada (suma de puntos con datos)`,
    nota_explicativa_fija: `Las potencias mostradas corresponden a la suma de las potencias contratadas de los puntos de suministro con información disponible para esta tarifa. No representan un valor individual ni una recomendación de dimensionamiento.`,
    base: `Se ha analizado la potencia contratada agregada por tarifa utilizando la información disponible en los puntos de suministro (p1–p6). Este análisis permite identificar tarifas con potencias relativamente elevadas y evaluar la completitud de datos de potencia.
En conjunto, la disponibilidad de datos de potencia es del {potencias_disponibles_pct}% (faltante {potencias_faltantes_pct}%).`,
    variante_potencias_incompletas: `Observación: la información de potencia presenta un grado de incompletitud significativo. Las conclusiones sobre potencia se interpretan como orientativas y se limitan a los puntos con datos registrados.`,
    variante_cobertura_baja: `Advertencia: cobertura de potencias inferior al 60%. El análisis de potencias se presenta con carácter orientativo debido a datos limitados.`,
    variante_cobertura_muy_baja: `Advertencia: cobertura de potencias inferior al 10%. No se presentan conclusiones técnicas sobre potencias debido a insuficiencia de datos.`,
  },

  // -------------------------------------------------------------------------
  // H) EXTREMOS POR TARIFA
  // -------------------------------------------------------------------------
  EXTREMOS: {
    base: `Para cada tarifa se han identificado los puntos de suministro con mayor y menor consumo y coste dentro del periodo analizado. Este enfoque permite detectar concentraciones de consumo o gasto sin realizar un desglose técnico individualizado por punto. Las diferencias observadas se explican por el nivel de consumo y el precio medio facturado.`,
  },

  // -------------------------------------------------------------------------
  // I) LIMITACIONES
  // -------------------------------------------------------------------------
  LIMITACIONES: {
    sugerencia: `Este informe se basa en la información disponible en las facturas y en los datos registrados para los puntos de suministro. No incluye curvas horarias ni desgloses técnicos avanzados (por ejemplo, reactiva o penalizaciones específicas) cuando no están presentes en los datos de origen. En caso de datos incompletos, ciertos indicadores se calculan sobre el subconjunto con información disponible.`,
  },

  // -------------------------------------------------------------------------
  // J) DESVIACIONES OBSERVADAS
  // -------------------------------------------------------------------------
  DESVIACIONES: {
    base: `Durante la revisión se han identificado aspectos destacables como concentraciones de consumo o coste en determinadas tarifas, picos puntuales de precio o meses con mayor impacto económico. Estas desviaciones se interpretan a partir de consumo, coste, precio medio y potencia agregada disponibles.`,
  },

  // -------------------------------------------------------------------------
  // K) CONCLUSIÓN FINAL
  // -------------------------------------------------------------------------
  CONCLUSION: {
    base: `En el periodo {fecha_inicio} – {fecha_fin}, el comportamiento energético del cliente presenta diferencias relevantes por tarifa y por mes. La concentración del coste en {tarifa_top_coste} y la presencia de picos en {mes_coste_max_nombre} sugieren que el análisis mensual y por tarifa es clave para priorizar acciones de optimización.
El análisis de potencias, agregado por tarifa, aporta una visión adicional sobre el dimensionamiento de suministro, si bien su interpretación depende de la completitud de los datos registrados.`,
    variante_1_tarifa: `En el periodo {fecha_inicio} – {fecha_fin}, el comportamiento energético se concentra en una única tarifa, destacando variaciones mensuales en consumo, coste y precio medio del kWh. El análisis de potencias agregado complementa la lectura económica del suministro, en función de la disponibilidad de datos.`,
    variante_calidad_datos: `Nota: parte de las conclusiones se interpretan con cautela debido a datos incompletos en consumo o precio en un porcentaje relevante de facturas.`,
  },
} as const;

// ============================================================================
// TIPOS PARA PLANTILLAS
// ============================================================================

export type PlantillaSeccion = keyof typeof CATALOGO_PLANTILLAS;
export type PlantillaVariante<S extends PlantillaSeccion> = keyof typeof CATALOGO_PLANTILLAS[S];

// ============================================================================
// FUNCIONES DE INTERPOLACIÓN
// ============================================================================

/**
 * Reemplaza placeholders {variable} en una plantilla con valores reales.
 * Formatea números automáticamente según el tipo de variable.
 */
export function interpolatePlantilla<T extends object>(
  template: string,
  variables: T
): string {
  const vars = variables as Record<string, unknown>;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    
    if (value === null || value === undefined) {
      return '—';
    }
    
    if (typeof value === 'number') {
      // Formatear según el tipo de variable
      if (key.includes('_pct')) {
        return value.toFixed(1);
      }
      if (key.includes('_eur_kwh') || key.includes('precio')) {
        return value.toFixed(4);
      }
      if (key.includes('_eur')) {
        return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (key.includes('_kwh') || key.includes('_kw')) {
        return value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      }
      return value.toLocaleString('es-ES');
    }
    
    return String(value);
  });
}

/**
 * Formatea una fecha ISO a formato legible
 */
export function formatFecha(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formatea un mes YYYY-MM a nombre legible
 */
export function formatMesNombre(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = parts[0] ?? '2024';
  const month = parts[1] ?? '01';
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Enmascara un CUPS mostrando solo los últimos caracteres
 */
export function maskCUPS(cups: string, visibleChars: number = 8): string {
  if (!cups || cups.length <= visibleChars) return cups;
  const masked = '*'.repeat(cups.length - visibleChars);
  return masked + cups.slice(-visibleChars);
}
