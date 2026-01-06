import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Upload, Loader2 } from 'lucide-react';

async function uploadAvatar({ userId, file }: { userId: string; file: File }) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${Math.random()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  if (!publicUrlData) throw new Error("No se pudo obtener la URL pública del avatar.");
  const newAvatarPublicUrl = publicUrlData.publicUrl;
  const { error: updateError } = await supabase.from('usuarios_app').update({ avatar_url: newAvatarPublicUrl }).eq('user_id', userId);
  if (updateError) throw updateError;

  return newAvatarPublicUrl;
}

interface AvatarProps {
   userId: string;
   url: string | null;
   onUpload: (newUrl: string) => void; // Cambiado para recibir la nueva URL
   nombre?: string | null; // Nombre del usuario para el fallback
   size?: number; // Tamaño opcional
}

export default function Avatar({ userId, url, onUpload, nombre, size = 150 }: AvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const fallbackInitial = nombre ? nombre.charAt(0).toUpperCase() : '?';

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async (newPublicUrl) => {
      queryClient.invalidateQueries({ queryKey: ['sessionData'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      await queryClient.refetchQueries({ queryKey: ['sessionData'], exact: true }); 
      onUpload(newPublicUrl); // Llama al callback con la nueva URL
      toast.success('Avatar actualizado correctamente.');
    },
    onError: (error) => {
      toast.error(`Error al subir el avatar: ${error.message}`);
    },
    onMutate: () => setUploading(true),
    onSettled: () => setUploading(false),
  });

  useEffect(() => {
    setAvatarUrl(url);
  }, [url]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Usamos encadenamiento opcional para más seguridad al obtener el archivo
    const file = event.target.files?.[0];

    // ¡CAMBIO CLAVE! Solo continuamos si 'file' realmente existe.
    if (file && userId) {
      uploadMutation.mutate({ userId, file });
    } else {
        console.error("No se seleccionó ningún archivo o falta el ID de usuario.");
        toast.error("Selecciona un archivo para subir.");
    }
  };

  return (
    <div style={{ width: size, position: 'relative', margin: 'auto' }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="avatar image"
          style={{ height: size, width: size, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        // --- USA EL FALLBACK CORREGIDO ---
        <div
            className="avatar no-image"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: size,
                width: size,
                borderRadius: '50%',
                backgroundColor: 'var(--muted)', // Color de fondo
                color: 'white',
                fontSize: size / 2.5, // Tamaño de letra proporcional
                fontWeight: 'bold',
                lineHeight: 1, // Ajuste para centrar verticalmente
            }}
        >
            {fallbackInitial}
        </div>
      )}
      {/* Botón flotante para subir archivo */}
      <div style={{ position: 'absolute', bottom: 0, right: 0 }}>
          <label htmlFor="avatar-upload" style={{
              display: 'inline-flex', // Cambiado a inline-flex
              alignItems: 'center',    // Centra el icono verticalmente
              justifyContent: 'center', // Centra el icono horizontalmente
              padding: '6px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: '50%',
              cursor: 'pointer',
              border: '2px solid white',
              lineHeight: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)' // Añade sombra
          }} title="Cambiar avatar">
            {/* Muestra icono de carga o de subida */}
            {uploading ? <Loader2 size={size * 0.15} className="animate-spin" /> : <Upload size={size * 0.15} />}
          </label>
          <input
            style={{ visibility: 'hidden', position: 'absolute' }} // Mejor ocultarlo así
            type="file"
            id="avatar-upload"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading} // Usa el estado 'uploading'
          />
        </div>
      </div>
    );
  }
