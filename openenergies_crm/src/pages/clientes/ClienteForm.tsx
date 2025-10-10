import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useEmpresaId } from '@hooks/useEmpresaId';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Cliente } from '@lib/types';

const schema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tipo: z.enum(['persona', 'sociedad'], { required_error: 'Debes seleccionar un tipo' }),
  dni: z.string().optional().nullable(),
  cif: z.string().optional().nullable(),
  email_facturacion: z.string().email('Introduce un email válido').optional().nullable().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function ClienteForm({ id }: { id?: string }) {
  const navigate = useNavigate();;
  const editing = Boolean(id);
  const { empresaId, loading: loadingEmpresa } = useEmpresaId();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (!editing) return;
    
    const fetchCliente = async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id!).maybeSingle();
      if (error) {
        setServerError(`Error al cargar el cliente: ${error.message}`);
        return;
      }
      if (data) {
        reset(data as Cliente); // reset actualiza los valores del formulario
      }
    };
    fetchCliente();
  }, [editing, id, reset]);

  async function onSubmit(values: FormData) {
    setServerError(null);
    if (loadingEmpresa || !empresaId) {
      setServerError('No se pudo determinar tu empresa. Recarga la página.');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase.from('clientes').update(values).eq('id', id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert({ ...values, empresa_id: empresaId });
        if (error) throw error;
      }
      navigate({ to: '/app/clientes' });
    } catch (e: any) {
      setServerError(`Error al guardar: ${e.message}`);
    }
  }

  return (
    <div className="grid">
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: '0' }}>{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card">
        <div className="grid" style={{ gap: '1.5rem' }}>
          {serverError && <div role="alert" style={{ color: '#b91c1c' }}>{serverError}</div>}

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label htmlFor="nombre">Nombre o Razón Social</label>
              <input id="nombre" {...register('nombre')} />
              {errors.nombre && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.nombre.message}</p>}
            </div>
            <div>
              <label htmlFor="tipo">Tipo de cliente</label>
              <select id="tipo" {...register('tipo')}>
                <option value="">-- Selecciona --</option>
                <option value="persona">Persona</option>
                <option value="sociedad">Sociedad</option>
              </select>
              {errors.tipo && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label htmlFor="dni">DNI</label>
              <input id="dni" {...register('dni')} placeholder="Para personas físicas" />
            </div>
            <div>
              <label htmlFor="cif">CIF</label>
              <input id="cif" {...register('cif')} placeholder="Para sociedades" />
            </div>
          </div>

          <div>
            <label htmlFor="email_facturacion">Email de facturación</label>
            <input id="email_facturacion" type="email" {...register('email_facturacion')} />
            {errors.email_facturacion && <p style={{ color: 'red', fontSize: '0.8rem' }}>{errors.email_facturacion.message}</p>}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/clientes' })}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
