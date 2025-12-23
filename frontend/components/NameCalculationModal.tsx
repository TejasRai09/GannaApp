import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface NameCalculationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    currentDate: string;
}

export const NameCalculationModal: React.FC<NameCalculationModalProps> = ({ isOpen, onClose, onSave, currentDate }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(`Calculation for ${currentDate}`);
        }
    }, [isOpen, currentDate]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter') handleSave();
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
        };
    }, [isOpen, onClose, name]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="name-modal-title" className="text-xl font-bold text-slate-800">Save Calculation</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>
                <div className="p-6 space-y-2">
                    <label htmlFor="calc-name" className="block text-sm font-medium text-slate-700">
                        Enter a name for this calculation to save it to your history.
                    </label>
                    <input
                        id="calc-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                        autoFocus
                    />
                </div>
                <footer className="flex justify-end p-4 border-t bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-200 mr-2">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66]">
                        <Save size={16}/> Save and Calculate
                    </button>
                </footer>
            </div>
        </div>
    );
};
