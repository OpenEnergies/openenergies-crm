import { useState } from 'react';
import toast from 'react-hot-toast';
import type { RolUsuario } from '@lib/types';

type PuntoExportRow = {
  cups: string;
  direccion_sum: string | null;
  provincia_sum: string | null;
  localidad_sum: string | null;
  tipo_factura: string | null;
  tarifa: string | null;
  p1_kw: number | null;
  p2_kw: number | null;
  p3_kw: number | null;
  p4_kw: number | null;
  p5_kw: number | null;
  p6_kw: number | null;
  consumo_anual_kwh: number | null;
  tiene_fv: boolean | null;
  fv_compensacion: string | null;
  direccion_fisc: string | null;
  provincia_fisc: string | null;
  localidad_fisc: string | null;
  direccion_post: string | null;
  provincia_post: string | null;
  localidad_post: string | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
  comercializadora: { nombre: string } | { nombre: string }[] | null;
};

export type PuntosExportFormat = 'csv' | 'xlsx';

const N8N_PUNTOS_WEBHOOKS: Record<PuntosExportFormat, string> = {
  xlsx: 'https://n8n.openenergiesgroup.com/webhook/9bd0cdde-b272-45ad-9fb7-f6e86b8a6afa',
  csv: 'https://n8n.openenergiesgroup.com/webhook/c36b199e-c50e-47fb-b17a-789853bf4e9d',
};

function getRelatedName(value: { nombre: string } | { nombre: string }[] | null): string {
  if (!value) return '';
  if (Array.isArray(value)) return value[0]?.nombre || '';
  return value.nombre || '';
}

function buildBasePayload(point: PuntoExportRow) {
  return {
    Cups: point.cups,
    Sociedad: getRelatedName(point.clientes),
    DireccionSuministro: point.direccion_sum,
    ProvinciaSuministro: point.provincia_sum,
    LocalidadSuministro: point.localidad_sum,
    TipoSuministro: point.tipo_factura,
    ComercializadoraActual: getRelatedName(point.comercializadora),
    Tarifa: point.tarifa,
    P1: point.p1_kw,
    P2: point.p2_kw,
    P3: point.p3_kw,
    P4: point.p4_kw,
    P5: point.p5_kw,
    P6: point.p6_kw,
    ConsumoAnual: point.consumo_anual_kwh,
  };
}

function formatFotovoltaica(value: boolean | null): string {
  return value ? 'Sí' : 'No';
}

function buildAdminPayload(point: PuntoExportRow) {
  return {
    ...buildBasePayload(point),
    Fotovoltaica: formatFotovoltaica(point.tiene_fv),
    EstadoFv: point.fv_compensacion,
    DireccionFiscal: point.direccion_fisc,
    ProvinciaFiscal: point.provincia_fisc,
    LocalidadFiscal: point.localidad_fisc,
    DireccionPostal: point.direccion_post,
    ProvinciaPostal: point.provincia_post,
    LocalidadPostal: point.localidad_post,
  };
}

export function useExportPuntos() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPuntos = async (params: {
    format: PuntosExportFormat;
    rol: RolUsuario | null;
    puntos: PuntoExportRow[];
  }): Promise<boolean> => {
    const { format, rol, puntos } = params;
    setIsExporting(true);

    try {
      if (!puntos || puntos.length === 0) {
        throw new Error('No hay puntos de suministro para exportar con los filtros seleccionados.');
      }

      const webhookUrl = N8N_PUNTOS_WEBHOOKS[format];
      const payload = puntos.map((point) => (rol === 'administrador' ? buildAdminPayload(point) : buildBasePayload(point)));

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Error del servidor de exportación: ${webhookResponse.status}`);
      }

      const blob = await webhookResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `puntos_suministro_${new Date().toISOString().slice(0, 10)}.${format}`;

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
      console.error('Puntos export error:', error);
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPuntos, isExporting };
}
