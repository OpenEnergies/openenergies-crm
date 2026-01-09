// src/components/SearchableSelect.tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    subtitle?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    icon?: React.ReactNode;
    error?: string;
    disabled?: boolean;
    allowEmpty?: boolean;
    emptyLabel?: string;
    labelClassName?: string;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Buscar...',
    label,
    icon,
    error,
    disabled = false,
    allowEmpty = true,
    emptyLabel = 'Ninguno',
    labelClassName,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filtrar opciones según el término de búsqueda
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Obtener la opción seleccionada
    const selectedOption = options.find(opt => opt.value === value);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Navegar con teclado
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    const selected = filteredOptions[highlightedIndex];
                    if (selected) {
                        onChange(selected.value);
                        setIsOpen(false);
                        setSearchTerm('');
                    }
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm('');
                break;
        }
    };

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchTerm('');
    };

    return (
        <div className="form-group" ref={containerRef}>
            {label && (
                <label className={`text-sm font-medium flex items-center gap-2 ${labelClassName || 'text-fenix-500'}`}>
                    {icon}
                    {label}
                </label>
            )}

            <div className="relative">
                {/* Campo de búsqueda/display */}
                <div
                    className={`glass-input cursor-pointer flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                        } ${error ? 'border-red-500' : ''}`}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                    }}
                >
                    <div className="flex-1 flex items-center gap-2">
                        {icon && <span className="text-secondary">{icon}</span>}
                        {isOpen ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                className="flex-1 bg-transparent border-0 outline-none text-primary"
                                disabled={disabled}
                            />
                        ) : (
                            <span className={`flex-1 ${!selectedOption ? 'text-secondary opacity-60' : 'text-primary'}`}>
                                {selectedOption ? selectedOption.label : placeholder}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {allowEmpty && selectedOption && !disabled && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-secondary hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <ChevronDown
                            size={16}
                            className={`text-fenix-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </div>

                {/* Dropdown de opciones */}
                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-bg-secondary border border-primary rounded-xl py-2 shadow-2xl z-[9999] max-h-60 overflow-y-auto">
                        {allowEmpty && (
                            <button
                                type="button"
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === ''
                                    ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 font-medium'
                                    : 'text-secondary hover:bg-bg-intermediate hover:text-primary'
                                    }`}
                                onClick={() => handleSelect('')}
                            >
                                {emptyLabel}
                            </button>
                        )}

                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-secondary text-sm text-center">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${option.value === value
                                        ? 'bg-fenix-500/20 text-fenix-600 dark:text-fenix-400 font-medium'
                                        : index === highlightedIndex
                                            ? 'bg-bg-intermediate text-primary'
                                            : 'text-secondary hover:bg-bg-intermediate hover:text-primary'
                                        }`}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    <div className="font-medium">{option.label}</div>
                                    {option.subtitle && (
                                        <div className="text-xs text-secondary mt-0.5">{option.subtitle}</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {error && <p className="form-error">{error}</p>}
        </div>
    );
}
