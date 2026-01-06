import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEffect, useState } from 'react';
import type { Cliente } from '@lib/types';
import { buildStoragePath } from '@lib/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import { FileUp } from 'lucide-react'; // Importamos un icono
import { toast } from 'react-hot-toast';

const schema = z.object({
  cliente_id: z.string().uuid({ message: "Debes seleccionar un cliente" }),
  tipo: z.string().min(1, "El tipo de documento es obligatorio"),
  // Zod no puede validar File directamente de forma simple, lo hacemos manualmente
  archivo: z.any().refine(file => file instanceof File, 'Debes seleccionar un archivo'),
});

type FormData = z.infer<typeof schema>;

export default function DocumentoUpload(){
  const navigate = useNavigate();
  const { register, handleSubmit, setValue, watch, formState:{errors, isSubmitting} } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  const selectedFile = watch('archivo');

  useEffect(()=>{
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => setClientes((data ?? []) as any));
  },[]);

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
    } catch(e: any) {
      toast.error(`Error al subir el documento: ${e.message}`);
    }
  }

  return (
    <div className="page-layout">
      <div className="page-header">
        <h2 style={{marginTop:0}}>Subir Documento</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card" style={{maxWidth:720}}>
        <div className="grid" style={{ gap: '1.5rem' }}>
          <div>
            <label htmlFor="cliente_id">Cliente</label>
            <select id="cliente_id" {...register('cliente_id')}>
              <option value="">Selecciona…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {errors.cliente_id && <p className="error-text">{errors.cliente_id.message}</p>}
          </div>

          <div>
            <label htmlFor="tipo">Tipo de Documento</label>
            <input id="tipo" placeholder="Ej: Factura Enero, DNI, Contrato..." {...register('tipo')} />
            {errors.tipo && <p className="error-text">{errors.tipo.message}</p>}
          </div>

          <div>
            <label>Archivo</label>
            <div className="file-input-wrapper">
              <label htmlFor="archivo" className="file-input-button">
                <FileUp size={18} />
                <span>Seleccionar archivo</span>
              </label>
              <input 
                id="archivo" 
                type="file" 
                style={{display: 'none'}}
                // --- ¡CAMBIO CLAVE AQUÍ! ---
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setValue('archivo', file, { shouldValidate: true });
                  }
                }}
              />
              {selectedFile && <span className="file-name">{selectedFile.name}</span>}
            </div>
            {errors.archivo && <p className="error-text">{errors.archivo.message as any}</p>}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <Link to="/app/documentos"><button type="button" className="secondary">Cancelar</button></Link>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Subiendo…' : 'Subir'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

