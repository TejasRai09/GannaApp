import React, { useState, useEffect } from 'react';
import { X, FileText, SlidersHorizontal, CheckCircle } from 'lucide-react';

interface IntroModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const steps = [
    {
        icon: <FileText size={48} className="text-[#003580]" />,
        title: 'Step 1: Upload Your Data',
        description: 'Start by uploading your Bonding, Historical Indent, and Historical Purchase files in .csv format. Once all files are loaded, you can proceed to the next step.'
    },
    {
        icon: <SlidersHorizontal size={48} className="text-[#003580]" />,
        title: 'Step 2: Set Your Parameters',
        description: 'Review the default parameters like plant capacity and stock levels, and adjust them to match today\'s conditions before moving on.'
    },
    {
        icon: <CheckCircle size={48} className="text-[#003580]" />,
        title: 'Step 3: Review & Calculate',
        description: 'Finally, review a summary of your data and settings. If everything looks correct, click the calculate button to get your results!'
    }
];

export const IntroModal: React.FC<IntroModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
            setStep(0); // Reset on close
        };
    }, [isOpen, onClose]);

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(s => s + 1);
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    const currentStep = steps[step];

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-modal-title"
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-end p-2">
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>
                
                <div className="px-10 pb-8">
                    <div className="flex justify-center mb-6">
                        {currentStep.icon}
                    </div>
                    <h2 id="intro-modal-title" className="text-2xl font-bold text-slate-800 mb-2">{currentStep.title}</h2>
                    <p className="text-slate-600">{currentStep.description}</p>
                </div>
                
                <footer className="flex flex-col sm:flex-row-reverse justify-between items-center p-4 border-t bg-slate-50 rounded-b-xl">
                    <button 
                        onClick={handleNext} 
                        className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66] mb-2 sm:mb-0"
                    >
                        {step === steps.length - 1 ? "Let's Go!" : 'Next'}
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-200"
                    >
                        Skip Tour
                    </button>
                </footer>
            </div>
        </div>
    );
};
