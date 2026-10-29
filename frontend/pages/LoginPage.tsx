/**
 * Sign in.
 *
 * Two doors, and they are not equivalent:
 *
 *   Microsoft  anyone in the directory. Always lands as a VIEWER — the
 *              directory proves who someone is, not what they may do.
 *   Password   auditors and admins, created deliberately by an admin.
 *
 * Microsoft is presented first because it is the route most people take and
 * needs no credential to be issued or remembered.
 */
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Page } from '../App';
import { authService } from '../services/authService';
import { isMicrosoftAvailable, signInWithMicrosoft, handleRedirect } from '../services/msalClient';

interface LoginPageProps {
    onLoginSuccess: (session: { token: string; user: any }) => void;
    onNavigate: (page: Page) => void;
}

/** Microsoft's own mark. Inline so it renders with no network dependency. */
const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden="true" focusable="false">
        <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
        <rect x="12" y="1"  width="10" height="10" fill="#7FBA00" />
        <rect x="1"  y="12" width="10" height="10" fill="#00A4EF" />
        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [msLoading, setMsLoading] = useState(false);
    const [msAvailable, setMsAvailable] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // Ask the server whether Microsoft sign-in is configured, and finish the
    // redirect leg if this load is returning from Microsoft.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const available = await isMicrosoftAvailable();
                if (!cancelled) setMsAvailable(available);
                if (!available) {
                    // With no directory sign-in there is nothing else to offer,
                    // so go straight to the credential form.
                    if (!cancelled) setShowPasswordForm(true);
                    return;
                }
                const idToken = await handleRedirect();
                if (idToken && !cancelled) {
                    setMsLoading(true);
                    const session = await authService.loginWithMicrosoft(idToken);
                    onLoginSuccess(session);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.message || 'Microsoft sign-in failed');
                    setMsLoading(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [onLoginSuccess]);

    const handleMicrosoft = async () => {
        setError('');
        setMsLoading(true);
        try {
            const idToken = await signInWithMicrosoft();
            const session = await authService.loginWithMicrosoft(idToken);
            onLoginSuccess(session);
        } catch (err: any) {
            // Closing the Microsoft window is a choice, not a failure.
            const cancelled = err?.errorCode === 'user_cancelled'
                || /user_cancelled|cancell?ed/i.test(err?.message ?? '');
            if (!cancelled) setError(err?.message || 'Microsoft sign-in failed');
            setMsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const session = await authService.login(email.trim().toLowerCase(), password);
            onLoginSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Sign-in failed');
        } finally {
            setIsLoading(false);
        }
    };

    const busy = isLoading || msLoading;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Brand bar */}
            <header className="px-6 py-5">
                <button
                    onClick={() => onNavigate('home')}
                    className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 rounded"
                    aria-label="Go to the homepage"
                >
                    <img src="/poddar-logo.png" alt="" className="h-8 w-auto" onError={(e) => { (e.currentTarget.style.display = 'none'); }} />
                    <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-600 transition-colors">
                        Saroj Poddar Group
                    </span>
                </button>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pb-16">
                <div className="w-full max-w-[400px]">

                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-[#003580] tracking-tight">GANNA INDENT</h1>
                        <p className="text-sm text-slate-500 mt-1.5">Sugarcane indent planning</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-7">

                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 mb-5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
                            >
                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {msAvailable && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleMicrosoft}
                                    disabled={busy}
                                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-slate-300 bg-white
                                        font-semibold text-slate-700 text-[15px]
                                        hover:bg-slate-50 hover:border-slate-400
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40
                                        disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {msLoading
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : <MicrosoftLogo />}
                                    {msLoading ? 'Signing in…' : 'Sign in with Microsoft'}
                                </button>

                                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-3">
                                    <ShieldCheck size={13} />
                                    Your work account. Opens the dashboard in view-only mode.
                                </p>

                                {!showPasswordForm && (
                                    <>
                                        <div className="flex items-center gap-3 my-6" aria-hidden="true">
                                            <div className="h-px flex-1 bg-slate-200" />
                                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">or</span>
                                            <div className="h-px flex-1 bg-slate-200" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswordForm(true)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                                                text-sm font-semibold text-slate-500 hover:text-[#003580] hover:bg-slate-50
                                                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 transition-colors"
                                        >
                                            <LockKeyhole size={15} />
                                            Sign in with a password
                                        </button>
                                    </>
                                )}
                            </>
                        )}

                        {showPasswordForm && (
                            <>
                                {msAvailable && <div className="h-px bg-slate-200 my-6" aria-hidden="true" />}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Email
                                        </label>
                                        <input
                                            id="email"
                                            type="email"
                                            autoComplete="username"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={busy}
                                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-[15px]
                                                focus:outline-none focus:ring-2 focus:ring-[#003580]/40 focus:border-[#003580]
                                                disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                disabled={busy}
                                                className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-slate-300 text-[15px]
                                                    focus:outline-none focus:ring-2 focus:ring-[#003580]/40 focus:border-[#003580]
                                                    disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600
                                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 rounded-r-lg"
                                            >
                                                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={busy}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                                            bg-[#003580] text-white font-semibold text-[15px]
                                            hover:bg-[#002a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40
                                            disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isLoading && <Loader2 size={17} className="animate-spin" />}
                                        {isLoading ? 'Signing in…' : 'Sign in'}
                                    </button>
                                </form>

                                <p className="text-xs text-slate-400 mt-4 text-center">
                                    Auditor and admin accounts are issued by your administrator.
                                </p>
                            </>
                        )}
                    </div>

                    <p className="text-center text-xs text-slate-400 mt-6">
                        Gobind Sugar Mills
                    </p>
                </div>
            </main>
        </div>
    );
};
