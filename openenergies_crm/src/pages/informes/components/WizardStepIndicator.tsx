// openenergies_crm/src/pages/informes/components/WizardStepIndicator.tsx
// Indicador visual de pasos del wizard

import React from 'react';
import { Check } from 'lucide-react';
import type { WizardStep } from '@lib/informesTypes';

interface WizardStepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

const steps = [
  { number: 1, title: 'Configuración', description: 'Alcance del informe' },
  { number: 2, title: 'Contenido', description: 'Edición y datos' },
  { number: 3, title: 'Generación', description: 'Revisar y generar' },
] as const;

export default function WizardStepIndicator({ currentStep, onStepClick }: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Progreso" className="mb-8">
      <ol className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          const isClickable = onStepClick && step.number < currentStep;

          return (
            <li key={step.number} className="relative flex items-center">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`
                    absolute right-full w-16 md:w-24 h-0.5 top-1/2 -translate-y-1/2
                    ${isCompleted || isCurrent ? 'bg-fenix-500' : 'bg-slate-200 dark:bg-slate-700'}
                  `}
                />
              )}

              {/* Step circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number as WizardStep)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full
                  transition-all duration-200 z-10
                  ${isCompleted
                    ? 'bg-fenix-500 text-white cursor-pointer hover:bg-fenix-600'
                    : isCurrent
                      ? 'bg-fenix-500 text-white ring-4 ring-fenix-500/20'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-default'
                  }
                `}
              >
                {isCompleted ? (
                  <Check size={20} strokeWidth={3} />
                ) : (
                  <span className="text-sm font-semibold">{step.number}</span>
                )}
              </button>

              {/* Step label */}
              <div className="hidden md:block ml-3 mr-8">
                <p
                  className={`
                    text-sm font-medium
                    ${isCurrent ? 'text-fenix-600 dark:text-fenix-400' : 'text-slate-600 dark:text-slate-400'}
                  `}
                >
                  {step.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
