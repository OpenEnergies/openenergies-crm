import type { RolUsuario } from './types';

export function canSeeModule(rol: RolUsuario, module: 'empresas' | 'usuarios'|'tarifas'|'puntos'|'contratos'|'clientes'|'documentos'|'facturas'|'consumos'|'remesas'|'notificaciones'|'estadisticas'|'comparativas'): boolean {
  // Mínimo viable según resumen de reglas y RLS (front solo para navegación)
  const matrix: Record<RolUsuario, string[]> = {
    administrador: ['empresas','usuarios','tarifas','puntos','contratos','clientes','documentos','facturas','consumos','remesas','notificaciones','estadisticas','comparativas'],
    comercializadora: ['usuarios','tarifas','puntos','contratos','clientes','documentos','facturas','consumos','notificaciones','estadisticas','comparativas'],
    comercial: ['puntos','contratos','clientes','documentos','estadisticas','comparativas'],
    cliente: ['documentos','contratos'] // área de cliente
  };
  return matrix[rol].includes(module);
}

export const isAdmin = (rol?: RolUsuario | null) => rol === 'administrador';
