
import React, { useState } from 'react';
import type { CalculationResults } from '../types';
import { Percent, BarChart3, Target, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { InfoIcon } from './InfoIcon';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    tooltip?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, tooltip }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center">
        <div className={`p-3 rounded-full mr-4 ${color}`}>
            {icon}
        </div>
        <div>
            <div className="flex items-center gap-1.5">
                <p className="text-sm text-slate-500 font-medium">{title}</p>
                {tooltip && <InfoIcon text={tooltip} />}
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);


export const ResultsDisplay: React.FC<{ results: CalculationResults }> = ({ results }) => {
    const { dWeights, overrunPercentage, effectiveRequirement, totalForecastT3 } = results;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
            <div 
                className="flex justify-between items-center p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-600" /> 
                    Calculation Summary
                    {!isExpanded && <span className="text-sm font-normal text-slate-500 ml-2">(Click to expand details)</span>}
                </h2>
                <button className="text-slate-400 hover:text-[#003580] transition-colors">
                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
            </div>
            
            {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <StatCard 
                            title="Plant Overrun" 
                            value={`${(overrunPercentage * 100).toFixed(2)}%`} 
                            icon={<Percent className="text-orange-800"/>} 
                            color="bg-orange-100"
                            tooltip="A percentage that measures if the plant historically receives more or less cane than was officially indented across all centers. It's a key adjustment factor to account for systemic over/under-purchasing."
                        />
                        <StatCard 
                            title="Effective Req (T+3)" 
                            value={effectiveRequirement.toLocaleString()} 
                            icon={<Target className="text-blue-800"/>} 
                            color="bg-blue-100"
                            tooltip="The adjusted daily crushing target for the plant, accounting for its operational capacity for the day."
                        />
                        <StatCard 
                            title="Total Forecast (T+3)" 
                            value={totalForecastT3.toLocaleString()} 
                            icon={<BarChart3 className="text-purple-800"/>} 
                            color="bg-purple-100"
                            tooltip="The quantity of cane expected to arrive on T+3 resulting from indents already placed in the previous three days (the 'pipeline' quantity)."
                        />
                    </div>
                    
                    <div>
                         <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Full Maturity Weight Profile (D1-D4)</h3>
                         <div className="grid grid-cols-4 gap-2 text-center">
                             {Object.entries(dWeights).map(([key, value]) => (
                                 <div key={key} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                     <p className="text-xs font-bold uppercase text-slate-400 mb-1">{key}</p>
                                     <p className="text-lg font-bold text-slate-800">{((Number(value)) * 100).toFixed(2)}%</p>
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};
