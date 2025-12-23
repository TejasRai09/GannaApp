
import React from 'react';
import { Loader2, Calculator, CheckCircle, FileText, SlidersHorizontal, AlertTriangle, CloudRain, Factory } from 'lucide-react';
import type { Bonding, Indent, Purchase, Constraint } from '../types';
import { formatDateGB } from '../services/dateUtils';

interface ReviewItemProps {
    label: string;
    value: string | number;
    unit?: string;
}
const ReviewItem: React.FC<ReviewItemProps> = ({ label, value, unit }) => (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-200">
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-sm font-semibold text-slate-800">{value} {unit}</p>
    </div>
);

interface FileStatusProps {
    label: string;
    isLoaded: boolean;
    rowCount: number;
}
const FileStatus: React.FC<FileStatusProps> = ({ label, isLoaded, rowCount }) => (
     <div className="flex justify-between items-center py-2 border-b border-slate-200">
        <p className="text-sm text-slate-600">{label}</p>
        {isLoaded ? (
            <span className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle size={16} /> {rowCount} rows loaded
            </span>
        ) : (
            <span className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle size={16} /> Missing
            </span>
        )}
    </div>
);


interface Step3ReviewProps {
    handlePrev: () => void;
    handleCalculate: () => void;
    isLoading: boolean;
    isReadOnly: boolean;
    // Data for review
    bondingData: Bonding[] | null;
    indentData: Indent[] | null;
    purchaseData: Purchase[] | null;
    currentDate: string;
    plantCapacity: number;
    totalDailyRequirement: number;
    constraints: Constraint[];
}

export const Step3Review: React.FC<Step3ReviewProps> = (props) => {
    return (
        <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                   <CheckCircle size={24}/> Review & Calculate
                </h2>
                <p className="text-slate-500 mt-2">
                    {props.isReadOnly
                        ? "Viewing a summary of the data and parameters for this calculation."
                        : "Please confirm your setup below. If everything is correct, proceed with the calculation."
                    }
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-8">
                    <div className="bg-slate-50 p-6 rounded-lg border">
                        <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={18}/> Data Files</h3>
                        <div className="space-y-1">
                            <FileStatus label="Bonding File" isLoaded={!!props.bondingData} rowCount={props.bondingData?.length ?? 0} />
                            <FileStatus label="Indent File" isLoaded={!!props.indentData} rowCount={props.indentData?.length ?? 0} />
                            <FileStatus label="Purchase File" isLoaded={!!props.purchaseData} rowCount={props.purchaseData?.length ?? 0} />
                        </div>
                    </div>
                    {props.constraints.length > 0 && (
                        <div className="bg-white p-6 rounded-lg border border-orange-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-orange-500"/> Active Constraints</h3>
                            <ul className="space-y-2">
                                {props.constraints.map(c => (
                                    <li key={c.id} className="flex items-start gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                                        <div className="mt-0.5">
                                            {c.type === 'field' ? <CloudRain size={16} className="text-blue-500"/> : <Factory size={16} className="text-orange-500"/>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{c.description} ({(c.impactFactor * 100).toFixed(0)}%)</p>
                                            <p className="text-xs text-slate-500">{formatDateGB(c.date)} • {c.type === 'field' ? 'Supply Impact' : 'Demand Impact'}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                 <div className="bg-slate-50 p-6 rounded-lg border h-fit">
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><SlidersHorizontal size={18}/> Key Parameters</h3>
                     <div className="space-y-1">
                        <ReviewItem label="Current Date" value={props.currentDate} />
                        <ReviewItem label="Plant Capacity" value={props.plantCapacity} unit="%" />
                        <ReviewItem label="Total Daily Requirement" value={props.totalDailyRequirement.toLocaleString()} unit="Qtls" />
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
                <button
                    onClick={props.handlePrev}
                    className="px-6 py-3 text-base font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
                >
                    Previous
                </button>
                {!props.isReadOnly && (
                    <button
                        onClick={props.handleCalculate}
                        disabled={props.isLoading}
                        className="min-w-[280px] flex justify-center items-center gap-3 px-6 py-4 text-lg font-bold text-white bg-green-600 rounded-xl shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-all duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        {props.isLoading ? <><Loader2 className="animate-spin" /> Calculating...</> : <><Calculator size={24}/> Calculate Recommended Indent</>}
                    </button>
                )}
            </div>
        </div>
    );
};