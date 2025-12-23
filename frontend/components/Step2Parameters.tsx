
import React from 'react';
import { SlidersHorizontal, Warehouse, Calendar, Edit } from 'lucide-react';
import { InfoIcon } from './InfoIcon';
import { ConstraintSelector } from './ConstraintSelector';
import type { Constraint } from '../types';

interface Step2ParametersProps {
    handleNext: () => void;
    handlePrev: () => void;
    isReadOnly: boolean;
    // All parameter states and setters
    plantStartDate: string;
    setPlantStartDate: (value: string) => void;
    currentDate: string;
    setCurrentDate: (value: string) => void;
    seasonTotalDays: number;
    setSeasonTotalDays: (value: number) => void;
    seasonalCrushingCapacity: number;
    setSeasonalCrushingCapacity: (value: number) => void;
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
    onEditAssumptions: () => void;
    // Constraints
    constraints: Constraint[];
    setConstraints: (constraints: Constraint[]) => void;
}

const InputField: React.FC<{ label: string; id: string; type: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; unit?: string; min?: number; max?: number, tooltip?: string }> = 
({ label, id, type, value, onChange, readOnly = false, unit, min, max, tooltip }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 flex items-center gap-1">
            {label} {tooltip && <InfoIcon text={tooltip} />}
        </label>
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

export const Step2Parameters: React.FC<Step2ParametersProps> = (props) => {
    const handleNumberChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(Number(e.target.value));
    };

    return (
        <div>
            <div className="max-w-3xl mx-auto space-y-6">
                
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 border-b pb-2 flex items-center gap-2"><SlidersHorizontal size={20}/> Parameters</h2>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
                                <Calendar size={18}/> Season Assumptions
                            </h3>
                            <button
                                onClick={props.onEditAssumptions}
                                disabled={props.isReadOnly}
                                className="flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-[#003580] bg-white rounded-md border border-slate-300 hover:bg-slate-100 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                            >
                                <Edit size={14}/> Edit
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <div>
                                <span className="text-slate-500">Start Date:</span>
                                <span className="font-semibold text-slate-700 ml-2">{props.plantStartDate || 'Not Set'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Total Days:</span>
                                <span className="font-semibold text-slate-700 ml-2">{props.seasonTotalDays.toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Crushing Capacity:</span>
                                <span className="font-semibold text-slate-700 ml-2">{props.seasonalCrushingCapacity.toLocaleString()} Qtls</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField label="Current Date" id="currentDate" type="date" value={props.currentDate} onChange={(e) => props.setCurrentDate(e.target.value)} readOnly={props.isReadOnly} tooltip="This is the date for which the calculation is being performed (T)." />
                            <InputField label="Plant Capacity" id="plantCapacity" type="number" value={props.plantCapacity} onChange={handleNumberChange(props.setPlantCapacity)} unit="%" min={0} max={100} readOnly={props.isReadOnly} tooltip="The target operating capacity of the plant for the day." />
                        </div>
                        <InputField label="Target Daily Run Rate" id="totalDailyRequirement" type="number" value={props.totalDailyRequirement} onChange={handleNumberChange(props.setTotalDailyRequirement)} unit="Qtls" readOnly={props.isReadOnly} tooltip="The target amount of cane to be crushed daily, used to calculate the indent requirement." />
                        
                        <div className="pt-4 mt-4 border-t">
                            <h3 className="text-md font-semibold text-slate-800 mb-2 flex items-center gap-2"><Warehouse size={18}/> Stock Levels (Qtls)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField label="Standard Stock – Centre" id="standardStockCentre" type="number" value={props.standardStockCentre} onChange={handleNumberChange(props.setStandardStockCentre)} readOnly={props.isReadOnly} tooltip="The ideal, desired stock level to be maintained across all centers." />
                                <InputField label="Standard Stock – Gate" id="standardStockGate" type="number" value={props.standardStockGate} onChange={handleNumberChange(props.setStandardStockGate)} readOnly={props.isReadOnly} tooltip="The ideal, desired stock level to be maintained at the gate." />
                                <InputField label="Available Stock – Centre" id="availableStockCentre" type="number" value={props.availableStockCentre} onChange={handleNumberChange(props.setAvailableStockCentre)} readOnly={props.isReadOnly} tooltip="The actual current stock available across all centers." />
                                <InputField label="Available Stock – Gate" id="availableStockGate" type="number" value={props.availableStockGate} onChange={handleNumberChange(props.setAvailableStockGate)} readOnly={props.isReadOnly} tooltip="The actual current stock available at the gate." />
                            </div>
                        </div>
                    </div>
                </div>

                <ConstraintSelector 
                    currentDate={props.currentDate}
                    constraints={props.constraints}
                    setConstraints={props.setConstraints}
                    isReadOnly={props.isReadOnly}
                />

            </div>
             <div className="mt-8 flex justify-between">
                <button
                    onClick={props.handlePrev}
                    className="px-6 py-3 text-base font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
                >
                    Previous
                </button>
                <button
                    onClick={props.handleNext}
                    className="px-6 py-3 text-base font-bold text-white bg-[#003580] rounded-lg shadow-md hover:bg-[#002a66] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003580] transition-all"
                >
                    Next: Review
                </button>
            </div>
        </div>
    );
};