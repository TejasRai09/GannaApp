import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataGridModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: any[] | null;
    onSave: (updatedData: any[]) => void;
}

const ROWS_PER_PAGE = 50;

export const DataGridModal: React.FC<DataGridModalProps> = ({ isOpen, onClose, title, data, onSave }) => {
    const [editedData, setEditedData] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (data) {
            // Deep copy to avoid mutating original state
            setEditedData(JSON.parse(JSON.stringify(data)));
            setHasChanges(false);
            setCurrentPage(1);
        }
    }, [data, isOpen]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handleCellChange = (rowIndex: number, columnKey: string, value: string) => {
        setEditedData(prev => {
            const newData = [...prev];
            newData[rowIndex][columnKey] = value;
            return newData;
        });
        setHasChanges(true);
    };

    const handleSave = () => {
        onSave(editedData);
    };

    const headers = useMemo(() => (editedData.length > 0 ? Object.keys(editedData[0]) : []), [editedData]);
    const totalPages = Math.ceil(editedData.length / ROWS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        return editedData.slice(startIndex, startIndex + ROWS_PER_PAGE);
    }, [editedData, currentPage]);
    const globalStartIndex = (currentPage - 1) * ROWS_PER_PAGE;


    if (!isOpen || !data) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="grid-modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="grid-modal-title" className="text-xl font-bold text-slate-800">{title}</h2>
                    <div className="flex items-center gap-4">
                        {hasChanges && <span className="text-sm font-semibold text-orange-600 animate-pulse">Unsaved Changes</span>}
                        <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                            <X size={24} />
                        </button>
                    </div>
                </header>

                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                                <tr>
                                    {headers.map(header => (
                                        <th key={header} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {paginatedData.map((row, pageIndex) => {
                                    const globalIndex = globalStartIndex + pageIndex;
                                    return (
                                        <tr key={globalIndex} className="border-b hover:bg-slate-50">
                                            {headers.map(header => (
                                                <td key={`${globalIndex}-${header}`} className="px-1 py-0.5 whitespace-nowrap">
                                                    <input
                                                        type="text"
                                                        value={String(row[header])}
                                                        onChange={(e) => handleCellChange(globalIndex, header, e.target.value)}
                                                        className="w-full p-1.5 bg-transparent border-none rounded-md focus:outline-none focus:ring-2 focus:ring-[#003580] focus:bg-slate-50"
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <footer className="flex justify-between items-center p-4 border-t bg-slate-50 rounded-b-xl">
                     <div className="text-sm text-slate-600">
                        Page {currentPage} of {totalPages} ({editedData.length} total records)
                    </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-2 rounded-md disabled:opacity-50 hover:bg-slate-200">
                            <ChevronLeft size={20}/>
                        </button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-2 rounded-md disabled:opacity-50 hover:bg-slate-200">
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={!hasChanges}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66] disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        <Save size={16}/> Save Changes
                    </button>
                </footer>
            </div>
        </div>
    );
};
