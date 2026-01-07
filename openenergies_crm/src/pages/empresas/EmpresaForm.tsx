import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import type { Empresa } from '@lib/types';
import { Building2, FileText, Tags, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LogoUpload, { convertToPng } from '@components/LogoUpload';

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
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (!editing) return;
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresas').select('*').eq('id', id!).maybeSingle();
      if (error) setServerError(`Error al cargar la empresa: ${error.message}`);
      if (data) {
        reset(data as Empresa);
        setCurrentLogoUrl(data.logo_url || null);
      }
    };
    fetchEmpresa();
  }, [editing, id, reset]);

  // Handle logo file selection (for new empresas or delayed upload)
  const handleLogoFileSelect = (file: File | null) => {
    setPendingLogoFile(file);
  };

  // Handle logo URL change (for immediate uploads)
  const handleLogoChange = (url: string | null) => {
    setCurrentLogoUrl(url);
  };

  // Upload logo for a given empresa ID
  async function uploadLogoForEmpresa(file: File, empresaId: string): Promise<string | null> {
    try {
      // Convert to PNG
      const pngBlob = await convertToPng(file);
      const pngFile = new File([pngBlob], `logo.png`, { type: 'image/png' });

      // Generate unique filename
      const fileName = `${empresaId}/${Date.now()}.png`;

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('logos_empresas')
        .upload(fileName, pngFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos_empresas')
        .getPublicUrl(fileName);

      // Update empresas table with logo_url
      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: publicUrl })
        .eq('id', empresaId);

      if (updateError) throw updateError;

      return publicUrl;
    } catch (error: any) {
      toast.error(`Error al subir logo: ${error.message}`);
      return null;
    }
  }

  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      let empresaId = id;

      if (editing) {
        const { error } = await supabase.from('empresas').update(values).eq('id', id!);
        if (error) throw error;
      } else {
        // Create empresa and get the new ID
        const { data, error } = await supabase.from('empresas').insert(values).select('id').single();
        if (error) throw error;
        empresaId = data.id;
      }

      // Upload pending logo if exists
      if (pendingLogoFile && empresaId) {
        setIsUploadingLogo(true);
        await uploadLogoForEmpresa(pendingLogoFile, empresaId);
        setIsUploadingLogo(false);
      }

      toast.success(editing ? 'Empresa actualizada correctamente' : 'Empresa creada correctamente');
      navigate({ to: '/app/empresas' });
    } catch (e: any) {
      setServerError(`Error al guardar: ${e.message}`);
      setIsUploadingLogo(false);
    }
  }

  // Check if form has changes (including logo)
  const hasChanges = isDirty || pendingLogoFile !== null;

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

          {/* Logo Upload */}
          <LogoUpload
            empresaId={editing ? id : undefined}
            currentLogoUrl={currentLogoUrl}
            onLogoChange={handleLogoChange}
            immediateUpload={editing} // Only immediate upload when editing
            onFileSelect={handleLogoFileSelect}
          />

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
                <option value="openenergies">Interna (Open Energies)</option>
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
              disabled={isSubmitting || isUploadingLogo || !hasChanges}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {(isSubmitting || isUploadingLogo) && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting || isUploadingLogo ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
