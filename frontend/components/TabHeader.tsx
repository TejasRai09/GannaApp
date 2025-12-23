
import React from 'react';
import { Info } from 'lucide-react';

interface TabHeaderProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
}

export const TabHeader: React.FC<TabHeaderProps> = ({ title, description, icon }) => {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex items-start gap-4">
            {icon && (
                <div className="p-2 bg-white rounded-md border border-slate-200 shadow-sm text-[#003580]">
                    {icon}
                </div>
            )}
            <div>
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
};
