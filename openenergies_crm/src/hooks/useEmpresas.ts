// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import type { Empresa } from '@lib/types';

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchEmpresas() {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre')
        .order('nombre', { ascending: true })
        .range(0, 99999);

      if (error) {
        console.error('Error al cargar la lista de empresas:', error);
      }

      if (mounted) {
        setEmpresas(data ?? []);
        setLoading(false);
      }
    }

    fetchEmpresas();

    return () => {
      mounted = false;
    };
  }, []);

  return { empresas, loading };
}