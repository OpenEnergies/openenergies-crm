import { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { useParams } from '@tanstack/react-router';
import { empresaDetailRoute } from '@router/routes';
import { X, FileText, Receipt, Loader2, Search, Eye, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { EmptyState } from '@components/EmptyState';
import { useSortableTable } from '@hooks/useSortableTable';
import FilePreviewModal from '@components/FilePreviewModal';
import DateFilterDropdown, { DateParts } from '@components/DateFilterDropdown';
import toast from 'react-hot-toast';

// ============ STORAGE HELPERS ============
const FACTURAS_BUCKET = 'facturas_clientes';
const SIGNED_URL_EXPIRY = 300;
const ITEMS_PER_PAGE = 50;

function normalizarComercializadora(valor: string | null | undefined): string {
    return String(valor ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

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
    puntos_suministro: { cups: string } | null;
    clientes: { nombre: string } | null;
    comercializadora: { nombre: string } | null;
}

// ============ FETCH FUNCTION ============
async function fetchFacturasEmpresa(empresaId: string): Promise<FacturaCliente[]> {
    const { data, error } = await supabase
        .from('facturacion_clientes')
        .select(`
      *,
      puntos_suministro (cups),
      clientes (nombre),
      comercializadora:empresas!comercializadora_id (nombre)
    `)
        .eq('comercializadora_id', empresaId)
        .is('eliminado_en', null)
        .order('fecha_emision', { ascending: false });

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

// ============ DETAIL MODAL (REUSED) ============
function FacturaDetailModal({ factura, onClose }: { factura: FacturaCliente, onClose: () => void }) {
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = originalOverflow; };
    }, []);

    const renderField = (label: string, value: string | number | null | undefined, formatType: 'text' | 'currency' | 'price' = 'text') => {
        if (value === null || value === undefined || value === '') return null;
        return (
            <div className="flex justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-gray-400 text-sm">{label}</span>
                <span className="text-white font-medium text-sm">
                    {formatType === 'currency' ? formatCurrency(value as number) :
                        formatType === 'price' ? formatPricePerKwh(value as number) :
                            String(value)}
                </span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-bg-intermediate">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-fenix-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Factura {factura.numero_factura}</h3>
                            <p className="text-sm text-gray-400">{formatDate(factura.fecha_emision)}</p>
                        </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="glass-card p-4 space-y-1">
                        <h4 className="text-sm font-semibold text-fenix-400 mb-3">Información General</h4>
                        {renderField('CUPS', factura.puntos_suministro?.cups)}
                        {renderField('Cliente', factura.clientes?.nombre)}
                        {renderField('Comercializadora', factura.comercializadora?.nombre)}
                        {renderField('Nº Factura', factura.numero_factura)}
                        {renderField('Fecha Emisión', formatDate(factura.fecha_emision))}
                    </div>
                    <div className="glass-card p-4 space-y-1">
                        <h4 className="text-sm font-semibold text-fenix-400 mb-3">Totales</h4>
                        {renderField('Total', factura.total, 'currency')}
                        {renderField('Consumo (kWh)', factura.consumo_kwh ? `${formatNumber(factura.consumo_kwh)} kWh` : null)}
                        {renderField('Precio (€/kWh)', factura.precio_eur_kwh, 'price')}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============ MAIN COMPONENT ============
export default function EmpresaFacturas() {
    const { id: empresaId } = useParams({ from: empresaDetailRoute.id });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFactura, setSelectedFactura] = useState<FacturaCliente | null>(null);
    const [previewModal, setPreviewModal] = useState<{ url: string; name: string } | null>(null);
    const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
    const [signedUrlCache, setSignedUrlCache] = useState<Record<string, { url: string; expires: number }>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [dateFilter, setDateFilter] = useState<DateParts>({ year: null, month: null, day: null });

    const { data: facturas = [], isLoading, isError } = useQuery({
        queryKey: ['empresa-facturas', empresaId],
        queryFn: () => fetchFacturasEmpresa(empresaId),
        enabled: !!empresaId,
    });

    const getSignedUrl = useCallback(async (facturaId: string, comercializadoraNombre: string | null | undefined, numeroFactura: string): Promise<string | null> => {
        const cached = signedUrlCache[facturaId];
        if (cached && cached.expires > Date.now()) return cached.url;
        const objectKey = getFacturaPdfKey(comercializadoraNombre, numeroFactura);
        const { data, error } = await supabase.storage.from(FACTURAS_BUCKET).createSignedUrl(objectKey, SIGNED_URL_EXPIRY);
        if (error || !data?.signedUrl) return null;
        setSignedUrlCache(prev => ({ ...prev, [facturaId]: { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_EXPIRY - 30) * 1000 } }));
        return data.signedUrl;
    }, [signedUrlCache]);

    const handlePreviewPdf = useCallback(async (factura: FacturaCliente) => {
        setLoadingPdfId(factura.id);
        try {
            const url = await getSignedUrl(factura.id, factura.comercializadora?.nombre, factura.numero_factura);
            if (!url) { toast.error('PDF no encontrado'); return; }
            setPreviewModal({ url, name: `${factura.numero_factura}.pdf` });
        } catch (err) { toast.error('Error al cargar PDF'); } finally { setLoadingPdfId(null); }
    }, [getSignedUrl]);

    const handleDownloadPdf = useCallback(async (factura: FacturaCliente) => {
        setLoadingPdfId(factura.id);
        try {
            const url = await getSignedUrl(factura.id, factura.comercializadora?.nombre, factura.numero_factura);
            if (!url) { toast.error('PDF no encontrado'); return; }
            const a = document.createElement('a'); a.href = url; a.download = `${factura.numero_factura}.pdf`; a.target = '_blank';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (err) { toast.error('Error al descargar PDF'); } finally { setLoadingPdfId(null); }
    }, [getSignedUrl]);

    const filteredFacturas = useMemo(() => {
        if (!facturas) return [];
        let data = facturas;
        if (dateFilter.year || dateFilter.month || dateFilter.day) {
            data = data.filter(f => {
                const date = new Date(f.fecha_emision);
                if (dateFilter.year && date.getFullYear().toString() !== dateFilter.year) return false;
                if (dateFilter.month && (date.getMonth() + 1).toString().padStart(2, '0') !== dateFilter.month) return false;
                if (dateFilter.day && date.getDate().toString().padStart(2, '0') !== dateFilter.day) return false;
                return true;
            });
        }
        if (!searchTerm) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(f =>
            f.numero_factura.toLowerCase().includes(term) ||
            f.puntos_suministro?.cups?.toLowerCase().includes(term) ||
            f.clientes?.nombre?.toLowerCase().includes(term)
        );
    }, [facturas, searchTerm, dateFilter]);

    const { sortedData, handleSort, renderSortIcon } = useSortableTable<FacturaCliente>(filteredFacturas, {
        initialSortKey: 'fecha_emision',
        initialSortDirection: 'desc',
        sortValueAccessors: {
            numero_factura: (item) => item.numero_factura,
            cliente: (item) => item.clientes?.nombre,
            cups: (item) => item.puntos_suministro?.cups,
            total: (item) => item.total,
            fecha_emision: (item) => item.fecha_emision,
        },
    });

    const totalItems = sortedData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const displayedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedData.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedData, currentPage]);

    useMemo(() => { setCurrentPage(1); }, [searchTerm, dateFilter]);

    if (isLoading) return <div className="glass-card p-12 flex items-center justify-center"><Loader2 className="w-8 h-8 text-fenix-500 animate-spin" /></div>;
    if (isError) return <div className="glass-card p-6 text-red-400">Error al cargar las facturas.</div>;

    return (
        <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-bg-intermediate">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-fenix-500/20 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-fenix-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Facturas</h2>
                            <p className="text-sm text-gray-400">{facturas.length} total</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 whitespace-nowrap">
                            <Search size={16} /> Buscar
                        </label>
                        <input
                            type="text"
                            placeholder="Nº factura, CUPS, Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="glass-input w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            {displayedData.length === 0 ? (
                <EmptyState title="Sin facturas" description="No se encontraron facturas." />
            ) : (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b-2 border-bg-intermediate bg-bg-intermediate text-xs text-gray-200 uppercase tracking-wider font-semibold">
                                <th className="p-4"><button onClick={() => handleSort('numero_factura' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">Nº Factura {renderSortIcon('numero_factura' as any)}</button></th>
                                <th className="p-4"><button onClick={() => handleSort('cliente' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">Cliente {renderSortIcon('cliente' as any)}</button></th>
                                <th className="p-4"><button onClick={() => handleSort('cups' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">CUPS {renderSortIcon('cups' as any)}</button></th>
                                <th className="p-4 text-right"><button onClick={() => handleSort('total' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors ml-auto cursor-pointer">Total {renderSortIcon('total' as any)}</button></th>
                                <th className="p-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSort('fecha_emision' as any)} className="flex items-center gap-1 hover:text-fenix-400 transition-colors cursor-pointer">Emisión {renderSortIcon('fecha_emision' as any)}</button>
                                        <DateFilterDropdown columnName="Emisión" options={facturas.map(f => new Date(f.fecha_emision))} selectedDate={dateFilter} onChange={setDateFilter} />
                                    </div>
                                </th>
                                <th className="p-4 text-right">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-fenix-500/10">
                            {displayedData.map(factura => (
                                <tr key={factura.id} className="hover:bg-fenix-500/8 transition-colors">
                                    <td className="p-4"><button onClick={() => setSelectedFactura(factura)} className="text-fenix-400 hover:text-fenix-300 font-medium cursor-pointer underline-offset-2 hover:underline">{factura.numero_factura}</button></td>
                                    <td className="p-4 text-gray-300 text-sm">{factura.clientes?.nombre || '—'}</td>
                                    <td className="p-4 text-gray-300 font-mono text-sm">{factura.puntos_suministro?.cups || '—'}</td>
                                    <td className="p-4 text-right text-white font-semibold">{formatCurrency(factura.total)}</td>
                                    <td className="p-4 text-gray-400 text-sm">{formatDate(factura.fecha_emision)}</td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handlePreviewPdf(factura)} disabled={loadingPdfId === factura.id} className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all cursor-pointer disabled:opacity-50">{loadingPdfId === factura.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}</button>
                                            <button onClick={() => handleDownloadPdf(factura)} disabled={loadingPdfId === factura.id} className="p-2 rounded-lg bg-fenix-500/10 hover:bg-fenix-500/20 text-fenix-400 transition-all cursor-pointer disabled:opacity-50"><Download size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {displayedData.length > 0 && (
                <div className="p-4 border-t border-bg-intermediate flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-sm text-gray-400">Página <span className="text-white font-medium">{currentPage}</span> de {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 disabled:opacity-30 cursor-pointer" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft size={18} /></button>
                        <button className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 disabled:opacity-30 cursor-pointer" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={18} /></button>
                        <button className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 disabled:opacity-30 cursor-pointer" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={18} /></button>
                        <button className="p-2 rounded-lg hover:bg-bg-intermediate text-gray-400 disabled:opacity-30 cursor-pointer" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight size={18} /></button>
                    </div>
                </div>
            )}

            {selectedFactura && createPortal(<FacturaDetailModal factura={selectedFactura} onClose={() => setSelectedFactura(null)} />, document.body)}
            <FilePreviewModal isOpen={!!previewModal} onClose={() => setPreviewModal(null)} fileUrl={previewModal?.url ?? null} fileName={previewModal?.name ?? null} />
        </div>
    );
}
