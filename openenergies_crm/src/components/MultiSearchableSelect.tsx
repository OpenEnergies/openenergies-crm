// src/components/MultiSearchableSelect.tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Loader2, Check } from 'lucide-react';

export interface Option {
    value: string;
    label: string;
    subtitle?: string;
    disabled?: boolean;
}

interface MultiSearchableSelectProps {
    options: Option[];
    selectedValues: string[] | null; // null represents "Todos"
    onChange: (values: string[] | null) => void;
    onSearch?: (term: string) => void;
    onDisabledClick?: (option: Option) => void;
    placeholder?: string;
    label?: string;
    icon?: React.ReactNode;
    isLoading?: boolean;
    disabled?: boolean;
    allLabel?: string;
    showChips?: boolean;
}

export default function MultiSearchableSelect({
    options,
    selectedValues,
    onChange,
    onSearch,
    onDisabledClick,
    placeholder = 'Buscar...',
    label,
    icon,
    isLoading = false,
    disabled = false,
    allLabel = 'Todos',
    showChips = true
}: MultiSearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isAllSelected = selectedValues === null;

    // Filter options locally if no external onSearch is provided
    const displayOptions = useMemo(() => {
        if (onSearch) return options;
        return options.filter(opt =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            opt.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm, onSearch]);

    // Close on click outside
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

    // Debounced search for external querying
    useEffect(() => {
        if (!onSearch) return;
        const handler = setTimeout(() => {
            onSearch(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, onSearch]);

    const handleToggleSelect = (option: Option | 'ALL') => {
        if (disabled) return;

        if (option === 'ALL') {
            onChange(null);
            setIsOpen(false);
            setSearchTerm('');
            return;
        }

        if (option.disabled) {
            onDisabledClick?.(option);
            return;
        }

        const value = option.value;
        let newValues: string[];
        if (isAllSelected) {
            newValues = [value];
        } else {
            const current = selectedValues || [];
            if (current.includes(value)) {
                newValues = current.filter(v => v !== value);
            } else {
                newValues = [...current, value];
            }
        }

        onChange(newValues.length === 0 ? [] : newValues);
    };

    const handleRemoveValue = (value: string) => {
        if (disabled || isAllSelected) return;
        const current = selectedValues || [];
        const newValues = current.filter(v => v !== value);
        onChange(newValues.length === 0 ? [] : newValues);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
    };

    const selectedOptions = isAllSelected
        ? []
        : options.filter(opt => selectedValues?.includes(opt.value));

    return (
        <div className="space-y-2" ref={containerRef}>
            {label && (
                <label className="text-xs font-bold text-fenix-500 uppercase tracking-wider flex items-center gap-2">
                    {icon} {label}
                </label>
            )}

            <div className="relative">
                <div
                    className={`glass-input cursor-pointer flex items-center justify-between min-h-[42px] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                    }}
                >
                    <div className="flex-1 flex items-center gap-2 overflow-hidden">
                        {isOpen ? (
                            <div className="flex items-center gap-2 w-full">
                                <Search size={14} className="text-secondary opacity-60 shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder={placeholder}
                                    className="flex-1 bg-transparent border-0 outline-none text-primary text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        ) : (
                            <span className="text-sm text-primary truncate px-1">
                                {isAllSelected ? allLabel : (selectedValues?.length ? `${selectedValues.length} seleccionado(s)` : placeholder)}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pr-1">
                        {isLoading && <Loader2 size={14} className="text-fenix-400 animate-spin" />}
                        {!isAllSelected && !disabled && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="text-secondary hover:text-red-500 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                        <ChevronDown
                            size={16}
                            className={`text-fenix-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </div>

                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#141424] border border-bg-intermediate rounded-xl py-2 shadow-2xl z-[9999] max-h-60 overflow-y-auto custom-scrollbar">
                        <button
                            type="button"
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${isAllSelected
                                ? 'bg-fenix-500/10 text-fenix-600 dark:text-fenix-400 font-bold'
                                : 'text-secondary hover:bg-bg-intermediate hover:text-primary'
                                }`}
                            onClick={() => handleToggleSelect('ALL')}
                        >
                            <span>{allLabel}</span>
                            {isAllSelected && <Check size={14} />}
                        </button>

                        <div className="h-px bg-primary my-1" />

                        {isLoading && displayOptions.length === 0 ? (
                            <div className="px-4 py-3 text-gray-500 text-sm text-center flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" /> Buscando...
                            </div>
                        ) : displayOptions.length === 0 ? (
                            <div className="px-4 py-3 text-secondary text-sm text-center">
                                No se encontraron resultados
                            </div>
                        ) : (
                            displayOptions.map((option: Option) => {
                                const isSelected = !isAllSelected && selectedValues?.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-start justify-between gap-3 ${isSelected
                                            ? 'bg-fenix-500/10 text-fenix-600 dark:text-fenix-400 font-bold'
                                            : option.disabled
                                                ? 'opacity-40 cursor-default'
                                                : 'text-primary hover:bg-bg-intermediate'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSelect(option);
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate flex items-center gap-2">
                                                {option.label}
                                                {option.disabled && (
                                                    <span className="text-[10px] bg-bg-intermediate px-1.5 py-0.5 rounded text-secondary uppercase font-bold">Sin Facturas</span>
                                                )}
                                            </div>
                                            {option.subtitle && (
                                                <div className="text-[10px] text-secondary mt-0.5 truncate leading-tight">{option.subtitle}</div>
                                            )}
                                        </div>
                                        {isSelected && <Check size={14} className="shrink-0 mt-0.5" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {showChips && (
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                    {isAllSelected ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fenix-500/10 text-fenix-400 text-[10px] font-bold border border-fenix-500/20">
                            <Check size={10} />
                            {allLabel}
                        </div>
                    ) : (
                        selectedOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleRemoveValue(opt.value)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-intermediate text-gray-300 text-[10px] hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20 group"
                            >
                                <span className="truncate max-w-[120px]">{opt.label}</span>
                                <X size={10} className="shrink-0 text-secondary group-hover:text-red-500" />
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
