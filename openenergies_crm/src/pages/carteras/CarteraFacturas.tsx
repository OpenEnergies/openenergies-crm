import { useParams } from '@tanstack/react-router';
import ClienteFacturas from '@pages/clientes/ClienteFacturas';
import { useGrupoClienteDetail } from '@hooks/useGruposClientes';

export default function CarteraFacturas() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data: grupo } = useGrupoClienteDetail(id);

  return <ClienteFacturas clienteIds={grupo?.cliente_ids || []} />;
}
