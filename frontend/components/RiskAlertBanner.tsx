
import React from 'react';
import { AlertTriangle, Info, CloudRain, Factory, RefreshCw } from 'lucide-react';
import type { RiskAnalysisItem } from '../types';

interface RiskAlertBannerProps {
    risks: RiskAnalysisItem[];
    onOpenSimulation: () => void;
}

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({ risks, onOpenSimulation }) => {
    if (!risks || risks.length === 0) return null;

    return (
        <div className="space-y-4 mb-6">
            {risks.map((risk, index) => (
                <div 
                    key={index}
                    className={`rounded-lg border p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500
                        ${risk.type === 'field' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}
                    `}
                >
                    <div className={`p-2 rounded-full flex-shrink-0 ${risk.type === 'field' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {risk.type === 'field' ? <CloudRain size={24} /> : <Factory size={24} />}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h4 className={`font-bold text-lg ${risk.type === 'field' ? 'text-amber-900' : 'text-blue-900'}`}>
                                {risk.type === 'field' ? 'Supply Risk Detected' : 'Operational Adjustment Applied'}
                            </h4>
                            {risk.type === 'field' && (
                                <button 
                                    onClick={onOpenSimulation}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-colors shadow-sm"
                                >
                                    <RefreshCw size={12} /> Run Simulation
                                </button>
                            )}
                        </div>
                        
                        <p className={`mt-1 text-sm ${risk.type === 'field' ? 'text-amber-800' : 'text-blue-800'}`}>
                            {risk.message}
                        </p>
                        
                        <div className="mt-3 flex gap-6 text-sm">
                            <div>
                                <span className={`uppercase text-xs font-bold ${risk.type === 'field' ? 'text-amber-500' : 'text-blue-400'}`}>
                                    {risk.type === 'field' ? 'Projected Deficit' : 'Reduced By'}
                                </span>
                                <p className={`font-mono font-bold text-lg ${risk.type === 'field' ? 'text-red-600' : 'text-slate-700'}`}>
                                    {Math.round(risk.deficit).toLocaleString()} <span className="text-xs font-normal">Qtls</span>
                                </p>
                            </div>
                            <div>
                                <span className={`uppercase text-xs font-bold ${risk.type === 'field' ? 'text-amber-500' : 'text-blue-400'}`}>
                                    {risk.type === 'field' ? 'Constrained Forecast' : 'New Requirement'}
                                </span>
                                <p className={`font-mono font-bold text-lg ${risk.type === 'field' ? 'text-amber-900' : 'text-blue-900'}`}>
                                    {Math.round(risk.constrainedValue).toLocaleString()} <span className="text-xs font-normal">Qtls</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
