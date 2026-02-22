import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import ClientInsightsWidget, { CostBreakdownWidget } from '@components/dashboard/ClientInsightsWidget';

export default function EmpresaGlobal() {
    const { id: empresaId } = useParams({ from: empresaDetailRoute.id });

    return (
        <div className="space-y-6 animate-fade-in">
            <ClientInsightsWidget empresaId={empresaId} />
            <CostBreakdownWidget empresaId={empresaId} />
        </div>
    );
}
