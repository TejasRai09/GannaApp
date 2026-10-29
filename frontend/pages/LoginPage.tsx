/**
 * Sign in.
 *
 * Two doors, and they are not equivalent:
 *
 *   Microsoft  anyone in the directory. Always lands as a VIEWER — the
 *              directory proves who someone is, not what they may do.
 *   Password   auditors and admins, created deliberately by an admin.
 *
 * Both are shown at once rather than hiding one behind a link. Microsoft is the
 * wider door, but the password path belongs to the auditor who signs in every
 * morning to run the indent, and making them click twice for that is wrong.
 *
 * Every mark on this page is inline SVG. The old header pulled logos from an
 * external domain, which is exactly the dependency that left the plant staring
 * at an unstyled page when a CDN was blocked.
 */
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, TrendingUp, Layers, LineChart } from 'lucide-react';
import type { Page } from '../App';
import { authService } from '../services/authService';
import { isMicrosoftAvailable, signInWithMicrosoft, handleRedirect } from '../services/msalClient';

interface LoginPageProps {
    onLoginSuccess: (session: { token: string; user: any }) => void;
    onNavigate: (page: Page) => void;
}

/** Microsoft's own mark, inline so it renders with no network dependency. */
const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 19 }) => (
    <svg width={size} height={size} viewBox="0 0 23 23" aria-hidden="true" focusable="false">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
);

/** A cane stalk, stylised. Stands in for the logo this project never had. */
const CaneMark: React.FC<{ size?: number; className?: string }> = ({ size = 34, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
        <rect width="40" height="40" rx="10" fill="currentColor" opacity="0.12" />
        <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M15 31 L15 11" />
            <path d="M25 31 L25 15" />
            <path d="M11.5 16 H18.5 M11.5 21 H18.5 M11.5 26 H18.5" strokeWidth="1.5" opacity="0.75" />
            <path d="M21.5 20 H28.5 M21.5 25 H28.5" strokeWidth="1.5" opacity="0.75" />
            <path d="M15 11 C15 11 12 7 8.5 7.5" strokeWidth="2" opacity="0.9" />
            <path d="M25 15 C25 15 28.5 11.5 32 12.5" strokeWidth="2" opacity="0.9" />
        </g>
    </svg>
);

/**
 * Field motif for the brand panel. Purely decorative, very low contrast — it
 * must never compete with the text sitting on top of it.
 */
const FieldPattern: React.FC = () => (
    <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
    >
        <defs>
            <linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
        </defs>
        <g stroke="url(#fadeDown)" strokeWidth="1.5" fill="none">
            {Array.from({ length: 18 }).map((_, i) => {
                const x = i * 24 + 8;
                const lean = (i % 3) - 1;
                return (
                    <g key={i}>
                        <path d={`M${x} 600 C ${x + lean * 10} 420, ${x + lean * 16} 300, ${x + lean * 22} 150`} />
                        <path d={`M${x + lean * 18} 230 l ${12 + lean * 4} -22`} opacity="0.7" />
                        <path d={`M${x + lean * 20} 190 l ${-12 + lean * 4} -20`} opacity="0.7" />
                    </g>
                );
            })}
        </g>
    </svg>
);

const CAPABILITIES = [
    { icon: TrendingUp, text: 'Tomorrow’s indent, three days ahead' },
    { icon: Layers, text: 'Every centre, weighted by what actually arrives' },
    { icon: LineChart, text: 'Four seasons of delivery behaviour behind each number' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigate }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [msLoading, setMsLoading] = useState(false);
    const [msAvailable, setMsAvailable] = useState(false);

    // Ask the server whether Microsoft sign-in is configured, and finish the
    // redirect leg if this page load is returning from Microsoft.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const available = await isMicrosoftAvailable();
                if (!cancelled) setMsAvailable(available);
                if (!available) return;

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
        <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">

            {/* ── Brand panel ──────────────────────────────────────────────
                Carries the identity so the form side can stay quiet. Hidden
                below lg, where a compact header takes its place. */}
            <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden
                bg-gradient-to-br from-[#001634] via-[#002f6e] to-[#00529c] text-white p-12 xl:p-16">
                <FieldPattern />

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => onNavigate('home')}
                        className="flex items-center gap-3 text-white/90 rounded-lg
                            hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
                        aria-label="Go to the homepage"
                    >
                        <CaneMark size={38} />
                        <span className="text-sm font-semibold tracking-wide uppercase text-white/70">
                            Gobind Sugar Mills
                        </span>
                    </button>
                </div>

                <div className="relative max-w-md">
                    <h1 className="text-[2.75rem] xl:text-5xl font-bold tracking-tight leading-[1.05]">
                        GANNA<br />INDENT
                    </h1>
                    <p className="mt-5 text-lg text-blue-100/90 leading-relaxed">
                        How much cane to call for, centre by centre — and how much of it
                        will actually reach the gate.
                    </p>

                    <ul className="mt-10 space-y-4">
                        {CAPABILITIES.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-start gap-3 text-[15px] text-blue-50/85">
                                <span className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Icon size={15} />
                                </span>
                                <span className="leading-snug">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative flex items-center gap-2 text-xs text-blue-200/60">
                    <span>Saroj Poddar Group</span>
                    <span aria-hidden="true">·</span>
                    <span>2026–27 season</span>
                </div>
            </aside>

            {/* ── Sign-in panel ───────────────────────────────────────────── */}
            <main className="flex flex-col min-h-screen lg:min-h-0">

                {/* Compact brand header, small screens only. */}
                <div className="lg:hidden bg-gradient-to-br from-[#001634] to-[#00529c] text-white px-6 py-7">
                    <div className="flex items-center gap-3">
                        <CaneMark size={32} />
                        <div className="leading-tight">
                            <div className="text-xl font-bold tracking-tight">GANNA INDENT</div>
                            <div className="text-xs text-blue-200/80">Gobind Sugar Mills</div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center px-6 py-10 sm:py-14">
                    <div className="w-full max-w-[380px] motion-safe:animate-fadeIn">

                        <div className="mb-7">
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Use your work account, or the credentials your administrator issued.
                            </p>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                aria-live="polite"
                                className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm"
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
                                    className="group w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl
                                        border border-slate-300 bg-white font-semibold text-slate-800 text-[15px]
                                        shadow-sm hover:shadow hover:border-slate-400 hover:bg-slate-50
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 focus-visible:ring-offset-2
                                        disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                >
                                    {msLoading
                                        ? <Loader2 size={18} className="animate-spin text-slate-500" />
                                        : <MicrosoftLogo />}
                                    {msLoading ? 'Signing in…' : 'Sign in with Microsoft'}
                                </button>

                                <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-2.5 px-1">
                                    <ShieldCheck size={13} className="mt-px flex-shrink-0" />
                                    <span>Opens the dashboard in view-only mode.</span>
                                </p>

                                <div className="flex items-center gap-3 my-6" aria-hidden="true">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">or</span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>
                            </>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
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
                                    placeholder="name@adventz.com"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-[15px] bg-slate-50/50
                                        placeholder:text-slate-300
                                        focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580] focus:bg-white
                                        disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700 mb-1.5">
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
                                        className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-300 text-[15px] bg-slate-50/50
                                            focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580] focus:bg-white
                                            disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700
                                            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 rounded-r-xl transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl
                                    bg-[#003580] text-white font-semibold text-[15px] shadow-sm
                                    hover:bg-[#002a66] hover:shadow-md
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003580]/40 focus-visible:ring-offset-2
                                    disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading && <Loader2 size={17} className="animate-spin" />}
                                {isLoading ? 'Signing in…' : 'Sign in'}
                            </button>
                        </form>

                        <p className="text-xs text-slate-400 mt-6 text-center leading-relaxed">
                            Auditor and admin accounts are issued by your administrator.
                        </p>
                    </div>
                </div>

                <footer className="lg:hidden px-6 pb-7 text-center text-xs text-slate-400">
                    Saroj Poddar Group · 2026–27 season
                </footer>
            </main>
        </div>
    );
};
