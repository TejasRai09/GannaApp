import React, { useState, useMemo } from 'react';
import type { CalculationRun, CalculationInputs } from '../types';
import { ResultsDisplay } from './ResultsDisplay';
import { IndentTable } from './IndentTable';
import { MaturityAnalysis } from './MaturityAnalysis';
import { ForecastBreakdown } from './ForecastBreakdown';
import { IndentCalculationBreakdown } from './IndentCalculationBreakdown';
import { ValidationBreakdown } from './ValidationBreakdown';
import { FullMaturityAnalysis } from './FullMaturityAnalysis';
import { TabHeader } from './TabHeader';
import { SimulationModal } from './SimulationModal';
import { RiskAlertBanner } from './RiskAlertBanner';
import { parseDate } from '../services/dateUtils';
import { Calculator, BarChart3, TestTube2, ClipboardList, CheckSquare, RefreshCcw, FileSpreadsheet, FlaskConical } from 'lucide-react';

type ActiveTab = 'summary' | 'indent_calc' | 'validation' | 'maturity' | 'forecast' | 'full_maturity';

const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        role="tab"
        aria-selected={isActive}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#003580]/50 ${
            isActive
                ? 'border-[#003580] text-[#003580] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
    >
        {icon}
        {label}
    </button>
);

const TAB_CONTENT: Record<ActiveTab, { title: string; description: string }> = {
    summary: {
        title: "Executive Overview",
        description: "A high-level snapshot of today's results. Review the key performance indicators (Plant Overrun, Forecast) and the final recommended indent quantities for Gate vs. Centre."
    },
    indent_calc: {
        title: "Calculation Engine",
        description: "The step-by-step math behind the recommendation. See exactly how the system derived the final indent for each center, moving from Effective Requirement to Stock Adjustment to Final Indent."
    },
    validation: {
        title: "Logic Audit",
        description: "A transparent trace of the entire calculation flow. Use this table to audit specific numbers and verify that the totals match your aggregate targets."
    },
    maturity: {
        title: "Short-Term Arrival Patterns (T-7 to T-4)",
        description: "Analyzes how fast cane has been arriving over the last week. The system uses these recent 'D-Weights' to predict immediate future arrivals. If recent data is insufficient, it falls back to seasonal averages."
    },
    full_maturity: {
        title: "Seasonal Arrival Patterns",
        description: "A complete historical view of every closed indent this season. This data determines the 'Fallback Weights' used when a center's recent performance is erratic or missing."
    },
    forecast: {
        title: "Pipeline Visibility (T+3)",
        description: "See what is already coming down the road. This view breaks down the expected arrivals for T+3 based on the indents you have already placed in the previous three days."
    }
};


interface Step4ResultsProps {
    activeCalculation: CalculationRun | null;
    onStartNew: () => void;
    setIsLogicModalOpen: (isOpen: boolean) => void;
    currentDate: string;
    // Data props for simulation
    bondingData: any[] | null;
    indentData: any[] | null;
    purchaseData: any[] | null;
    onSaveSimulation: (name: string, inputs: Partial<CalculationInputs>) => void;
}

export const Step4Results: React.FC<Step4ResultsProps> = ({ activeCalculation, onStartNew, setIsLogicModalOpen, currentDate, bondingData, indentData, purchaseData, onSaveSimulation }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('summary');
    const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);

    // FIX: Safely parse the currentDate from calculation inputs to avoid RangeError
    const safeCurrentDateString = useMemo(() => {
        const fallback = new Date().toISOString().split('T')[0];
        if (!activeCalculation?.inputs?.currentDate) return fallback;
        const dateObj = parseDate(activeCalculation.inputs.currentDate);
        return (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toISOString().split('T')[0] : fallback;
    }, [activeCalculation]);

    if (!activeCalculation) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold text-slate-800">No Calculation Results to Display</h2>
                <p className="text-slate-500 mt-2">Please complete the previous steps or select a historical report to view.</p>
                <button
                    onClick={onStartNew}
                    className="mt-6 px-6 py-3 text-base font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] transition-colors"
                >
                   Start New Calculation
                </button>
            </div>
        );
    }
    
    const calculationResults = activeCalculation.results;
    const headerInfo = TAB_CONTENT[activeTab];

    const getIcon = (tab: ActiveTab) => {
        switch(tab) {
            case 'summary': return <ClipboardList size={24} />;
            case 'indent_calc': return <Calculator size={24} />;
            case 'validation': return <CheckSquare size={24} />;
            case 'maturity': return <TestTube2 size={24} />;
            case 'full_maturity': return <FileSpreadsheet size={24} />;
            case 'forecast': return <BarChart3 size={24} />;
        }
    };

    return (
        <div className="space-y-4">
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 bg-slate-100 rounded-lg border">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-500">Viewing Report:</p>
                        {activeCalculation.isScenario && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
                                Scenario
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-[#003580]">{activeCalculation.name}</h2>
                    <p className="text-xs text-slate-500">Calculated on {new Date(activeCalculation.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setIsSimulationModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold text-sm rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"
                    >
                       <FlaskConical size={16}/> Run Simulation
                    </button>
                    <button
                        onClick={onStartNew}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                       <RefreshCcw size={16}/> Start New Calculation
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 p-2 rounded-xl border">
                <div className="border-b border-slate-200 px-4 bg-white rounded-t-lg">
                    <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                        <TabButton label="Summary" icon={<ClipboardList size={16}/>} isActive={activeTab === 'summary'} onClick={() => setActiveTab('summary')} />
                        <TabButton label="Indent Calculation" icon={<Calculator size={16}/>} isActive={activeTab === 'indent_calc'} onClick={() => setActiveTab('indent_calc')} />
                        <TabButton label="Validation" icon={<CheckSquare size={16}/>} isActive={activeTab === 'validation'} onClick={() => setActiveTab('validation')} />
                        <TabButton label="Recent Maturity" icon={<TestTube2 size={16}/>} isActive={activeTab === 'maturity'} onClick={() => setActiveTab('maturity')} />
                        <TabButton label="Full Maturity" icon={<FileSpreadsheet size={16}/>} isActive={activeTab === 'full_maturity'} onClick={() => setActiveTab('full_maturity')} />
                        <TabButton label="Forecast Breakdown" icon={<BarChart3 size={16}/>} isActive={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} />
                    </nav>
                </div>
                <div className="p-6 bg-white rounded-b-lg">
                    <RiskAlertBanner 
                        risks={calculationResults.riskAnalysis || []} 
                        onOpenSimulation={() => setIsSimulationModalOpen(true)}
                    />

                    <TabHeader 
                        title={headerInfo.title} 
                        description={headerInfo.description} 
                        icon={getIcon(activeTab)} 
                    />
                    
                    {activeTab === 'summary' && (
                        <div className="space-y-8">
                            <ResultsDisplay results={calculationResults} />
                            <IndentTable results={calculationResults} calculationName={activeCalculation.name} />
                        </div>
                    )}
                    {activeTab === 'indent_calc' && <IndentCalculationBreakdown results={calculationResults} />}
                    {activeTab === 'validation' && <ValidationBreakdown results={calculationResults} />}
                    {activeTab === 'maturity' && <MaturityAnalysis results={calculationResults} />}
                    {activeTab === 'full_maturity' && <FullMaturityAnalysis results={calculationResults} />}
                    {activeTab === 'forecast' && <ForecastBreakdown results={calculationResults} currentDate={safeCurrentDateString} />}
                </div>
            </div>

            {bondingData && indentData && purchaseData && (
                <SimulationModal 
                    isOpen={isSimulationModalOpen}
                    onClose={() => setIsSimulationModalOpen(false)}
                    baseCalculation={activeCalculation}
                    onSaveSimulation={onSaveSimulation}
                    data={{
                        bondingData,
                        indentData,
                        purchaseData
                    }}
                />
            )}
        </div>
    );
};