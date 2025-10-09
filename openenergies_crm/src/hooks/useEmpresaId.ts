import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import type { UUID } from '@lib/types';

export function useEmpresaId() {
  const [empresaId, setEmpresaId] = useState<UUID | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function run() {
      // rpc current_user_empresa_id()
      const { data, error } = await supabase.rpc('current_user_empresa_id');
      if (error) console.error(error);
      if (mounted) { setEmpresaId(data ?? null); setLoading(false); }
    }
    run();
    return () => { mounted = false; };
  }, []);
  return { empresaId, loading };
}
