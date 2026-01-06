interface HamburgerButtonProps {
    readonly isOpen: boolean;
    readonly onClick: () => void;
}

export function HamburgerButton({ isOpen, onClick }: HamburgerButtonProps) {
    return (
        <button
            className="
        relative w-10 h-10 flex items-center justify-center
        rounded-lg
        text-gray-400 hover:text-white hover:bg-bg-intermediate
        transition-colors duration-150
        touch-target
      "
            onClick={onClick}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
        >
            <div className="w-5 h-4 relative flex flex-col justify-between">
                <span
                    className={`
            block w-full h-0.5 bg-current rounded-full
            transition-all duration-300 origin-center
            ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}
          `}
                />
                <span
                    className={`
            block w-full h-0.5 bg-current rounded-full
            transition-all duration-200
            ${isOpen ? 'opacity-0 scale-0' : 'opacity-100'}
          `}
                />
                <span
                    className={`
            block w-full h-0.5 bg-current rounded-full
            transition-all duration-300 origin-center
            ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}
          `}
                />
            </div>
        </button>
    );
}
