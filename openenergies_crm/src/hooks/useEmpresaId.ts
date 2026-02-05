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
      // Silently handle error as requested to avoid console noise, fallback to null
      if (error && import.meta.env.DEV) {
        // console.debug('RPC current_user_empresa_id failed:', error.message);
      }
      if (mounted) { setEmpresaId(data ?? null); setLoading(false); }
    }
    run();
    return () => { mounted = false; };
  }, []);
  return { empresaId, loading };
}
