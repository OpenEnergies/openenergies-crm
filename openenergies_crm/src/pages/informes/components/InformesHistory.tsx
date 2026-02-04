// openenergies_crm/src/pages/informes/components/InformesHistory.tsx
// Historial de informes generados

import React from 'react';
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  Users,
  Loader2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useInformesList, useDeleteInforme, useInformeDownloadUrl } from '@hooks/useInformesMercado';
import type { InformeMercadoConRelaciones } from '@lib/informesTypes';
import {
  getTipoInformeLabel,
  getEstadoLabel,
  getEstadoColor
} from '@lib/informesTypes';

interface InformesHistoryProps {
  limit?: number;
  showViewAll?: boolean;
}

function InformeRow({ informe }: { informe: InformeMercadoConRelaciones }) {
  const { data: downloadUrl, isLoading: loadingUrl } = useInformeDownloadUrl(informe.ruta_storage);
  const deleteMutation = useDeleteInforme();

  const createdDate = new Date(informe.creado_en).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const createdTime = new Date(informe.creado_en).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este informe?')) {
      deleteMutation.mutate(informe.id);
    }
  };

  const creadorNombre = informe.creador
    ? `${informe.creador.nombre || ''} ${informe.creador.apellidos || ''}`.trim() || 'Usuario'
    : 'Usuario';

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors group">
      {/* Icon */}
      <div className="flex-shrink-0 p-2.5 bg-fenix-100 dark:bg-fenix-900/30 rounded-lg">
        <FileText size={20} className="text-fenix-600 dark:text-fenix-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-700 dark:text-slate-300 truncate">
            {informe.titulo}
          </h4>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEstadoColor(informe.estado)}`}>
            {getEstadoLabel(informe.estado)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{getTipoInformeLabel(informe.tipo_informe)}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            Cliente completo
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <Calendar size={12} />
          <span>{createdDate} a las {createdTime}</span>
          <span>por {creadorNombre}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {informe.ruta_storage && informe.estado === 'completado' && (
          <a
            href={downloadUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              p-2 rounded-lg transition-colors
              ${loadingUrl
                ? 'bg-slate-100 dark:bg-slate-700 cursor-wait'
                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'
              }
            `}
            title="Descargar PDF"
          >
            {loadingUrl ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
          </a>
        )}
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors disabled:opacity-50"
          title="Eliminar"
        >
          {deleteMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    </div>
  );
}

export default function InformesHistory({ limit = 10, showViewAll = false }: InformesHistoryProps) {
  const { data: informes, isLoading, error } = useInformesList({ limit });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-fenix-500" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error al cargar el historial de informes
      </div>
    );
  }

  if (!informes || informes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <FileText size={24} className="text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
          Sin informes aún
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Los informes que generes aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {informes.map((informe) => (
        <InformeRow key={informe.id} informe={informe} />
      ))}

      {showViewAll && informes.length >= limit && (
        <button className="w-full flex items-center justify-center gap-2 py-3 text-sm text-fenix-600 dark:text-fenix-400 hover:text-fenix-700 transition-colors">
          Ver todos los informes
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
