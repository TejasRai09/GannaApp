
import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, Search, RotateCcw, MessageSquare, Languages } from 'lucide-react';
import type { IndentResultRow } from '../types';
import { formatDateGB } from '../services/dateUtils';

interface DispatchHubProps {
    isOpen: boolean;
    onClose: () => void;
    data: IndentResultRow[];
    currentDate: Date | string;
}

type LanguageCode = 'en' | 'hi';

interface LanguageConfig {
    label: string;
    header: string;
    dateLabel: string;
    centerLabel: string;
    indentLabel: string;
    footer: string;
}

const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
    en: {
        label: 'English',
        header: '🚜 GANNA Indent Order',
        dateLabel: '📅 Date:',
        centerLabel: '📍 Center:',
        indentLabel: '📦 FINAL INDENT:',
        footer: '⚠️ Please distribute slips by 6:00 PM.'
    },
    hi: {
        label: 'हिंदी',
        header: '🚜 गन्ना इंडेंट आदेश',
        dateLabel: '📅 दिनांक:',
        centerLabel: '📍 केंद्र:',
        indentLabel: '📦 अंतिम मांग:',
        footer: '⚠️ कृपया शाम 6:00 बजे तक पर्चियां वितरित करें।'
    }
};

const generateMessage = (row: IndentResultRow, lang: LanguageCode, dateStr: string): string => {
    const config = LANGUAGES[lang];
    // Note: We use *bold* markdown for WhatsApp
    return `*${config.header}*
${config.dateLabel} ${dateStr}

${config.centerLabel} ${row.centreName} (${row.centreId})
${config.indentLabel} *${Math.round(row.indentToRaise).toLocaleString()} Qtls*

${config.footer}`;
};

export const DispatchHub: React.FC<DispatchHubProps> = ({ isOpen, onClose, data, currentDate }) => {
    const [language, setLanguage] = useState<LanguageCode>('en');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

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

    const formattedDate = useMemo(() => formatDateGB(currentDate), [currentDate]);

    const filteredData = useMemo(() => {
        return data.filter(row => 
            row.centreName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            row.centreId.includes(searchTerm)
        );
    }, [data, searchTerm]);

    const handleCopy = async (row: IndentResultRow) => {
        const text = generateMessage(row, language, formattedDate);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIds(prev => {
                const next = new Set(prev);
                next.add(row.centreId);
                return next;
            });
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleReset = () => {
        setCopiedIds(new Set());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex justify-between items-center p-4 border-b bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#003580] text-white rounded-lg">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Field Communication Hub</h2>
                            <p className="text-sm text-slate-500">Generate and copy formatted WhatsApp messages for field officers.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </header>

                {/* Toolbar */}
                <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm w-full md:w-auto">
                        <Languages size={16} className="ml-2 text-slate-400"/>
                        {(Object.keys(LANGUAGES) as LanguageCode[]).map((code) => (
                            <button
                                key={code}
                                onClick={() => setLanguage(code)}
                                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                                    language === code 
                                    ? 'bg-[#003580] text-white shadow-sm' 
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {LANGUAGES[code].label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search center..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
                            />
                        </div>
                        {copiedIds.size > 0 && (
                            <button 
                                onClick={handleReset}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                            >
                                <RotateCcw size={14} /> Reset ({copiedIds.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredData.map(row => {
                            const isCopied = copiedIds.has(row.centreId);
                            const message = generateMessage(row, language, formattedDate);
                            
                            return (
                                <div 
                                    key={row.centreId} 
                                    className={`group flex flex-col bg-white rounded-xl border transition-all duration-200 ${
                                        isCopied 
                                        ? 'border-green-300 shadow-sm opacity-60 hover:opacity-100' 
                                        : 'border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300'
                                    }`}
                                >
                                    <div className="p-4 flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-slate-800">{row.centreName}</h3>
                                                <p className="text-xs font-mono text-slate-500">ID: {row.centreId}</p>
                                            </div>
                                            {isCopied && <Check size={18} className="text-green-600" />}
                                        </div>
                                        
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative">
                                            <p className="text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed select-all">
                                                {message}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3 border-t bg-slate-50/50 rounded-b-xl">
                                        <button
                                            onClick={() => handleCopy(row)}
                                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                                                isCopied
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-[#003580] text-white hover:bg-[#002a66] shadow-sm'
                                            }`}
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check size={16} /> Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={16} /> Copy Message
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredData.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-semibold">No centers found</p>
                            <p className="text-sm">Try adjusting your search terms.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
