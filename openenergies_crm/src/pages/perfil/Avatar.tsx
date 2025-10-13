import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

async function uploadAvatar({ userId, file }: { userId: string; file: File }) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${Math.random()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase.from('usuarios_app').update({ avatar_url: filePath }).eq('user_id', userId);
  if (updateError) throw updateError;

  return filePath;
}

export default function Avatar({ userId, url, onUpload }: { userId: string; url: string | null; onUpload: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      onUpload(); // Invalida la query del perfil en el componente padre
      alert('Avatar actualizado correctamente.');
    },
    onError: (error) => {
      alert(`Error al subir el avatar: ${error.message}`);
    },
  });

  useEffect(() => {
    if (url) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(url);
      setAvatarUrl(data.publicUrl);
    } else {
        setAvatarUrl(null);
    }
  }, [url]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Usamos encadenamiento opcional para más seguridad al obtener el archivo
    const file = event.target.files?.[0];

    // ¡CAMBIO CLAVE! Solo continuamos si 'file' realmente existe.
    if (file && userId) {
      uploadMutation.mutate({ userId, file });
    } else {
        console.error("No se seleccionó ningún archivo o falta el ID de usuario.");
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={avatarUrl || `https://ui-avatars.com/api/?name=${userId}&background=random`}
        alt="Avatar"
        style={{ height: 150, width: 150, borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }}
      />
      <div>
        <label htmlFor="avatar-upload" className="button secondary">
          {uploadMutation.isPending ? 'Subiendo...' : 'Cambiar foto'}
        </label>
        <input
          style={{ display: 'none' }}
          type="file"
          id="avatar-upload"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploadMutation.isPending}
        />
      </div>
    </div>
  );
}