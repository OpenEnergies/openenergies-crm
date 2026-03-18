import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { supabase } from '@lib/supabase';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { useGrupoClienteDetail } from '@hooks/useGruposClientes';

export default function CarteraDocumentos() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data: grupo } = useGrupoClienteDetail(id);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['cartera-documentos', id, grupo?.cliente_ids],
    queryFn: async () => {
      if (!grupo || grupo.cliente_ids.length === 0) return [];

      const { data, error } = await supabase
        .from('documentos')
        .select('id, nombre_archivo, ruta_storage, creado_en, clientes(nombre)')
        .in('cliente_id', grupo.cliente_ids)
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .range(0, 99999);

      if (error) throw error;
      return data || [];
    },
    enabled: !!grupo,
  });

  const rows = useMemo(() => documentos as Array<any>, [documentos]);

  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={40} className="text-fenix-500/60" />}
        title="Sin documentos"
        description="No hay documentos cargados para las sociedades de esta cartera."
      />
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-bg-intermediate">
        <h2 className="text-xl font-bold text-fenix-600 dark:text-fenix-500">Documentos de la cartera</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-bg-intermediate text-xs uppercase tracking-wider text-primary font-bold bg-bg-intermediate/30">
              <th className="p-4 text-left">Nombre</th>
              <th className="p-4 text-left">Sociedad</th>
              <th className="p-4 text-left">Ruta</th>
              <th className="p-4 text-left">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fenix-500/10">
            {rows.map((doc) => (
              <tr key={doc.id} className="hover:bg-fenix-500/5 transition-colors">
                <td className="p-4 text-primary font-medium">{doc.nombre_archivo || 'Documento'}</td>
                <td className="p-4 text-secondary">{Array.isArray(doc.clientes) ? doc.clientes[0]?.nombre : doc.clientes?.nombre || '—'}</td>
                <td className="p-4 text-secondary font-mono text-xs">{doc.ruta_storage}</td>
                <td className="p-4 text-secondary">{fmtDate(doc.creado_en)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
