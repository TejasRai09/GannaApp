import React, { useState, useMemo } from 'react';
import { CloudRain, AlertTriangle, X, Check, Calendar, Factory, Zap } from 'lucide-react';
import { addDays, formatDateGB, parseDate } from '../services/dateUtils';
import type { Constraint, ConstraintType } from '../types';
import { generateId } from '../utils/utils';

interface ConstraintSelectorProps {
    currentDate: string;
    constraints: Constraint[];
    setConstraints: (constraints: Constraint[]) => void;
    isReadOnly?: boolean;
}

interface ConstraintModalProps {
    date: Date;
    existingConstraint?: Constraint;
    onSave: (c: Constraint) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const ConstraintModal: React.FC<ConstraintModalProps> = ({ date, existingConstraint, onSave, onDelete, onClose }) => {
    const [type, setType] = useState<ConstraintType>(existingConstraint?.type || 'field');
    const [impact, setImpact] = useState<number>(existingConstraint ? existingConstraint.impactFactor * 100 : 50);
    const [description, setDescription] = useState<string>(existingConstraint?.description || '');

    const handleSave = () => {
        onSave({
            id: existingConstraint?.id || generateId('constraint'),
            date: date.toISOString().split('T')[0],
            type,
            impactFactor: impact / 100,
            description
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Operational Constraint</h3>
                        <p className="text-xs text-slate-500">{formatDateGB(date)}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><X size={20} /></button>
                </header>
                
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Constraint Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setType('field'); setDescription('Heavy Rain'); }}
                                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${type === 'field' ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}
                            >
                                <CloudRain size={24} />
                                <span className="text-sm font-semibold">Field / Weather</span>
                            </button>
                            <button
                                onClick={() => { setType('mill'); setDescription('Breakdown'); }}
                                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${type === 'mill' ? 'border-[#f97316] bg-orange-50 text-[#f97316]' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}
                            >
                                <Factory size={24} />
                                <span className="text-sm font-semibold">Mill / Demand</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Impact Severity</label>
                            <span className="text-xs font-bold text-slate-700">{impact}% Reduction</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            step="5" 
                            value={impact} 
                            onChange={(e) => setImpact(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003580]"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>None</span>
                            <span>Moderate</span>
                            <span>Full Stop</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input 
                            type="text" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={type === 'field' ? "e.g., Heavy Rain Forecast" : "e.g., Boiler Maintenance"}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-[#003580] focus:border-[#003580]"
                        />
                    </div>
                </div>

                <footer className="flex justify-between p-4 border-t bg-slate-50 rounded-b-xl">
                    {existingConstraint ? (
                        <button onClick={() => { onDelete(existingConstraint.id); onClose(); }} className="text-red-500 hover:text-red-700 text-sm font-semibold px-2">Delete</button>
                    ) : (
                        <div></div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#003580] text-white text-sm font-bold rounded-lg hover:bg-[#002a66]">
                            <Check size={16} /> Save
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export const ConstraintSelector: React.FC<ConstraintSelectorProps> = ({ currentDate, constraints, setConstraints, isReadOnly }) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const startDate = useMemo(() => parseDate(currentDate) || new Date(), [currentDate]);
    
    const days = useMemo(() => {
        const result = [];
        for (let i = 0; i < 7; i++) {
            result.push(addDays(startDate, i));
        }
        return result;
    }, [startDate]);

    const handleConstraintSave = (newConstraint: Constraint) => {
        setConstraints(prev => {
            const others = prev.filter(c => c.date !== newConstraint.date); 
            return [...others, newConstraint];
        });
    };

    const handleConstraintDelete = (id: string) => {
        setConstraints(prev => prev.filter(c => c.id !== id));
    };

    const activeConstraintForModal = useMemo(() => {
        if (!selectedDate || isNaN(selectedDate.getTime())) return undefined;
        const dateStr = selectedDate.toISOString().split('T')[0];
        return constraints.find(c => c.date === dateStr);
    }, [selectedDate, constraints]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <Zap size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Operational Constraints</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
                Select a day to log expected interruptions (e.g., Rain, Mill Maintenance). The engine will adjust forecasts or indent recommendations accordingly.
            </p>

            <div className="grid grid-cols-7 gap-2">
                {days.map((date, i) => {
                    const isValid = !isNaN(date.getTime());
                    const dateStr = isValid ? date.toISOString().split('T')[0] : '';
                    const constraint = constraints.find(c => c.date === dateStr);
                    const isToday = i === 0;
                    
                    return (
                        <button
                            key={dateStr || i}
                            onClick={() => !isReadOnly && isValid && setSelectedDate(date)}
                            disabled={isReadOnly || !isValid}
                            className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all h-24 relative
                                ${constraint 
                                    ? (constraint.type === 'field' ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-orange-50 border-orange-200 hover:border-orange-400')
                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                }
                                ${isReadOnly || !isValid ? 'cursor-default opacity-80' : 'cursor-pointer'}
                            `}
                        >
                            <span className={`text-[10px] uppercase font-bold mb-1 ${isToday ? 'text-[#003580]' : 'text-slate-400'}`}>
                                {isToday ? 'Today' : `T+${i}`}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                                {isValid ? `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}` : '--'}
                            </span>
                            
                            {constraint ? (
                                <div className="mt-auto flex flex-col items-center">
                                    {constraint.type === 'field' 
                                        ? <CloudRain size={16} className="text-blue-500 mb-1" /> 
                                        : <Factory size={16} className="text-orange-500 mb-1" />
                                    }
                                    <span className={`text-[10px] font-bold px-1.5 rounded-full ${constraint.type === 'field' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'}`}>
                                        -{Math.round(constraint.impactFactor * 100)}%
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-auto opacity-0 hover:opacity-50 transition-opacity">
                                    <AlertTriangle size={14} className="text-slate-300" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {selectedDate && !isNaN(selectedDate.getTime()) && (
                <ConstraintModal 
                    date={selectedDate}
                    existingConstraint={activeConstraintForModal}
                    onSave={handleConstraintSave}
                    onDelete={handleConstraintDelete}
                    onClose={() => setSelectedDate(null)}
                />
            )}
        </div>
    );
};