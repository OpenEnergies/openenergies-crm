// openenergies_crm/src/pages/informes/InformesPage.tsx
// Página principal del módulo de Informes de Mercado

import React, { useState, useCallback } from 'react';
import { FileBarChart, History, Plus, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// Components
import WizardStepIndicator from './components/WizardStepIndicator';
import Step1Config from './components/Step1Config';
import Step2Content from './components/Step2Content';
import AuditoriaEnergeticaContent from './components/AuditoriaEnergeticaContent';
import Step3Generate from './components/Step3Generate';
import InformesHistory from './components/InformesHistory';

// Hooks & Types
import { useGenerateInforme, informesKeys } from '@hooks/useInformesMercado';
import { useEmpresaId } from '@hooks/useEmpresaId';
import type {
  WizardStep,
  InformeConfig,
  InformeContent,
  AuditoriaContent,
  GenerateInformeResponse
} from '@lib/informesTypes';
import { DEFAULT_CONFIG, DEFAULT_CONTENT, DEFAULT_AUDITORIA_CONTENT } from '@lib/informesTypes';

type ViewMode = 'wizard' | 'history';

export default function InformesPage() {
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaId();
  const generateMutation = useGenerateInforme();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('wizard');

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [config, setConfig] = useState<InformeConfig>(DEFAULT_CONFIG);
  const [content, setContent] = useState<InformeContent>(DEFAULT_CONTENT);
  const [auditoriaContent, setAuditoriaContent] = useState<AuditoriaContent>(DEFAULT_AUDITORIA_CONTENT);
  const [generateResult, setGenerateResult] = useState<GenerateInformeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Navigation handlers
  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
    setError(null);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
      setError(null);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
      setError(null);
    }
  }, [currentStep]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setConfig(DEFAULT_CONFIG);
    setContent(DEFAULT_CONTENT);
    setAuditoriaContent(DEFAULT_AUDITORIA_CONTENT);
    setGenerateResult(null);
    setError(null);
  }, []);

  // Generate handler
  const handleGenerate = useCallback(async () => {
    if (!empresaId) {
      setError('No se pudo determinar la empresa');
      return;
    }

    setError(null);
    setGenerateResult(null);

    try {
      const result = await generateMutation.mutateAsync({
        config: {
          ...config,
          empresa_id: empresaId,
        },
        content,
      });

      setGenerateResult(result);

      // Invalidate history to show new informe
      queryClient.invalidateQueries({ queryKey: informesKeys.lists() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [config, content, empresaId, generateMutation, queryClient]);

  // Tab button component
  const TabButton = ({
    mode,
    icon,
    label,
    count
  }: {
    mode: ViewMode;
    icon: React.ReactNode;
    label: string;
    count?: number;
  }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
        ${viewMode === mode
          ? 'bg-fenix-500 text-white shadow-lg shadow-fenix-500/25'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`
          px-1.5 py-0.5 rounded text-xs
          ${viewMode === mode
            ? 'bg-white/20 text-white'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <FileBarChart className="text-fenix-500" size={28} />
              Informes de Mercado
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Genera informes de auditoría y situación de mercado para tus clientes
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <TabButton
              mode="wizard"
              icon={<Plus size={18} />}
              label="Nuevo Informe"
            />
            <TabButton
              mode="history"
              icon={<History size={18} />}
              label="Historial"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'wizard' ? (
        <div className="max-w-4xl mx-auto">
          {/* Wizard Step Indicator */}
          <WizardStepIndicator
            currentStep={currentStep}
            onStepClick={goToStep}
          />

          {/* Step Content */}
          <div className="mt-6">
            {currentStep === 1 && (
              <Step1Config
                config={config}
                onChange={setConfig}
                onNext={handleNext}
              />
            )}
            {currentStep === 2 && config.tipo_informe === 'auditoria' && (
              <AuditoriaEnergeticaContent
                config={config}
                content={auditoriaContent}
                onChange={setAuditoriaContent}
                onBack={handleBack}
                onNext={handleNext}
              />
            )}
            {currentStep === 2 && config.tipo_informe === 'comparativa' && (
              <Step2Content
                config={config}
                content={content}
                onChange={setContent}
                onBack={handleBack}
                onNext={handleNext}
              />
            )}
            {currentStep === 3 && (
              <Step3Generate
                config={config}
                content={content}
                auditoriaContent={config.tipo_informe === 'auditoria' ? auditoriaContent : undefined}
                onBack={handleBack}
                onGenerate={handleGenerate}
                isGenerating={generateMutation.isPending}
                generateResult={generateResult}
                error={error}
              />
            )}
          </div>

          {/* Reset button when completed */}
          {generateResult?.success && (
            <div className="mt-6 text-center">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-fenix-600 dark:text-fenix-400 hover:text-fenix-700 transition-colors"
              >
                <RefreshCw size={16} />
                Crear otro informe
              </button>
            </div>
          )}

          {/* Quick History Preview */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <History size={20} className="text-slate-400" />
                Últimos Informes
              </h2>
              <button
                onClick={() => setViewMode('history')}
                className="text-sm text-fenix-600 dark:text-fenix-400 hover:text-fenix-700 transition-colors"
              >
                Ver todos →
              </button>
            </div>
            <InformesHistory limit={3} showViewAll={false} />
          </div>
        </div>
      ) : (
        <div>
          {/* Full History View */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
              Todos los Informes
            </h2>
            <button
              onClick={() => {
                handleReset();
                setViewMode('wizard');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-fenix-500 text-white rounded-lg hover:bg-fenix-600 transition-colors shadow-lg shadow-fenix-500/25"
            >
              <Plus size={18} />
              Nuevo Informe
            </button>
          </div>
          <InformesHistory limit={50} showViewAll={false} />
        </div>
      )}
    </div>
  );
}
