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
