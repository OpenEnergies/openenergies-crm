// openenergies_crm/src/pages/informes/components/InformesHistory.tsx
// Historial de informes generados

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  Users,
  Loader2,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  X
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

// Modal de confirmación (Componente interno)
function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  title
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                ¿Eliminar informe?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Estás a punto de eliminar el informe <span className="font-medium text-slate-800 dark:text-white">"{title}"</span>.
              </p>
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50">
                Esta acción eliminará permanentemente el archivo asociado.
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors font-medium text-sm flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Eliminar Informe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function InformeRow({
  informe,
  onDeleteClick
}: {
  informe: InformeMercadoConRelaciones;
  onDeleteClick: (informe: InformeMercadoConRelaciones) => void;
}) {
  const { data: downloadUrl, isLoading: loadingUrl } = useInformeDownloadUrl(informe.ruta_storage);

  const createdDate = new Date(informe.creado_en).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const createdTime = new Date(informe.creado_en).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

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
          onClick={() => onDeleteClick(informe)}
          className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors"
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function InformesHistory({ limit = 10, showViewAll = false }: InformesHistoryProps) {
  const { data: informes, isLoading, error } = useInformesList({ limit });
  const deleteMutation = useDeleteInforme();

  // State para el modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [informeToDelete, setInformeToDelete] = useState<InformeMercadoConRelaciones | null>(null);

  const handleDeleteClick = (informe: InformeMercadoConRelaciones) => {
    setInformeToDelete(informe);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (informeToDelete) {
      await deleteMutation.mutateAsync(informeToDelete.id);
      setDeleteModalOpen(false);
      setInformeToDelete(null);
    }
  };

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
    <>
      <div className="space-y-3">
        {informes.map((informe) => (
          <InformeRow
            key={informe.id}
            informe={informe}
            onDeleteClick={handleDeleteClick}
          />
        ))}

        {showViewAll && informes.length >= limit && (
          <button className="w-full flex items-center justify-center gap-2 py-3 text-sm text-fenix-600 dark:text-fenix-400 hover:text-fenix-700 transition-colors">
            Ver todos los informes
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
        title={informeToDelete?.titulo || 'Informe'}
      />
    </>
  );
}
