import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@lib/supabase';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef  } from 'react';
import type { Empresa } from '@lib/types';
import { empresasEditRoute } from '@router/routes';
import { Building2, FileText, Tags, Image as ImageIcon, UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MAX_LOGO_BYTES = 512 * 1024; // 512 KB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'];

const schema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  cif: z.string().optional().nullable(),
  tipo: z.string().min(1, 'El tipo es obligatorio'), // p.ej., 'comercializadora'
});

type FormData = z.infer<typeof schema>;

export default function EmpresaForm({ id }: { id?: string }) {
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
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

  useEffect(() => {
    if (!editing || !id) return;
    // Si quieres intentar JPG/SVG como fallback desde aquí (opcional),
    // puedes quedarse solo con PNG aquí y gestionar fallbacks en <img onError> si lo deseas.
  }, [editing, id]);

  function handleLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error('Formato no permitido. Usa PNG, JPG o SVG.');
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`El logo supera ${Math.round(MAX_LOGO_BYTES/1024)} KB.`);
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    // Preview
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      toast.success('Logo cargado correctamente');
    };
    reader.readAsDataURL(file);
    setLogoFile(file);
    setLogoDirty(true);
  }
  async function onSubmit(values: FormData) {
    setServerError(null);
    try {
      let empresaId = id;

      if (editing) {
        if (isDirty) { // solo actualiza la tabla si hay cambios en inputs
          const { error } = await supabase.from('empresas').update(values).eq('id', id!);
          if (error) throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('empresas')
          .insert(values)
          .select('id')
          .single();
        if (error) throw error;
        empresaId = data.id as string;
      }

      // Subir logo si hay
      if (logoFile && empresaId) {
        // Determinar extensión por MIME
        const ext = logoFile.type === 'image/png'
          ? 'png'
          : logoFile.type === 'image/jpeg'
            ? 'jpg'
            : logoFile.type === 'image/svg+xml'
              ? 'svg'
              : null;

        if (!ext) {
          toast.error('Tipo de logo no soportado.');
        } else {
          const path = `${empresaId}.${ext}`;
          const { error: upErr } = await supabase
            .storage
            .from('logos_empresas')
            .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
          if (upErr) throw upErr;
          const { data: publicUrlData } = supabase
          .storage
          .from('logos_empresas')
          .getPublicUrl(path);

          const newLogoPublicUrl = `${publicUrlData.publicUrl}?t=${new Date().getTime()}`;

          const { error: updateUrlError } = await supabase
            .from('empresas')
            .update({ logo_url: newLogoPublicUrl })
            .eq('id', empresaId);

          if (updateUrlError) {
            toast.error(`Logo subido, pero error al guardar URL: ${updateUrlError.message}`);
          }
          setLogoDirty(false);
        }
      }

      // Mostrar mensaje de éxito y navegar fuera del bloque de subida de logo
      if (isDirty || logoFile) {
        toast.success(editing ? 'Empresa actualizada' : 'Empresa creada');
      } else {
        toast.success('No hay cambios que guardar.');
      }
      navigate({ to: '/app/empresas' });

    } catch (e: any) {
      console.error("Error al guardar:", e);
      const errorMessage = `Error al guardar: ${e.message}`;
      setServerError(errorMessage);
      toast.error(errorMessage);
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
                    <option value="openenergies">Interna (Open Energies)</option>
                </select>
              </div>
              {errors.tipo && <p className="error-text">{errors.tipo.message}</p>}
            </div>
          </div>
          <div>
            <label>Logo de la empresa</label>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div
                style={{
                  width: 96, height: 48, border: '1px dashed #d1d5db',
                  borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center',
                  background:'#fff'
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                title="Subir logo"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:6, color:'#6b7280' }}>
                    <UploadCloud size={16} />
                    <span style={{ fontSize:12 }}>Subir logo</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                style={{ display:'none' }}
                onChange={handleLogoPick}
              />
              <div style={{ fontSize:12, color:'#6b7280' }}>
                Formatos: PNG, JPG, SVG. Máx {Math.round(MAX_LOGO_BYTES/1024)} KB.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem' }}>
            <button type="button" className="secondary" onClick={() => navigate({ to: '/app/empresas' })}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting || (!isDirty && !logoDirty)}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}