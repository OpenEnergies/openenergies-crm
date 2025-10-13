import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa } from '@lib/types';
import { empresasEditRoute } from '@router/routes';
import { Building2, FileText, Tags } from 'lucide-react';

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
      <div className="page-header">
        <h2 style={{ margin: 0 }}>{editing ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}
          
          <div>
            <label htmlFor="nombre">Nombre de la empresa</label>
            <div className="input-icon-wrapper">
              <Building2 size={18} className="input-icon" />
              <input id="nombre" {...register('nombre')} />
            </div>
            {errors.nombre && <p className="error-text">{errors.nombre.message}</p>}
          </div>

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem'}}>
            <div>
              <label htmlFor="cif">CIF (opcional)</label>
              <div className="input-icon-wrapper">
                <FileText size={18} className="input-icon" />
                <input id="cif" {...register('cif')} />
              </div>
            </div>
            <div>
              <label htmlFor="tipo">Tipo de empresa</label>
              <div className="input-icon-wrapper">
                <Tags size={18} className="input-icon" />
                <select id="tipo" {...register('tipo')}>
                    <option value="comercializadora">Comercializadora</option>
                    <option value="distribuidora">Distribuidora</option>
                    <option value="transportista">Transportista</option>
                    <option value="openenergies">Interna (Open Energies)</option>
                </select>
              </div>
              {errors.tipo && <p className="error-text">{errors.tipo.message}</p>}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem' }}>
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