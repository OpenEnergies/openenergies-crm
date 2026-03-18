import { useParams } from '@tanstack/react-router';
import PuntosList from '@pages/puntos/PuntosList';
import { useGrupoClienteDetail } from '@hooks/useGruposClientes';

export default function CarteraPuntos() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data: grupo } = useGrupoClienteDetail(id);

  return <PuntosList clienteIds={grupo?.cliente_ids || []} />;
}
