import React from 'react';
import { FileUpload } from './FileUpload';
import type { Bonding, Indent, Purchase, StoredData } from '../types';
import { AlertTriangle, Info, Database, Trash2 } from 'lucide-react';
import { DataType } from '../App';


interface Step1UploadProps {
    handleNext: () => void;
    isReadOnly: boolean;
    // Data props
    bondingData: StoredData<Bonding> | null;
    indentData: StoredData<Indent> | null;
    purchaseData: StoredData<Purchase> | null;
    // Handlers
    onFileReplace: (kind: DataType, setter: (data: StoredData<any> | null) => void, file: File) => void;
    onManualAppend: (dataType: 'indent' | 'purchase') => void;
    setBondingData: (data: StoredData<Bonding> | null) => void;
    setIndentData: (data: StoredData<Indent> | null) => void;
    setPurchaseData: (data: StoredData<Purchase> | null) => void;
    openDataGridModal: (dataType: DataType) => void;
    onClearAllData: () => void;
    // Status props
    error: string | null;
    info: string | null;
    allFilesUploaded: boolean;
}

export const Step1Upload: React.FC<Step1UploadProps> = (props) => {
    const {
        handleNext, isReadOnly,
        bondingData, indentData, purchaseData,
        onFileReplace, onManualAppend, 
        setBondingData, setIndentData, setPurchaseData,
        openDataGridModal, onClearAllData,
        error, info, allFilesUploaded
    } = props;
    
    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                    <Database size={24}/> Manage Stored Data
                </h2>
                <p className="text-slate-500 mt-2">
                    {isReadOnly 
                        ? "Viewing stored data for the organization. No changes can be made."
                        : "Your data files are saved to the backend for your organization. Upload initial files, or replace/append to existing ones. Once all three files are loaded, you can proceed."
                    }
                </p>
            </div>

            <div className="space-y-6 mb-6">
                <FileUpload 
                    label="Bonding File" 
                    onFileSelect={(file) => onFileReplace('bonding', setBondingData, file)} 
                    storedData={bondingData}
                    onViewAndEditClick={() => openDataGridModal('bonding')}
                    isReadOnly={isReadOnly}
                />
                <FileUpload 
                    label="Historical Indent File" 
                    onFileSelect={(file) => onFileReplace('indent', setIndentData, file)} 
                    onManualAppend={() => onManualAppend('indent')}
                    storedData={indentData}
                    onViewAndEditClick={() => openDataGridModal('indent')}
                    isAppendable={true}
                    isReadOnly={isReadOnly}
                />
                <FileUpload 
                    label="Historical Purchase File" 
                    onFileSelect={(file) => onFileReplace('purchase', setPurchaseData, file)} 
                    onManualAppend={() => onManualAppend('purchase')}
                    storedData={purchaseData}
                    onViewAndEditClick={() => openDataGridModal('purchase')}
                    isAppendable={true}
                    isReadOnly={isReadOnly}
                />
            </div>

            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center gap-3 shadow-sm mb-6" role="alert"><AlertTriangle/><div><p className="font-bold">Error</p><p>{error}</p></div></div>}
            {info && !error && <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md flex items-center gap-3 shadow-sm mb-6" role="alert"><Info/><div><p className="font-bold">Information</p><p>{info}</p></div></div>}

            <div className="mt-8 flex justify-between items-center">
                 {!isReadOnly && (
                    <button
                        onClick={onClearAllData}
                        className="flex items-center gap-2 text-sm text-red-600 font-semibold hover:bg-red-50 p-2 rounded-lg"
                    >
                        <Trash2 size={16}/> Clear All Data & Start Over
                    </button>
                 )}
                <button
                    onClick={handleNext}
                    disabled={!allFilesUploaded}
                    className="px-6 py-3 text-base font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] transition-all duration-200 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    Next: Set Parameters
                </button>
            </div>
        </div>
    );
};
