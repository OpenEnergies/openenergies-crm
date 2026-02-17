import type { RolUsuario } from './types';

export function canSeeModule(rol: RolUsuario, module: 'empresas' | 'usuarios' | 'tarifas' | 'puntos' | 'contratos' | 'clientes' | 'documentos' | 'facturas' | 'consumos' | 'remesas' | 'notificaciones' | 'estadisticas' | 'comparativas' | 'agenda' | 'renovaciones' | 'canales'): boolean {
  // Mínimo viable según resumen de reglas y RLS (front solo para navegación)
  const matrix: Record<RolUsuario, string[]> = {
    administrador: ['empresas', 'usuarios', 'tarifas', 'puntos', 'contratos', 'clientes', 'documentos', 'facturas', 'consumos', 'remesas', 'notificaciones', 'estadisticas', 'comparativas', 'agenda', 'renovaciones', 'canales'],
    comercial: ['puntos', 'clientes', 'documentos', 'estadisticas', 'facturas'],
    cliente: ['documentos', 'puntos', 'facturas', 'estadisticas'] // área de cliente
  };
  return matrix[rol].includes(module);
}

export const isAdmin = (rol?: RolUsuario | null) => rol === 'administrador';
