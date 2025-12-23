import React, { useState, useMemo } from 'react';
import type { CalculationResults, IndentCalculationBreakdownRow } from '../types';
import { Filter, Target, Percent, Warehouse, Minus, Divide, CheckCircle, ArrowRight, FileText, Calculator, Database, Lightbulb, TrendingUp, AlertTriangle, BookOpen, Scale } from 'lucide-react';

type ViewMode = 'technical' | 'business';

interface ExplanationContent {
    technical: {
        logic: string;
        formula: string;
        source: string;
    };
    business: {
        strategy: string;
        goal: string;
        risk: string;
    };
}

const DetailRow: React.FC<{ label: string; value: string; isBold?: boolean }> = ({ label, value, isBold }) => (
    <div className="flex justify-between items-baseline">
        <p className={isBold ? 'text-slate-700 font-medium' : ''}>{label}:</p>
        <p className={`font-mono text-right ${isBold ? 'font-bold text-slate-900 bg-slate-100 px-1 rounded' : ''}`}>{value}</p>
    </div>
);

const ExplanationCard: React.FC<{ data: ExplanationContent; mode: ViewMode; color: string }> = ({ data, mode, color }) => (
    <div className="h-full flex flex-col justify-center transition-all duration-300">
        <div className={`p-4 rounded-lg border text-sm h-full ${color.replace('bg-', 'bg-opacity-20 border-').replace('100', '200')}`}>
            {mode === 'technical' ? (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <FileText size={12} /> Logic
                        </p>
                        <p className="text-slate-700 leading-snug">{data.technical.logic}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <Calculator size={12} /> Formula
                        </p>
                        <code className="block bg-white/60 p-2 rounded text-xs font-mono text-slate-700 break-words border border-slate-200/50 shadow-sm">
                            {data.technical.formula}
                        </code>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <Database size={12} /> Source
                        </p>
                        <p className="text-slate-500 text-xs italic">{data.technical.source}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <Lightbulb size={12} className="text-amber-500" /> Strategy
                        </p>
                        <p className="text-slate-800 font-semibold leading-snug">{data.business.strategy}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <Target size={12} className="text-blue-500" /> Operational Goal
                        </p>
                        <p className="text-slate-700 leading-snug bg-white/40 p-2 rounded border border-white/50">{data.business.goal}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-red-500" /> Risk Factor
                        </p>
                        <p className="text-slate-600 text-xs italic leading-relaxed">{data.business.risk}</p>
                    </div>
                </div>
            )}
        </div>
    </div>
);

const CalculationRow: React.FC<{
    stepNumber: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
    explanation: ExplanationContent;
    viewMode: ViewMode;
}> = ({ stepNumber, title, icon, color, children, explanation, viewMode }) => {
    return (
        <div className="group relative">
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* Left Side: Calculation Card */}
                <div className="flex-1 min-w-0">
                    <div className="bg-white p-5 rounded-xl border shadow-sm h-full relative z-10 transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${color}`}>
                                {stepNumber}
                            </div>
                            <div className={`p-1.5 rounded-md ${color.replace('100', '50')}`}>
                                {icon}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg">{title}</h4>
                        </div>
                        <div className="text-sm text-slate-600 space-y-3 px-1">
                            {children}
                        </div>
                    </div>
                </div>

                {/* Connector Arrow (Desktop only) */}
                <div className="hidden lg:flex flex-col justify-center items-center text-slate-300">
                    <ArrowRight size={24} strokeWidth={1.5} />
                </div>

                {/* Right Side: Explanation Note */}
                <div className="lg:w-[350px] flex-shrink-0">
                    <ExplanationCard data={explanation} mode={viewMode} color={color} />
                </div>
            </div>
            
            {/* Vertical Connector Line */}
            <div className="hidden lg:block absolute left-[2.25rem] bottom-[-1.5rem] top-[calc(100%)] w-px bg-slate-200 -z-10 h-6"></div>
        </div>
    );
};

const CalculationFlow: React.FC<{ data: IndentCalculationBreakdownRow; viewMode: ViewMode }> = ({ data, viewMode }) => {
    return (
        <div className="space-y-6 pb-4">
            <CalculationRow 
                stepNumber="1"
                title="Distribute Requirement" 
                icon={<Target size={18} className="text-blue-700" />} 
                color="bg-blue-100 text-blue-800"
                viewMode={viewMode}
                explanation={{
                    technical: {
                        logic: "Allocate the mill's effective daily requirement to this center based on its percentage share of total bonded cane.",
                        formula: "Effective Requirement * (Center Bonding / Total Bonding)",
                        source: "Parameters (Req) • Bonding File"
                    },
                    business: {
                        strategy: "Ensuring Equity Among Farmers",
                        goal: "To give every farmer a fair turn based on their committed supply quantity.",
                        risk: "Ignoring this leads to favoritism complaints and unequal harvest progress across zones."
                    }
                }}
            >
                <DetailRow label="Effective Requirement" value={Math.round(data.effectiveRequirement).toLocaleString()} />
                <DetailRow label="Center Bonding %" value={`${data.bondingPercentage.toFixed(2)}%`} />
                <div className="h-px bg-slate-100 my-1" />
                <DetailRow label="Requirement by Bonding" value={Math.round(data.requirementByBonding).toLocaleString()} isBold />
            </CalculationRow>

            <CalculationRow 
                stepNumber="2"
                title="Adjust for Stock Levels" 
                icon={<Warehouse size={18} className="text-cyan-700" />} 
                color="bg-cyan-100 text-cyan-800"
                viewMode={viewMode}
                explanation={{
                    technical: {
                        logic: "Adjust the requirement to normalize stock levels. If stocks are low, we add to the requirement; if high, we subtract.",
                        formula: "Requirement by Bonding + Stock Adjustment",
                        source: "Parameters (Stock Levels)"
                    },
                    business: {
                        strategy: "Optimizing Yard Inventory",
                        goal: "To keep the cane yard 'fresh'. We slow down indents if the yard is full to prevent drying, and speed up if empty to prevent mill stoppages.",
                        risk: "High stock = Drying/Weight Loss. Low Stock = Mill Stoppage (No Cane)."
                    }
                }}
            >
                <DetailRow label="Previous Result" value={Math.round(data.requirementByBonding).toLocaleString()} />
                <DetailRow label="Stock Adjustment" value={Math.round(data.stockAdjustment).toLocaleString()} />
                <div className="h-px bg-slate-100 my-1" />
                <DetailRow label="Adjusted Requirement" value={Math.round(data.adjustedRequirement).toLocaleString()} isBold />
            </CalculationRow>

            <CalculationRow 
                stepNumber="3"
                title="Subtract T+3 Forecast" 
                icon={<Minus size={18} className="text-purple-700" />} 
                color="bg-purple-100 text-purple-800"
                viewMode={viewMode}
                explanation={{
                    technical: {
                        logic: "Subtract the quantity of cane already expected to arrive on T+3 from previously placed indents (the pipeline).",
                        formula: "Adjusted Requirement - Forecast (T+3)",
                        source: "Past Indents & D-Weights"
                    },
                    business: {
                        strategy: "Pipeline Visibility",
                        goal: "To account for slips already in the farmers' hands that are scheduled to arrive on this specific day.",
                        risk: "Double-ordering. If we ignore pending arrivals, we will invite too much cane and choke the yard."
                    }
                }}
            >
                <DetailRow label="Previous Result" value={Math.round(data.adjustedRequirement).toLocaleString()} />
                <DetailRow label="Forecast (T+3)" value={Math.round(data.forecastT3).toLocaleString()} />
                <div className="h-px bg-slate-100 my-1" />
                <DetailRow label="Net Requirement" value={Math.round(data.netRequirement).toLocaleString()} isBold />
            </CalculationRow>
            
            <CalculationRow 
                stepNumber="4"
                title="Adjust for Plant Overrun" 
                icon={<Divide size={18} className="text-orange-700" />} 
                color="bg-orange-100 text-orange-800"
                viewMode={viewMode}
                explanation={{
                    technical: {
                        logic: "Reduce the target to account for the historical trend of actual arrivals exceeding indented quantities.",
                        formula: "Net Requirement / (1 + Overrun %)",
                        source: "Historical Purchase vs Indent"
                    },
                    business: {
                        strategy: "Behavioral Calibration",
                        goal: "To adjust for the historical reality that actual arrivals often exceed the ordered quantity (e.g., farmers overloading carts).",
                        risk: "If we order exactly 100 tons, we might receive 105 tons. We must under-order slightly to hit the target exactly."
                    }
                }}
            >
                <DetailRow label="Previous Result" value={Math.round(data.netRequirement).toLocaleString()} />
                <DetailRow label="Plant Overrun" value={`${(data.overrunPercentage * 100).toFixed(2)}%`} />
                <div className="h-px bg-slate-100 my-1" />
                <DetailRow label="Target Arrival Qty" value={Math.round(data.targetArrival).toLocaleString()} isBold />
            </CalculationRow>

            <CalculationRow 
                stepNumber="5"
                title="Calculate Final Indent" 
                icon={<Percent size={18} className="text-indigo-700" />} 
                color="bg-indigo-100 text-indigo-800"
                viewMode={viewMode}
                explanation={{
                    technical: {
                        logic: "Determine the total order size needed today so that the D1 portion (which arrives on T+3) matches the Target Arrival.",
                        formula: "Target Arrival / Center D1 Weight",
                        source: "Maturity Analysis (D1)"
                    },
                    business: {
                        strategy: "Grossing Up for Immediate Need",
                        goal: "To issue enough total slips today to ensure the fraction that arrives instantly (D1) meets the immediate crushing need.",
                        risk: "If we don't gross up, the immediate arrivals will fall short, and the mill will starve on T+3."
                    }
                }}
            >
                <DetailRow label="Target Arrival" value={Math.round(data.targetArrival).toLocaleString()} />
                <DetailRow label="Center D1 Weight" value={`${(data.d1Weight * 100).toFixed(2)}%`} />
            </CalculationRow>

            {/* Final Result Card */}
            <div className="mt-8 flex flex-col lg:flex-row gap-6 items-center">
                <div className="flex-1 w-full">
                    <div className="bg-green-50 p-6 rounded-xl border-2 border-green-500 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CheckCircle size={100} className="text-green-800" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <h4 className="font-bold text-lg text-green-900 uppercase tracking-widest mb-2">Final Recommendation</h4>
                            <p className="text-sm text-green-700 mb-4">Indent to be raised for <strong>{data.centreName}</strong> today</p>
                            <p className="text-4xl font-bold text-green-800 font-mono tracking-tight bg-white/50 px-6 py-2 rounded-lg backdrop-blur-sm">
                                {data.finalIndent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs font-semibold text-green-600 mt-2">Qtls</p>
                        </div>
                    </div>
                </div>
                <div className="hidden lg:block lg:w-[350px] text-center text-slate-400 text-sm italic px-4">
                    The process is complete. This value is ready to be communicated to the center.
                </div>
            </div>
        </div>
    );
};

export const IndentCalculationBreakdown: React.FC<{ results: CalculationResults }> = ({ results }) => {
    const { indentCalculationBreakdown } = results;
    const [selectedCenterId, setSelectedCenterId] = useState(indentCalculationBreakdown.length > 0 ? indentCalculationBreakdown[0].centreId : '');
    const [viewMode, setViewMode] = useState<ViewMode>('technical');

    const allCenters = useMemo(() =>
        indentCalculationBreakdown.map(c => ({ centreId: c.centreId, centreName: c.centreName }))
            .sort((a, b) => a.centreName.localeCompare(b.centreName)),
        [indentCalculationBreakdown]
    );

    const selectedData = useMemo(() =>
        indentCalculationBreakdown.find(row => row.centreId === selectedCenterId),
        [indentCalculationBreakdown, selectedCenterId]
    );

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 bg-slate-50 p-4 rounded-lg border">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <label htmlFor="center-filter-calc" className="flex items-center gap-2 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        <Filter size={16} /> Center:
                    </label>
                    <select
                        id="center-filter-calc"
                        value={selectedCenterId}
                        onChange={(e) => setSelectedCenterId(e.target.value)}
                        className="block w-full sm:w-64 p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-[#003580] focus:border-[#003580]"
                    >
                        {allCenters.map(center => (
                            <option key={center.centreId} value={center.centreId}>
                                {center.centreName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm w-full sm:w-auto">
                    <button
                        onClick={() => setViewMode('technical')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'technical' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Scale size={14} /> Technical
                    </button>
                    <button
                        onClick={() => setViewMode('business')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${viewMode === 'business' ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BookOpen size={14} /> Business
                    </button>
                </div>
            </div>

            {selectedData ? (
                <CalculationFlow data={selectedData} viewMode={viewMode} />
            ) : (
                <div className="text-center p-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed">
                    <Calculator size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-lg font-medium text-slate-600">No calculation data available</p>
                    <p>Please select a center to view the step-by-step breakdown.</p>
                </div>
            )}
        </div>
    );
};