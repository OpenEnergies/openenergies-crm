import { useState, useEffect } from 'react';
import { Plus, X, Phone } from 'lucide-react';

interface MultiPhoneInputProps {
    readonly value?: string;
    readonly onChange: (value: string) => void;
    readonly disabled?: boolean;
    readonly showIcon?: boolean;
}

/**
 * Componente para gestionar múltiples teléfonos
 * Almacena en formato: "telf1 / telf2 / telf3"
 */
export function MultiPhoneInput({ value, onChange, disabled = false, showIcon = true }: MultiPhoneInputProps) {
    // Parsear el valor inicial
    const parsePhones = (val: string | undefined): string[] => {
        if (!val || val.trim() === '') return [''];
        return val.split(' / ').map(p => p.trim()).filter(p => p !== '');
    };

    const [phones, setPhones] = useState<string[]>(() => {
        const parsed = parsePhones(value);
        return parsed.length > 0 ? parsed : [''];
    });

    // Sincronizar cuando cambia el value externo
    useEffect(() => {
        const parsed = parsePhones(value);
        if (parsed.length === 0) {
            setPhones(['']);
        } else {
            setPhones(parsed);
        }
    }, [value]);

    const handlePhoneChange = (index: number, newValue: string) => {
        // Permitir solo números, espacios, +, -, (, )
        const sanitized = newValue.replace(/[^\d\s+\-()]/g, '');

        const newPhones = [...phones];
        newPhones[index] = sanitized;
        setPhones(newPhones);

        // Emitir valor formateado
        const formatted = newPhones.filter(p => p.trim() !== '').join(' / ');
        onChange(formatted);
    };

    const addPhone = () => {
        setPhones([...phones, '']);
    };

    const removePhone = (index: number) => {
        if (phones.length <= 1) return; // Mantener al menos un campo

        const newPhones = phones.filter((_, i) => i !== index);
        setPhones(newPhones);

        // Emitir valor formateado
        const formatted = newPhones.filter(p => p.trim() !== '').join(' / ');
        onChange(formatted);
    };

    return (
        <div className="space-y-2">
            {phones.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                    {/* Input with icon */}
                    <div className="relative flex-1">
                        {showIcon && <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                            placeholder={index === 0 ? 'Teléfono principal' : `Teléfono ${index + 1}`}
                            disabled={disabled}
                            className={`glass-input w-full ${showIcon ? 'pl-10' : ''}`}
                        />
                    </div>

                    {/* Remove button (only if more than one) */}
                    {phones.length > 1 && (
                        <button
                            type="button"
                            onClick={() => removePhone(index)}
                            disabled={disabled}
                            title="Eliminar teléfono"
                            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    )}

                    {/* Add button (only on first field) */}
                    {index === 0 && (
                        <button
                            type="button"
                            onClick={addPhone}
                            disabled={disabled}
                            title="Añadir otro teléfono"
                            className="p-2 rounded-lg text-gray-400 hover:text-fenix-400 hover:bg-fenix-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
