import React, { useRef } from 'react';
import { X, CheckCircle, AlertTriangle, UploadCloud, Trash2, RefreshCw, FileText, Map as MapIcon, Database, Edit, PlusSquare } from 'lucide-react';
import type { StoredData } from '../types';
import type { DataType } from '../App';

interface DataManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    bondingData: StoredData<any> | null;
    indentData: StoredData<any> | null;
    purchaseData: StoredData<any> | null;
    centerMapping: { [key: string]: string };
    onFileReplace: (key: DataType, file: File) => void;
    onMappingReplace: (file: File) => void;
    onDeleteData: (type: 'bonding' | 'indent' | 'purchase' | 'mapping') => void;
    onEdit: (type: 'bonding' | 'indent' | 'purchase') => void;
    onAppend: (type: 'indent' | 'purchase') => void;
}

interface DataRowProps {
    label: string;
    icon: React.ReactNode;
    isLoaded: boolean;
    details: string;
    onReplace: () => void;
    onDelete: () => void;
    onEdit?: () => void;
    onAppend?: () => void;
    deleteLabel?: string;
}

const DataRow: React.FC<DataRowProps> = ({ label, icon, isLoaded, details, onReplace, onDelete, onEdit, onAppend, deleteLabel = "Delete" }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
        <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${isLoaded ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                {icon}
            </div>
            <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    {label}
                    {isLoaded ? (
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">LOADED</span>
                    ) : (
                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded-full">PENDING</span>
                    )}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{details}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {isLoaded && onEdit && (
                <button
                    onClick={onEdit}
                    className="p-2 text-slate-600 hover:text-[#003580] hover:bg-white rounded-lg border border-transparent hover:border-slate-300 transition-all"
                    title="View & Edit"
                >
                    <Edit size={18} />
                </button>
            )}
            {isLoaded && onAppend && (
                <button
                    onClick={onAppend}
                    className="p-2 text-slate-600 hover:text-[#003580] hover:bg-white rounded-lg border border-transparent hover:border-slate-300 transition-all"
                    title="Add Daily Entry"
                >
                    <PlusSquare size={18} />
                </button>
            )}
            <button
                onClick={onReplace}
                className="p-2 text-slate-600 hover:text-[#003580] hover:bg-white rounded-lg border border-transparent hover:border-slate-300 transition-all"
                title="Replace / Upload"
            >
                {isLoaded ? <RefreshCw size={18} /> : <UploadCloud size={18} />}
            </button>
            {isLoaded && (
                <button
                    onClick={onDelete}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg border border-transparent hover:border-red-200 transition-all"
                    title={deleteLabel}
                >
                    <Trash2 size={18} />
                </button>
            )}
        </div>
    </div>
);

export const DataManagerModal: React.FC<DataManagerModalProps> = ({ 
    isOpen, onClose, 
    bondingData, indentData, purchaseData, centerMapping,
    onFileReplace, onMappingReplace, onDeleteData,
    onEdit, onAppend
}) => {
    const bondingInputRef = useRef<HTMLInputElement>(null);
    const indentInputRef = useRef<HTMLInputElement>(null);
    const purchaseInputRef = useRef<HTMLInputElement>(null);
    const mappingInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
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

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'bonding' | 'indent' | 'purchase' | 'mapping') => {
        const file = e.target.files?.[0];
        if (file) {
            if (type === 'mapping') {
                onMappingReplace(file);
            } else {
                onFileReplace(type, file);
            }
        }
        if (e.target) e.target.value = '';
    };

    // Treat empty mapping OR exact match of the default 6 rules as "Default" (not custom loaded)
    const keys = Object.keys(centerMapping);
    const isDefaultMapping = keys.length === 0 || (keys.length === 6 && centerMapping['26'] === '1'); 

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-manager-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Database className="text-[#003580]" size={24}/>
                        <h2 id="data-manager-title" className="text-xl font-bold text-slate-800">Stored Data Management</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 flex-grow overflow-y-auto space-y-4">
                    <p className="text-sm text-slate-600 mb-4">
                        Manage your organization datasets here. Data is saved to the backend and persists until you replace or delete it.
                    </p>

                    <DataRow 
                        label="Bonding File" 
                        icon={<FileText size={20} />} 
                        isLoaded={!!bondingData}
                        details={bondingData ? `${bondingData.data.length} records • ${bondingData.fileName}` : 'Required for calculation'}
                        onReplace={() => bondingInputRef.current?.click()}
                        onDelete={() => onDeleteData('bonding')}
                        onEdit={() => onEdit('bonding')}
                    />
                    
                    <DataRow 
                        label="Indent File" 
                        icon={<FileText size={20} />} 
                        isLoaded={!!indentData}
                        details={indentData ? `${indentData.data.length} records • ${indentData.fileName}` : 'Required for calculation'}
                        onReplace={() => indentInputRef.current?.click()}
                        onDelete={() => onDeleteData('indent')}
                        onEdit={() => onEdit('indent')}
                        onAppend={() => onAppend('indent')}
                    />

                    <DataRow 
                        label="Purchase File" 
                        icon={<FileText size={20} />} 
                        isLoaded={!!purchaseData}
                        details={purchaseData ? `${purchaseData.data.length} records • ${purchaseData.fileName}` : 'Required for calculation'}
                        onReplace={() => purchaseInputRef.current?.click()}
                        onDelete={() => onDeleteData('purchase')}
                        onEdit={() => onEdit('purchase')}
                        onAppend={() => onAppend('purchase')}
                    />

                    <div className="h-px bg-slate-200 my-4"></div>

                    <DataRow 
                        label="Center Mapping" 
                        icon={<MapIcon size={20} />} 
                        isLoaded={!isDefaultMapping}
                        details={isDefaultMapping ? 'Using System Default Mapping' : `${Object.keys(centerMapping).length} custom rules defined`}
                        onReplace={() => mappingInputRef.current?.click()}
                        onDelete={() => onDeleteData('mapping')}
                        deleteLabel="Reset to Default"
                    />

                    {/* Hidden Inputs */}
                    <input type="file" ref={bondingInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'bonding')} />
                    <input type="file" ref={indentInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'indent')} />
                    <input type="file" ref={purchaseInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'purchase')} />
                    <input type="file" ref={mappingInputRef} className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 'mapping')} />
                </div>
                
                <footer className="flex justify-end p-4 border-t bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-sm">
                        Done
                    </button>
                </footer>
            </div>
        </div>
    );
};