// src/pages/facturas/FacturasList.tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import { X, FileText, Receipt, Loader2, Search, Eye, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Pencil, FileUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';
import { useTheme } from '@hooks/ThemeContext';
import { useSession } from '@hooks/useSession';
import ColumnFilterDropdown from '@components/ColumnFilterDropdown';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import FilePreviewModal from '@components/FilePreviewModal';
import ExportButton from '@components/ExportButton';
import toast from 'react-hot-toast';

// ============ STORAGE HELPERS ============
const FACTURAS_BUCKET = 'facturas_clientes';
const SIGNED_URL_EXPIRY = 300; // 5 minutes
const ITEMS_PER_PAGE = 50;

/**
 * Normalizes comercializadora name for storage key:
 * lowercase, no accents, no spaces, no special chars
 */
function normalizarComercializadora(valor: string | null | undefined): string {
    return String(valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * Builds the storage object key for a client invoice PDF
 */
function getFacturaPdfKey(comercializadoraNombre: string | null | undefined, numeroFactura: string): string {
    const slug = normalizarComercializadora(comercializadoraNombre);
    return `${slug}_${numeroFactura}.pdf`;
}

// ============ TYPES ============
interface FacturaCliente {
    id: string;
    punto_id: string;
    cliente_id: string;
    comercializadora_id: string;
    fecha_emision: string;
    numero_factura: string;
    tipo_factura: string | null;
    tarifa: string | null;
    direccion_suministro: string | null;
    provincia: string | null;
    potencia_kw_min: number | null;
    potencia_kw_max: number | null;
    base_impuesto_principal: number | null;
    tipo_impuesto_principal_pct: number | null;
    importe_impuesto_principal: number | null;
    base_impuesto_secundario: number | null;
    tipo_impuesto_secundario_pct: number | null;
    importe_impuesto_secundario: number | null;
    total: number;
    consumo_kwh: number | null;
    precio_eur_kwh: number | null;
    observaciones: string | null;
    creado_en: string;
    // Joined relations
    puntos_suministro: { cups: string; direccion_sum: string | null; localidad_sum: string | null; provincia_sum: string | null } | null;
    clientes: { id: string; nombre: string } | null;
    comercializadora: { nombre: string } | null;
}

// ============ FETCH FUNCTION ============
async function fetchFacturas(dateFilter: DateParts): Promise<FacturaCliente[]> {
    let query = supabase
        .from('facturacion_clientes')
        .select(`
      *,
      puntos_suministro (cups, direccion_sum, localidad_sum, provincia_sum),
      clientes (id, nombre),
      comercializadora:empresas!comercializadora_id (nombre)
    `)
        .is('eliminado_en', null)
        .order('fecha_emision', { ascending: false });

    if (dateFilter.year) {
        if (dateFilter.month) {
            if (dateFilter.day) {
                const dateStr = `${dateFilter.year}-${dateFilter.month}-${dateFilter.day}`;
                query = query.eq('fecha_emision', dateStr);
            } else {
                const start = `${dateFilter.year}-${dateFilter.month}-01`;
                const y = parseInt(dateFilter.year);
                const m = parseInt(dateFilter.month);
                const nextY = m === 12 ? y + 1 : y;
                const nextM = m === 12 ? 1 : m + 1;
                const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
                query = query.gte('fecha_emision', start).lt('fecha_emision', end);
            }
        } else {
            const start = `${dateFilter.year}-01-01`;
            const end = `${parseInt(dateFilter.year) + 1}-01-01`;
            query = query.gte('fecha_emision', start).lt('fecha_emision', end);
        }
    }

    const { data, error } = await query.limit(1000);

    if (error) throw error;
    return data as FacturaCliente[];
}

// ============ HELPER FUNCTIONS ============
const formatDate = (date: string | null): string => {
    if (!date) return '—';
    try {
        return format(parseISO(date), 'dd-MM-yy');
    } catch {
        return date;
    }
};

const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
};

const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
};

const formatPricePerKwh = (value: number | null): string => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    });
};

// ============ DETAIL MODAL ============
interface FacturaModalProps {
    factura: FacturaCliente;
    onClose: () => void;
}

function FacturaDetailModal({ factura, onClose }: FacturaModalProps) {
    // Lock body scroll when modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const renderField = (label: string, value: string | number | null | undefined, formatType: 'text' | 'currency' | 'price' = 'text') => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <div className="flex justify-between py-2 border-b border-primary/20 last:border-0 hover:bg-bg-intermediate/20 transition-colors">
                <span className="text-secondary text-sm font-medium">{label}</span>
                <span className="text-primary font-bold text-sm">
                    {formatType === 'currency' ? formatCurrency(value as number) :
                        formatType === 'price' ? formatPricePerKwh(value as number) :
                            String(value)}
                </span>
            </div>
        );
    };

    const cups = factura.puntos_suministro?.cups;
    const nombreCliente = factura.clientes?.nombre;
    const nombreComercializadora = factura.comercializadora?.nombre;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-primary">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-fenix-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-primary">Factura {factura.numero_factura}</h3>
                            <p className="text-sm text-secondary opacity-70">{formatDate(factura.fecha_emision)}</p>
                        </div>
                    </div>
                    <button
                        className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
                        onClick={onClose}
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Basic Info Section */}
                    <div className="glass-card p-4 space-y-1">
                        <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-3">Información General</h4>
                        {renderField('CUPS', cups)}
                        {renderField('Sociedad', nombreCliente)}
                        {renderField('Comercializadora', nombreComercializadora)}
                        {renderField('Nº Factura', factura.numero_factura)}
                        {renderField('Fecha Emisión', formatDate(factura.fecha_emision))}
                        {renderField('Tipo Factura', factura.tipo_factura)}
                        {renderField('Tarifa', factura.tarifa)}
                    </div>

                    {/* Supply Info Section */}
                    {(factura.direccion_suministro || factura.provincia || factura.potencia_kw_min || factura.potencia_kw_max) && (
                        <div className="glass-card p-4 space-y-1">
                            <h4 className="text-sm font-semibold text-fenix-400 mb-3">Datos de Suministro</h4>
                            {renderField('Dirección', factura.direccion_suministro)}
                            {renderField('Provincia', factura.provincia)}
                            {(factura.potencia_kw_min !== null || factura.potencia_kw_max !== null) &&
                                renderField('Potencia (kW)', `${formatNumber(factura.potencia_kw_min)} - ${formatNumber(factura.potencia_kw_max)}`)}
                        </div>
                    )}

                    {/* Taxes Section - Primary */}
                    {(factura.base_impuesto_principal || factura.tipo_impuesto_principal_pct || factura.importe_impuesto_principal) && (
                        <div className="glass-card p-4 space-y-1">
                            <h4 className="text-sm font-semibold text-fenix-400 mb-3">Impuesto Principal</h4>
                            {renderField('Base Imponible', factura.base_impuesto_principal, 'currency')}
                            {renderField('Tipo (%)', factura.tipo_impuesto_principal_pct ? `${factura.tipo_impuesto_principal_pct}%` : null)}
                            {renderField('Importe', factura.importe_impuesto_principal, 'currency')}
                        </div>
                    )}

                    {/* Taxes Section - Secondary */}
                    {(factura.base_impuesto_secundario || factura.tipo_impuesto_secundario_pct || factura.importe_impuesto_secundario) && (
                        <div className="glass-card p-4 space-y-1">
                            <h4 className="text-sm font-semibold text-fenix-400 mb-3">Impuesto Secundario</h4>
                            {renderField('Base Imponible', factura.base_impuesto_secundario, 'currency')}
                            {renderField('Tipo (%)', factura.tipo_impuesto_secundario_pct ? `${factura.tipo_impuesto_secundario_pct}%` : null)}
                            {renderField('Importe', factura.importe_impuesto_secundario, 'currency')}
                        </div>
                    )}

                    {/* Totals Section */}
                    <div className="glass-card p-4 space-y-1">
                        <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-3">Totales</h4>
                        {renderField('Total', factura.total, 'currency')}
                        {renderField('Consumo (kWh)', factura.consumo_kwh ? `${formatNumber(factura.consumo_kwh)} kWh` : null)}
                        {renderField('Precio (€/kWh)', factura.precio_eur_kwh, 'price')}
                    </div>

                    {/* Observations */}
                    {factura.observaciones && (
                        <div className="glass-card p-4">
                            <h4 className="text-sm font-bold text-fenix-600 dark:text-fenix-400 uppercase tracking-wider mb-3">Observaciones</h4>
                            <p className="text-sm text-primary whitespace-pre-wrap">{factura.observaciones}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============ MAIN COMPONENT ============
export default function FacturasList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFactura, setSelectedFactura] = useState<FacturaCliente | null>(null);
    const { rol } = useSession();
    const isCliente = rol === 'cliente';

    // PDF Preview state
    const [previewModal, setPreviewModal] = useState<{ url: string; name: string } | null>(null);
    const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [signedUrlCache, setSignedUrlCache] = useState<Record<string, { url: string; expires: number }>>({});

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [dateFilter, setDateFilter] = useState<DateParts>({ year: null, month: null, day: null });
    const { theme } = useTheme();

    // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
    const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';

    const { data: facturas = [], isLoading, isError } = useQuery({
        queryKey: ['facturas-global', dateFilter],
        queryFn: () => fetchFacturas(dateFilter),
    });

    const dateOptions = useMemo(() => {
        return facturas.map(f => new Date(f.fecha_emision));
    }, [facturas]);

    // Get or create signed URL with caching
    const getSignedUrl = useCallback(async (facturaId: string, comercializadoraNombre: string | null | undefined, numeroFactura: string): Promise<string | null> => {
        // Check cache first
        const cached = signedUrlCache[facturaId];
        if (cached && cached.expires > Date.now()) {
            return cached.url;
        }

        const objectKey = getFacturaPdfKey(comercializadoraNombre, numeroFactura);

        const { data, error } = await supabase.storage
            .from(FACTURAS_BUCKET)
            .createSignedUrl(objectKey, SIGNED_URL_EXPIRY);

        if (error || !data?.signedUrl) {
            console.error('Error getting signed URL:', error);
            return null;
        }

        // Cache the URL (expire 30s before actual expiry for safety)
        setSignedUrlCache(prev => ({
            ...prev,
            [facturaId]: {
                url: data.signedUrl,
                expires: Date.now() + (SIGNED_URL_EXPIRY - 30) * 1000
            }
        }));

        return data.signedUrl;
    }, [signedUrlCache]);

    // Handle PDF preview
    const handlePreviewPdf = useCallback(async (factura: FacturaCliente) => {
        setLoadingPdfId(factura.id);
        try {
            const url = await getSignedUrl(factura.id, factura.comercializadora?.nombre, factura.numero_factura);
            if (!url) {
                toast.error('PDF no encontrado en almacenamiento');
                return;
            }
            setPreviewModal({ url, name: `${factura.numero_factura}.pdf` });
        } catch (err) {
            console.error('Preview error:', err);
            toast.error('Error al cargar vista previa del PDF');
        } finally {
            setLoadingPdfId(null);
        }
    }, [getSignedUrl]);

    // Handle PDF download
    const handleDownloadPdf = useCallback(async (factura: FacturaCliente) => {
        setLoadingPdfId(factura.id);
        try {
            const url = await getSignedUrl(factura.id, factura.comercializadora?.nombre, factura.numero_factura);
            if (!url) {
                toast.error('PDF no encontrado en almacenamiento');
                return;
            }
            // Trigger download via hidden anchor
            const a = document.createElement('a');
            a.href = url;
            a.download = `${factura.numero_factura}.pdf`;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Error al descargar el PDF');
        } finally {
            setLoadingPdfId(null);
        }
    }, [getSignedUrl]);

    // Filter by search term
    const filteredFacturas = useMemo(() => {
        if (!facturas) return [];
        if (!searchTerm) return facturas;
        const term = searchTerm.toLowerCase();
        return facturas.filter(f =>
            f.numero_factura.toLowerCase().includes(term) ||
            f.puntos_suministro?.cups?.toLowerCase().includes(term) ||
            f.clientes?.nombre?.toLowerCase().includes(term) ||
            f.direccion_suministro?.toLowerCase().includes(term)
        );
    }, [facturas, searchTerm]);

    // Sorting with useSortableTable hook
    const { sortedData, handleSort, renderSortIcon } = useSortableTable<FacturaCliente>(filteredFacturas, {
        initialSortKey: 'fecha_emision',
        initialSortDirection: 'desc',
        sortValueAccessors: {
            numero_factura: (item: FacturaCliente) => item.numero_factura,
            cliente_id: (item: FacturaCliente) => item.clientes?.nombre || '', // Sort by name
            puntos_suministro: (item: FacturaCliente) => item.puntos_suministro?.cups || '',
            potencia_kw_max: (item: FacturaCliente) => item.potencia_kw_max || 0,
            total: (item: FacturaCliente) => item.total,
            consumo_kwh: (item: FacturaCliente) => item.consumo_kwh || 0,
            fecha_emision: (item: FacturaCliente) => item.fecha_emision,
        },
    });

    // Pagination
    const totalItems = sortedData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const displayedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedData.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedData, currentPage]);

    // Reset page when search changes
    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (isLoading) {
        return (
            <div className="glass-card p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="glass-card p-6 text-red-400" role="alert">
                Error al cargar las facturas.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-fenix-600 dark:text-fenix-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Facturas</h1>
                        <p className="text-secondary opacity-70">Listado completo de todas las facturas emitidas.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                            <Search size={16} />
                            Buscar
                        </label>
                        <input
                            type="text"
                            placeholder="Factura, cliente o CUPS..."
                            className="glass-input w-64"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <ExportButton
                        exportParams={{
                            entity: 'facturas',
                            filters: {
                                search: searchTerm || undefined,
                                fecha_desde: dateFilter.year && dateFilter.month ? `${dateFilter.year}-${dateFilter.month}-01` : undefined,
                                fecha_hasta: dateFilter.year && dateFilter.month && dateFilter.day ? `${dateFilter.year}-${dateFilter.month}-${dateFilter.day}` : undefined,
                            },
                        }}
                    />
                    {!isCliente && (
                        <Link
                            to="/app/facturas/importar"
                            className="flex items-center justify-center h-11 px-4 bg-bg-intermediate border border-fenix-500/30 hover:border-fenix-500 text-primary rounded-lg transition-all shadow-lg shadow-black/20"
                            title="Importar Facturas"
                        >
                            <FileUp size={20} className="text-fenix-400" />
                            <span className="ml-2 hidden lg:inline">Importar</span>
                        </Link>
                    )}
                    {!isCliente && (
                        <Link
                            to="/app/facturas/nuevo"
                            className="flex items-center justify-center h-11 px-4 bg-fenix-500 hover:bg-fenix-400 text-white rounded-lg transition-colors shadow-lg shadow-fenix-500/20"
                            title="Nueva Factura"
                        >
                            <Plus size={20} className="text-white" />
                        </Link>
                    )}
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                {/* Table */}
                {displayedData.length === 0 ? (
                    <EmptyState
                        icon={<FileText className="text-fenix-500" size={48} />}
                        title="Sin facturas"
                        description={searchTerm ? 'No se encontraron facturas con ese criterio de búsqueda.' : 'No hay facturas registradas.'}
                    />
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr
                                    className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                                    style={{ borderBottomColor: tableBorderColor }}
                                >
                                    <th className="p-4 text-left">
                                        <button onClick={() => handleSort('numero_factura' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                                            Nº Factura {renderSortIcon('numero_factura' as any)}
                                        </button>
                                    </th>
                                    <th className="p-4 text-left">
                                        {isCliente ? (
                                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Dirección</span>
                                        ) : (
                                            <button onClick={() => handleSort('cliente_id' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                                                Cliente {renderSortIcon('cliente_id' as any)}
                                            </button>
                                        )}
                                    </th>
                                    <th className="p-4 text-left">
                                        <button onClick={() => handleSort('puntos_suministro' as any)} className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                                            CUPS {renderSortIcon('puntos_suministro' as any)}
                                        </button>
                                    </th>
                                    <th className="p-4 text-right">
                                        <button onClick={() => handleSort('total' as any)} className="flex items-center justify-end gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer">
                                            Importe {renderSortIcon('total' as any)}
                                        </button>
                                    </th>
                                    <th className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1 group">
                                            <button
                                                onClick={() => handleSort('fecha_emision' as any)}
                                                className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                                            >
                                                Emisión {renderSortIcon('fecha_emision' as any)}
                                            </button>
                                            <DateFilterDropdown
                                                columnName="Emisión"
                                                options={dateOptions}
                                                selectedDate={dateFilter}
                                                onChange={setDateFilter}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-fenix-500/10">
                                {displayedData.map(factura => (
                                    <tr
                                        key={factura.id}
                                        className="hover:bg-bg-intermediate/50 transition-colors"
                                    >
                                        <td className="p-4">
                                            <button
                                                className="font-bold text-fenix-600 dark:text-fourth hover:underline text-left transition-colors cursor-pointer font-mono text-sm"
                                                onClick={() => setSelectedFactura(factura)}
                                                title="Ver detalle"
                                            >
                                                {factura.numero_factura || '—'}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            {isCliente ? (
                                                <span className="text-primary text-sm">
                                                    {[factura.puntos_suministro?.direccion_sum, factura.puntos_suministro?.localidad_sum, factura.puntos_suministro?.provincia_sum].filter(Boolean).join(', ') || '—'}
                                                </span>
                                            ) : factura.clientes ? (
                                                <Link
                                                    to="/app/clientes/$id"
                                                    params={{ id: factura.clientes.id }}
                                                    className="font-bold text-fenix-600 dark:text-fourth hover:underline transition-colors"
                                                >
                                                    {factura.clientes.nombre}
                                                </Link>
                                            ) : (
                                                <span className="text-secondary opacity-50 italic">Eliminado</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-medium text-secondary truncate max-w-[200px] inline-block font-mono text-xs" title={factura.puntos_suministro?.cups}>
                                                {factura.puntos_suministro?.cups ?? '—'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-secondary">
                                                {formatCurrency(factura.total)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-sm text-secondary font-medium">
                                                {formatDate(factura.fecha_emision)}
                                            </span>
                                        </td>
                                        {/* Actions */}
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {!isCliente && (
                                                    <Link
                                                        to="/app/facturas/$id"
                                                        params={{ id: factura.id }}
                                                        className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all cursor-pointer"
                                                        title="Editar factura"
                                                    >
                                                        <Pencil size={16} />
                                                    </Link>
                                                )}
                                                <button
                                                    onClick={() => handlePreviewPdf(factura)}
                                                    disabled={loadingPdfId === factura.id}
                                                    className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all cursor-pointer disabled:opacity-50"
                                                    title="Vista previa PDF"
                                                >
                                                    {loadingPdfId === factura.id ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <Eye size={16} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPdf(factura)}
                                                    disabled={loadingPdfId === factura.id}
                                                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
                                                    title="Descargar PDF"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {displayedData.length > 0 && (
                    <div
                        className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
                        style={{ borderTop: `1px solid ${tableBorderColor}` }}
                    >
                        <span className="text-sm text-secondary">
                            Total: <span className="text-primary font-medium">{totalItems}</span> factura{totalItems !== 1 ? 's' : ''} • Página <span className="text-primary font-medium">{currentPage}</span> de {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                title="Primera página"
                            >
                                <ChevronsLeft size={18} />
                            </button>
                            <button
                                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                title="Página anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                title="Página siguiente"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <button
                                className="p-2 rounded-lg hover:bg-bg-intermediate text-secondary hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                title="Última página"
                            >
                                <ChevronsRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Detail Modal - Rendered via Portal to escape parent overflow */}
                {selectedFactura && createPortal(
                    <FacturaDetailModal
                        factura={selectedFactura}
                        onClose={() => setSelectedFactura(null)}
                    />,
                    document.body
                )}

                {/* PDF Preview Modal */}
                <FilePreviewModal
                    isOpen={!!previewModal}
                    onClose={() => setPreviewModal(null)}
                    fileUrl={previewModal?.url || null}
                    fileName={previewModal?.name || null}
                />
            </div>
        </div>
    );
}
