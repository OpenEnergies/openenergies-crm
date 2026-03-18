import { useParams } from '@tanstack/react-router';
import ContratosList from '@pages/contratos/ContratosList';
import { useGrupoClienteDetail } from '@hooks/useGruposClientes';

export default function CarteraContratos() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data: grupo } = useGrupoClienteDetail(id);

  return <ContratosList clienteIds={grupo?.cliente_ids || []} />;
}
