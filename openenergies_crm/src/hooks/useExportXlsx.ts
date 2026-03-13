// src/hooks/useExportXlsx.ts
// Hook para exportar facturas en formato XLSX via RPC + webhook n8n
import { useState } from 'react';
import { supabase } from '@lib/supabase';
import toast from 'react-hot-toast';

export interface XlsxExportFilters {
    cliente_id?: string | null;
    cliente_ids?: string[];
    fecha_desde?: string;
    fecha_hasta?: string;
    comercializadoras?: string[];
    agrupaciones?: string[];
    tipos_suministro?: string[];
}

const N8N_WEBHOOK_URL = 'https://n8n.converlysolutions.com/webhook/67cc5442-a52b-4605-888d-e7445d4d13a6';

export function useExportXlsx() {
    const [isExporting, setIsExporting] = useState(false);

    const exportXlsx = async (filters: XlsxExportFilters): Promise<boolean> => {
        setIsExporting(true);

        try {
            const targetClienteIds = (filters.cliente_ids && filters.cliente_ids.length > 0)
                ? filters.cliente_ids
                : [filters.cliente_id ?? null];

            let xlsxData: any[] = [];

            for (const targetClienteId of targetClienteIds) {
                const rpcParams = {
                    p_cliente_id: targetClienteId,
                    p_fecha_desde: filters.fecha_desde ?? null,
                    p_fecha_hasta: filters.fecha_hasta ?? null,
                    p_comercializadoras: (filters.comercializadoras && filters.comercializadoras.length > 0) ? filters.comercializadoras : null,
                    p_agrupaciones: (filters.agrupaciones && filters.agrupaciones.length > 0) ? filters.agrupaciones : null,
                    p_tipos_suministro: (filters.tipos_suministro && filters.tipos_suministro.length > 0) ? filters.tipos_suministro : null,
                };

                const { data, error: rpcError } = await supabase.rpc('export_xlsx_facturas', rpcParams);

                if (rpcError) {
                    throw new Error(rpcError.message || 'Error al obtener datos para XLSX');
                }

                if (Array.isArray(data) && data.length > 0) {
                    xlsxData = xlsxData.concat(data);
                }
            }

            if (!xlsxData || (Array.isArray(xlsxData) && xlsxData.length === 0)) {
                throw new Error('No se encontraron facturas con los filtros seleccionados');
            }

            const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(xlsxData),
            });

            if (!webhookResponse.ok) {
                throw new Error(`Error del servidor de exportación: ${webhookResponse.status}`);
            }

            const blob = await webhookResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const filename = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(message);
            console.error('XLSX export error:', error);
            return false;
        } finally {
            setIsExporting(false);
        }
    };

    return { exportXlsx, isExporting };
}
