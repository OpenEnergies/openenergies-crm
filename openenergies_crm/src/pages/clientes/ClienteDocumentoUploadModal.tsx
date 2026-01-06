import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { buildStoragePath, joinPath } from '@lib/utils';
import { FileUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

const schema = z.object({
  tipo: z.string().min(1, "El tipo de documento es obligatorio"),
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
        tipo: values.tipo,
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

  return (
    <div className="modal-overlay">
      <form onSubmit={handleSubmit(onSubmit)} className="modal-content card">
        <h3 style={{ marginTop: 0 }}>Subir Documento</h3>
        <div className="grid" style={{ gap: '1.5rem' }}>
          <div>
            <label htmlFor="tipo">Tipo de Documento</label>
            <input id="tipo" placeholder="Ej: Factura Enero, Contrato..." {...register('tipo')} />
            {errors.tipo && <p className="error-text">{errors.tipo.message}</p>}
          </div>
          <div>
            <label>Archivo</label>
            <div className="file-input-wrapper">
              <label htmlFor="archivo" className="file-input-button"><FileUp size={18} /><span>Seleccionar archivo</span></label>
              <input id="archivo" type="file" onChange={(e) => setValue('archivo', e.target.files?.[0] as File, { shouldValidate: true })} style={{ display: 'none' }} />
              {selectedFile && <span className="file-name">{selectedFile.name}</span>}
            </div>
            {errors.archivo && <p className="error-text">{errors.archivo.message as any}</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Subiendo…' : 'Subir'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
