// src/hooks/useExportData.ts
// Hook reutilizable para exportar datos a CSV vía Edge Function
import { useState } from 'react';
import { supabase } from '@lib/supabase';
import toast from 'react-hot-toast';

export type ExportEntity =
    | 'clientes'
    | 'puntos_suministro'
    | 'contratos'
    | 'facturas'
    | 'renovaciones'
    | 'usuarios_app'
    | 'empresas';

export interface ExportFilters {
    search?: string;
    cliente_id?: string;
    empresa_id?: string;
    comercializadora_id?: string;
    estado?: string[];
    fotovoltaica?: string[];
    cobrado?: string[];
    rol?: string[];
    fecha_desde?: string;
    fecha_hasta?: string;
    is_archived?: boolean;
    provincia?: string[];
    tarifa?: string[];
    tipo?: string[];
}

export interface ExportParams {
    entity: ExportEntity;
    filters?: ExportFilters;
    customFilename?: string;
}

export function useExportData() {
    const [isExporting, setIsExporting] = useState(false);

    const exportToExcel = async ({ entity, filters = {}, customFilename }: ExportParams) => {
        setIsExporting(true);
        const loadingToast = toast.loading('Generando archivo CSV...');

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                throw new Error('No hay sesión activa. Por favor, inicia sesión de nuevo.');
            }

            const response = await supabase.functions.invoke('export-data', {
                body: { entity, filters },
                responseType: 'blob',
            });

            if (response.error) {
                throw new Error(response.error.message || 'Error al generar el archivo');
            }

            // Check if response is an error JSON (sometimes blob responses might contain JSON error)
            if (response.data instanceof Blob && response.data.type === 'application/json') {
                const text = await response.data.text();
                try {
                    const errorData = JSON.parse(text);
                    if (errorData.error) throw new Error(errorData.error);
                } catch (e) {
                    // If parsing fails, it's not a JSON error, proceed
                }
            }

            // Get the blob from response
            let blob: Blob;
            if (response.data instanceof Blob) {
                blob = response.data;
            } else if (response.data instanceof ArrayBuffer) {
                blob = new Blob([response.data], {
                    type: 'text/csv; charset=utf-8'
                });
            } else if (typeof response.data === 'string') {
                blob = new Blob([response.data], {
                    type: 'text/csv; charset=utf-8'
                });
            } else {
                console.error('Unexpected response format:', response.data);
                throw new Error('Formato de respuesta inesperado: ' + typeof response.data);
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const filename = customFilename || `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.dismiss(loadingToast);
            toast.success('Archivo descargado correctamente');
        } catch (error) {
            toast.dismiss(loadingToast);
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(message);
            console.error('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return { exportToExcel, isExporting };
}
