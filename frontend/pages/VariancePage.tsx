/**
 * Version 2.1 — the variance and scorecard screen.
 *
 * The contest is between two FORECASTS of the same thing: against the indent
 * that was actually placed, how much cane turned up? The app answers with its
 * predicted delivery rate; the plant team answers by hand. Both are scored
 * against the arrival.
 *
 * Neither side is scored against the other, and neither is scored against the
 * order. The order is the plant team's decision — scoring anyone on it would
 * just measure how well they remembered their own number.
 *
 * Because the two sides may have assumed different order sizes, every forecast
 * is re-stated against the order actually placed before being compared. Without
 * that step the win would go to whoever guessed the order size better, which is
 * not forecasting.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCcw, AlertTriangle, Info } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { addDays, formatDateGB } from '../services/dateUtils';
import {
    getLedger, getScorecard, getReasonCodes, accuracyPct, biasPct, yieldPct, n,
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

/**
 * A forecast re-stated against the order actually placed — the only footing on
 * which two forecasts of the same day can be compared.
 *
 * With no order recorded yet there is nothing to re-state onto, so the figure
 * is shown as given.
 */
const restate = (expected: number | null, basis: number | null, placed: number | null): number | null => {
    if (expected === null || basis === null || basis <= 0) return null;
    if (placed === null || placed <= 0) return expected;
    return expected * (placed / basis);
};

const Pct: React.FC<{ v: number | null; bold?: boolean }> = ({ v, bold }) => {
    if (v === null) return <span className="text-slate-300">—</span>;
    const tone = v >= 85 ? 'text-green-700' : v >= 70 ? 'text-amber-700' : 'text-red-600';
    return <span className={`${tone} ${bold ? 'font-bold' : 'font-medium'}`}>{v.toFixed(1)}%</span>;
};

/**
 * Signed error. Positive means the forecast expected more cane than arrived,
 * which is the direction that empties a yard — worth distinguishing from an
 * error of the same size in the other direction.
 */
const Bias: React.FC<{ v: number | null }> = ({ v }) => {
    if (v === null) return null;
    if (Math.abs(v) < 0.5) return <span className="text-slate-500">balanced</span>;
    return v > 0
        ? <span className="text-amber-700">expected {v.toFixed(1)}% too much</span>
        : <span className="text-sky-700">expected {(-v).toFixed(1)}% too little</span>;
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

    const o = score?.overall;
    const appAcc = o ? accuracyPct(o.app_abs_error, o.actual_volume) : null;
    const plantAcc = o ? accuracyPct(o.plant_abs_error, o.actual_volume) : null;
    const appBias = o ? biasPct(o.app_bias, o.actual_volume) : null;
    const plantBias = o ? biasPct(o.plant_bias, o.actual_volume) : null;
    const actualYield = o ? yieldPct(o.actual_volume, o.indent_volume) : null;
    const appYield = o ? yieldPct(o.app_pred_volume, o.indent_volume) : null;
    const plantYield = o ? yieldPct(o.plant_pred_volume, o.indent_volume) : null;
    const cases = o?.cases ?? 0;
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
                            Against the cane that was ordered, how much actually arrived — and who called it closer.
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
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Who forecast the cane better?</h2>
                    <p className="text-xs text-slate-500 mb-4">
                        Both forecasts are re-stated against the indent that was actually placed, then measured
                        against what arrived — never against each other, and never against the order. Volume-weighted,
                        counting only centre-days where you gave your own figure.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">App forecast</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={appAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1"><Bias v={appBias} /></div>
                            <div className="text-xs text-slate-400 mt-0.5">{o?.app_wins ?? 0} centre-days closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Your forecast</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={plantAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1"><Bias v={plantBias} /></div>
                            <div className="text-xs text-slate-400 mt-0.5">{o?.plant_wins ?? 0} centre-days closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-sky-50 border border-sky-200">
                            <div className="text-xs font-semibold text-sky-800 uppercase tracking-wide">Delivery rate</div>
                            <div className="text-3xl font-bold mt-1 text-sky-900">
                                {actualYield === null ? '—' : `${actualYield.toFixed(1)}%`}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                actually delivered of what was ordered
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                app said {appYield === null ? '—' : `${appYield.toFixed(1)}%`}
                                {' · '}you said {plantYield === null ? '—' : `${plantYield.toFixed(1)}%`}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Evidence</div>
                            <div className="text-3xl font-bold mt-1 text-slate-800">{cases}</div>
                            <div className="text-xs text-slate-500 mt-1">centre-days compared</div>
                            {cov && (
                                <div className="text-xs text-slate-400 mt-0.5">
                                    {cov.with_plant}/{cov.total_rows} rows have your figure
                                    {' · '}{cov.with_arrival} have arrivals
                                </div>
                            )}
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
                                        <th className="px-4 py-2.5 text-right" title="Cane delivered as a share of cane ordered">Delivered</th>
                                        <th className="px-4 py-2.5 text-right">App</th>
                                        <th className="px-4 py-2.5 text-right">You</th>
                                        <th className="px-4 py-2.5 text-right">Closer</th>
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
                                            <td className="px-4 py-2.5 text-right text-sky-800">
                                                {(() => { const y = yieldPct(g.actual_volume, g.indent_volume); return y === null ? '—' : `${y.toFixed(0)}%`; })()}
                                            </td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.app_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Pct v={accuracyPct(g.plant_abs_error, g.actual_volume)} /></td>
                                            <td className="px-4 py-2.5 text-right"><Winner g={g} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Centres where your forecast is consistently closer are the ones where your judgement
                            should eventually carry weight in the model — but only once there are enough cases to
                            be sure it is judgement and not chance.
                        </p>
                    </div>
                )}

                {/* By reason */}
                {score && score.byReason.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Which reasons actually predict something?</h2>
                        <p className="text-xs text-slate-500 mb-3">
                            A reason that reliably goes with your forecast being closer is a candidate to become a
                            model input. One that does not can be dropped from the list.
                        </p>
                        <div className="overflow-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                    <tr>
                                        <th className="px-4 py-2.5">Reason given</th>
                                        <th className="px-4 py-2.5 text-right">Times used</th>
                                        <th className="px-4 py-2.5 text-right" title="Cane delivered as a share of cane ordered">Delivered</th>
                                        <th className="px-4 py-2.5 text-right">App</th>
                                        <th className="px-4 py-2.5 text-right">You</th>
                                        <th className="px-4 py-2.5 text-right">Closer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {score.byReason.map((g) => (
                                        <tr key={g.reason_code} className="border-b hover:bg-slate-50">
                                            <td className="px-4 py-2.5 font-medium text-slate-800">{reasonLabel(g.reason_code ?? null)}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-500">{g.cases}</td>
                                            <td className="px-4 py-2.5 text-right text-sky-800">
                                                {(() => { const y = yieldPct(g.actual_volume, g.indent_volume); return y === null ? '—' : `${y.toFixed(0)}%`; })()}
                                            </td>
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

                {/* Row-by-row detail */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Daily detail</h2>
                    <p className="text-xs text-slate-500 mb-3">
                        Both forecasts are shown scaled to the order actually placed, so they can be read straight
                        against the arrival. Until an order is recorded they appear as they were entered.
                    </p>
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
                                        <th className="px-3 py-2.5 text-right" title="Indent actually placed for this centre and day">Ordered</th>
                                        <th className="px-3 py-2.5 text-right bg-indigo-50" title="Cane the app expected against that order">App expected</th>
                                        <th className="px-3 py-2.5 text-right bg-emerald-50" title="Cane you expected against that order">You expected</th>
                                        <th className="px-3 py-2.5 text-right" title="Cane that actually arrived against that order">Arrived</th>
                                        <th className="px-3 py-2.5 text-right" title="Arrived as a share of ordered">Rate</th>
                                        <th className="px-3 py-2.5 text-right">Closer</th>
                                        <th className="px-3 py-2.5">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const placed = n(r.actual_indent);
                                        const arrived = n(r.actual_arrival);
                                        const appExp = restate(n(r.app_expected_arrival), n(r.app_indent), placed);
                                        const plantExp = restate(n(r.plant_expected_arrival), n(r.plant_basis_indent), placed);
                                        const rate = placed && placed > 0 && arrived !== null
                                            ? (arrived / placed) * 100 : null;
                                        // Only callable once both forecasts and the arrival are known.
                                        const closer = appExp !== null && plantExp !== null && arrived !== null
                                            ? (Math.abs(appExp - arrived) < Math.abs(plantExp - arrived) ? 'app' : 'you')
                                            : null;
                                        return (
                                            <tr key={`${r.delivery_date}-${r.centre_id}`} className="border-b hover:bg-slate-50">
                                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDateGB(r.delivery_date)}</td>
                                                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                                                    {r.centre_name || r.centre_id}
                                                    {r.is_gate === 1 && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">GATE</span>}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">{fmt(placed)}</td>
                                                <td className="px-3 py-2 text-right bg-indigo-50/50 text-indigo-900">{fmt(appExp)}</td>
                                                <td className="px-3 py-2 text-right bg-emerald-50/50 font-semibold text-emerald-900">{fmt(plantExp)}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(arrived)}</td>
                                                <td className="px-3 py-2 text-right text-sky-800">{rate === null ? '—' : `${rate.toFixed(0)}%`}</td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {closer === 'app' && <span className="text-indigo-700 font-semibold">app</span>}
                                                    {closer === 'you' && <span className="text-emerald-700 font-semibold">you</span>}
                                                </td>
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
