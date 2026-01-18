import { useForm } from 'react-hook-form';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { buildStoragePath } from '@lib/utils';
import { FileUp, Upload, X, Loader2, Users, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import type { Cliente } from '@lib/types';

const schema = z.object({
  cliente_id: z.string().uuid({ message: "Debes seleccionar un cliente" }),
  tipo: z.string().min(1, "El tipo de documento es obligatorio"),
  archivo: z.instanceof(File, { message: 'Debes seleccionar un archivo' }),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function DocumentoUploadModal({ onClose, onSuccess }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);

  const selectedFile = watch('archivo');
  const selectedClienteId = watch('cliente_id');

  useEffect(() => {
    setLoadingClientes(true);
    supabase
      .from('clientes')
      .select('id, nombre')
      .is('eliminado_en', null)
      .order('nombre')
      .then(({ data }) => {
        setClientes((data ?? []) as Cliente[]);
        setLoadingClientes(false);
      });
  }, []);

  async function onSubmit(values: FormData) {
    const file = values.archivo;
    const path = buildStoragePath({ clienteId: values.cliente_id, fileName: file.name });

    try {
      const { error: uploadError } = await supabase.storage.from('documentos').upload(path, file);
      if (uploadError) throw uploadError;

      const meta = {
        cliente_id: values.cliente_id,
        tipo: values.tipo,
        ruta_storage: path,
        nombre_archivo: file.name,
        mime_type: file.type,
        tamano_bytes: file.size,
      };

      const { error: insertError } = await supabase.from('documentos').insert(meta);
      if (insertError) throw insertError;

      toast.success('Documento subido correctamente.');
      onSuccess();
    } catch (e: any) {
      toast.error(`Error al subir el documento: ${e.message}`);
    }
  }

  const selectedCliente = clientes.find(c => c.id === selectedClienteId);

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
            className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Selector de Cliente */}
          <div>
            <label htmlFor="cliente_id" className="block text-sm font-medium text-gray-300 mb-2">
              Cliente
            </label>
            {loadingClientes ? (
              <div className="flex items-center gap-2 p-3 text-gray-500">
                <Loader2 className="animate-spin w-4 h-4" />
                <span>Cargando clientes...</span>
              </div>
            ) : (
              <div className="relative">
                <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  id="cliente_id"
                  {...register('cliente_id')}
                  className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-bg-intermediate rounded-xl text-white appearance-none cursor-pointer focus:ring-2 focus:ring-fenix-500/50 focus:border-fenix-500 transition-all [&>option]:bg-gray-800 [&>option]:text-white"
                >
                  <option value="" className="bg-gray-800 text-gray-400">Selecciona un cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            )}
            {errors.cliente_id && <p className="text-sm text-red-400 mt-1">{errors.cliente_id.message}</p>}
          </div>

          {/* Tipo de documento */}
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Documento
            </label>
            <div className="relative">
              <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="tipo"
                placeholder="Ej: Factura Enero, DNI, Contrato..."
                {...register('tipo')}
                className="w-full pl-10 px-4 py-3 bg-bg-intermediate border border-bg-intermediate rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-fenix-500/50 focus:border-fenix-500 transition-all"
              />
            </div>
            {errors.tipo && <p className="text-sm text-red-400 mt-1">{errors.tipo.message}</p>}
          </div>

          {/* Selector de archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Archivo
            </label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="archivo"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fenix-500/10 hover:bg-fenix-500/20 text-fenix-500 font-medium cursor-pointer transition-colors"
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
              className="btn-secondary cursor-pointer"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedClienteId}
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

