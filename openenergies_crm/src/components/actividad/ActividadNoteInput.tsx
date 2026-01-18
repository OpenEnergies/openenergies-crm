// src/components/actividad/ActividadNoteInput.tsx
// Componente de input para añadir notas manuales al log de actividad

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useInsertarNotaManual } from '@hooks/useActividadLog';
import { useTheme } from '@hooks/ThemeContext';
import toast from 'react-hot-toast';

interface ActividadNoteInputProps {
    clienteId: string | null;
    onSuccess?: () => void;
}

export default function ActividadNoteInput({ clienteId, onSuccess }: ActividadNoteInputProps) {
    const { theme } = useTheme();
    const [nota, setNota] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { mutate: insertarNota, isPending } = useInsertarNotaManual();

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '42px'; // Altura mínima fija
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 42), 120)}px`;
        }
    }, [nota]);

    const handleSubmit = () => {
        if (!nota.trim() || isPending) return;

        insertarNota(
            { clienteId, contenido: nota.trim() },
            {
                onSuccess: () => {
                    setNota('');
                    toast.success('Nota añadida');
                    onSuccess?.();
                },
                onError: (error) => {
                    console.error('Error al añadir nota:', error);
                    toast.error('Error al añadir la nota');
                },
            }
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className={`
      p-4 border-t
      ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
    `}>
            <div className={`
        flex items-center gap-3 rounded-xl transition-all
        ${theme === 'dark'
                    ? 'bg-slate-800 border border-slate-700 focus-within:border-fenix-500/50'
                    : 'bg-slate-100 border border-slate-200 focus-within:border-fenix-400'}
      `}>
                {/* Textarea centrado con altura fija mínima */}
                <textarea
                    ref={textareaRef}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Añadir una nota..."
                    disabled={isPending}
                    rows={1}
                    className={`
            flex-1 resize-none bg-transparent border-0 outline-none text-sm
            py-3 px-4 min-h-[42px] leading-normal
            disabled:opacity-50 
            ${theme === 'dark'
                            ? 'text-slate-200 placeholder:text-slate-500'
                            : 'text-slate-700 placeholder:text-slate-400'}
          `}
                    style={{
                        lineHeight: '1.5',
                        boxSizing: 'border-box',
                    }}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!nota.trim() || isPending}
                    className={`
            p-3 mr-1 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 shrink-0
            ${nota.trim()
                            ? 'bg-fenix-500 hover:bg-fenix-600 text-white shadow-lg shadow-fenix-500/30'
                            : theme === 'dark'
                                ? 'bg-slate-700 text-slate-500'
                                : 'bg-slate-200 text-slate-400'
                        }
          `}
                    title="Enviar nota (Ctrl+Enter)"
                >
                    {isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Send size={18} />
                    )}
                </button>
            </div>
            <p className={`
        text-[10px] mt-2 text-center select-none
        ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}
      `}>
                <kbd className={`
          px-1.5 py-0.5 rounded text-[9px] font-mono
          ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}
        `}>Ctrl</kbd>
                {' + '}
                <kbd className={`
          px-1.5 py-0.5 rounded text-[9px] font-mono
          ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}
        `}>Enter</kbd>
                {' para enviar'}
            </p>
        </div>
    );
}
