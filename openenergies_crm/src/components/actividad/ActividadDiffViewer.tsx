// src/components/actividad/ActividadDiffViewer.tsx
// Componente para visualizar diferencias entre estados anterior y nuevo

import type { DetallesJson, MetadatosEntidad } from '@lib/actividadTypes';
import { CAMPOS_OCULTOS_DIFF, CAMPO_LABELS, CAMPOS_FK_A_RESOLVER } from '@lib/actividadTypes';
import { useTheme } from '@hooks/ThemeContext';

interface ActividadDiffViewerProps {
    detalles: DetallesJson;
    metadatosEntidad?: MetadatosEntidad | null;
}

interface CambioItem {
    campo: string;
    label: string;
    valorAnterior: unknown;
    valorNuevo: unknown;
    tipo: 'agregado' | 'eliminado' | 'modificado';
}

/**
 * Detecta los cambios entre el estado anterior y nuevo
 */
function detectarCambios(
    oldObj: Record<string, unknown> | undefined,
    newObj: Record<string, unknown> | undefined
): CambioItem[] {
    const cambios: CambioItem[] = [];
    const allKeys = new Set([
        ...Object.keys(oldObj || {}),
        ...Object.keys(newObj || {}),
    ]);

    for (const campo of allKeys) {
        if (CAMPOS_OCULTOS_DIFF.includes(campo)) continue;

        const valorAnterior = oldObj?.[campo];
        const valorNuevo = newObj?.[campo];

        if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
            let tipo: CambioItem['tipo'] = 'modificado';
            if (valorAnterior === undefined || valorAnterior === null) {
                tipo = 'agregado';
            } else if (valorNuevo === undefined || valorNuevo === null) {
                tipo = 'eliminado';
            }

            cambios.push({
                campo,
                label: CAMPO_LABELS[campo] || formatearNombreCampo(campo),
                valorAnterior,
                valorNuevo,
                tipo,
            });
        }
    }

    return cambios;
}

/**
 * Formatea un nombre de campo snake_case a título
 */
function formatearNombreCampo(campo: string): string {
    return campo
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Formatea un valor para mostrar, resolviendo FKs si es posible
 */
function formatearValor(
    valor: unknown,
    campo: string,
    metadatos?: MetadatosEntidad | null
): string {
    if (valor === null || valor === undefined) return '—';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';

    // Intentar resolver FK a nombre humano usando metadatos
    if (campo in CAMPOS_FK_A_RESOLVER && metadatos) {
        // Si es comercializadora_id y tenemos el nombre
        if ((campo === 'comercializadora_id' || campo === 'current_comercializadora_id') && metadatos.comercializadora_nombre) {
            return metadatos.comercializadora_nombre;
        }
        // Si es cliente_id y tenemos el nombre
        if (campo === 'cliente_id' && metadatos.cliente_nombre) {
            return metadatos.cliente_nombre;
        }
        // Si es punto_id y tenemos CUPS
        if (campo === 'punto_id' && metadatos.cups) {
            return metadatos.cups;
        }
    }

    // Si es un UUID, truncarlo para legibilidad (no ideal pero mejor que nada)
    if (typeof valor === 'string' && isUUID(valor)) {
        return `ID: ...${valor.slice(-8)}`;
    }

    if (typeof valor === 'object') {
        try {
            return JSON.stringify(valor);
        } catch {
            return String(valor);
        }
    }

    return String(valor);
}

/**
 * Verifica si un string parece ser un UUID
 */
function isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

export default function ActividadDiffViewer({ detalles, metadatosEntidad }: ActividadDiffViewerProps) {
    const { theme } = useTheme();
    const cambios = detectarCambios(
        detalles.old as Record<string, unknown> | undefined,
        detalles.new as Record<string, unknown> | undefined
    );

    if (cambios.length === 0) {
        return (
            <p className={`text-sm italic ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                No hay cambios detectados.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {cambios.map((cambio) => (
                <div
                    key={cambio.campo}
                    className={`
            p-2.5 rounded-lg text-xs
            ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}
          `}
                >
                    {/* Nombre del campo */}
                    <span className={`
            font-bold uppercase tracking-wider text-[10px]
            ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}
          `}>
                        {cambio.label}
                    </span>

                    {/* Valores */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {cambio.tipo === 'agregado' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                + {formatearValor(cambio.valorNuevo, cambio.campo, metadatosEntidad)}
                            </span>
                        ) : cambio.tipo === 'eliminado' ? (
                            <span className="text-red-600 dark:text-red-400 line-through">
                                - {formatearValor(cambio.valorAnterior, cambio.campo, metadatosEntidad)}
                            </span>
                        ) : (
                            <>
                                <span className={`
                  line-through truncate max-w-[140px]
                  ${theme === 'dark' ? 'text-red-400/70' : 'text-red-500/70'}
                `}>
                                    {formatearValor(cambio.valorAnterior, cambio.campo, metadatosEntidad)}
                                </span>
                                <span className={theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}>→</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[140px]">
                                    {formatearValor(cambio.valorNuevo, cambio.campo, metadatosEntidad)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
