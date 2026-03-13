import { useEffect, useState } from 'react';

const MESSAGES = [
    'Inicializando sistema...',
    'Preparando entorno...',
    'Cargando datos...',
    'Conectando servicios...',
];

export function GlobalLoadingScreen() {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        }, 1500); // Rotate message every 1.5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg-primary transition-colors duration-300">
            <div className="flex flex-col items-center max-w-sm w-full px-6 animate-fade-in">
                {/* Logo Container */}
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-8 relative flex items-center justify-center w-24 h-24">
                    <img
                        src="/logo_openenergies.png"
                        alt="Open Energies Logo"
                        className="w-16 h-16 object-contain"
                    />
                    {/* Subtle pulse effect around logo */}
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-fenix-500/20 animate-pulse"></div>
                </div>

                {/* Loading Message */}
                <div className="h-6 mb-4">
                    <p className="text-secondary text-sm font-medium animate-pulse text-center">
                        {MESSAGES[messageIndex]}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-bg-intermediate rounded-full overflow-hidden">
                    <div className="h-full bg-fenix-500 rounded-full animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
    );
}
