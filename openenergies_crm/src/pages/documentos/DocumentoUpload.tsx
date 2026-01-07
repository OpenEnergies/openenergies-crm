import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEffect, useState } from 'react';
import type { Cliente } from '@lib/types';
import { buildStoragePath } from '@lib/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import { FileUp, ArrowLeft, Users, FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';

const schema = z.object({
  cliente_id: z.string().uuid({ message: "Debes seleccionar un cliente" }),
  tipo: z.string().min(1, "El tipo de documento es obligatorio"),
  archivo: z.any().refine(file => file instanceof File, 'Debes seleccionar un archivo'),
});

type FormData = z.infer<typeof schema>;

export default function DocumentoUpload() {
  const navigate = useNavigate();
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const selectedFile = watch('archivo');

  useEffect(() => {
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => setClientes((data ?? []) as any));
  }, []);

  async function onSubmit(values: FormData) {
    const file = values.archivo as File;
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
        tamano_bytes: file.size
      };

      const { error: insertError } = await supabase.from('documentos').insert(meta);
      if (insertError) throw insertError;

      toast.success('Documento subido correctamente.');
      navigate({ to: '/app/documentos' });
    } catch (e: any) {
      toast.error(`Error al subir el documento: ${e.message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: '/app/documentos' })}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Subir Documento</h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Cliente */}
          <div>
            <label htmlFor="cliente_id" className="block text-sm font-medium text-gray-300 mb-2">
              Cliente
            </label>
            <div className="relative">
              <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                id="cliente_id"
                {...register('cliente_id')}
                className="glass-input pl-10 w-full appearance-none cursor-pointer"
              >
                <option value="">Selecciona…</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {errors.cliente_id && <p className="text-sm text-red-400 mt-1">{errors.cliente_id.message}</p>}
          </div>

          {/* Tipo */}
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Documento
            </label>
            <div className="relative">
              <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="tipo"
                placeholder="Ej: Factura Enero, DNI, Contrato..."
                {...register('tipo')}
                className="glass-input pl-10 w-full"
              />
            </div>
            {errors.tipo && <p className="text-sm text-red-400 mt-1">{errors.tipo.message}</p>}
          </div>

          {/* Archivo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Archivo
            </label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="archivo"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-intermediate hover:bg-white/20 text-gray-300 cursor-pointer transition-colors"
              >
                <FileUp size={18} />
                <span>Seleccionar archivo</span>
              </label>
              <input
                id="archivo"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setValue('archivo', file, { shouldValidate: true });
                  }
                }}
              />
              {selectedFile && (
                <span className="text-sm text-gray-400 truncate max-w-xs">
                  {selectedFile.name}
                </span>
              )}
            </div>
            {errors.archivo && <p className="text-sm text-red-400 mt-1">{errors.archivo.message as any}</p>}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-bg-intermediate">
            <Link to="/app/documentos">
              <button
                type="button"
                className="btn-secondary cursor-pointer"
              >
                Cancelar
              </button>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Subiendo…' : 'Subir'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


