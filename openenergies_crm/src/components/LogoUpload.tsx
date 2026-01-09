// src/components/LogoUpload.tsx
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

interface LogoUploadProps {
    empresaId?: string;
    currentLogoUrl: string | null | undefined;
    onLogoChange: (url: string | null) => void;
    /** If true, uploads immediately. If false, returns the file for later processing */
    immediateUpload?: boolean;
    onFileSelect?: (file: File | null) => void;
}

/**
 * Converts an image file to PNG format using Canvas
 */
async function convertToPng(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            if (ctx) {
                // Draw white background for transparency (optional)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to convert image to PNG'));
                        }
                    },
                    'image/png',
                    1.0
                );
            } else {
                reject(new Error('Could not get canvas context'));
            }
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        // Handle SVG files specially
        if (file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        } else {
            img.src = URL.createObjectURL(file);
        }
    });
}

export default function LogoUpload({
    empresaId,
    currentLogoUrl,
    onLogoChange,
    immediateUpload = true,
    onFileSelect
}: LogoUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync preview with currentLogoUrl prop changes
    useState(() => {
        if (currentLogoUrl !== previewUrl && !pendingFile) {
            setPreviewUrl(currentLogoUrl || null);
        }
    });

    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Formato no permitido. Usa PNG, JPG, JPEG o SVG.');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('El archivo no puede superar 5MB.');
            return;
        }

        // Create preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setPendingFile(file);

        if (onFileSelect) {
            onFileSelect(file);
        }

        // If immediate upload and we have an empresaId, upload now
        if (immediateUpload && empresaId) {
            await uploadLogo(file, empresaId);
        }
    }, [empresaId, immediateUpload, onFileSelect]);

    const uploadLogo = async (file: File, targetEmpresaId: string) => {
        setUploading(true);
        try {
            // Convert to PNG
            const pngBlob = await convertToPng(file);
            const pngFile = new File([pngBlob], `logo.png`, { type: 'image/png' });

            // Generate unique filename
            const fileName = `${targetEmpresaId}/${Date.now()}.png`;

            // Delete old logo if exists
            if (currentLogoUrl) {
                const oldPath = currentLogoUrl.split('/logos_empresas/')[1];
                if (oldPath) {
                    await supabase.storage.from('logos_empresas').remove([oldPath]);
                }
            }

            // Upload new logo
            const { error: uploadError } = await supabase.storage
                .from('logos_empresas')
                .upload(fileName, pngFile, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('logos_empresas')
                .getPublicUrl(fileName);

            // Update empresas table
            const { error: updateError } = await supabase
                .from('empresas')
                .update({ logo_url: publicUrl })
                .eq('id', targetEmpresaId);

            if (updateError) throw updateError;

            setPreviewUrl(publicUrl);
            setPendingFile(null);
            onLogoChange(publicUrl);
            toast.success('Logo actualizado correctamente');
        } catch (error: any) {
            toast.error(`Error al subir logo: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveLogo = async () => {
        // If there's just a pending file (not uploaded), just clear it
        if (pendingFile && !currentLogoUrl) {
            setPreviewUrl(null);
            setPendingFile(null);
            if (onFileSelect) onFileSelect(null);
            return;
        }

        if (!empresaId || !currentLogoUrl) {
            setPreviewUrl(null);
            setPendingFile(null);
            if (onFileSelect) onFileSelect(null);
            onLogoChange(null);
            return;
        }

        setUploading(true);
        try {
            const oldPath = currentLogoUrl.split('/logos_empresas/')[1];
            if (oldPath) {
                await supabase.storage.from('logos_empresas').remove([oldPath]);
            }

            const { error } = await supabase
                .from('empresas')
                .update({ logo_url: null })
                .eq('id', empresaId);

            if (error) throw error;

            setPreviewUrl(null);
            setPendingFile(null);
            onLogoChange(null);
            toast.success('Logo eliminado');
        } catch (error: any) {
            toast.error(`Error al eliminar logo: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    // Expose upload function for parent components
    const triggerUpload = async (targetId: string) => {
        if (pendingFile) {
            await uploadLogo(pendingFile, targetId);
        }
    };

    return (
        <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <ImageIcon size={16} />
                Logo de la empresa
            </label>

            <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="w-20 h-20 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center overflow-hidden">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Logo preview"
                            className="w-full h-full object-contain p-1"
                        />
                    ) : (
                        <Upload className="w-6 h-6 text-secondary opacity-50" />
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {previewUrl ? 'Cambiar' : 'Subir logo'}
                    </button>

                    {previewUrl && (
                        <button
                            type="button"
                            onClick={handleRemoveLogo}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                            Eliminar
                        </button>
                    )}
                </div>
            </div>

            <p className="text-xs text-secondary opacity-70">
                Formatos: PNG, JPG, JPEG, SVG. Se convertirá a PNG. Máx: 5MB
            </p>
        </div>
    );
}

// Export the upload helper for use in forms
export { convertToPng };
