/**
 * Version 2 — the variance and scorecard screen.
 *
 * Shows the four numbers side by side, and a running scorecard of whether the
 * app or the plant team came closer to the cane that actually arrived.
 *
 * Both are scored against the ARRIVAL, never against each other. Scoring the
 * plant team against their own number would only teach us to copy them.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCcw, AlertTriangle, Info } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { addDays, formatDateGB } from '../services/dateUtils';
import {
    getLedger, getScorecard, getReasonCodes, accuracyPct, n,
    type LedgerRow, type Scorecard, type ScorecardGroup, type ReasonCode,
} from '../services/feedbackService';
import type { Page } from '../App';

interface Props {
    onNavigate: (p: Page) => void;
    onLogout: () => void;
}

/** Enough cases for a comparison to mean anything. Below this we show the
 *  numbers but refuse to call a winner. */
const MIN_CASES = 15;

const fmt = (v: number | null, dp = 0) =>
    v === null || !Number.isFinite(v) ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: dp });

const Pct: React.FC<{ v: number | null; bold?: boolean }> = ({ v, bold }) => {
    if (v === null) return <span className="text-slate-300">—</span>;
    const tone = v >= 85 ? 'text-green-700' : v >= 70 ? 'text-amber-700' : 'text-red-600';
    return <span className={`${tone} ${bold ? 'font-bold' : 'font-medium'}`}>{v.toFixed(1)}%</span>;
};

const Winner: React.FC<{ g: ScorecardGroup }> = ({ g }) => {
    const app = accuracyPct(g.app_abs_error, g.actual_volume);
    const plant = accuracyPct(g.plant_abs_error, g.actual_volume);
    if (app === null || plant === null) return <span className="text-slate-300">—</span>;
    if (g.cases < MIN_CASES) {
        return <span className="text-slate-400 text-xs italic" title={`Only ${g.cases} cases — too few to call`}>
            too few
        </span>;
    }
    const gap = plant - app;
    if (Math.abs(gap) < 1) return <span className="text-slate-500 text-xs">level</span>;
    return gap > 0
        ? <span className="text-emerald-700 font-semibold text-xs">plant +{gap.toFixed(1)}</span>
        : <span className="text-indigo-700 font-semibold text-xs">app +{(-gap).toFixed(1)}</span>;
};

export const VariancePage: React.FC<Props> = ({ onNavigate, onLogout }) => {
    const { token } = useAuth();

    const [days, setDays] = useState(30);
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [score, setScore] = useState<Scorecard | null>(null);
    const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { from, to } = useMemo(() => {
        const today = new Date();
        return { from: addDays(today, -days), to: addDays(today, 7) };
    }, [days]);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const [l, s, c] = await Promise.all([
                getLedger(token, from, to),
                getScorecard(token, from, to),
                getReasonCodes(token),
            ]);
            setRows(l.rows);
            setScore(s);
            setReasonCodes(c.reasonCodes);
        } catch (e: any) {
            setError(e?.message || 'Could not load the feedback data');
        } finally {
            setLoading(false);
        }
    }, [token, from, to]);

    useEffect(() => { load(); }, [load]);

    const reasonLabel = useCallback(
        (code: string | null) => reasonCodes.find(r => r.code === code)?.label ?? code ?? '',
        [reasonCodes]);

    const appAcc = score ? accuracyPct(score.overall.app_abs_error, score.overall.actual_volume) : null;
    const plantAcc = score ? accuracyPct(score.overall.plant_abs_error, score.overall.actual_volume) : null;
    const cases = score?.overall.cases ?? 0;
    const cov = score?.coverage;

    return (
        <div className="min-h-screen bg-slate-50">
            <Header pageTitle="Variance & Scorecard" onNavigate={onNavigate} onLogout={onLogout} />
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <BarChart3 size={22} /> Variance &amp; Scorecard
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            App recommendation, your number, what was ordered, and what arrived — side by side.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                            aria-label="Period"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Whole season</option>
                        </select>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50"
                        >
                            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                        {error}
                    </div>
                )}

                {/* Scorecard */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Who came closer to the cane?</h2>
                    <p className="text-xs text-slate-500 mb-4">
                        Both are measured against what actually arrived — never against each other. Volume-weighted,
                        counting only days where you entered your own number.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">App</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={appAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1">{score?.overall.app_wins ?? 0} centre-days closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Plant team</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={plantAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1">{score?.overall.plant_wins ?? 0} centre-days closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Evidence</div>
                            <div className="text-3xl font-bold mt-1 text-slate-800">{cases}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                centre-days compared
                                {cov && ` · ${cov.with_plant}/${cov.total_rows} rows have your input`}
                            </div>
                        </div>
                    </div>

                    {cases < MIN_CASES && (
                        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                Only {cases} comparable centre-day{cases === 1 ? '' : 's'} so far. That is not yet
                                evidence — treat these figures as a progress indicator, not a result. The proposal
                                allows a month of collection before any weighting is changed.
                            </span>
                        </div>
                    )}
                </div>

                {/* By centre */}
                {score && score.byCentre.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-lg font-bold text-slate-900 mb-3">By centre</h2>
                        <div className="overflow-auto max-h-[420px] border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2.5">Centre</th>
                                        <th className="px-4 py-2.5 text-right">Cases</th>
                                        <th className="px-4 py-2.5 text-right">App</th>
                                        <th className="px-4 py-2.5 text-right">Plant team</th>
                                        <th className="px-4 py-2.5 text-right">Difference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {score.byCentre.map((g) => (
                                        <tr key={g.centre_id} className="border-b hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-medium text-slate-800">
                                                {g.centre_name || g.centre_id}
                                                {g.is_gate === 1 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">GATE</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-slate-500">{g.cases}</td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.app_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.plant_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Winner g={g} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Centres where the plant team is consistently closer are the ones where their input should
                            eventually carry weight — but only once there are enough cases to be sure.
                        </p>
                    </div>
                )}

                {/* By reason */}
                {score && score.byReason.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Which reasons actually predict something?</h2>
                        <p className="text-xs text-slate-500 mb-3">
                            A reason that reliably goes with the plant team being closer is a candidate to become a
                            model input. One that does not can be dropped from the list.
                        </p>
                        <div className="overflow-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2.5">Reason given</th>
                                        <th className="px-4 py-2.5 text-right">Times used</th>
                                        <th className="px-4 py-2.5 text-right">App</th>
                                        <th className="px-4 py-2.5 text-right">Plant team</th>
                                        <th className="px-4 py-2.5 text-right">Difference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {score.byReason.map((g) => (
                                        <tr key={g.reason_code} className="border-b hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-medium text-slate-800">{reasonLabel(g.reason_code ?? null)}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-500">{g.cases}</td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.app_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.plant_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Winner g={g} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* The four numbers */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Daily detail</h2>
                    {rows.length === 0 && !loading ? (
                        <div className="flex items-start gap-2 px-4 py-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-sm">
                            <Info size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                Nothing recorded for this period yet. Rows appear here as soon as a calculation is run —
                                the app's own numbers are saved automatically.
                            </span>
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-[600px] border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2.5">Delivery</th>
                                        <th className="px-3 py-2.5">Centre</th>
                                        <th className="px-3 py-2.5 text-right bg-indigo-50">App</th>
                                        <th className="px-3 py-2.5 text-right bg-emerald-50">Yours</th>
                                        <th className="px-3 py-2.5 text-right">Ordered</th>
                                        <th className="px-3 py-2.5 text-right">Arrived</th>
                                        <th className="px-3 py-2.5">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const app = n(r.app_indent), plant = n(r.plant_indent);
                                        const arrived = n(r.actual_arrival);
                                        return (
                                            <tr key={`${r.delivery_date}-${r.centre_id}`} className="border-b hover:bg-slate-50">
                                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDateGB(r.delivery_date)}</td>
                                                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                                                    {r.centre_name || r.centre_id}
                                                    {r.is_gate === 1 && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">GATE</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right bg-indigo-50/50 text-indigo-900">{fmt(app)}</td>
                                                <td className="px-3 py-2 text-right bg-emerald-50/50 font-semibold text-emerald-900">{fmt(plant)}</td>
                                                <td className="px-3 py-2 text-right text-slate-600">{fmt(n(r.actual_indent))}</td>
                                                <td className="px-3 py-2 text-right text-slate-600">{fmt(arrived)}</td>
                                                <td className="px-3 py-2 text-xs text-slate-500">
                                                    {r.reason_code ? reasonLabel(r.reason_code) : ''}
                                                    {r.reason_note && <span className="text-slate-400 italic"> — {r.reason_note}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
