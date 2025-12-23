import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, UploadCloud, Save, Settings, SlidersHorizontal } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab: 'mapping' | 'assumptions';
    initialMapping: { [key: string]: string };
    plantStartDate: string;
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
    onSave: (
        newMapping: { [key: string]: string },
        newAssumptions: { startDate: string, totalDays: number, capacity: number }
    ) => void;
}

const TabButton: React.FC<{ label: string, icon: React.ReactNode, isActive: boolean, onClick: () => void }> = ({ label, icon, isActive, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${isActive ? 'border-[#003580] text-[#003580]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
        {icon} {label}
    </button>
);

const InputField: React.FC<{ label: string; id: string; type: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; unit?: string; }> = 
({ label, id, type, value, onChange, unit }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                className="block w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:ring-[#003580] focus:border-[#003580]"
            />
            {unit && <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 sm:text-sm">{unit}</span>
            </div>}
        </div>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
    const { isOpen, onClose, defaultTab, initialMapping, plantStartDate, seasonTotalDays, seasonalCrushingCapacity, onSave } = props;

    const [activeTab, setActiveTab] = useState<'mapping' | 'assumptions'>(defaultTab);

    // Internal state for mapping
    const [mapping, setMapping] = useState(initialMapping);
    const [newSource, setNewSource] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [mappingError, setMappingError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Internal state for season assumptions
    const [startDate, setStartDate] = useState(plantStartDate);
    const [totalDays, setTotalDays] = useState(seasonTotalDays);
    const [capacity, setCapacity] = useState(seasonalCrushingCapacity);

    // Reset internal state when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
            setMapping(initialMapping);
            setStartDate(plantStartDate);
            setTotalDays(seasonTotalDays);
            setCapacity(seasonalCrushingCapacity);
            setMappingError(null);
        }
    }, [isOpen, defaultTab, initialMapping, plantStartDate, seasonTotalDays, seasonalCrushingCapacity]);

    useEffect(() => {
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

    const handleAddMapping = () => {
        if (newSource.trim() && newTarget.trim()) {
            setMappingError(null);
            setMapping(prev => ({ ...prev, [newSource.trim()]: newTarget.trim() }));
            setNewSource('');
            setNewTarget('');
        }
    };

    const handleRemoveMapping = (sourceKey: string) => {
        setMapping(prev => {
            const newMap = { ...prev };
            delete newMap[sourceKey];
            return newMap;
        });
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setMappingError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.trim().split(/\r\n|\n/);
                if (lines.length < 2) throw new Error("CSV has no data rows.");
                
                const headerLine = lines.shift()!;
                const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                const sourceIndex = headers.indexOf('source');
                const targetIndex = headers.indexOf('target');

                if (sourceIndex === -1 || targetIndex === -1) {
                    throw new Error("CSV must contain 'Source' and 'Target' columns.");
                }

                const newMapping: { [key: string]: string } = {};
                lines.forEach(line => {
                    const values = line.split(',');
                    const source = values[sourceIndex]?.trim().replace(/"/g, '');
                    const target = values[targetIndex]?.trim().replace(/"/g, '');
                    if (source && target) {
                        newMapping[source] = target;
                    }
                });

                setMapping(newMapping);
            } catch (err: any) {
                setMappingError(`Error parsing CSV: ${err.message}`);
            } finally {
                if (event.target) event.target.value = ''; // Reset file input
            }
        };
        reader.onerror = () => setMappingError('Error reading file.');
        reader.readAsText(file);
    };

    const handleSaveAndClose = () => {
        onSave(mapping, { startDate, totalDays, capacity });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex justify-between items-center p-4 border-b">
                    <h2 id="settings-modal-title" className="text-xl font-bold text-slate-800">Settings</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close modal">
                        <X size={24} />
                    </button>
                </header>
                
                <div className="border-b border-slate-200">
                    <nav className="flex space-x-2 px-4">
                        <TabButton label="Center Mapping" icon={<Settings size={16}/>} isActive={activeTab === 'mapping'} onClick={() => setActiveTab('mapping')} />
                        <TabButton label="Season Assumptions" icon={<SlidersHorizontal size={16}/>} isActive={activeTab === 'assumptions'} onClick={() => setActiveTab('assumptions')} />
                    </nav>
                </div>

                <div className="p-6 flex-grow overflow-y-auto space-y-6">
                    {activeTab === 'mapping' && (
                        <div>
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-slate-600 mb-2">
                                    Consolidate center codes by mapping sources to a target.
                                </p>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
                                >
                                    <UploadCloud size={14} /> Upload CSV
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                            </div>
                             {mappingError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-200 mt-2">{mappingError}</p>}
                            <div className="bg-slate-50 border rounded-lg max-h-64 overflow-y-auto mt-2">
                               <table className="w-full text-sm">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-200 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Source Code</th>
                                            <th className="px-4 py-2 text-left">Maps to Target Code</th>
                                            <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(mapping).length > 0 ? Object.entries(mapping).map(([source, target]) => (
                                            <tr key={source} className="border-b last:border-0">
                                                <td className="px-4 py-2 font-mono">{source}</td>
                                                <td className="px-4 py-2 font-mono">{target}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <button onClick={() => handleRemoveMapping(source)} className="p-1 text-red-500 hover:text-red-700" aria-label={`Remove mapping for ${source}`}>
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={3} className="text-center p-4 text-slate-500">No mappings defined.</td></tr>
                                        )}
                                    </tbody>
                               </table>
                            </div>
                             <div className="border-t pt-4 mt-6">
                                 <h3 className="text-md font-semibold text-slate-800 mb-2">Add New Mapping</h3>
                                 <div className="flex items-center gap-4">
                                    <input
                                        type="text"
                                        placeholder="Source Code"
                                        value={newSource}
                                        onChange={(e) => setNewSource(e.target.value)}
                                        className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                    />
                                     <span className="text-slate-500">&rarr;</span>
                                    <input
                                        type="text"
                                        placeholder="Target Code"
                                        value={newTarget}
                                        onChange={(e) => setNewTarget(e.target.value)}
                                        className="block w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                                    />
                                    <button onClick={handleAddMapping} className="p-2 bg-[#003580] text-white rounded-lg hover:bg-[#002a66]" aria-label="Add new mapping">
                                        <Plus size={20}/>
                                    </button>
                                 </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'assumptions' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                These are high-level assumptions for the entire season. They are used in the dashboard summary and are saved automatically.
                            </p>
                            <InputField label="Season Start Date" id="plantStartDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <InputField label="Total Season Days" id="seasonTotalDays" type="number" value={totalDays} onChange={(e) => setTotalDays(Number(e.target.value))} />
                            <InputField label="Seasonal Crushing Capacity" id="seasonalCrushingCapacity" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} unit="Qtls"/>
                        </div>
                    )}
                </div>
                
                <footer className="flex justify-end items-center p-4 border-t bg-slate-50 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-200 mr-2">
                        Cancel
                    </button>
                     <button onClick={handleSaveAndClose} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003580] rounded-lg hover:bg-[#002a66]">
                        <Save size={16} /> Save and Close
                    </button>
                </footer>
            </div>
        </div>
    );
};