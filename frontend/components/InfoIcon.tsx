
import React from 'react';
import { Info } from 'lucide-react';

interface InfoIconProps {
    text: string;
    widthClass?: string;
}

export const InfoIcon: React.FC<InfoIconProps> = ({ text, widthClass = 'w-64' }) => {
    return (
        <div className="relative flex items-center group z-10">
            <Info size={14} className="text-slate-400 cursor-help" />
            <div className={`absolute bottom-full mb-2 ${widthClass} p-3 bg-slate-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none left-1/2 -translate-x-1/2`}>
                {text}
                <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                    <polygon className="fill-current" points="0,0 127.5,127.5 255,0" />
                </svg>
            </div>
        </div>
    );
};
