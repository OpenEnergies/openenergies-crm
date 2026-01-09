import { Building2 } from 'lucide-react';
import { EmptyState } from '@components/EmptyState';

export default function EmpresaActividad() {
    return (
        <div className="glass-card p-12">
            <EmptyState
                icon={<Building2 className="text-fenix-500" size={48} />}
                title="Actividad de la Empresa"
                description="Aquí se mostrará el historial de mantenimiento y actividades relacionadas con la empresa."
            />
        </div>
    );
}
