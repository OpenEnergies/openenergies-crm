// src/components/ExportModal.tsx
// Modal de exportación con filtros contextuales por entidad
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Filter, Loader2, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { fetchAllRows } from '@lib/supabaseFetchAll';
import { useExportData, type ExportEntity, type ExportFilters } from '@hooks/useExportData';
import MultiSearchableSelect, { type Option } from '@components/MultiSearchableSelect';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    entity: ExportEntity;
    preFilters?: ExportFilters;
    entityLabel?: string;
}

// Configuración de filtros disponibles por entidad
const ENTITY_FILTER_CONFIG: Record<ExportEntity, {
    showCliente?: boolean;
    showComercializadora?: boolean;
    showProvincia?: boolean;
    showEstado?: boolean;
    showTarifa?: boolean;
    showRol?: boolean;
    showTipo?: boolean;
    showFechas?: boolean;
    showFotovoltaica?: boolean;
    showCobrado?: boolean;
    estadoOptions?: string[];
}> = {
    clientes: {},
    puntos_suministro: {
        showCliente: true,
        showComercializadora: true,
        showProvincia: true,
        showTarifa: true,
        showEstado: true,
        estadoOptions: ['Nueva Oportunidad', 'Solicitar Doc.', 'Doc. OK', 'Estudio enviado', 'Aceptado', 'Permanencia', 'Standby', 'Desiste'],
    },
    contratos: {
        showComercializadora: true,
        showEstado: true,
        showFotovoltaica: true,
        showCobrado: true,
        showFechas: true,
        estadoOptions: ['Aceptado', 'En curso', 'Bloqueado', 'Pendiente Doc.', 'Pendiente firma', 'Firmado', 'Contratado', 'Pendiente renovacion', 'Baja', 'Standby', 'Desiste'],
    },
    facturas: {
        showComercializadora: true,
        showTipo: true,
        showFechas: true,
    },
    renovaciones: {
        showComercializadora: true,
        showEstado: true,
        showFechas: true,
        estadoOptions: ['En curso', 'Contratado', 'Pendiente renovacion'],
    },
    usuarios_app: {
        showRol: true,
        estadoOptions: ['admin', 'comercial', 'backoffice', 'superadmin'],
    },
    empresas: {
        showTipo: true,
    },
};

export default function ExportModal({
    isOpen,
    onClose,
    entity,
    preFilters = {},
    entityLabel,
}: ExportModalProps) {
    const { exportToExcel, isExporting } = useExportData();
    const config = ENTITY_FILTER_CONFIG[entity];

    // Filter states
    const [filtroCliente, setFiltroCliente] = useState<string | null>(null);
    const [filtroComercializadora, setFiltroComercializadora] = useState<string | null>(null);
    const [selectedProvincias, setSelectedProvincias] = useState<string[] | null>(null);
    const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
    const [selectedTarifas, setSelectedTarifas] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
    const [selectedFotovoltaica, setSelectedFotovoltaica] = useState<string[]>([]);
    const [selectedCobrado, setSelectedCobrado] = useState<string[]>([]);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    // Reset filters when modal opens
    useEffect(() => {
        if (isOpen) {
            setFiltroCliente(preFilters?.cliente_id || null);
            setFiltroComercializadora(preFilters?.comercializadora_id || null);
            setSelectedProvincias(null);
            setSelectedEstados([]);
            setSelectedTarifas([]);
            setSelectedRoles([]);
            setSelectedTipos([]);
            setSelectedFotovoltaica([]);
            setSelectedCobrado([]);
            setFechaDesde('');
            setFechaHasta('');
        }
    }, [isOpen]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Fetch clientes for filter
    const { data: clientesData } = useQuery({
        queryKey: ['export-clientes-options'],
        queryFn: async () => {
            const { data } = await supabase
                .from('clientes')
                .select('id, nombre')
                .is('eliminado_en', null)
                .order('nombre');
            return data || [];
        },
        enabled: isOpen && !!config.showCliente,
    });

    // Fetch comercializadoras for filter
    const { data: comercializadorasData } = useQuery({
        queryKey: ['export-comercializadoras-options'],
        queryFn: async () => {
            const { data } = await supabase
                .from('empresas')
                .select('id, nombre')
                .eq('tipo', 'comercializadora')
                .is('eliminado_en', null)
                .order('nombre');
            return data || [];
        },
        enabled: isOpen && !!config.showComercializadora,
    });

    // Fetch provincias for filter
    const { data: provinciasData } = useQuery({
        queryKey: ['export-provincias-options'],
        queryFn: async () => {
            const data = await fetchAllRows<{ provincia_sum: string }>(supabase
                .from('puntos_suministro')
                .select('provincia_sum')
                .is('eliminado_en', null)
                .not('provincia_sum', 'is', null));
            const unique = [...new Set((data || []).map(p => p.provincia_sum).filter(Boolean))].sort();
            return unique;
        },
        enabled: isOpen && !!config.showProvincia,
    });

    // Fetch tarifas for filter
    const { data: tarifasData, isLoading: isLoadingTarifas } = useQuery({
        queryKey: ['export-tarifas-options'],
        queryFn: async () => {
            const data = await fetchAllRows<{ tarifa: string }>(supabase
                .from('puntos_suministro')
                .select('tarifa')
                .is('eliminado_en', null)
                .not('tarifa', 'is', null));
            const unique = [...new Set((data || []).map(p => p.tarifa).filter(Boolean))].sort();
            return unique;
        },
        enabled: isOpen && !!config.showTarifa,
    });

    // Convert to options
    const clienteOptions: Option[] = useMemo(() =>
        (clientesData || []).map(c => ({ value: c.id, label: c.nombre })),
        [clientesData]
    );

    const comercializadoraOptions: Option[] = useMemo(() =>
        (comercializadorasData || []).map(c => ({ value: c.id, label: c.nombre })),
        [comercializadorasData]
    );

    const provinciaOptions: Option[] = useMemo(() =>
        (provinciasData || []).map(p => ({ value: p, label: p })),
        [provinciasData]
    );

    const tarifaOptions: Option[] = useMemo(() =>
        (tarifasData || []).map(t => ({ value: t, label: t })),
        [tarifasData]
    );

    const estadoOptions: Option[] = useMemo(() =>
        (config.estadoOptions || []).map(e => ({ value: e, label: e })),
        [config.estadoOptions]
    );

    const rolOptions: Option[] = [
        { value: 'admin', label: 'Administrador' },
        { value: 'comercial', label: 'Comercial' },
        { value: 'backoffice', label: 'Backoffice' },
        { value: 'superadmin', label: 'Superadmin' },
    ];

    const tipoOptions: Option[] = [
        { value: 'comercializadora', label: 'Comercializadora' },
        { value: 'openenergies', label: 'Open Energies' },
    ];

    const fotovoltaicaOptions: Option[] = [
        { value: 'Sí', label: 'Sí' },
        { value: 'No', label: 'No' },
        { value: 'En proceso', label: 'En proceso' },
    ];

    const cobradoOptions: Option[] = [
        { value: 'true', label: 'Sí' },
        { value: 'false', label: 'No' },
    ];

    // Build filters for export
    const buildFilters = (): ExportFilters => {
        const filters: ExportFilters = { ...preFilters };

        if (filtroCliente) { // Using new filter state
            filters.cliente_id = filtroCliente;
        }
        if (filtroComercializadora) { // Using new filter state
            filters.comercializadora_id = filtroComercializadora;
        }
        if (selectedEstados.length > 0) {
            filters.estado = selectedEstados;
        }
        if (selectedRoles.length > 0) {
            filters.rol = selectedRoles;
        }
        if (selectedFotovoltaica.length > 0) {
            filters.fotovoltaica = selectedFotovoltaica;
        }
        if (selectedCobrado.length > 0) {
            filters.cobrado = selectedCobrado;
        }
        if (fechaDesde) {
            filters.fecha_desde = fechaDesde;
        }
        if (fechaHasta) {
            filters.fecha_hasta = fechaHasta;
        }
        if (selectedProvincias && selectedProvincias.length > 0) { // Keep old province filter logic if not replaced
            filters.provincia = selectedProvincias;
        }
        if (selectedTarifas.length > 0) { // Keep old tarifa filter logic if not replaced
            filters.tarifa = selectedTarifas;
        }
        if (selectedTipos.length > 0) { // Keep old tipo filter logic if not replaced
            filters.tipo = selectedTipos;
        }

        return filters;
    };

    const handleExport = () => {
        const filters = buildFilters();
        exportToExcel({ entity, filters });
        onClose();
    };

    const handleClearFilters = () => {
        setFiltroCliente(null);
        setFiltroComercializadora(null);
        setSelectedProvincias(null);
        setSelectedEstados([]);
        setSelectedTarifas([]);
        setSelectedRoles([]);
        setSelectedTipos([]);
        setSelectedFotovoltaica([]);
        setSelectedCobrado([]);
        setFechaDesde('');
        setFechaHasta('');
        setFiltroCliente(null);
        setFiltroComercializadora(null);
    };

    const hasActiveFilters =
        filtroCliente ||
        filtroComercializadora ||
        (selectedProvincias && selectedProvincias.length > 0) ||
        selectedEstados.length > 0 ||
        selectedTarifas.length > 0 ||
        selectedRoles.length > 0 ||
        selectedTipos.length > 0 ||
        selectedFotovoltaica.length > 0 ||
        selectedCobrado.length > 0 ||
        fechaDesde ||
        fechaHasta ||
        filtroCliente || // New filter state
        filtroComercializadora; // New filter state

    if (!isOpen) return null;

    const entityLabels: Record<ExportEntity, string> = {
        clientes: 'Clientes',
        puntos_suministro: 'Puntos de Suministro',
        contratos: 'Contratos',
        facturas: 'Facturas',
        renovaciones: 'Renovaciones',
        usuarios_app: 'Usuarios',
        empresas: 'Empresas',
    };

    // Placeholder for searchFilterOptions, as it's not defined in the original code
    // and the provided snippet doesn't define it.
    // This function would typically handle fetching options based on a search query.
    const searchFilterOptions = (type: string, query: string) => {
        console.log(`Searching ${type} for query: ${query}`);
        // Implement actual search logic here, e.g., by calling a supabase function
        // or filtering existing data.
        return Promise.resolve([]); // Return an empty array for now
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl glass-modal overflow-hidden flex flex-col max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-fenix-500/20 bg-bg-primary/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center text-fenix-500">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-fenix-600 dark:text-fenix-400">Exportar Datos</h3>
                            <p className="text-xs text-secondary font-medium uppercase tracking-wider">
                                {entityLabel || entity.replace('_', ' ')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-secondary hover:text-primary hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-bg-primary/30">
                    <div className="space-y-6">
                        {/* Search Filter - Only show if supported by entity config logic manually,
                            but for now we assume search is handled by preFilters or backend logic if passed.
                            Actually, the modal allows filtering by specific fields.
                        */}

                        {/* ... Filters content ... */}

                        {/* Cliente filter */}
                        {config.showCliente && (
                            <MultiSearchableSelect
                                label="Cliente"
                                options={clienteOptions}
                                selectedValues={filtroCliente ? [filtroCliente] : null}
                                onChange={(vals) => setFiltroCliente(vals?.[0] ?? null)}
                                placeholder="Buscar clientes..."
                                isLoading={!clientesData}
                            />
                        )}

                        {config.showComercializadora && (
                            <MultiSearchableSelect
                                label="Comercializadora"
                                options={comercializadoraOptions}
                                selectedValues={filtroComercializadora ? [filtroComercializadora] : null}
                                onChange={(vals) => setFiltroComercializadora(vals?.[0] ?? null)}
                                placeholder="Buscar comercializadoras..."
                                isLoading={!comercializadorasData}
                            />
                        )}

                        {/* Provincia Filter - Custom logic or simplified */}
                        {config.showProvincia && (
                            <label className="block">
                                <span className="text-xs text-secondary font-medium uppercase tracking-wider mb-1 block">Provincia</span>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="glass-input w-full pl-9"
                                        placeholder="Filtrar por provincia..."
                                        // Simple text input for province for now or generic logic
                                        onChange={(e) => { /* Handle province text change if implemented in hook */ }}
                                    />
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                                </div>
                                <p className="text-[10px] text-secondary/70 mt-1">Filtra por texto exacto.</p>
                            </label>
                        )}


                        {/* Filters Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Estado filter */}
                            {config.showEstado && config.estadoOptions && (
                                <div className="space-y-1">
                                    <label className="text-xs text-secondary font-medium uppercase tracking-wider">Estado</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                        {config.estadoOptions.map(opt => (
                                            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEstados.includes(opt)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedEstados([...selectedEstados, opt]);
                                                        else setSelectedEstados(selectedEstados.filter(s => s !== opt));
                                                    }}
                                                    className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                                />
                                                <span className="text-sm text-secondary group-hover:text-primary transition-colors">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tarifa filter */}
                            {config.showTarifa && (
                                <div className="space-y-1">
                                    <label className="text-xs text-secondary font-medium uppercase tracking-wider">Tarifa</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                        {isLoadingTarifas ? (
                                            <div className="flex items-center justify-center py-2"><Loader2 size={16} className="animate-spin text-fenix-500" /></div>
                                        ) : tarifasData?.map(t => (
                                            <label key={t} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTarifas.includes(t)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedTarifas([...selectedTarifas, t]);
                                                        else setSelectedTarifas(selectedTarifas.filter(s => s !== t));
                                                    }}
                                                    className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                                />
                                                <span className="text-sm text-secondary group-hover:text-primary transition-colors">{t}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rol filter (Usuarios App) */}
                            {config.showRol && (
                                <div className="space-y-1">
                                    <label className="text-xs text-secondary font-medium uppercase tracking-wider">Rol</label>
                                    <div className="space-y-2 p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                        {['administrador', 'comercial', 'cliente'].map(rol => (
                                            <label key={rol} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRoles.includes(rol)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedRoles([...selectedRoles, rol]);
                                                        else setSelectedRoles(selectedRoles.filter(s => s !== rol));
                                                    }}
                                                    className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                                />
                                                <span className="text-sm text-secondary group-hover:text-primary transition-colors capitalize">{rol}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Fotovoltaica Filter */}
                            {config.showFotovoltaica && (
                                <div className="space-y-1">
                                    <label className="text-xs text-secondary font-medium uppercase tracking-wider">Fotovoltaica</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                        {['Pendiente de instalar', 'Activa', 'Pendiente de activar', 'Duda', 'No'].map(fv => (
                                            <label key={fv} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFotovoltaica.includes(fv)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedFotovoltaica([...selectedFotovoltaica, fv]);
                                                        else setSelectedFotovoltaica(selectedFotovoltaica.filter(s => s !== fv));
                                                    }}
                                                    className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                                />
                                                <span className="text-sm text-secondary group-hover:text-primary transition-colors">{fv}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Cobrado Filter */}
                            {config.showCobrado && (
                                <div className="space-y-1">
                                    <label className="text-xs text-secondary font-medium uppercase tracking-wider">Cobrado</label>
                                    <div className="space-y-2 p-2 bg-bg-intermediate/20 rounded-lg border border-primary/10">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedCobrado.includes('true')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedCobrado([...selectedCobrado, 'true']);
                                                    else setSelectedCobrado(selectedCobrado.filter(s => s !== 'true'));
                                                }}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">Sí</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedCobrado.includes('false')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedCobrado([...selectedCobrado, 'false']);
                                                    else setSelectedCobrado(selectedCobrado.filter(s => s !== 'false'));
                                                }}
                                                className="rounded border-primary/30 text-fenix-500 focus:ring-fenix-500 bg-bg-primary group-hover:border-fenix-500 transition-colors"
                                            />
                                            <span className="text-sm text-secondary group-hover:text-primary transition-colors">No</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Date range filter */}
                        {config.showFechas && (
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="text-xs text-secondary font-medium">Desde</span>
                                    <input
                                        type="date"
                                        className="glass-input mt-1 w-full"
                                        value={fechaDesde}
                                        onChange={(e) => setFechaDesde(e.target.value)}
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-secondary font-medium">Hasta</span>
                                    <input
                                        type="date"
                                        className="glass-input mt-1 w-full"
                                        value={fechaHasta}
                                        onChange={(e) => setFechaHasta(e.target.value)}
                                    />
                                </label>
                            </div>
                        )}

                        {/* No filters available message */}
                        {!config.showCliente && !config.showComercializadora && !config.showProvincia &&
                            !config.showEstado && !config.showTarifa && !config.showRol && !config.showTipo &&
                            !config.showFechas && !config.showFotovoltaica && !config.showCobrado && (
                                <p className="text-sm text-secondary text-center py-4">
                                    Se exportarán todos los registros disponibles.
                                </p>
                            )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-fenix-500/20 flex items-center justify-end gap-3 bg-bg-intermediate/30">
                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            className="px-4 py-2.5 rounded-xl bg-bg-intermediate hover:bg-slate-600 dark:hover:bg-slate-700 text-primary font-medium transition-all cursor-pointer border border-primary/20"
                        >
                            Limpiar filtros
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-fenix-500 hover:bg-fenix-400 text-white font-bold shadow-lg shadow-fenix-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        Exportar CSV
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
