// src/components/EmpresaLogo.tsx
import { Building2 } from 'lucide-react';

interface EmpresaLogoProps {
    logoUrl: string | null | undefined;
    nombre: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeConfig = {
    sm: {
        container: 'w-10 h-10',
        text: 'text-sm',
        icon: 16,
    },
    md: {
        container: 'w-12 h-12',
        text: 'text-lg',
        icon: 20,
    },
    lg: {
        container: 'w-14 h-14',
        text: 'text-xl',
        icon: 28,
    },
};

/**
 * Reusable component to display company logos with fallback
 * - Shows logo image if logoUrl is provided
 * - Falls back to company initial or Building2 icon if no logo
 */
export default function EmpresaLogo({
    logoUrl,
    nombre,
    size = 'md',
    className = ''
}: EmpresaLogoProps) {
    const config = sizeConfig[size];

    // Base container classes
    const containerClasses = `
    ${config.container}
    rounded-xl
    bg-white
    flex items-center justify-center
    shrink-0
    ring-1 ring-gray-200
    overflow-hidden
    ${className}
  `.trim();

    // If logo URL exists, show the image
    if (logoUrl) {
        return (
            <div className={containerClasses}>
                <img
                    src={logoUrl}
                    alt={`Logo ${nombre}`}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                        // On error, hide the image and show fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling;
                        if (fallback) {
                            (fallback as HTMLElement).style.display = 'flex';
                        }
                    }}
                />
                {/* Hidden fallback that shows on image error */}
                <span
                    className={`${config.text} font-bold text-gray-600 hidden items-center justify-center w-full h-full`}
                    aria-hidden="true"
                >
                    {nombre.charAt(0).toUpperCase()}
                </span>
            </div>
        );
    }

    // No logo URL - show fallback (initial or icon)
    return (
        <div className={containerClasses}>
            {nombre ? (
                <span className={`${config.text} font-bold text-gray-600`}>
                    {nombre.charAt(0).toUpperCase()}
                </span>
            ) : (
                <Building2 size={config.icon} className="text-secondary opacity-50" />
            )}
        </div>
    );
}
