// src/pages/documentos/ClienteDocumentosExplorer.tsx
import { useParams } from '@tanstack/react-router';
import { useClienteId } from '@hooks/useClienteId';
import ClienteDocumentos from '../clientes/ClienteDocumentos';
import { Loader2 } from 'lucide-react';
// --- (1) Importar la definición de la ruta ---
import { documentosClienteRoute } from '@router/routes';

// --- (2) Ya no necesitamos exportar el ID aquí ---
// export const documentosClienteRouteId = '/app/documentos-cliente/$';

export default function ClienteDocumentosExplorer() {
  // --- (3) Usar la definición de la ruta en useParams ---
  const { _splat: path } = useParams({ from: documentosClienteRoute.id });
  
  const { clienteId, isLoading } = useClienteId();

  // --- (4) Asegurarse de que clienteId es string antes de renderizar ---
  if (isLoading || typeof clienteId !== 'string') {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin" /> Cargando documentos...
        {/* Podrías añadir un mensaje de error si !isLoading && !clienteId */}
        {!isLoading && !clienteId && <p className="error-text" style={{marginTop: '1rem'}}>No se pudo encontrar la información del cliente.</p>}
      </div>
    );
  }

  // Ahora sabemos que clienteId es un string
  return (
    <ClienteDocumentos
      clienteId={clienteId} // <-- Ahora es seguro pasarlo
      pathSplat={path || ''}
      clientMode={true} 
    />
  );
}