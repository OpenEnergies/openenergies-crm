import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { EmptyState } from '@components/EmptyState';
import { fmtDate } from '@lib/utils';
import { Radio, Plus, Trash2, Loader2, XCircle, X, Layers, Search } from 'lucide-react';
import { useSortableTable } from '@hooks/useSortableTable';
import { useTheme } from '@hooks/ThemeContext';
import { toast } from 'react-hot-toast';

type Canal = {
    id: string;
    nombre: string;
    creado_en: string | null;
};

async function fetchCanales(): Promise<Canal[]> {
    const { data, error } = await supabase
        .from('canales')
        .select('*')
        .order('creado_en', { ascending: false });

    if (error) throw error;
    return data as Canal[];
}

async function createCanal(nombre: string): Promise<Canal> {
    const { data, error } = await supabase
        .from('canales')
        .insert({ nombre })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function deleteCanal(id: string): Promise<void> {
    const { error } = await supabase
        .from('canales')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export default function CanalesList() {
    const queryClient = useQueryClient();
    const { data: fetchedData, isLoading, isError } = useQuery({
        queryKey: ['canales'],
        queryFn: fetchCanales
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { theme } = useTheme();

    // Border color for table separators: green in dark mode, gray in light mode (matches ClientesList)
    const tableBorderColor = theme === 'dark' ? '#17553eff' : '#cbd5e1';
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState<Canal | null>(null);
    const [newCanalName, setNewCanalName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const {
        sortedData,
        handleSort,
        renderSortIcon
    } = useSortableTable<Canal>(fetchedData, {
        initialSortKey: 'nombre',
        initialSortDirection: 'asc'
    });

    // Filter by search
    const displayedData = sortedData.filter(c =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Mutations
    const createMutation = useMutation({
        mutationFn: createCanal,
        onSuccess: () => {
            toast.success('Canal creado correctamente');
            queryClient.invalidateQueries({ queryKey: ['canales'] });
            setShowCreateModal(false);
            setNewCanalName('');
        },
        onError: (error: Error) => {
            toast.error(`Error al crear: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCanal,
        onSuccess: () => {
            toast.success('Canal eliminado correctamente');
            queryClient.invalidateQueries({ queryKey: ['canales'] });
            setShowDeleteModal(null);
            setSelectedIds([]);
        },
        onError: (error: Error) => {
            toast.error(`Error al eliminar: ${error.message}`);
        },
    });

    // Selection handlers
    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedIds(displayedData.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleRowSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCanalName.trim()) {
            createMutation.mutate(newCanalName.trim());
        }
    };

    const isAllSelected = displayedData.length > 0 && selectedIds.length === displayedData.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < displayedData.length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-fenix-500/20 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-fenix-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500">Canales de Captación</h1>
                        <p className="text-secondary opacity-70 text-sm">Gestiona los canales de entrada de los clientes.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-400 whitespace-nowrap">
                            <Search size={16} />
                            Buscar
                        </label>
                        <input
                            type="text"
                            placeholder="Nombre de canal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="glass-input h-11"
                        />
                    </div>

                    {selectedIds.length > 0 ? (
                        /* Selection action bar */
                        <div className="flex items-center gap-2 bg-fenix-500/10 border border-fenix-500/30 rounded-lg px-3 py-2">
                            <span className="text-sm text-fenix-400 font-medium">
                                {selectedIds.length} seleccionado(s)
                            </span>
                            <div className="flex items-center gap-1 ml-2">
                                {selectedIds.length === 1 && (
                                    <button
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                        title="Eliminar Canal"
                                        onClick={() => {
                                            const canal = fetchedData?.find(c => c.id === selectedIds[0]);
                                            if (canal) setShowDeleteModal(canal);
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button
                                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                                    title="Cancelar selección"
                                    onClick={() => setSelectedIds([])}
                                >
                                    <XCircle size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Añadir Canal</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table Card */}
            <div className="glass-card overflow-hidden">
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-fenix-500 animate-spin" />
                    </div>
                )}

                {isError && (
                    <div className="text-center py-12">
                        <p className="text-red-400">Error al cargar los canales.</p>
                    </div>
                )}

                {fetchedData && fetchedData.length === 0 && !isLoading && (
                    <EmptyState
                        title="Sin canales"
                        description="Aún no hay canales registrados."
                        cta={
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium transition-colors cursor-pointer"
                            >
                                Crear el primero
                            </button>
                        }
                    />
                )}

                {fetchedData && fetchedData.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr
                                    className="border-b-2 bg-bg-intermediate text-xs text-primary uppercase tracking-wider font-bold"
                                    style={{ borderBottomColor: tableBorderColor }}
                                >
                                    <th className="w-10 p-4 text-left">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={input => {
                                                if (input) input.indeterminate = isIndeterminate;
                                            }}
                                            onChange={handleSelectAll}
                                            aria-label="Seleccionar todos"
                                            className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                                        />
                                    </th>
                                    <th className="p-4 text-left">
                                        <button
                                            onClick={() => handleSort('nombre')}
                                            className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                                        >
                                            Nombre del Canal {renderSortIcon('nombre')}
                                        </button>
                                    </th>
                                    <th className="p-4 text-left">
                                        <button
                                            onClick={() => handleSort('creado_en')}
                                            className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-wider hover:text-fenix-600 dark:hover:text-fenix-400 transition-colors cursor-pointer"
                                        >
                                            Fecha de Creación {renderSortIcon('creado_en')}
                                        </button>
                                    </th>
                                    <th className="p-4 text-right">
                                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                                            Acciones
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-fenix-500/10">
                                {displayedData.map(c => {
                                    const isSelected = selectedIds.includes(c.id);
                                    return (
                                        <tr
                                            key={c.id}
                                            className={`
                        transition-colors cursor-default ${isSelected
                                                    ? 'bg-fenix-500/15 hover:bg-fenix-500/20'
                                                    : 'hover:bg-fenix-500/8'}
                      `}
                                        >
                                            <td className="p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleRowSelect(c.id)}
                                                    aria-label={`Seleccionar ${c.nombre}`}
                                                    className="w-5 h-5 rounded-full border-2 border-gray-500 bg-bg-intermediate checked:bg-fenix-500/80 checked:border-fenix-500/80 focus:ring-2 focus:ring-fenix-400/30 focus:ring-offset-0 cursor-pointer transition-all accent-fenix-500"
                                                />
                                            </td>
                                            <td className="p-4">
                                                <span className="text-fenix-600 dark:text-fourth font-bold">
                                                    {c.nombre}
                                                </span>
                                            </td>
                                            <td className="p-4 text-secondary font-medium">{fmtDate(c.creado_en)}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setShowDeleteModal(c)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-bg-intermediate border border-bg-intermediate rounded-2xl p-6 shadow-2xl glass-modal">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-primary">Añadir Canal</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-bg-intermediate transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit}>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-secondary uppercase tracking-tight mb-2">
                                    Nombre del canal
                                </label>
                                <input
                                    type="text"
                                    value={newCanalName}
                                    onChange={(e) => setNewCanalName(e.target.value)}
                                    placeholder="Ej: Web, Referido, Campaña..."
                                    className="glass-input"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="h-11 px-4 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white transition-colors disabled:opacity-50 cursor-pointer"
                                    disabled={!newCanalName.trim() || createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'Creando...' : 'Crear Canal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-bg-intermediate border border-bg-intermediate rounded-2xl p-6 shadow-2xl glass-modal">
                        <h3 className="text-xl font-bold text-primary mb-4">Confirmar Eliminación</h3>
                        <p className="text-secondary mb-6">
                            ¿Estás seguro de que quieres eliminar el canal <strong className="text-primary">{showDeleteModal.nombre}</strong>?
                            <br />
                            <span className="text-red-600 dark:text-red-400 text-sm">Esta acción es irreversible.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 rounded-lg bg-bg-intermediate hover:bg-bg-secondary border border-primary text-secondary font-medium transition-colors cursor-pointer"
                                onClick={() => setShowDeleteModal(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white transition-colors disabled:opacity-50 cursor-pointer"
                                onClick={() => deleteMutation.mutate(showDeleteModal.id)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
