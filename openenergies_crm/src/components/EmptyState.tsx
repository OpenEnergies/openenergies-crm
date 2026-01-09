import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  cta?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, cta, icon }: EmptyStateProps) {
  return (
    <div
      className="glass-card text-center py-12 px-6"
      role="status"
      aria-live="polite"
    >
      {/* Icono opcional */}
      <div className="flex justify-center mb-4">
        {icon ?? (
          <div className="w-16 h-16 rounded-full bg-fenix-500/10 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-fenix-500" />
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold text-primary mb-2">
        {title}
      </h3>

      <p className="text-secondary mb-6 max-w-sm mx-auto">
        {description}
      </p>

      {cta && (
        <div className="flex justify-center">
          {cta}
        </div>
      )}
    </div>
  );
}
