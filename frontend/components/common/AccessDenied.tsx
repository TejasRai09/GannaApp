/**
 * Shown when someone reaches a screen their role does not cover.
 *
 * It says plainly what was refused and what their role does allow, rather than
 * silently bouncing them to the dashboard — a page that vanishes without
 * explanation reads as a bug and generates a support call.
 */
import React from 'react';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import type { UserRole } from '../../types';
import { ROLE_LABEL, ROLE_DESCRIPTION } from '../../services/permissions';
import { Header } from './Header';

interface Props {
    /** What they tried to reach, as a noun phrase: "the activity log". */
    what: string;
    role: UserRole;
    onNavigate: (p: any) => void;
    onLogout: () => void;
}

export const AccessDenied: React.FC<Props> = ({ what, role, onNavigate, onLogout }) => (
    <div className="min-h-screen bg-slate-50">
        <Header pageTitle="Not available" onNavigate={onNavigate} onLogout={onLogout} />
        <main className="max-w-xl mx-auto px-4 py-20 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-400 mb-5">
                <ShieldOff size={26} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
                {what.charAt(0).toUpperCase() + what.slice(1)} is not part of your role
            </h1>
            <p className="text-slate-500 mt-3">
                You are signed in as <strong className="text-slate-700">{ROLE_LABEL[role]}</strong>.{' '}
                {ROLE_DESCRIPTION[role]}
            </p>
            <p className="text-sm text-slate-400 mt-2">
                If you need access, ask an administrator to change your role.
            </p>
            <button
                onClick={() => onNavigate('dashboard')}
                className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#003580] text-white font-semibold text-sm hover:bg-[#002a66] transition-colors"
            >
                <ArrowLeft size={16} /> Back to the dashboard
            </button>
        </main>
    </div>
);
