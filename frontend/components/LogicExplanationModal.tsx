import React, { useEffect } from 'react';
import { X, ArrowRight, TrendingUp, BarChart3, TestTube2, Target } from 'lucide-react';

interface LogicExplanationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Step: React.FC<{ icon: React.ReactNode, title: string, children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border h-full">
    <div className="flex-shrink-0 text-[#003580] mt-1">{icon}</div>
    <div>
      <h4 className="font-bold text-slate-800">{title}</h4>
      <div className="text-sm text-slate-600 space-y-2 mt-1">{children}</div>
    </div>
  </div>
);

const Arrow: React.FC = () => (
    <div className="flex justify-center items-center my-2 md:my-0">
        <ArrowRight size={24} className="text-slate-400 rotate-90 md:rotate-0" />
    </div>
);

export const LogicExplanationModal: React.FC<LogicExplanationModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
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

    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logic-modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="logic-modal-title" className="text-xl font-bold text-slate-800">Calculation Logic Walkthrough</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 overflow-y-auto">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Step icon={<TestTube2 size={24} />} title="1. Maturity Weights (D1-D4)">
                           <p>Analyzes recent closed indents to find the historical arrival pattern for each center. The weights represent the percentage of an indent that arrives on a specific day relative to its <strong>Indent Date</strong>:</p>
                           <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                               <li><strong>D1:</strong> Arriving on or before the Indent Date (Day ≤ 0).</li>
                               <li><strong>D2:</strong> Arriving 1 day after (Day +1).</li>
                               <li><strong>D3:</strong> Arriving 2 days after (Day +2).</li>
                               <li><strong>D4:</strong> Arriving 3 or more days after (Day ≥ +3).</li>
                           </ul>
                           <p className="mt-2">These weights are determined using a conditional average to ensure stability, and a center's specific D1 weight is crucial for calculating the final indent.</p>
                        </Step>
                        
                        <Step icon={<TrendingUp size={24} />} title="2. Plant Overrun">
                           <p>Checks if the plant historically receives more or less cane than indented across all centers.</p>
                           <p>Calculated as: <br/><code>(Total Purchases / Total Indents) - 1</code>.</p>
                           <p>A positive value means more cane arrives than indented.</p>
                        </Step>

                        <Step icon={<BarChart3 size={24} />} title="3. Forecast (T+3)">
                           <p>The system predicts arrivals for T+3 by summing up expected portions from previously placed indents:</p>
                           <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                               <li>The <strong>D2</strong> portion of the indent <strong>for T+2</strong></li>
                               <li>The <strong>D3</strong> portion of the indent <strong>for T+1</strong></li>
                               <li>The <strong>D4</strong> portion of the indent <strong>for T (Today)</strong></li>
                           </ul>
                        </Step>

                        <Step icon={<Target size={24} />} title="4. Recommended Indent">
                            <p>This is the final calculation, performed for each center:</p>
                            <ol className="list-decimal list-inside space-y-1 pl-1">
                                <li>The <strong>Effective Requirement</strong> is distributed by bonding %.</li>
                                <li>Stock balances for <strong>Gate</strong> and <strong>Centre</strong> are added proportionally to their respective centers to get the 'Adjusted' value.</li>
                                <li>Subtract the center's <strong>Forecast (T+3)</strong>.</li>
                                <li>Adjust for <strong>Plant Overrun</strong>.</li>
                                <li>The result is divided by that center's specific <strong>D1 Weight</strong> to get the final indent.</li>
                            </ol>
                        </Step>
                    </div>
                </div>
            </div>
        </div>
    );
};