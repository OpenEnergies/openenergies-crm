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
  onUpload: (newUrl: string) => void;
  nombre?: string | null;
  size?: number;
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
      onUpload(newPublicUrl);
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
    const file = event.target.files?.[0];

    if (file && userId) {
      uploadMutation.mutate({ userId, file });
    } else {
      console.error("No se seleccionó ningún archivo o falta el ID de usuario.");
      toast.error("Selecciona un archivo para subir.");
    }
  };

  return (
    <div className="relative mx-auto" style={{ width: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="rounded-full object-cover border-4 border-bg-intermediate"
          style={{ height: size, width: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-fenix-500/30 text-white font-bold"
          style={{
            height: size,
            width: size,
            fontSize: size / 2.5,
          }}
        >
          {fallbackInitial}
        </div>
      )}

      {/* Upload Button */}
      <div className="absolute bottom-0 right-0">
        <label
          htmlFor="avatar-upload"
          className="flex items-center justify-center p-2 bg-fenix-500 hover:bg-fenix-400 text-white rounded-full cursor-pointer border-2 border-white/20 shadow-lg transition-colors"
          title="Cambiar avatar"
        >
          {uploading ? (
            <Loader2 size={size * 0.15} className="animate-spin" />
          ) : (
            <Upload size={size * 0.15} />
          )}
        </label>
        <input
          type="file"
          id="avatar-upload"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </div>
    </div>
  );
}

