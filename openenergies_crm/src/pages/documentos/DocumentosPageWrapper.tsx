// src/pages/documentos/DocumentosPageWrapper.tsx
import { useSession } from '@hooks/useSession';
import DocumentosList from './DocumentosList';
import { Navigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

/**
 * Este componente decide qué vista de "Documentos" mostrar.
 * - Admin/Comercial: Muestra la lista global (DocumentosList).
 * - Cliente: Redirige a su explorador personal (/app/documentos-cliente/).
 */
export default function DocumentosPageWrapper() {
  const { rol, loading } = useSession();

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (rol === 'administrador' || rol === 'comercial') {
    return <DocumentosList />;
  }

  if (rol === 'cliente') {
    // --- CORRECCIÓN AQUÍ ---
    // Redirigir al cliente a su explorador de documentos personal
    // Usamos la ruta con '$' y pasamos un splat vacío en params
    return <Navigate to="/app/documentos-cliente/$" params={{ _splat: '' }} replace />;
    // --- FIN CORRECCIÓN ---
  }

  // Fallback (no debería ocurrir)
  return <div className="card">No tienes permisos para ver esta sección.</div>;
}