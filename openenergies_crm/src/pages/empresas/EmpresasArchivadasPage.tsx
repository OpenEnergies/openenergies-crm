// src/pages/empresas/EmpresasArchivadasPage.tsx
import EmpresasList from './EmpresasList'; // Importa el componente de lista modificado

/**
 * Este componente ahora solo renderiza la lista en modo 'archivado'.
 * Toda la lógica del encabezado (incluido el botón "Volver")
 * se ha movido a 'EmpresasList.tsx' para evitar saltos de layout.
 */
export default function EmpresasArchivadasPage() {
  return (
    <div className="grid">
      {/* Renderiza el componente de lista, que ahora
          incluye su propia cabecera adaptada. */}
      <EmpresasList mode="archived" />
    </div>
  );
}