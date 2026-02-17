// src/pages/clientes/CrearUsuarioClienteModal.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { Mail, Lock, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PasswordInput from '@components/PasswordInput';

const schema = z.object({
    email: z.string().email('Introduce un email válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

interface Props {
    clienteId: string;
    clienteNombre: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CrearUsuarioClienteModal({ clienteId, clienteNombre, open, onClose, onSuccess }: Props) {
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    async function onSubmit(values: FormData) {
        setServerError(null);
        try {
            const { error } = await supabase.functions.invoke('manage-user', {
                body: {
                    action: 'create-client-user',
                    payload: {
                        clienteId,
                        clienteNombre,
                        email: values.email,
                        password: values.password,
                    },
                },
            });

            if (error) throw new Error(error.message);

            toast.success('¡Usuario de acceso creado correctamente!');
            reset();
            onSuccess();
            onClose();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Error inesperado';
            setServerError(message);
            toast.error(message);
        }
    }

    function handleClose() {
        reset();
        setServerError(null);
        onClose();
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 glass-card p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-fenix-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-primary">Crear Usuario</h2>
                            <p className="text-xs text-secondary opacity-70 truncate max-w-[220px]">
                                {clienteNombre}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Info */}
                <p className="text-sm text-secondary opacity-70 mb-5">
                    Se creará un usuario con rol <strong className="text-fenix-500">cliente</strong> vinculado a esta ficha.
                    Comunícale las credenciales de acceso.
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {serverError && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {serverError}
                        </div>
                    )}

                    {/* Email */}
                    <div>
                        <label htmlFor="modal_email" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                            <Mail size={16} />
                            Email de acceso
                        </label>
                        <input
                            id="modal_email"
                            type="email"
                            {...register('email')}
                            placeholder="usuario@ejemplo.com"
                            className="glass-input w-full"
                            autoFocus
                        />
                        {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>}
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="modal_password" className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-tight mb-2">
                            <Lock size={16} />
                            Contraseña
                        </label>
                        <PasswordInput
                            id="modal_password"
                            {...register('password')}
                            showIcon={false}
                        />
                        {errors.password && <p className="text-sm text-red-400 mt-1">{errors.password.message}</p>}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-primary/10">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="btn-secondary cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-fenix-500 to-fenix-600 hover:from-fenix-400 hover:to-fenix-500 text-white font-bold shadow-lg shadow-fenix-500/25 hover:shadow-fenix-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                            {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
