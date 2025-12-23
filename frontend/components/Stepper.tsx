import React from 'react';
import { Check } from 'lucide-react';

interface Step {
    id: number;
    name: string;
}

interface StepperProps {
    steps: Step[];
    currentStep: number;
    maxReachedStep: number;
    onStepClick: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, maxReachedStep, onStepClick }) => {
    return (
        <nav aria-label="Progress">
            <ol role="list" className="flex items-center">
                {steps.map((step, stepIdx) => (
                    <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'flex-1' : ''}`}>
                        <>
                            {step.id < currentStep ? ( // Completed step
                                <div className="flex items-center relative z-10 bg-white pr-4">
                                    <button onClick={() => onStepClick(step.id)} className="flex items-center text-sm font-medium">
                                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#003580] group-hover:bg-[#002a66]">
                                            <Check className="h-6 w-6 text-white" aria-hidden="true" />
                                        </span>
                                        <span className="ml-4 text-sm font-medium text-slate-900">{step.name}</span>
                                    </button>
                                </div>
                            ) : step.id === currentStep ? ( // Current step
                                <div className="flex items-center relative z-10 bg-white pr-4" aria-current="step">
                                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#003580]">
                                        <span className="text-[#003580]">{step.id}</span>
                                    </span>
                                    <span className="ml-4 text-sm font-medium text-[#003580]">{step.name}</span>
                                </div>
                            ) : ( // Upcoming step
                                <div className="flex items-center relative z-10 bg-white pr-4">
                                    <button 
                                      onClick={() => onStepClick(step.id)} 
                                      className="flex items-center text-sm font-medium"
                                      disabled={step.id > maxReachedStep}
                                    >
                                        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${step.id <= maxReachedStep ? 'border-slate-300 group-hover:border-slate-400' : 'border-slate-200'}`}>
                                            <span className={`${step.id <= maxReachedStep ? 'text-slate-500 group-hover:text-slate-900' : 'text-slate-400'}`}>{step.id}</span>
                                        </span>
                                        <span className={`ml-4 text-sm font-medium ${step.id <= maxReachedStep ? 'text-slate-500 group-hover:text-slate-900' : 'text-slate-400'}`}>{step.name}</span>
                                    </button>
                                </div>
                            )}

                            {stepIdx !== steps.length - 1 ? (
                                <div className="absolute top-1/2 left-10 -translate-y-1/2 w-[calc(100%-40px)] -ml-px" aria-hidden="true">
                                     <svg
                                        className="h-full w-full text-slate-300"
                                        viewBox="0 0 100 1"
                                        fill="none"
                                        preserveAspectRatio="none"
                                    >
                                        <line x1="0" y1="0.5" x2="100" y2="0.5" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeDasharray="2,4" />
                                    </svg>
                                </div>
                            ) : null}
                        </>
                    </li>
                ))}
            </ol>
        </nav>
    );
};