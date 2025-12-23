
import React, { useState } from 'react';
import type { Page, DataType } from '../App';
import type { CalculationRun, StoredData, Bonding } from '../types';
import { CheckCircle, Info, Calculator, History, Newspaper, Database, AlertCircle } from 'lucide-react';
import { ConsolidatedSummary } from '../components/ConsolidatedSummary';
import { Header } from '../components/common/Header';
import { DataManagerModal } from '../components/DataManagerModal';
import { DataGridModal } from '../components/DataGridModal';
import { ManualAppendModal } from '../components/ManualAppendModal';
import { formatDateTimeGB } from '../services/dateUtils';

interface DashboardProps {
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    onGoToCalculator: () => void;
    onViewHistoryItem: (id: string) => void;
    onClearAllData: () => void;
    bondingData: StoredData<Bonding> | null;
    indentData: StoredData<any> | null;
    purchaseData: StoredData<any> | null;
    calculationHistory: CalculationRun[];
    infoMessage: string | null;
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
    centerMapping: { [key: string]: string };
    handleFileUpdate: (key: DataType, setter: (data: StoredData<any> | null) => void, file: File) => void;
    handleMappingFileUpload: (file: File) => void;
    handleDeleteData: (type: 'bonding' | 'indent' | 'purchase' | 'mapping') => void;
    setBondingData: (data: StoredData<Bonding> | null) => void;
    setIndentData: (data: StoredData<any> | null) => void;
    setPurchaseData: (data: StoredData<any> | null) => void;
    openDataGridModal: (dataType: DataType) => void;
    openManualAppendModal: (dataType: 'indent' | 'purchase') => void;
    // New props for modals
    dataGridModal: { isOpen: boolean; data: any[] | null; title: string; dataType: DataType | null };
    manualAppendModal: { isOpen: boolean; dataType: 'indent' | 'purchase' | null };
    closeDataGridModal: () => void;
    closeManualAppendModal: () => void;
    handleGridSave: (updatedData: any[], dataType: DataType) => void;
    handleManualAppend: (newRecords: any[], dataType: 'indent' | 'purchase') => void;
}

export const DashboardPage: React.FC<DashboardProps> = (props) => {
    const { 
        onNavigate, onLogout, onGoToCalculator, onViewHistoryItem,
        bondingData, indentData, purchaseData, calculationHistory, infoMessage,
        seasonTotalDays, seasonalCrushingCapacity, centerMapping,
        handleFileUpdate, handleMappingFileUpload, handleDeleteData,
        openDataGridModal, openManualAppendModal,
        dataGridModal, manualAppendModal, closeDataGridModal, closeManualAppendModal,
        handleGridSave, handleManualAppend
    } = props;
    
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);

    const isReadyToCalculate = !!bondingData && !!indentData && !!purchaseData;
    const recentCalculations = calculationHistory.slice(0, 5);
    
    const loadedFilesCount = [bondingData, indentData, purchaseData].filter(Boolean).length;
    const allFilesLoaded = loadedFilesCount === 3;

    // Helper wrapper for handleFileUpdate to match the modal's signature
    const onFileReplace = (type: DataType, file: File) => {
        if (type === 'bonding') handleFileUpdate('bonding', props.setBondingData, file); 
        if (type === 'indent') handleFileUpdate('indent', props.setIndentData, file);
        if (type === 'purchase') handleFileUpdate('purchase', props.setPurchaseData, file);
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
            <Header pageTitle="Mission Control" onNavigate={onNavigate} onLogout={onLogout} />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Welcome Back!</h2>
                            <p className="text-slate-600">Here's your overview for today, {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
                        </div>
                        <button 
                            onClick={() => setIsDataModalOpen(true)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-sm transition-all ${
                                allFilesLoaded 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                        >
                            {allFilesLoaded ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            {allFilesLoaded ? 'Data Ready' : `${loadedFilesCount}/3 Files Loaded`}
                            <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs ml-1 font-bold">Manage</span>
                        </button>
                    </div>

                    {infoMessage && (
                        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md flex items-center gap-3 shadow-md" role="alert">
                            <Info size={20} />
                            <div>
                                <p className="font-bold">Update</p>
                                <p>{infoMessage}</p>
                            </div>
                        </div>
                    )}

                    {calculationHistory.length > 0 && (
                        <ConsolidatedSummary
                            indentData={indentData}
                            purchaseData={purchaseData}
                            bondingData={bondingData}
                            calculationHistory={calculationHistory}
                            seasonTotalDays={seasonTotalDays}
                            seasonalCrushingCapacity={seasonalCrushingCapacity}
                        />
                    )}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white p-6 rounded-xl shadow-md">
                                <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={onGoToCalculator}
                                        className="w-full flex justify-center items-center gap-3 px-6 py-3 text-base font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] transition-all"
                                    >
                                        <Calculator size={20}/> 
                                        {isReadyToCalculate ? 'Go to Calculator' : 'Upload Data to Start'}
                                    </button>
                                     <button
                                        onClick={() => onNavigate('history')}
                                        className="w-full flex justify-center items-center gap-3 px-6 py-3 text-base font-bold text-[#003580] bg-white rounded-lg shadow-sm border-2 border-[#003580] hover:bg-blue-50 transition-all"
                                    >
                                        <History size={20}/> View Full History
                                    </button>
                                    <button
                                        onClick={() => setIsDataModalOpen(true)}
                                        className="w-full flex justify-center items-center gap-3 px-6 py-3 text-base font-bold text-slate-700 bg-white rounded-lg shadow-sm border border-slate-300 hover:bg-slate-50 transition-all"
                                    >
                                        <Database size={20}/> Manage Data
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-8">
                            {calculationHistory.length > 0 ? (
                                <div className="bg-white p-6 rounded-xl shadow-md">
                                    <h3 className="text-xl font-bold text-slate-900 mb-4">Recent Calculations</h3>
                                     <ul className="space-y-3">
                                        {recentCalculations.map(run => (
                                            <li key={run.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-lg border">
                                                <div>
                                                    <p className="font-bold text-slate-800">{run.name}</p>
                                                    <p className="text-xs text-slate-500">{formatDateTimeGB(run.timestamp)}</p>
                                                </div>
                                                <div className="flex items-center gap-4 mt-3 sm:mt-0">
                                                    <div className="text-right">
                                                        <p className="text-xs text-slate-500">Total Indent</p>
                                                        <p className="font-bold text-lg text-[#003580]">{run.results.tableData.reduce((s, r) => s + r.indentToRaise, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-slate-600">Qtls</span></p>
                                                    </div>
                                                    <button
                                                        onClick={() => onViewHistoryItem(run.id)}
                                                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#003580] font-semibold text-sm rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <Newspaper size={16}/> View
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-white p-8 rounded-xl shadow-md text-center">
                                    <h3 className="text-xl font-bold text-slate-900">No Calculations Yet</h3>
                                    <p className="text-slate-500 mt-2 mb-4">
                                        {isReadyToCalculate 
                                            ? "Your data is loaded. Go to the calculator to run your first analysis."
                                            : "Upload your data files to get started."
                                        }
                                    </p>
                                    <button
                                        onClick={onGoToCalculator}
                                        className="inline-flex justify-center items-center gap-3 px-6 py-3 text-base font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] transition-all"
                                    >
                                        <Calculator size={20}/> 
                                        {isReadyToCalculate ? 'Go to Calculator' : 'Upload Data'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <DataManagerModal 
                isOpen={isDataModalOpen}
                onClose={() => setIsDataModalOpen(false)}
                bondingData={bondingData}
                indentData={indentData}
                purchaseData={purchaseData}
                centerMapping={centerMapping}
                onFileReplace={onFileReplace}
                onMappingReplace={handleMappingFileUpload}
                onDeleteData={handleDeleteData}
                onEdit={(type) => openDataGridModal(type as DataType)}
                onAppend={(type) => openManualAppendModal(type as 'indent' | 'purchase')}
            />
            
            <DataGridModal 
                isOpen={dataGridModal.isOpen} 
                onClose={closeDataGridModal} 
                title={dataGridModal.title} 
                data={dataGridModal.data}
                onSave={(updatedData) => handleGridSave(updatedData, dataGridModal.dataType!)} 
            />
            <ManualAppendModal 
                isOpen={manualAppendModal.isOpen}
                onClose={closeManualAppendModal}
                dataType={manualAppendModal.dataType}
                onSave={handleManualAppend}
            />
        </div>
    );
};
