
import React, { useRef } from 'react';
import { Upload, CheckCircle, RefreshCw, Edit, PlusSquare } from 'lucide-react';
import type { StoredData } from '../types';
import { formatDateTimeGB } from '../services/dateUtils';

interface FileUploadProps {
    label: string;
    onFileSelect: (file: File) => void;
    onManualAppend?: () => void;
    storedData: StoredData<any> | null;
    onViewAndEditClick?: () => void;
    isAppendable?: boolean;
    isReadOnly?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect, onManualAppend, storedData, onViewAndEditClick, isAppendable = false, isReadOnly = false }) => {
    const replaceInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, handler: (file: File) => void) => {
        if (isReadOnly) return;
        const file = event.target.files?.[0];
        if (file) {
            handler(file);
        }
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const triggerReplaceInput = () => {
        if (isReadOnly) return;
        replaceInputRef.current?.click();
    };


    if (storedData) {
        return (
            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-700">{label}</p>
                        <div className="mt-1 flex items-center gap-2 text-green-800">
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                            <span className="font-semibold">{storedData.fileName}</span>
                        </div>
                         <p className="text-xs text-slate-500 mt-1 pl-7">
                            {storedData.data.length} records, updated {formatDateTimeGB(storedData.lastUpdated)}
                        </p>
                    </div>
                     <span className="text-xs font-bold text-green-600 bg-green-200 px-2 py-1 rounded-full flex-shrink-0">LOADED</span>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 flex items-center gap-2">
                    <button
                        onClick={triggerReplaceInput}
                        disabled={isReadOnly}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-300 hover:bg-slate-100 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                        aria-label={`Replace ${label}`}
                    >
                        <RefreshCw size={14} /> Replace
                    </button>
                    {onViewAndEditClick && (
                        <button
                            onClick={onViewAndEditClick}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
                            aria-label={`View and edit ${label}`}
                        >
                            <Edit size={14} /> View & Edit
                        </button>
                    )}
                     {isAppendable && onManualAppend && (
                        <button
                            onClick={onManualAppend}
                            disabled={isReadOnly}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-300 hover:bg-slate-100 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                            aria-label={`Add daily entry to ${label}`}
                        >
                            <PlusSquare size={14} /> Add Daily Entry
                        </button>
                    )}
                </div>
                <input type="file" ref={replaceInputRef} onChange={(e) => handleFileChange(e, onFileSelect)} accept=".csv" className="hidden" disabled={isReadOnly}/>
            </div>
        );
    }

    return (
        <div>
            <div 
                onClick={triggerReplaceInput}
                className={`relative flex flex-col items-center justify-center w-full p-6 text-center border-2 border-slate-300 border-dashed rounded-lg transition-all duration-200 ${isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'cursor-pointer hover:border-[#003580] hover:bg-[#e6f0ff]'}`}
            >
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-500">Click to upload a .csv file</p>
            </div>
             <input type="file" ref={replaceInputRef} onChange={(e) => handleFileChange(e, onFileSelect)} accept=".csv" className="hidden" disabled={isReadOnly} />
        </div>
    );
};
