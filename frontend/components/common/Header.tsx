import React from 'react';
import { LogOut, HelpCircle, LayoutGrid, Users, Settings, Info, UserX, Building2 } from 'lucide-react';
import type { Page } from '../../App';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
    pageTitle: string;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    showSettings?: boolean;
    showLogic?: boolean;
    onOpenSettings?: () => void;
    onOpenLogic?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, onNavigate, onLogout, showSettings, showLogic, onOpenSettings, onOpenLogic }) => {
    const { currentUser, impersonator, stopImpersonating, currentOrganization } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const displayName = currentUser?.name || currentUser?.email || '';
    const orgName = currentOrganization?.name;

    return (
        <header className="bg-white shadow-sm sticky top-0 z-40">
            {impersonator && (
                <div className="bg-yellow-400 text-yellow-900 px-4 py-1 text-sm font-semibold flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <UserX size={16} />
                        You are impersonating <span className="font-bold">{currentUser?.name}</span>.
                    </div>
                    <button onClick={stopImpersonating} className="px-2 py-0.5 bg-yellow-900/80 text-white text-xs rounded-md hover:bg-yellow-900">
                        Return to Superadmin
                    </button>
                </div>
            )}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                <div className="flex-1 flex justify-start items-center gap-4">
                    {currentOrganization?.customLogoBase64 ? (
                        <img src={currentOrganization.customLogoBase64} alt={`${currentOrganization.name} Logo`} className="h-12 object-contain" />
                    ) : (
                        <img 
                            src="https://www.zuariindustries.in/assets/web/img/logo/adventz.png" 
                            alt="Adventz Logo" 
                            className="h-10 object-contain"
                            referrerPolicy="no-referrer"
                        />
                    )}
                    {!isSuperAdmin && (
                         <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Back to Dashboard">
                            <LayoutGrid size={20} />
                        </button>
                    )}
                </div>
                
                <div className="flex-1 text-center">
                    <h1 
                        className="text-3xl font-extrabold text-[#003580] leading-tight tracking-tighter"
                        title="Ganna Allocation & Normalized Needs Analyzer"
                    >
                        GANNA
                    </h1>
                    <p className="text-sm font-medium text-slate-500">{pageTitle}</p>
                </div>

                <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4">
                    {displayName && (
                        <div className="hidden sm:flex flex-col items-end leading-tight text-right">
                            <span className="text-sm text-slate-500">Hi,</span>
                            <span className="text-sm font-semibold text-slate-800" title={displayName}>{displayName}</span>
                            {orgName && <span className="text-xs text-slate-500" title={orgName}>{orgName}</span>}
                        </div>
                    )}
                    {isAdmin && (
                        <>
                            <button onClick={() => onNavigate('team')} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition-colors" aria-label="Manage Team">
                                <Users size={16} /> Team
                            </button>
                            <button onClick={() => onNavigate('branding')} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition-colors" aria-label="Branding Settings">
                                <Building2 size={16} /> Branding
                            </button>
                        </>
                    )}
                    {showLogic && <button onClick={onOpenLogic} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Show calculation logic"><Info size={20} /></button>}
                    {!isSuperAdmin && <button onClick={() => onNavigate('help')} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Help & Glossary"><HelpCircle size={20} /></button>}
                    {showSettings && <button onClick={onOpenSettings} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Open settings"><Settings size={20} /></button>}
                    <button onClick={onLogout} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors" aria-label="Logout"><LogOut size={20} /></button>
                    {!currentOrganization?.customLogoBase64 && (
                        <div className="hidden lg:block opacity-90">
                            <img 
                                src="https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png" 
                                alt="Zuari Industries" 
                                className="h-8 object-contain"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};