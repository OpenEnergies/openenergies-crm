import { useForm } from 'react-hook-form';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { buildStoragePath, joinPath } from '@lib/utils';
import { FileUp, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const schema = z.object({
  archivo: z.instanceof(File, { message: 'Debes seleccionar un archivo' }),
});
type FormData = z.infer<typeof schema>;

interface Props {
  clienteId: string;
  currentPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClienteDocumentoUploadModal({ clienteId, currentPath, onClose, onSuccess }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const selectedFile = watch('archivo');

  async function onSubmit(values: FormData) {
    const file = values.archivo;
    // Construimos la ruta completa, incluyendo las subcarpetas
    const finalDirPath = joinPath('clientes', clienteId, currentPath); // Construye el directorio de destino
    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; // Nombre seguro con timestamp
    const filePath = joinPath(finalDirPath, safeFileName);
    try {
      const { error: uploadError } = await supabase.storage.from('documentos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const meta = {
        cliente_id: clienteId,
        ruta_storage: filePath,
        nombre_archivo: file.name,
        mime_type: file.type,
        tamano_bytes: file.size,
      };

      const { error: insertError } = await supabase.from('documentos').insert(meta);
      if (insertError) throw insertError;

      toast.success('Documento subido correctamente.');
      onSuccess(); // Llama a la función de éxito (refrescar y cerrar)
    } catch (e: any) {
      toast.error(`Error al subir el documento: ${e.message}`);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop con blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      {/* Modal */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative z-10 w-full max-w-md glass-modal p-6"
        style={{ transform: 'perspective(1000px) rotateX(0deg)', transformStyle: 'preserve-3d' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-500 flex items-center gap-2">
            <Upload size={22} className="text-fenix-500" />
            Subir Documento
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Selector de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Archivo
            </label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="archivo"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fenix-500/10 hover:bg-fenix-500/20 text-fenix-400 font-medium cursor-pointer transition-colors"
              >
                <FileUp size={18} />
                <span>Seleccionar archivo</span>
              </label>
              <input
                id="archivo"
                type="file"
                onChange={(e) => setValue('archivo', e.target.files?.[0] as File, { shouldValidate: true })}
                className="hidden"
              />
              {selectedFile && (
                <span className="text-sm text-gray-400 truncate max-w-[180px]">
                  {selectedFile.name}
                </span>
              )}
            </div>
            {errors.archivo && <p className="text-sm text-red-400 mt-1">{errors.archivo.message as any}</p>}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-5 border-t border-bg-intermediate">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-600 text-white font-medium shadow-lg shadow-fenix-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Subiendo...' : 'Subir Archivo'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
