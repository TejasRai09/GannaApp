
import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, ArrowRight, Save, FlaskConical, RefreshCcw, RotateCcw, Eye, EyeOff } from 'lucide-react';
import type { CalculationRun, CalculationResults, CalculationInputs, IndentResultRow } from '../types';
import { calculateRecommendedIndents } from '../services/calculationService';
import { InfoIcon } from './InfoIcon';

interface SimulationModalProps {
    isOpen: boolean;
    onClose: () => void;
    baseCalculation: CalculationRun;
    onSaveSimulation: (name: string, inputs: Partial<CalculationInputs>) => void;
    data: {
        bondingData: any[];
        indentData: any[];
        purchaseData: any[];
    };
}

const ParameterInput: React.FC<{
    label: string;
    value: number;
    originalValue: number;
    onChange: (val: number) => void;
    unit?: string;
}> = ({ label, value, originalValue, onChange, unit }) => {
    const isModified = value !== originalValue;
    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className={`block w-full px-3 py-2 border rounded-md text-sm transition-all ${
                            isModified 
                            ? 'border-indigo-300 ring-2 ring-indigo-100 bg-white' 
                            : 'border-slate-300 focus:ring-blue-100 focus:border-blue-400'
                        }`}
                    />
                    {unit && <span className="absolute right-3 top-2 text-slate-400 text-sm">{unit}</span>}
                </div>
                {isModified && (
                    <div className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded flex items-center gap-1" title="Original Value">
                        <RotateCcw size={10} className="cursor-pointer hover:text-slate-800" onClick={() => onChange(originalValue)}/>
                        Orig: {originalValue}
                    </div>
                )}
            </div>
        </div>
    );
};

const KPICard: React.FC<{ title: string; base: number; sim: number; unit?: string, inverse?: boolean }> = ({ title, base, sim, unit, inverse }) => {
    const diff = sim - base;
    const isZero = Math.abs(diff) < 0.01;
    
    let colorClass = 'text-slate-500';
    let bgClass = 'bg-slate-100';
    if (!isZero) {
        if (diff > 0) {
            colorClass = 'text-green-700';
            bgClass = 'bg-green-100';
        } else {
            colorClass = 'text-red-700';
            bgClass = 'bg-red-100';
        }
    }

    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm flex-1">
            <p className="text-xs font-bold text-slate-500 uppercase">{title}</p>
            <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">{sim.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                <span className="text-sm text-slate-400 mb-1">{unit}</span>
            </div>
            {!isZero && (
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mt-2 ${bgClass} ${colorClass}`}>
                    {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, {maximumFractionDigits: 0})}
                </div>
            )}
            {isZero && <p className="text-xs text-slate-400 mt-2">No Change</p>}
        </div>
    );
};

export const SimulationModal: React.FC<SimulationModalProps> = ({ isOpen, onClose, baseCalculation, onSaveSimulation, data }) => {
    const [step, setStep] = useState<'config' | 'compare'>('config');
    const [simInputs, setSimInputs] = useState(baseCalculation.inputs);
    const [simResults, setSimResults] = useState<CalculationResults | null>(null);
    const [simName, setSimName] = useState(`${baseCalculation.name} - Scenario 1`);
    const [showAllCenters, setShowAllCenters] = useState(false);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('config');
            setSimInputs(baseCalculation.inputs);
            setSimResults(null);
            setSimName(`${baseCalculation.name} - Scenario`);
            setShowAllCenters(false);
        }
    }, [isOpen, baseCalculation]);

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
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleSimulate = async () => {
        // Reconstruct full inputs
        const fullInputs: CalculationInputs = {
            ...simInputs,
            bondingData: data.bondingData,
            indentData: data.indentData,
            purchaseData: data.purchaseData,
            currentDate: new Date(simInputs.currentDate),
            plantStartDate: simInputs.plantStartDate, 
            // ensure date objects if needed, though calculationService handles strings largely via util
        };
        
        // Run calculation synchronously (it's fast enough)
        try {
            const results = calculateRecommendedIndents(fullInputs);
            setSimResults(results);
            setStep('compare');
        } catch (e) {
            console.error("Simulation failed", e);
            alert("Failed to run simulation. Please check data.");
        }
    };

    const handleSave = () => {
        onSaveSimulation(simName, simInputs);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className={`bg-white rounded-xl shadow-2xl w-full transition-all duration-300 flex flex-col ${step === 'compare' ? 'max-w-6xl h-[90vh]' : 'max-w-2xl h-auto'}`}>
                
                {/* Header */}
                <header className="flex justify-between items-center p-5 border-b bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                            <FlaskConical size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">What-If Simulation</h2>
                            <p className="text-sm text-slate-500">
                                {step === 'config' ? 'Adjust parameters to test a scenario' : 'Comparing simulation against original'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {step === 'config' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ParameterInput 
                                    label="Plant Capacity" 
                                    value={simInputs.plantCapacity} 
                                    originalValue={baseCalculation.inputs.plantCapacity}
                                    onChange={(v) => setSimInputs(p => ({...p, plantCapacity: v}))}
                                    unit="%"
                                />
                                <ParameterInput 
                                    label="Daily Requirement" 
                                    value={simInputs.totalDailyRequirement} 
                                    originalValue={baseCalculation.inputs.totalDailyRequirement}
                                    onChange={(v) => setSimInputs(p => ({...p, totalDailyRequirement: v}))}
                                    unit="Qtls"
                                />
                            </div>
                            
                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <SlidersHorizontal size={16}/> Stock Adjustments
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ParameterInput 
                                        label="Standard Stock (Gate)" 
                                        value={simInputs.standardStockGate} 
                                        originalValue={baseCalculation.inputs.standardStockGate}
                                        onChange={(v) => setSimInputs(p => ({...p, standardStockGate: v}))}
                                        unit="Qtls"
                                    />
                                    <ParameterInput 
                                        label="Available Stock (Gate)" 
                                        value={simInputs.availableStockGate} 
                                        originalValue={baseCalculation.inputs.availableStockGate}
                                        onChange={(v) => setSimInputs(p => ({...p, availableStockGate: v}))}
                                        unit="Qtls"
                                    />
                                     <ParameterInput 
                                        label="Standard Stock (Centre)" 
                                        value={simInputs.standardStockCentre} 
                                        originalValue={baseCalculation.inputs.standardStockCentre}
                                        onChange={(v) => setSimInputs(p => ({...p, standardStockCentre: v}))}
                                        unit="Qtls"
                                    />
                                    <ParameterInput 
                                        label="Available Stock (Centre)" 
                                        value={simInputs.availableStockCentre} 
                                        originalValue={baseCalculation.inputs.availableStockCentre}
                                        onChange={(v) => setSimInputs(p => ({...p, availableStockCentre: v}))}
                                        unit="Qtls"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'compare' && simResults && (
                        <div className="space-y-6 h-full flex flex-col">
                            {/* KPI Diffs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KPICard 
                                    title="Total Indent" 
                                    base={baseCalculation.results.tableData.reduce((s,r) => s + r.indentToRaise, 0)}
                                    sim={simResults.tableData.reduce((s,r) => s + r.indentToRaise, 0)}
                                    unit="Qtls"
                                />
                                <KPICard 
                                    title="Effective Req" 
                                    base={baseCalculation.results.effectiveRequirement}
                                    sim={simResults.effectiveRequirement}
                                    unit="Qtls"
                                />
                                <KPICard 
                                    title="Total Forecast (T+3)" 
                                    base={baseCalculation.results.totalForecastT3}
                                    sim={simResults.totalForecastT3}
                                    unit="Qtls"
                                />
                            </div>

                            {/* Comparison Table */}
                            <div className="bg-white border rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                                <div className="p-3 bg-slate-100 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <h3 className="font-bold text-slate-700">Center-wise Variance Analysis</h3>
                                    
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={showAllCenters}
                                                    onChange={(e) => setShowAllCenters(e.target.checked)}
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                <span className="ml-2 text-xs font-medium text-slate-600">
                                                    {showAllCenters ? 'Show All Rows' : 'Show Changes Only'}
                                                </span>
                                            </label>
                                        </div>

                                        <div className="text-xs text-slate-500 flex gap-4 border-l pl-4 border-slate-300">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Increased Indent</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Reduced Indent</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-auto flex-1 custom-scrollbar">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs uppercase text-slate-500 font-semibold">
                                            <tr>
                                                <th className="px-4 py-3">Center</th>
                                                <th className="px-4 py-3 text-right">Base Indent</th>
                                                <th className="px-4 py-3 text-right text-indigo-700 bg-indigo-50/50">Simulated Indent</th>
                                                <th className="px-4 py-3 text-right">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {simResults.tableData.map(simRow => {
                                                const baseRow = baseCalculation.results.tableData.find(r => r.centreId === simRow.centreId);
                                                const baseIndent = baseRow?.indentToRaise || 0;
                                                const simIndent = simRow.indentToRaise;
                                                const diff = simIndent - baseIndent;
                                                
                                                // If NOT showing all, hide rows with negligible difference
                                                if (!showAllCenters && Math.abs(diff) < 1) return null;

                                                const isZero = Math.abs(diff) < 1;

                                                return (
                                                    <tr key={simRow.centreId} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-medium text-slate-800">
                                                            {simRow.centreName} <span className="text-xs text-slate-400">({simRow.centreId})</span>
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-slate-500 font-mono">
                                                            {baseIndent.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                                        </td>
                                                        <td className={`px-4 py-2 text-right font-bold font-mono ${isZero ? 'text-slate-700' : 'text-indigo-700 bg-indigo-50/30'}`}>
                                                            {simIndent.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono">
                                                            {!isZero ? (
                                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="p-5 border-t bg-white rounded-b-xl flex justify-between items-center">
                    {step === 'config' ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button 
                                onClick={handleSimulate} 
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all"
                            >
                                Simulate & Compare <ArrowRight size={18}/>
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setStep('config')} 
                                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg flex items-center gap-2"
                            >
                                <SlidersHorizontal size={16}/> Adjust Parameters
                            </button>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="text" 
                                    value={simName}
                                    onChange={(e) => setSimName(e.target.value)}
                                    className="border-slate-300 rounded-md text-sm w-64 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Scenario Name"
                                />
                                <button 
                                    onClick={handleSave} 
                                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-all"
                                >
                                    <Save size={18}/> Save as New Version
                                </button>
                            </div>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
};
