import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEffect, useState } from 'react';
import type { Cliente } from '@lib/types';
import { buildStoragePath } from '@lib/utils';
import { useNavigate } from '@tanstack/react-router';

const schema = z.object({
  cliente_id: z.string().uuid(),
  tipo: z.string().min(1),
  archivo: z.instanceof(File)
});

type FormData = z.infer<typeof schema>;

export default function DocumentoUpload(){
  const navigate = useNavigate();
  const { register, handleSubmit, setValue, formState:{errors, isSubmitting} } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(()=>{
    (async ()=>{
      const { data } = await supabase.from('clientes').select('id, nombre').order('nombre');
      setClientes((data ?? []) as any);
    })();
  },[]);

  async function onSubmit(values: FormData) {
    const file = values.archivo;
    const path = buildStoragePath({ clienteId: values.cliente_id, fileName: file.name });
    const up = await supabase.storage.from('documentos').upload(path, file, { upsert: false });
    if (up.error) return alert(up.error.message);

    const meta = {
      cliente_id: values.cliente_id,
      tipo: values.tipo,
      ruta_storage: path,
      nombre_archivo: file.name,
      mime_type: file.type,
      tamano_bytes: file.size
    };

    const ins = await supabase.from('documentos').insert(meta);
    if (ins.error) return alert(ins.error.message);

    navigate({ to: '/app/documentos' });
  }

  return (
    <div className="card" style={{maxWidth:640}}>
      <h2 style={{marginTop:0}}>Subir documento</h2>
      <form className="grid" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="cliente_id">Cliente</label>
          <select id="cliente_id" {...register('cliente_id')} aria-invalid={!!errors.cliente_id}>
            <option value="">Selecciona…</option>
            {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {errors.cliente_id && <div role="alert" style={{color:'#b91c1c'}}>{errors.cliente_id.message}</div>}
        </div>
        <div>
          <label htmlFor="tipo">Tipo</label>
          <input id="tipo" placeholder="p.ej. factura, contrato, comparativa" {...register('tipo')} />
        </div>
        <div>
          <label htmlFor="archivo">Archivo</label>
          <input id="archivo" type="file" onChange={(e)=> setValue('archivo', e.target.files?.[0] as File)} />
          {errors.archivo && <div role="alert" style={{color:'#b91c1c'}}>{errors.archivo.message as any}</div>}
        </div>
        <div><button disabled={isSubmitting}>{isSubmitting ? 'Subiendo…' : 'Subir'}</button></div>
      </form>
    </div>
  );
}
