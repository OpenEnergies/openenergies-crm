// src/pages/facturas/FacturaImport.tsx
import { useState, useRef } from 'react';
import { router } from '@router/routes';
import {
    FileUp, ArrowLeft, Receipt, X, CheckCircle2,
    AlertCircle, FileText, UploadCloud, Building2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const SUPPORTED_COMPANIES = [
    'E3 ENERGY', 'ALUMBRA', 'ENDESA', 'IBERDROLA', 'IGNIS',
    'INTEGRA', 'NATURGY', 'NORDY', 'PLENITUDE', 'TOTAL ENERGIES', 'AXPO'
];

const WEBHOOK_URL = 'https://n8n.openenergiesgroup.com/webhook/b108a204-8e9c-43fb-bc23-5da85ceb343a';
const MAX_CUMULATIVE_SIZE_MB = 20;

export default function FacturaImport() {
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
            if (newFiles.length < e.target.files.length) {
                toast.error('Solo se permiten archivos PDF');
            }
            setFiles(prev => [...prev, ...newFiles]);
        }
        // Reset input to allow adding the same file again if needed (unlikely but good practice)
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const totalSizeMB = files.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024);

    const handleSubmit = async () => {
        if (files.length === 0) return;

        if (totalSizeMB > MAX_CUMULATIVE_SIZE_MB) {
            toast.error(`El tamaño total excede el límite de ${MAX_CUMULATIVE_SIZE_MB}MB`);
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            files.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Error al enviar los archivos');

            setIsSuccess(true);
            setFiles([]);
            toast.success('Facturas enviadas correctamente');
        } catch (error: any) {
            console.error('Error submitting invoices:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center p-8 animate-fade-in min-h-[400px]">
                <div className="w-20 h-20 bg-fenix-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={48} className="text-fenix-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">¡Enviado con éxito!</h2>
                <div className="glass-card p-6 max-w-md text-center space-y-4">
                    <p className="text-gray-300">
                        Las facturas se han enviado correctamente. Aparecerán en el CRM en los próximos minutos.
                    </p>
                    <div className="flex items-start gap-3 bg-bg-intermediate/50 p-4 rounded-lg text-sm text-fenix-400 border border-fenix-500/20 text-left">
                        <AlertCircle size={18} className="shrink-0" />
                        <p>El tiempo medio de extracción de datos es de 1 minuto por factura.</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsSuccess(false)}
                    className="mt-8 btn-primary px-8"
                >
                    Enviar más facturas
                </button>
                <button
                    onClick={() => router.history.back()}
                    className="mt-4 text-fenix-500 hover:text-fenix-400 font-medium transition-colors"
                >
                    Volver al listado
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.history.back()}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-fenix-600 dark:text-fenix-500 flex items-center gap-2">
                    <FileUp size={24} className="text-fenix-400" />
                    Importación por Lote de Facturas
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {/* Upload Section */}
                    <div className="glass-card p-8 border-2 border-dashed border-gray-700 hover:border-fenix-500/50 transition-all">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-fenix-500/10 rounded-full flex items-center justify-center">
                                <UploadCloud size={32} className="text-fenix-500" />
                            </div>
                            <div>
                                <h3 className="text-slate-600 dark:text-slate-400">Selecciona tus facturas PDF</h3>
                                <p className="text-gray-400 text-sm mt-1">Puedes seleccionar múltiples archivos simultáneamente</p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".pdf"
                                multiple
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-primary"
                                disabled={isSubmitting}
                            >
                                <FileUp size={18} />
                                Seleccionar Archivos
                            </button>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="glass-card overflow-hidden">
                            <div className="p-4 border-b border-bg-intermediate flex justify-between items-center bg-bg-intermediate/30">
                                <h4 className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <FileText size={18} className="text-fenix-400" />
                                    Cola de subida ({files.length})
                                </h4>
                                <span className={`text-xs ${totalSizeMB > MAX_CUMULATIVE_SIZE_MB ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                                    Total: {totalSizeMB.toFixed(2)} MB / {MAX_CUMULATIVE_SIZE_MB} MB
                                </span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                <table className="w-full">
                                    <tbody className="divide-y divide-bg-intermediate/50">
                                        {files.map((file, index) => (
                                            <tr key={`${file.name}-${index}`} className="group hover:bg-white/5 transition-colors">
                                                <td className="p-3 pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <FileText size={16} className="text-red-400" />
                                                        <span className="text-gray-400 text-sm mt-1">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-xs text-gray-500">
                                                    {(file.size / 1024).toFixed(0)} KB
                                                </td>
                                                <td className="p-3 pr-4 text-right">
                                                    <button
                                                        onClick={() => removeFile(index)}
                                                        className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                        title="Eliminar de la lista"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={files.length === 0 || isSubmitting || totalSizeMB > MAX_CUMULATIVE_SIZE_MB}
                        className="w-full btn-primary h-12 text-lg font-bold shadow-glow-sm disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <UploadCloud size={20} className="animate-bounce" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={20} />
                                Enviar {files.length > 0 ? `(${files.length} facturas)` : ''}
                            </>
                        )}
                    </button>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="glass-card p-6 border-l-4 border-fenix-500">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={20} className="text-fenix-400" />
                            <h4 className="text-slate-600 dark:text-slate-400">Comercializadoras Soportadas</h4>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                            El sistema de extracción automática de datos solo está disponible para estas compañías:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SUPPORTED_COMPANIES.map(company => (
                                <span
                                    key={company}
                                    className="px-2 py-1 bg-fenix-500/10 text-fenix-400 border border-fenix-500/20 rounded text-[10px] font-bold tracking-wider"
                                >
                                    {company}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card p-6 bg-bg-intermediate/60 border border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle size={20} className="text-solar-400" />
                            <h4 className="text-slate-600 dark:text-slate-400">Información Técnica</h4>
                        </div>
                        <ul className="text-xs text-gray-400 space-y-3 list-disc pl-4">
                            <li>Límite de subida: <strong>{MAX_CUMULATIVE_SIZE_MB}MB</strong> por lote.</li>
                            <li>Formato aceptado: <strong>Solo PDF</strong>.</li>
                            <li>Los datos se procesarán mediante IA y aparecerán automáticamente asociados al cliente y punto de suministro correspondiente.</li>
                            <li>Si la factura no pertenece a una de las compañías soportadas, se guardará como documento pero los datos no se extraerán automáticamente.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
