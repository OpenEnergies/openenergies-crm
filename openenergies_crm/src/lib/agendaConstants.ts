// src/lib/agendaConstants.ts

/** Mapa de etiquetas de eventos de agenda a sus colores por defecto */
export const etiquetaColorMap: Record<string, string> = {
  'Reunión': '#2BB673',     // Verde (primary)
  'Tarea': '#2E87E5',       // Azul (secondary)
  'Llamada': '#f39b03',     // Naranja (warning/standby)
  'Recordatorio': '#8B5CF6', // Morado (purple variable)
  'Personal': '#64748b',     // Gris (muted)
  'Renovación': '#DC2626',   // Rojo (danger)
};

/** Lista de etiquetas que se pueden seleccionar al crear/editar un evento */
export const etiquetasSeleccionables = Object.keys(etiquetaColorMap)
  .filter(et => et !== 'Renovación'); // Excluye 'Renovación'