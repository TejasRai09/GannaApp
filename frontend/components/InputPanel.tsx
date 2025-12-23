import React from 'react';
import { SlidersHorizontal, Calendar, Warehouse } from 'lucide-react';

interface InputPanelProps {
    plantStartDate: string;
    setPlantStartDate: (value: string) => void;
    currentDate: string;
    setCurrentDate: (value: string) => void;
    plantCapacity: number;
    setPlantCapacity: (value: number) => void;
    totalDailyRequirement: number;
    setTotalDailyRequirement: (value: number) => void;
    standardStockCentre: number;
    setStandardStockCentre: (value: number) => void;
    standardStockGate: number;
    setStandardStockGate: (value: number) => void;
    availableStockCentre: number;
    setAvailableStockCentre: (value: number) => void;
    availableStockGate: number;
    setAvailableStockGate: (value: number) => void;
}

const InputField: React.FC<{ label: string; id: string; type: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; unit?: string; min?: number; max?: number }> = 
({ label, id, type, value, onChange, readOnly = false, unit, min, max }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
        <div className="mt-1 relative rounded-md shadow-sm">
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                min={min}
                max={max}
                className={`block w-full px-3 py-2 border rounded-md text-sm transition-colors duration-200
                    ${readOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-slate-300 focus:ring-[#003580] focus:border-[#003580]'}`}
            />
            {unit && <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 sm:text-sm">{unit}</span>
            </div>}
        </div>
    </div>
);


export const InputPanel: React.FC<InputPanelProps> = (props) => {
    const handleNumberChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(Number(e.target.value));
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-4 text-slate-900 border-b pb-2 flex items-center gap-2"><SlidersHorizontal size={20}/> Parameters</h2>
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <InputField label="Plant Start Date" id="plantStartDate" type="date" value={props.plantStartDate} onChange={(e) => props.setPlantStartDate(e.target.value)} />
                    <InputField label="Current Date" id="currentDate" type="date" value={props.currentDate} onChange={(e) => props.setCurrentDate(e.target.value)} />
                </div>
                <InputField label="Plant Capacity" id="plantCapacity" type="number" value={props.plantCapacity} onChange={handleNumberChange(props.setPlantCapacity)} unit="%" min={0} max={100} />
                <InputField label="Total Daily Requirement" id="totalDailyRequirement" type="number" value={props.totalDailyRequirement} onChange={handleNumberChange(props.setTotalDailyRequirement)} unit="Qtls" />
                
                <div className="pt-4 mt-4 border-t">
                    <h3 className="text-md font-semibold text-slate-800 mb-2 flex items-center gap-2"><Warehouse size={18}/> Stock Levels (Qtls)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField label="Standard Stock – Centre" id="standardStockCentre" type="number" value={props.standardStockCentre} onChange={handleNumberChange(props.setStandardStockCentre)} />
                        <InputField label="Standard Stock – Gate" id="standardStockGate" type="number" value={props.standardStockGate} onChange={handleNumberChange(props.setStandardStockGate)} />
                        <InputField label="Available Stock – Centre" id="availableStockCentre" type="number" value={props.availableStockCentre} onChange={handleNumberChange(props.setAvailableStockCentre)} />
                        <InputField label="Available Stock – Gate" id="availableStockGate" type="number" value={props.availableStockGate} onChange={handleNumberChange(props.setAvailableStockGate)} />
                    </div>
                </div>
            </div>
        </div>
    );
};