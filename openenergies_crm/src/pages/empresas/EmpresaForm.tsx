import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Empresa } from '@lib/types';
import { Building2, FileText, Tags, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const schema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  cif: z.string().optional().nullable(),
  tipo: z.string().min(1, 'El tipo es obligatorio'),
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
        toast.success('Empresa actualizada correctamente');
      } else {
        const { error } = await supabase.from('empresas').insert(values);
        if (error) throw error;
        toast.success('Empresa creada correctamente');
      }
      navigate({ to: '/app/empresas' });
    } catch (e: any) {
      setServerError(`Error al guardar: ${e.message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate({ to: '/app/empresas' })}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-emerald-400">
            {editing ? 'Editar Empresa' : 'Nueva Empresa'}
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6">
        <div className="space-y-6">
          {serverError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
              {serverError}
            </div>
          )}

          {/* Nombre */}
          {/* Nombre */}
          <div>
            <label htmlFor="nombre" className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
              <Building2 size={16} />
              Nombre de la empresa
            </label>
            <input
              id="nombre"
              {...register('nombre')}
              className="glass-input w-full"
            />
            {errors.nombre && <p className="text-sm text-red-400 mt-1">{errors.nombre.message}</p>}
          </div>

          {/* CIF + Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cif" className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
                <FileText size={16} />
                CIF (opcional)
              </label>
              <input
                id="cif"
                {...register('cif')}
                className="glass-input w-full"
              />
            </div>
            <div>
              <label htmlFor="tipo" className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
                <Tags size={16} />
                Tipo de empresa
              </label>
              <select
                id="tipo"
                {...register('tipo')}
                className="glass-input w-full appearance-none"
              >
                <option value="comercializadora">Comercializadora</option>
                <option value="fenixnewenergy">Interna (Fenix New Energy)</option>
              </select>
              {errors.tipo && <p className="text-sm text-red-400 mt-1">{errors.tipo.message}</p>}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-bg-intermediate">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate({ to: '/app/empresas' })}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

