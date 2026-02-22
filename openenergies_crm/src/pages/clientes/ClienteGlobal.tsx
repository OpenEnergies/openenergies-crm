import React from 'react';
import { useParams } from '@tanstack/react-router';
import { clienteDetailRoute } from '@router/routes';
import ClientInsightsWidget, { CostBreakdownWidget } from '@components/dashboard/ClientInsightsWidget';

export default function ClienteGlobal() {
    const { id: clienteId } = useParams({ from: clienteDetailRoute.id });

    return (
        <div className="space-y-6 animate-fade-in w-full">
            <ClientInsightsWidget clienteId={clienteId} />
            <CostBreakdownWidget clienteId={clienteId} />
        </div>
    );
}
