import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa } from '@lib/types';
import { empresasEditRoute } from '@router/routes';

const schema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  cif: z.string().optional().nullable(),
  tipo: z.string().min(1, 'El tipo es obligatorio'), // p.ej., 'comercializadora'
});

type FormData = z.infer<typeof schema>;

export default function EmpresaForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);
  
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (!editing) return;
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresas').select('*').eq('id', id!).maybeSingle();
      if (error) setServerError(`Error al cargar la empresa: ${error.message}`);
      if (data) reset(data as Empresa);
    };
    fetchEmpresa();
  }, [editing, id, reset]);

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      if (editing) {
        const { error } = await supabase.from('empresas').update(values).eq('id', id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empresas').insert(values);
        if (error) throw error;
      }
      navigate({ to: '/app/empresas' });
    } catch (e: any) {
      setServerError(`Error al guardar: ${e.message}`);
    }
  }

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>{editing ? 'Editar empresa' : 'Nueva empresa'}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}
          
          <div>
            <label htmlFor="nombre">Nombre de la empresa</label>
            <input id="nombre" {...register('nombre')} />
            {errors.nombre && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.nombre.message}</p>}
          </div>

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label htmlFor="cif">CIF (opcional)</label>
              <input id="cif" {...register('cif')} />
            </div>
            <div>
              <label htmlFor="tipo">Tipo de empresa</label>
              <select id="tipo" {...register('tipo')}>
                  <option value="comercializadora">Comercializadora</option>
                  <option value="distribuidora">Distribuidora</option>
                  <option value="transportista">Transportista</option>
                  <option value="openenergies">Interna (Open Energies)</option>
              </select>
              {errors.tipo && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.tipo.message}</p>}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/empresas' })}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}