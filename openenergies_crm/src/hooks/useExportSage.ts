// src/hooks/useExportSage.ts
// Hook para exportar facturas en formato Sage 200 via RPC + webhook n8n
import { useState } from 'react';
import { supabase } from '@lib/supabase';
import toast from 'react-hot-toast';

export interface SageExportFilters {
    cliente_id: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    comercializadoras?: string[];
    agrupaciones?: string[];
    tipos_suministro?: string[];
}

const N8N_WEBHOOK_URL = 'https://n8n.converlysolutions.com/webhook/917ee33f-9f65-4a38-9cb7-6a27c343c029';

export function useExportSage() {
    const [isExporting, setIsExporting] = useState(false);

    const exportSage = async (filters: SageExportFilters) => {
        setIsExporting(true);
        const loadingToast = toast.loading('Generando archivo Sage 200...');

        try {
            // 1. Build RPC params matching the DB function signature
            const rpcParams: Record<string, unknown> = {
                p_cliente_id: filters.cliente_id,
            };
            if (filters.fecha_desde) rpcParams.p_fecha_desde = filters.fecha_desde;
            if (filters.fecha_hasta) rpcParams.p_fecha_hasta = filters.fecha_hasta;
            if (filters.comercializadoras && filters.comercializadoras.length > 0) {
                rpcParams.p_comercializadoras = filters.comercializadoras;
            }
            if (filters.agrupaciones && filters.agrupaciones.length > 0) {
                rpcParams.p_agrupaciones = filters.agrupaciones;
            }
            if (filters.tipos_suministro && filters.tipos_suministro.length > 0) {
                rpcParams.p_tipos_suministro = filters.tipos_suministro;
            }

            const { data: sageData, error: rpcError } = await supabase.rpc('export_sage_facturas', rpcParams);

            if (rpcError) {
                throw new Error(rpcError.message || 'Error al obtener datos de Sage');
            }

            if (!sageData || (Array.isArray(sageData) && sageData.length === 0)) {
                throw new Error('No se encontraron facturas con los filtros seleccionados');
            }

            // 2. Send JSON to n8n webhook and get back XLSX
            const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sageData),
            });

            if (!webhookResponse.ok) {
                throw new Error(`Error del servidor de exportación: ${webhookResponse.status}`);
            }

            // 3. Download the XLSX response
            const blob = await webhookResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const filename = `sage200_facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.dismiss(loadingToast);
            toast.success('Archivo Sage 200 descargado correctamente');
        } catch (error) {
            toast.dismiss(loadingToast);
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(message);
            console.error('Sage export error:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return { exportSage, isExporting };
}
