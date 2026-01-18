import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import ContratosList from '@pages/contratos/ContratosList';

export default function EmpresaContratos() {
  const { id: empresaId } = useParams({ from: empresaDetailRoute.id });

  return (
    <ContratosList empresaId={empresaId} />
  );
}
