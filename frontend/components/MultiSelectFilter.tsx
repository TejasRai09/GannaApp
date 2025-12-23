import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
    id: string;
    name: string;
}

interface MultiSelectFilterProps {
    title: string;
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ title, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (id: string) => {
        let newSelected: string[];
        if (selected.includes('all')) {
            newSelected = [id];
        } else {
            if (selected.includes(id)) {
                newSelected = selected.filter(s => s !== id);
            } else {
                newSelected = [...selected, id];
            }
        }
        if (newSelected.length === 0) newSelected = ['all'];
        if (newSelected.length > 1 && newSelected.includes('all')) {
             newSelected = newSelected.filter(s => s !== 'all');
        }
        onChange(newSelected);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.checked ? ['all'] : []);
    };
    
    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayLabel = selected.includes('all')
        ? 'All Centers'
        : `${selected.length} Center${selected.length > 1 ? 's' : ''} Selected`;

    return (
        <div className="relative w-full sm:w-56" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-1.5 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
            >
                <span>{displayLabel}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border z-20">
                    <div className="p-2 border-b">
                        <div className="relative">
                             <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <input
                                type="text"
                                placeholder="Search centers..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-8 pr-2 py-1 w-full border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-[#003580]/50"
                            />
                        </div>
                    </div>
                    <ul className="p-2 max-h-60 overflow-y-auto">
                        <li>
                            <label className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selected.includes('all')}
                                    onChange={handleSelectAll}
                                    className="h-4 w-4 rounded border-gray-300 text-[#003580] focus:ring-[#003580]"
                                />
                                <span className="font-semibold text-sm">All Centers</span>
                            </label>
                        </li>
                        {filteredOptions.map(option => (
                            <li key={option.id}>
                                <label className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(option.id) && !selected.includes('all')}
                                        onChange={() => handleSelect(option.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-[#003580] focus:ring-[#003580]"
                                    />
                                    <span className="text-sm">{option.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
