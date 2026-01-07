export function buildStoragePath(params: { clienteId: string; fileName: string }) {
  // Estructura clara por cliente
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `clientes/${params.clienteId}/${Date.now()}_${safeName}`;
}

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES');
}

export function clsx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// --- Utils ---
export function joinPath(...segments: Array<string | undefined | null>) {
  return segments
    .filter((s) => typeof s === 'string' && s !== undefined && s !== null && s.trim() !== '')
    .map((s) => (s as string).replace(/^\/+|\/+$/g, ''))
    .join('/');
}

/**
 * Formatea un IBAN con espacios cada 4 caracteres
 * Ejemplo: "ES1234567890123456789012" -> "ES12 3456 7890 1234 5678 9012"
 */
export function formatIBAN(iban: string | null | undefined): string {
  if (!iban) return '—';
  // Eliminar espacios existentes y formatear cada 4 caracteres
  const cleaned = iban.replace(/\s+/g, '');
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}