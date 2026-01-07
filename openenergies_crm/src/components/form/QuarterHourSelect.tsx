/**
 * Utilidad para validar horas en cuartos de hora (00, 15, 30, 45)
 */

/**
 * Valida si una hora está en formato de cuarto de hora
 * @param time - Hora en formato "HH:mm"
 * @returns true si los minutos son 00, 15, 30 o 45
 */
export function isQuarterHour(time: string): boolean {
  if (!time) return false;
  
  const parts = time.split(':');
  if (parts.length < 2 || !parts[1]) return false;
  
  const minutes = Number.parseInt(parts[1], 10);
  return [0, 15, 30, 45].includes(minutes);
}

/**
 * Redondea una hora al cuarto de hora más cercano
 * @param time - Hora en formato "HH:mm"
 * @returns Hora redondeada al cuarto de hora más cercano
 */
export function roundToQuarterHour(time: string): string {
  if (!time) return '00:00';
  
  const parts = time.split(':');
  if (parts.length < 2 || !parts[0] || !parts[1]) return '00:00';
  
  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);
  
  const quarterMinutes = Math.round(minutes / 15) * 15;
  const adjustedHours = quarterMinutes === 60 ? hours + 1 : hours;
  const adjustedMinutes = quarterMinutes === 60 ? 0 : quarterMinutes;
  
  return `${adjustedHours.toString().padStart(2, '0')}:${adjustedMinutes.toString().padStart(2, '0')}`;
}

/**
 * Genera opciones de tiempo en intervalos de cuartos de hora
 * @returns Array de opciones { value, label } para un select
 */
export function generateQuarterHourOptions(): Array<{ value: string; label: string }> {
  return Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4).toString().padStart(2, '0');
    const m = ((i % 4) * 15).toString().padStart(2, '0');
    return { value: `${h}:${m}`, label: `${h}:${m}` };
  });
}

