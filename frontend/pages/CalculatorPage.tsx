
import React, { useState, useEffect, useMemo } from 'react';
import type { Page, DataType } from '../App';
import type { Bonding, Indent, Purchase, CalculationRun, StoredData, CalculationInputs, Constraint } from '../types';
import { Stepper } from '../components/Stepper';
import { Step1Upload } from '../components/Step1Upload';
import { Step2Parameters } from '../components/Step2Parameters';
import { Step3Review } from '../components/Step3Review';
import { Step4Results } from '../components/Step4Results';
import { DataGridModal } from '../components/DataGridModal';
import { ManualAppendModal } from '../components/ManualAppendModal';
import { LogicExplanationModal } from '../components/LogicExplanationModal';
import { SettingsModal } from '../components/SettingsModal';
import { IntroModal } from '../components/IntroModal';
import { NameCalculationModal } from '../components/NameCalculationModal';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';

interface CalculatorPageProps {
    bondingData: StoredData<Bonding> | null;
    indentData: StoredData<Indent> | null;
    purchaseData: StoredData<Purchase> | null;
    activeCalculation: CalculationRun | null;
    error: string | null;
    info: string | null;
    isLoading: boolean;
    currentDate: string;
    plantStartDate: string;
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
    plantCapacity: number;
    totalDailyRequirement: number;
    standardStockCentre: number;
    standardStockGate: number;
    availableStockCentre: number;
    availableStockGate: number;
    centerMapping: { [key: string]: string };
    dataGridModal: { isOpen: boolean; data: any[] | null; title: string; dataType: DataType | null };
    manualAppendModal: { isOpen: boolean; dataType: 'indent' | 'purchase' | null };
    isLogicModalOpen: boolean;
    isSettingsModalOpen: boolean;
    setBondingData: (data: StoredData<Bonding> | null) => void;
    setIndentData: (data: StoredData<Indent> | null) => void;
    setPurchaseData: (data: StoredData<Purchase> | null) => void;
    setCurrentDate: (date: string) => void;
    setPlantStartDate: (date: string) => void;
    setSeasonTotalDays: (value: number) => void;
    setSeasonalCrushingCapacity: (value: number) => void;
    setPlantCapacity: (value: number) => void;
    setTotalDailyRequirement: (value: number) => void;
    setStandardStockCentre: (value: number) => void;
    setStandardStockGate: (value: number) => void;
    setAvailableStockCentre: (value: number) => void;
    setAvailableStockGate: (value: number) => void;
    setIsLogicModalOpen: (isOpen: boolean) => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    handleFileUpdate: (key: DataType, setter: (data: StoredData<any> | null) => void, file: File) => void;
    handleManualAppend: (newRecords: any[], dataType: 'indent' | 'purchase') => void;
    handleCalculate: (name: string, isScenario?: boolean, overrideInputs?: Partial<CalculationInputs>) => Promise<void>;
    onClearAllData: () => void;
    handleSaveSettings: (newMapping: { [key: string]: string; }, newAssumptions: { startDate: string; totalDays: number; capacity: number; }) => void;
    handleGridSave: (updatedData: any[], dataType: DataType) => void;
    openDataGridModal: (dataType: DataType) => void;
    closeDataGridModal: () => void;
    openManualAppendModal: (dataType: 'indent' | 'purchase') => void;
    closeManualAppendModal: () => void;
    // New Constraint props
    constraints: Constraint[];
    setConstraints: (constraints: Constraint[]) => void;
}

export const CalculatorPage: React.FC<CalculatorPageProps> = (props) => {
    const { currentUser } = useAuth();
    const isReadOnly = currentUser?.role === 'viewer';

    const [step, setStep] = useState(1);
    const [isIntroModalOpen, setIsIntroModalOpen] = useState(false);
    const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
    const [maxReachedStep, setMaxReachedStep] = useState(1);
    const [settingsDefaultTab, setSettingsDefaultTab] = useState<'mapping' | 'assumptions'>('mapping');
    const [hasShownIntro, setHasShownIntro] = useState(false);

    const allFilesUploaded = useMemo(() => !!props.bondingData && !!props.indentData && !!props.purchaseData, [props.bondingData, props.indentData, props.purchaseData]);

     useEffect(() => {
        if (props.activeCalculation) {
            setStep(4);
            setMaxReachedStep(4);
            return;
        }
        
        if (allFilesUploaded) {
            setStep(2);
            setMaxReachedStep(2);
        } else if (!hasShownIntro) {
            const timer = setTimeout(() => {
                setIsIntroModalOpen(true);
                setHasShownIntro(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [props.activeCalculation, allFilesUploaded, hasShownIntro]);

    useEffect(() => {
        if (step > maxReachedStep) {
            setMaxReachedStep(step);
        }
    }, [step]);
    
    const handleNext = () => setStep(current => Math.min(current + 1, 4));
    const handlePrev = () => setStep(current => Math.max(current - 1, 1));
    const goToStep = (targetStep: number) => {
        if (targetStep <= maxReachedStep) setStep(targetStep);
    };
    
    const startNewCalculationFlow = () => {
        props.onNavigate('calculator');
        setStep(allFilesUploaded ? 2 : 1);
        setMaxReachedStep(allFilesUploaded ? 2 : 1);
    };

    const triggerCalculation = () => {
        if (isReadOnly) return;
        setIsNamingModalOpen(true);
    };

    const executeCalculation = async (name: string) => {
        setIsNamingModalOpen(false);
        await props.handleCalculate(name);
        setStep(4);
        setMaxReachedStep(4);
    };
    
    const handleSaveSimulation = async (name: string, inputs: Partial<CalculationInputs>) => {
        await props.handleCalculate(name, true, inputs);
        // We stay on Step 4 (results page will update to new calculation automatically via activeCalculation prop)
    };
    
    const openSettingsModal = (defaultTab: 'mapping' | 'assumptions' = 'mapping') => {
        setSettingsDefaultTab(defaultTab);
        props.setIsSettingsModalOpen(true);
    };

    const stepProps: any = { ...props, handleNext, handlePrev, isReadOnly };

    const steps = [
        { id: 1, name: 'Manage Data' },
        { id: 2, name: 'Set Parameters' },
        { id: 3, name: 'Review & Calculate' },
        { id: 4, name: 'View Results' },
    ];
    
    return (
        <>
            <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
                <Header 
                    pageTitle="Indent Planning Engine"
                    onNavigate={props.onNavigate}
                    onLogout={props.onLogout}
                    showSettings
                    showLogic
                    onOpenSettings={() => openSettingsModal('mapping')}
                    onOpenLogic={() => props.setIsLogicModalOpen(true)}
                />
                
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                     <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                        <Stepper steps={steps} currentStep={step} onStepClick={goToStep} maxReachedStep={maxReachedStep}/>
                    </div>
                    
                    <div className="bg-white p-8 rounded-xl shadow-md min-h-[400px]">
                        {step === 1 && <Step1Upload 
                            {...stepProps} 
                            allFilesUploaded={allFilesUploaded}
                            onFileReplace={(key, setter, file) => props.handleFileUpdate(key, setter, file)}
                            onManualAppend={(dataType) => props.openManualAppendModal(dataType)}
                        />}
                        {step === 2 && <Step2Parameters {...stepProps} onEditAssumptions={() => openSettingsModal('assumptions')} />}
                        {step === 3 && <Step3Review 
                            {...stepProps}
                            bondingData={props.bondingData?.data ?? null}
                            indentData={props.indentData?.data ?? null}
                            purchaseData={props.purchaseData?.data ?? null}
                            handleCalculate={triggerCalculation} 
                        />}
                        {step === 4 && <Step4Results 
                            {...stepProps} 
                            onStartNew={startNewCalculationFlow} 
                            bondingData={props.bondingData?.data ?? null}
                            indentData={props.indentData?.data ?? null}
                            purchaseData={props.purchaseData?.data ?? null}
                            onSaveSimulation={handleSaveSimulation}
                        />}
                    </div>
                </main>
            </div>
            
            <DataGridModal 
                isOpen={props.dataGridModal.isOpen} 
                onClose={props.closeDataGridModal} 
                title={props.dataGridModal.title} 
                data={props.dataGridModal.data}
                onSave={(updatedData) => props.handleGridSave(updatedData, props.dataGridModal.dataType!)} 
            />
            <ManualAppendModal 
                isOpen={props.manualAppendModal.isOpen}
                onClose={props.closeManualAppendModal}
                dataType={props.manualAppendModal.dataType}
                onSave={props.handleManualAppend}
            />
            <LogicExplanationModal isOpen={props.isLogicModalOpen} onClose={() => props.setIsLogicModalOpen(false)} />
            <SettingsModal 
                isOpen={props.isSettingsModalOpen} 
                onClose={() => props.setIsSettingsModalOpen(false)} 
                defaultTab={settingsDefaultTab}
                initialMapping={props.centerMapping} 
                plantStartDate={props.plantStartDate}
                seasonTotalDays={props.seasonTotalDays}
                seasonalCrushingCapacity={props.seasonalCrushingCapacity}
                onSave={props.handleSaveSettings}
            />
            <IntroModal isOpen={isIntroModalOpen} onClose={() => setIsIntroModalOpen(false)} />
            <NameCalculationModal 
                isOpen={isNamingModalOpen} 
                onClose={() => setIsNamingModalOpen(false)} 
                onSave={executeCalculation} 
                currentDate={props.currentDate}
            />
        </>
    );
};