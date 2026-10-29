/**
 * Variance and scorecard.
 *
 * One question: whose indent would have met the requirement more closely?
 *
 * The requirement is an INPUT — the plant team says how much cane the mill
 * needs, and the app turns that into an order by dividing by the yield it
 * predicts. The plant team places their own order from their own judgement.
 * The next day's files say what they actually ordered and what actually came.
 *
 *   R = requirement      what was needed
 *   A = app indent       what the app said to order
 *   P = actual indent    what the plant team actually ordered
 *   V = actual arrival   what turned up
 *
 *   observed yield  y = V / P
 *   plant result        V        miss = V - R
 *   app result          A * y    miss = A * y - R
 *
 * Both use the SAME observed yield, so the day's weather, roads and labour are
 * baked into y and cancel out. What is left is the ordering decision, which is
 * the only thing either side controls.
 *
 * The day is the unit of judgement, not the centre: the mill needs a total
 * tonnage, and splitting it between centres is the app's own choice. Grading
 * the plant team against an allocation they never agreed to would not be fair,
 * so the per-centre table is diagnostic only and says so.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCcw, AlertTriangle, Info, Target } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { addDays, formatDateGB } from '../services/dateUtils';
import {
    getScorecard, fulfilmentPct, biasPct, yieldPct,
    type Scorecard, type ScorecardDay, type ScorecardCentre,
} from '../services/feedbackService';
import type { Page } from '../App';

interface Props {
    onNavigate: (p: Page) => void;
    onLogout: () => void;
}

/** Enough days for a comparison to mean anything. Below this, no winner is named. */
const MIN_DAYS = 10;

const fmt = (v: number | null | undefined, dp = 0) =>
    v === null || v === undefined || !Number.isFinite(v)
        ? '—'
        : v.toLocaleString(undefined, { maximumFractionDigits: dp });

/** Signed quantity with an explicit sign, so short and over never look alike. */
const fmtSigned = (v: number) =>
    !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString()}`;

const Pct: React.FC<{ v: number | null; bold?: boolean }> = ({ v, bold }) => {
    if (v === null) return <span className="text-slate-300">—</span>;
    const tone = v >= 90 ? 'text-green-700' : v >= 75 ? 'text-amber-700' : 'text-red-600';
    return <span className={`${tone} ${bold ? 'font-bold' : 'font-medium'}`}>{v.toFixed(1)}%</span>;
};

/**
 * Which way the miss went. Short and over cost the mill very different things —
 * a short day stops the crush, a long day piles cane in the yard to spoil — so
 * the direction is named rather than folded into an absolute number.
 */
const Direction: React.FC<{ pct: number | null }> = ({ pct }) => {
    if (pct === null) return null;
    if (Math.abs(pct) < 1) return <span className="text-slate-500">on target</span>;
    return pct > 0
        ? <span className="text-amber-700">{pct.toFixed(1)}% more cane than needed</span>
        : <span className="text-red-600">{Math.abs(pct).toFixed(1)}% short of requirement</span>;
};

export const VariancePage: React.FC<Props> = ({ onNavigate, onLogout }) => {
    const { token } = useAuth();

    const [days, setDays] = useState(30);
    const [score, setScore] = useState<Scorecard | null>(null);
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
            setScore(await getScorecard(token, from, to));
        } catch (e: any) {
            setError(e?.message || 'Could not load the comparison');
        } finally {
            setLoading(false);
        }
    }, [token, from, to]);

    useEffect(() => { load(); }, [load]);

    const o = score?.overall;
    const appAcc = o ? fulfilmentPct(o.appAbsError, o.requirement) : null;
    const plantAcc = o ? fulfilmentPct(o.plantAbsError, o.requirement) : null;
    const appBias = o ? biasPct(o.appBias, o.requirement) : null;
    const plantBias = o ? biasPct(o.plantBias, o.requirement) : null;
    const observedYield = o ? yieldPct(o.arrived, o.ordered) : null;
    const scoredDays = o?.days ?? 0;
    const cov = score?.coverage;

    const verdict = (() => {
        if (!o || scoredDays < MIN_DAYS || appAcc === null || plantAcc === null) return null;
        const gap = appAcc - plantAcc;
        if (Math.abs(gap) < 1) return { tone: 'slate', text: 'Level so far — neither is consistently closer.' };
        return gap > 0
            ? { tone: 'indigo', text: `The app's order would have been ${gap.toFixed(1)} points closer to the requirement.` }
            : { tone: 'emerald', text: `Your own order was ${Math.abs(gap).toFixed(1)} points closer to the requirement.` };
    })();

    return (
        <div className="min-h-screen bg-slate-50">
            <Header pageTitle="Variance & Scorecard" onNavigate={onNavigate} onLogout={onLogout} />
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                <div className="flex flex-wrap justify-between items-end gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <BarChart3 size={22} /> Variance &amp; Scorecard
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Whose indent would have met the requirement more closely — yours, or the app's.
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

                {/* How it is measured — stated on the page, not hidden in a tooltip. */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs leading-relaxed">
                    <Target size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    <span>
                        The <strong>requirement</strong> is the target both are measured against. You ordered
                        a quantity and a quantity arrived — that is your result. The app's order is scored at
                        the <strong>same delivery rate actually observed that day</strong>, so weather, roads
                        and labour affect both sides equally and only the ordering decision is left.
                        {' '}This assumes a centre's delivery rate does not change with the size of the order;
                        over a normal range that holds, at extremes it would not.
                    </span>
                </div>

                {/* Headline */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Your order</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={plantAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1"><Direction pct={plantBias} /></div>
                            <div className="text-xs text-slate-400 mt-0.5">{o?.plantWins ?? 0} day{(o?.plantWins ?? 0) === 1 ? '' : 's'} closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">App's order</div>
                            <div className="text-3xl font-bold mt-1"><Pct v={appAcc} bold /></div>
                            <div className="text-xs text-slate-500 mt-1"><Direction pct={appBias} /></div>
                            <div className="text-xs text-slate-400 mt-0.5">{o?.appWins ?? 0} day{(o?.appWins ?? 0) === 1 ? '' : 's'} closer</div>
                        </div>
                        <div className="p-4 rounded-lg bg-sky-50 border border-sky-200">
                            <div className="text-xs font-semibold text-sky-800 uppercase tracking-wide">Delivery rate</div>
                            <div className="text-3xl font-bold mt-1 text-sky-900">
                                {observedYield === null ? '—' : `${observedYield.toFixed(1)}%`}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">of ordered cane actually arrived</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {fmt(o?.arrived)} of {fmt(o?.ordered)} qtl
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Evidence</div>
                            <div className="text-3xl font-bold mt-1 text-slate-800">{scoredDays}</div>
                            <div className="text-xs text-slate-500 mt-1">day{scoredDays === 1 ? '' : 's'} compared</div>
                            {cov && (
                                <div className="text-xs text-slate-400 mt-0.5">
                                    {cov.with_arrived} of {cov.total_rows} rows have arrivals
                                </div>
                            )}
                        </div>
                    </div>

                    {verdict && (
                        <div className={`mt-5 px-4 py-3 rounded-lg text-sm font-medium border
                            ${verdict.tone === 'indigo' ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                              : verdict.tone === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                            {verdict.text}
                        </div>
                    )}

                    {scoredDays < MIN_DAYS && (
                        <div className="flex items-start gap-2 mt-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>
                                {scoredDays === 0
                                    ? 'No day in this period has both an order and its arrivals yet. Rows appear here once the indent and purchase files for a delivery day have been uploaded.'
                                    : `Only ${scoredDays} comparable day${scoredDays === 1 ? '' : 's'} so far. That is not evidence yet — treat it as a progress indicator, not a result.`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Day by day — the unit the verdict rests on */}
                {score && score.byDay.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Day by day</h2>
                        <p className="text-xs text-slate-500 mb-3">
                            Each row is one delivery day, totalled across every centre. This is what the
                            verdict above is built from.
                        </p>
                        <div className="overflow-auto max-h-[460px] border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-600 uppercase bg-slate-50 sticky top-0 border-b">
                                    <tr>
                                        <th className="px-3 py-2.5 font-semibold">Delivery</th>
                                        <th className="px-3 py-2.5 text-right font-semibold" title="Cane the mill needed">Required</th>
                                        <th className="px-3 py-2.5 text-right font-semibold" title="What you indented">You ordered</th>
                                        <th className="px-3 py-2.5 text-right font-semibold" title="What arrived against your order">Arrived</th>
                                        <th className="px-3 py-2.5 text-right font-semibold bg-emerald-50" title="Your result against the requirement">Your miss</th>
                                        <th className="px-3 py-2.5 text-right font-semibold" title="What the app recommended ordering">App order</th>
                                        <th className="px-3 py-2.5 text-right font-semibold bg-indigo-50" title="What the app's order would have brought, at the rate observed that day">App miss</th>
                                        <th className="px-3 py-2.5 text-right font-semibold">Closer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {score.byDay.map((d: ScorecardDay) => (
                                        <tr key={d.deliveryDate} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium">{formatDateGB(d.deliveryDate)}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{fmt(d.requirement)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt(d.ordered)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt(d.arrived)}</td>
                                            <td className={`px-3 py-2.5 text-right font-semibold bg-emerald-50/50 ${d.plantMiss < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                                                {fmtSigned(d.plantMiss)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-slate-600">{fmt(d.appOrdered)}</td>
                                            <td className={`px-3 py-2.5 text-right font-semibold bg-indigo-50/50 ${d.appMiss < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                                                {fmtSigned(d.appMiss)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs">
                                                {d.winner === 'app' && <span className="text-indigo-700 font-semibold">app</span>}
                                                {d.winner === 'plant' && <span className="text-emerald-700 font-semibold">you</span>}
                                                {d.winner === 'tie' && <span className="text-slate-400">level</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Per centre — diagnostic only */}
                {score && score.byCentre.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">By centre</h2>
                        <p className="text-xs text-slate-500 mb-3">
                            Diagnostic, not a verdict. The per-centre requirement is the app's own split of
                            the mill total, which you never agreed to — so a centre looking short here may
                            simply mean the app allocated it differently, not that anyone ordered badly.
                            Useful for spotting a centre that consistently under-delivers.
                        </p>
                        <div className="overflow-auto max-h-[420px] border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-600 uppercase bg-slate-50 sticky top-0 border-b">
                                    <tr>
                                        <th className="px-3 py-2.5 font-semibold">Centre</th>
                                        <th className="px-3 py-2.5 text-right font-semibold">Required</th>
                                        <th className="px-3 py-2.5 text-right font-semibold">Ordered</th>
                                        <th className="px-3 py-2.5 text-right font-semibold">Arrived</th>
                                        <th className="px-3 py-2.5 text-right font-semibold" title="Arrived as a share of ordered">Rate</th>
                                        <th className="px-3 py-2.5 text-right font-semibold bg-emerald-50">Your miss</th>
                                        <th className="px-3 py-2.5 text-right font-semibold bg-indigo-50">App miss</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {score.byCentre.map((c: ScorecardCentre) => {
                                        const rate = yieldPct(c.arrived, c.ordered);
                                        return (
                                            <tr key={c.centreId} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                                    {c.centreName || c.centreId}
                                                    {c.isGate && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">GATE</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-slate-700">{fmt(c.requirement)}</td>
                                                <td className="px-3 py-2.5 text-right text-slate-600">{fmt(c.ordered)}</td>
                                                <td className="px-3 py-2.5 text-right text-slate-600">{fmt(c.arrived)}</td>
                                                <td className="px-3 py-2.5 text-right text-sky-800">{rate === null ? '—' : `${rate.toFixed(0)}%`}</td>
                                                <td className={`px-3 py-2.5 text-right bg-emerald-50/50 ${c.plantMiss < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                                                    {fmtSigned(c.plantMiss)}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right bg-indigo-50/50 ${c.appMiss < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                                                    {fmtSigned(c.appMiss)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {score && score.byDay.length === 0 && !loading && (
                    <div className="flex items-start gap-2 px-4 py-4 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm">
                        <Info size={16} className="mt-0.5 flex-shrink-0" />
                        <span>
                            Nothing to compare yet. A delivery day appears here once its indent and purchase
                            files have been uploaded — normally three days after the order is placed. Nothing
                            needs to be entered by hand.
                        </span>
                    </div>
                )}
            </main>
        </div>
    );
};
