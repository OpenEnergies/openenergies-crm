import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import type { Cliente } from '@lib/types';

const schema = z.object({
  nombre: z.string().min(2),
  tipo: z.string().min(1), // ej: 'persona' | 'sociedad' (en DB es USER-DEFINED)
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  email_facturacion: z.string().email().optional().nullable()
});

type FormData = z.infer<typeof schema>;

export default function ClienteForm(){
  const navigate = useNavigate();
  const { id } = useParams({ from: '/app/clientes/:id' }) as { id?: string };
    const editing = Boolean(id);
  const { empresaId, loading } = useEmpresaId();

  const { register, handleSubmit, setValue, formState:{errors, isSubmitting} } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(()=>{
    if (!editing) return;
    (async ()=>{
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id!).maybeSingle();
      if (error) { alert(error.message); return; }
      if (!data) { alert('Cliente no encontrado'); return; }
      const c = data as Cliente;
      setValue('nombre', c.nombre);
      setValue('tipo', c.tipo);
      setValue('dni', c.dni);
      setValue('cif', c.cif);
      setValue('email_facturacion', c.email_facturacion);
    })();
  }, [editing, id, setValue]);

  async function onSubmit(values: FormData) {
    if (loading || !empresaId) { alert('No se pudo determinar la empresa'); return; }
    if (editing) {
      const { error } = await supabase.from('clientes').update(values).eq('id', id!);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('clientes').insert({ ...values, empresa_id: empresaId });
      if (error) return alert(error.message);
    }
    navigate({ to: '/app/clientes' });
  }

  return (
    <div className="card" style={{maxWidth:720}}>
      <h2 style={{marginTop:0}}>{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      <form className="grid" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-row">
          <div>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" {...register('nombre')} aria-invalid={!!errors.nombre}/>
            {errors.nombre && <div role="alert" style={{color:'#b91c1c'}}>{errors.nombre.message}</div>}
          </div>
          <div>
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" {...register('tipo')} aria-invalid={!!errors.tipo}>
              <option value="persona">Persona</option>
              <option value="sociedad">Sociedad</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div>
            <label htmlFor="dni">DNI</label>
            <input id="dni" {...register('dni')} />
          </div>
          <div>
            <label htmlFor="cif">CIF</label>
            <input id="cif" {...register('cif')} />
          </div>
        </div>
        <div>
          <label htmlFor="email_facturacion">Email de facturación</label>
          <input id="email_facturacion" type="email" {...register('email_facturacion')} />
        </div>
        <div><button disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </div>
  );
}
