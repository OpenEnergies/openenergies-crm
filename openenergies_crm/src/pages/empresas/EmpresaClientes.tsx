import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import ClientesList from '@pages/clientes/ClientesList';

export default function EmpresaClientes() {
    const { id: empresaId } = useParams({ from: empresaDetailRoute.id });

    return (
        <ClientesList empresaId={empresaId} />
    );
}
