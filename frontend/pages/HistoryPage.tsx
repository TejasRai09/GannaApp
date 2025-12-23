
import React, { useState, useMemo } from 'react';
import type { Page } from '../App';
import type { CalculationRun } from '../types';
import { History, Search, Newspaper, Trash2, AlertTriangle } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { formatDateTimeGB } from '../services/dateUtils';

interface HistoryPageProps {
    history: CalculationRun[];
    onNavigate: (page: Page) => void;
    onView: (id: string) => void;
    onDelete: (id: string) => void;
    onLogout: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ history, onNavigate, onView, onDelete, onLogout }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { currentUser } = useAuth();
    const isReadOnly = currentUser?.role === 'viewer';

    const filteredHistory = useMemo(() => {
        return history.filter(run =>
            run.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [history, searchTerm]);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
            <Header pageTitle="Calculation History" onNavigate={onNavigate} onLogout={onLogout} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4 mb-4">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><History size={24}/> All Saved Calculations</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full sm:w-64 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003580]/50"
                            />
                        </div>
                    </div>
                    
                    {filteredHistory.length > 0 ? (
                        <ul className="space-y-3">
                            {filteredHistory.map(run => (
                                <li key={run.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 rounded-lg border hover:shadow-md transition-shadow">
                                    <div>
                                        <p className="font-bold text-slate-800">{run.name}</p>
                                        <p className="text-xs text-slate-500">{formatDateTimeGB(run.timestamp)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                                        <button
                                            onClick={() => onView(run.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#003580] font-semibold text-sm rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                                        >
                                            <Newspaper size={16}/> View Report
                                        </button>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Are you sure you want to delete "${run.name}"? This action cannot be undone.`)) {
                                                        onDelete(run.id);
                                                    }
                                                }}
                                                className="p-2 text-red-600 rounded-lg hover:bg-red-100"
                                                aria-label={`Delete calculation ${run.name}`}
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12">
                             <AlertTriangle className="mx-auto w-12 h-12 text-amber-500" />
                             <h3 className="mt-2 text-xl font-semibold text-slate-800">No Matching Calculations Found</h3>
                             <p className="mt-1 text-slate-500">
                                {searchTerm ? `Your search for "${searchTerm}" did not return any results.` : "There are no saved calculations yet."}
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
