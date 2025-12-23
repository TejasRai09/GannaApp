import React, { useEffect } from 'react';
import { X, Calculator, ClipboardList, Percent, Equal } from 'lucide-react';

interface CalculationModalData {
    centerName: string;
    indentDate: Date;
    purchaseDate: Date;
    indentQty: number;
    dWeight: number;
    dWeightLabel: string;
    forecastValue: number;
}

interface ForecastCalculationModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: CalculationModalData | null;
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);

const CalculationCard: React.FC<{ icon: React.ReactNode, label: string, value: string, subtext?: string, color: string }> = ({ icon, label, value, subtext, color }) => (
    <div className="flex-1 text-center p-4 bg-white rounded-lg border shadow-sm">
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 ${color}`}>
            {icon}
        </div>
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
);

export const ForecastCalculationModal: React.FC<ForecastCalculationModalProps> = ({ isOpen, onClose, data }) => {
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
        };
    }, [isOpen, onClose]);

    if (!isOpen || !data) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calc-modal-title"
        >
            <div 
                className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b bg-white rounded-t-xl">
                    <h2 id="calc-modal-title" className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Calculator size={20} /> Forecast Calculation
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="text-center">
                        <p className="text-sm text-slate-600">Breakdown for <span className="font-semibold text-[#003580]">{data.centerName}</span></p>
                        <p className="text-sm text-slate-600">Expected arrival on <span className="font-semibold text-slate-800">{formatDate(data.purchaseDate)}</span></p>
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-4 my-6">
                        <CalculationCard 
                            icon={<ClipboardList className="text-blue-600" />}
                            label="Indent Quantity"
                            value={Math.round(data.indentQty).toLocaleString()}
                            subtext={`From Indent Date: ${formatDate(data.indentDate)}`}
                            color="bg-blue-100"
                        />
                         <X size={24} className="text-slate-400 flex-shrink-0" />
                         <CalculationCard 
                            icon={<Percent className="text-orange-600" />}
                            label="Maturity Weight"
                            value={(data.dWeight * 100).toFixed(2) + '%'}
                            subtext={`Using Weight: ${data.dWeightLabel}`}
                            color="bg-orange-100"
                        />
                         <Equal size={24} className="text-slate-400 flex-shrink-0" />
                         <CalculationCard 
                            icon={<Calculator className="text-green-600" />}
                            label="Forecasted Arrival"
                            value={Math.round(data.forecastValue).toLocaleString()}
                            subtext="in Qtls"
                            color="bg-green-100"
                        />
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border text-center">
                        <h4 className="font-semibold text-slate-800 mb-1">Calculation Formula</h4>
                        <p className="font-mono text-slate-700 bg-slate-100 p-3 rounded-md">
                            <span className="text-blue-700">{Math.round(data.indentQty).toLocaleString()}</span>
                            <span className="text-slate-500"> (Indent) </span>
                            <span className="font-bold"> × </span>
                            <span className="text-orange-700">{(data.dWeight * 100).toFixed(2)}%</span>
                            <span className="text-slate-500"> (Weight) </span>
                             <span className="font-bold"> = </span>
                            <span className="text-green-700 font-bold">{Math.round(data.forecastValue).toLocaleString()}</span>
                        </p>
                    </div>
                </div>

                <footer className="flex justify-end p-4 border-t">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66]">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};