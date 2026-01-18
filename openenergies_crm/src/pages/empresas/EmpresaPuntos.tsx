import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import PuntosList from '@pages/puntos/PuntosList';

export default function EmpresaPuntos() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id });

  return (
    <PuntosList empresaId={empresaId} />
  );
}
