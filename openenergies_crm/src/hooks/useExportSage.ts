// src/hooks/useExportSage.ts
// Hook para exportar facturas en formato Sage 200 via RPC + webhook n8n
import { useState } from 'react';
import { supabase } from '@lib/supabase';
import toast from 'react-hot-toast';
import { addPeriodoFacturacionToPayload, filterExportRowsByScope } from '@hooks/facturaExportPayload';

export interface SageExportFilters {
    cliente_id?: string | null;
    cliente_ids?: string[];
    punto_ids?: string[];
    fecha_desde?: string;
    fecha_hasta?: string;
    comercializadoras?: string[];
    agrupaciones?: string[];
    tipos_suministro?: string[];
}

const N8N_WEBHOOK_URL = 'https://n8n.openenergiesgroup.com/webhook/c4a628c4-7f91-4a18-926c-2f6f0a7804f3';

export function useExportSage() {
    const [isExporting, setIsExporting] = useState(false);

    const exportSage = async (filters: SageExportFilters): Promise<boolean> => {
        setIsExporting(true);

        try {
            const targetClienteIds = (filters.cliente_ids && filters.cliente_ids.length > 0)
                ? filters.cliente_ids
                : [filters.cliente_id ?? null];

            let sageData: any[] = [];

            for (const targetClienteId of targetClienteIds) {
                const rpcParams = {
                    p_cliente_id: targetClienteId,
                    p_fecha_desde: filters.fecha_desde ?? null,
                    p_fecha_hasta: filters.fecha_hasta ?? null,
                    p_comercializadoras: (filters.comercializadoras && filters.comercializadoras.length > 0) ? filters.comercializadoras : null,
                    p_agrupaciones: (filters.agrupaciones && filters.agrupaciones.length > 0) ? filters.agrupaciones : null,
                    p_tipos_suministro: (filters.tipos_suministro && filters.tipos_suministro.length > 0) ? filters.tipos_suministro : null,
                };

                const { data, error: rpcError } = await supabase.rpc('export_sage_facturas', rpcParams);

                if (rpcError) {
                    throw new Error(rpcError.message || 'Error al obtener datos de Sage');
                }

                if (Array.isArray(data) && data.length > 0) {
                    sageData = sageData.concat(data);
                }
            }

            sageData = await filterExportRowsByScope(sageData, {
                cliente_id: filters.cliente_id,
                comercializadoras: filters.comercializadoras,
                punto_ids: filters.punto_ids,
            });

            const webhookPayload = await addPeriodoFacturacionToPayload(sageData);

            if (!webhookPayload || webhookPayload.length === 0) {
                throw new Error('No se encontraron facturas con los filtros seleccionados');
            }

            // 2. Send JSON to n8n webhook and get back XLSX
            const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
            });

            if (!webhookResponse.ok) {
                throw new Error(`Error del servidor de exportación: ${webhookResponse.status}`);
            }

            // 3. Download the XLSX response
            const blob = await webhookResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const filename = `exportacione_sage200_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
            console.error('Sage export error:', error);
            return false;
        } finally {
            setIsExporting(false);
        }
    };

    return { exportSage, isExporting };
}
