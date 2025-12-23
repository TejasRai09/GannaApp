
import React, { useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface DataPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: any[] | null;
}

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({ isOpen, onClose, title, data }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
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

    if (!isOpen || !data) {
        return null;
    }

    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const previewData = data.slice(0, 100);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="modal-title" className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 flex-grow overflow-y-auto">
                    <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-md mb-4 flex items-start gap-3">
                         <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                         <div>
                             <p className="font-semibold">All data processed successfully.</p>
                             <p className="text-sm">
                                 Successfully parsed {data.length} records. 
                                 {data.length > 100 && ` Showing the first 100 rows.`}
                             </p>
                         </div>
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                                <tr>
                                    {headers.map(header => (
                                        <th key={header} scope="col" className="px-4 py-3 font-semibold">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {previewData.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-b hover:bg-slate-50">
                                        {headers.map(header => (
                                            <td key={`${rowIndex}-${header}`} className="px-4 py-2 whitespace-nowrap">
                                                {String(row[header])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
