import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';

type DataType = 'indent' | 'purchase';

interface ManualAppendModalProps {
    isOpen: boolean;
    onClose: () => void;
    dataType: DataType | null;
    onSave: (newRecords: any[], dataType: DataType) => void;
}

const INDENT_TEMPLATE = { 'Code': '', 'Center Name': '', 'Indent Date': '', 'No of Purchy': '', 'Qty in Qtls': '' };
const PURCHASE_TEMPLATE = { 'Code': '', 'Center Name': '', 'Purchase Date': '', 'Indent Date': '', 'No of Purchy': '', 'Qty in Qtls': '' };

export const ManualAppendModal: React.FC<ManualAppendModalProps> = ({ isOpen, onClose, dataType, onSave }) => {
    // FIX: Typed state for records and currentRecord to avoid 'unknown' type on object values.
    const [records, setRecords] = useState<{[key: string]: string}[]>([]);
    const [currentRecord, setCurrentRecord] = useState<{[key: string]: string}>({});
    const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);

    const template = dataType === 'indent' ? INDENT_TEMPLATE : PURCHASE_TEMPLATE;

    useEffect(() => {
        if (isOpen && dataType) {
            const recordTemplate = { ...template };
            if (dataType === 'indent') {
                recordTemplate['Indent Date'] = commonDate;
            } else {
                recordTemplate['Purchase Date'] = commonDate;
            }
            setCurrentRecord(recordTemplate);
            setRecords([]); // Clear previous records
        }
    }, [isOpen, dataType, commonDate]);

    const handleCommonDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        setCommonDate(newDate);
        setCurrentRecord(prev => {
            const updated = {...prev};
            if(dataType === 'indent') updated['Indent Date'] = newDate;
            if(dataType === 'purchase') updated['Purchase Date'] = newDate;
            return updated;
        });
    };

    const handleAddRecord = () => {
        // Basic validation
        if (!currentRecord.Code || !currentRecord['Qty in Qtls']) {
            alert('Center Code and Qty in Qtls are required.');
            return;
        }
        setRecords(prev => [...prev, currentRecord]);
        // Reset for next entry, keeping common dates
        const recordTemplate = { ...template };
        if (dataType === 'indent') {
            recordTemplate['Indent Date'] = commonDate;
        } else {
            recordTemplate['Purchase Date'] = commonDate;
        }
        setCurrentRecord(recordTemplate);
    };
    
    const handleRemoveRecord = (index: number) => {
        setRecords(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (records.length > 0) {
            onSave(records, dataType!);
            onClose();
        } else {
            alert("No records to save.");
        }
    };

    if (!isOpen || !dataType) return null;

    const headers = Object.keys(template);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="append-modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="append-modal-title" className="text-xl font-bold text-slate-800">
                        Add Daily {dataType === 'indent' ? 'Indent' : 'Purchase'} Entries
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 flex-grow overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-md font-semibold text-slate-800 mb-2">New Record Entry</h3>
                        <div className="p-4 bg-slate-50 border rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                            {Object.entries(currentRecord).map(([key, value]) => {
                                const isCommonDateField = (dataType === 'indent' && key === 'Indent Date') || (dataType === 'purchase' && key === 'Purchase Date');
                                return (
                                <div key={key}>
                                    <label htmlFor={key} className="text-xs font-medium text-slate-600">{key}</label>
                                    <input
                                        id={key}
                                        type={key.includes('Date') ? 'date' : 'text'}
                                        value={isCommonDateField ? commonDate : value}
                                        onChange={isCommonDateField ? handleCommonDateChange : (e) => setCurrentRecord(p => ({ ...p, [key]: e.target.value }))}
                                        className="mt-1 block w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm"
                                    />
                                </div>
                            )})}
                            <button onClick={handleAddRecord} className="flex items-center justify-center gap-2 h-9 px-4 bg-[#003580] text-white text-sm font-semibold rounded-lg hover:bg-[#002a66]">
                                <Plus size={16}/> Add Record
                            </button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-md font-semibold text-slate-800 mb-2">Records to be Added ({records.length})</h3>
                        <div className="border rounded-lg max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-200 sticky top-0">
                                    <tr>
                                        {headers.map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
                                        <th className="px-4 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length > 0 ? records.map((rec, idx) => (
                                        <tr key={idx} className="border-b last:border-0">
                                            {headers.map(h => <td key={h} className="px-4 py-2 whitespace-nowrap">{rec[h]}</td>)}
                                            <td className="px-4 py-2 text-right">
                                                <button onClick={() => handleRemoveRecord(idx)} className="p-1 text-red-500 hover:text-red-700">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={headers.length + 1} className="text-center p-4 text-slate-500">No records added yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <footer className="flex justify-end p-4 border-t bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-200 mr-2">
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={records.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66] disabled:bg-slate-400"
                    >
                        <Save size={16}/> Save {records.length} Records
                    </button>
                </footer>
            </div>
        </div>
    );
};