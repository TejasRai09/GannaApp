import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CalculationResults } from '../types';
import { ClipboardList, Download, Sparkles, Users } from 'lucide-react';
import { exportToCsv } from '../services/exportService';
import { useAuth } from '../context/AuthContext';
import { addDays } from '../services/dateUtils';
import {
    getReasonCodes, savePredictions, savePlantInput, getLedger, n,
    type ReasonCode,
} from '../services/feedbackService';
import { PlantInputCell, needsReason, type SaveState } from './PlantInputColumn';

interface IndentTableProps {
    results: CalculationResults;
    calculationName: string;
    /** The run date. Delivery is T+3, which is what the feedback ledger is keyed by. */
    currentDate?: Date;
}

interface PlantEntry {
    value: number | null;
    reasonCode: string | null;
    reasonNote: string | null;
}

const PHASE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    'Normal':    { bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  label: 'Normal Season' },
    'Pre-Surge': { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  label: 'Pre-Surge (Week 13-15)' },
    'Surge':     { bg: 'bg-red-50 border-red-200',      text: 'text-red-700',    label: 'Surge Period' },
};

const STATUS_BADGE: Record<string, { dot: string; label: string }> = {
    within: { dot: 'bg-green-500', label: 'In band range' },
    above:  { dot: 'bg-amber-500', label: 'Above band range' },
    below:  { dot: 'bg-red-500',   label: 'Below band range' },
};

export const IndentTable: React.FC<IndentTableProps> = ({ results, calculationName, currentDate }) => {
    const { tableData, overallBandLo, overallBandMid, overallBandHigh } = results;
    const { token } = useAuth();

    const totalIndentToRaise = tableData.reduce((sum, row) => sum + row.indentToRaise, 0);
    const totalExcelIndent   = tableData.reduce((sum, row) => sum + row.dWeightIndent, 0);
    const totalBonding       = tableData.reduce((sum, row) => sum + row.bonding, 0);

    // ── v2 feedback loop ────────────────────────────────────────────────────
    const deliveryDate  = currentDate ? addDays(currentDate, 3) : null;
    const feedbackOn    = Boolean(token && deliveryDate);

    const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
    const [plant, setPlant]             = useState<Record<string, PlantEntry>>({});
    const [saveStates, setSaveStates]   = useState<Record<string, SaveState>>({});
    const [ledgerReady, setLedgerReady] = useState(false);
    const [loadError, setLoadError]     = useState<string | null>(null);
    // Guards against re-saving predictions on every re-render of the same run.
    const savedForDate = useRef<string | null>(null);

    useEffect(() => {
        if (!feedbackOn || !token || !deliveryDate) return;
        const key = deliveryDate.toDateString();
        if (savedForDate.current === key) return;
        savedForDate.current = key;

        let cancelled = false;
        (async () => {
            try {
                const isGateMap = new Map<string, boolean>(
                    tableData.map(r => [r.centreId, r.isGate ?? false] as [string, boolean]));
                // The app's row must exist before a plant number can attach to it.
                await savePredictions(token, deliveryDate, tableData, isGateMap);
                const [codes, ledger] = await Promise.all([
                    getReasonCodes(token),
                    getLedger(token, deliveryDate, deliveryDate),
                ]);
                if (cancelled) return;
                setReasonCodes(codes.reasonCodes);
                const existing: Record<string, PlantEntry> = {};
                for (const r of ledger.rows) {
                    if (r.plant_indent !== null) {
                        existing[r.centre_id] = {
                            value: n(r.plant_indent),
                            reasonCode: r.reason_code,
                            reasonNote: r.reason_note,
                        };
                    }
                }
                setPlant(existing);
                setLedgerReady(true);
                setLoadError(null);
            } catch (e: any) {
                if (cancelled) return;
                // The recommendation itself must still be usable if this fails.
                savedForDate.current = null;
                setLoadError(e?.message || 'Could not reach the feedback service');
            }
        })();
        return () => { cancelled = true; };
    }, [feedbackOn, token, deliveryDate?.getTime(), tableData]);

    const handlePlantChange = useCallback(
        (centreId: string, value: number | null, reasonCode: string | null, reasonNote: string | null) => {
            setPlant(prev => ({ ...prev, [centreId]: { value, reasonCode, reasonNote } }));

            if (!token || !deliveryDate) return;
            // A number that still needs a reason is held locally until one is
            // picked, so half-finished entries never reach the ledger.
            const row = tableData.find(r => r.centreId === centreId);
            if (value !== null && row && needsReason(value, row.indentToRaise) && !reasonCode) return;

            setSaveStates(s => ({ ...s, [centreId]: 'saving' }));
            savePlantInput(token, deliveryDate, centreId, value, reasonCode, reasonNote, true)
                .then(() => setSaveStates(s => ({ ...s, [centreId]: 'saved' })))
                .catch(() => setSaveStates(s => ({ ...s, [centreId]: 'error' })));
        },
        [token, deliveryDate?.getTime(), tableData],
    );

    const enteredCount = Object.values(plant).filter((p: PlantEntry) => p.value !== null).length;
    const totalPlant   = tableData.reduce(
        (sum, r) => sum + (plant[r.centreId]?.value ?? r.indentToRaise), 0);

    const hasBands       = tableData.some(r => r.bandLow !== undefined);
    const hasMl          = tableData.some(r => r.mlMaturity !== undefined);
    const firstBandRow   = tableData.find(r => r.phase !== undefined);
    const phase          = firstBandRow?.phase;
    const weekOfSeason   = firstBandRow?.weekOfSeason;
    const phaseStyle     = phase ? PHASE_STYLES[phase] : null;

    // Volume-weighted average predicted maturity (for the banner)
    const mlWeightedMaturity = (() => {
        let p = 0, q = 0;
        for (const r of tableData) {
            if (r.mlMaturity !== undefined && r.indentToRaise > 0) { p += r.mlMaturity * r.indentToRaise; q += r.indentToRaise; }
        }
        return q > 0 ? p / q : undefined;
    })();
    const windDownCount = tableData.filter(r => r.mlCapped).length;

    const overallStatus = overallBandLo !== undefined
        ? (totalIndentToRaise < overallBandLo ? 'below' : totalIndentToRaise > (overallBandHigh ?? Infinity) ? 'above' : 'within')
        : null;

    const handleExport = () => {
        const dataToExport = tableData.map(row => ({
            'Centre ID':              row.centreId,
            'Centre Name':            row.centreName,
            'Actual Bonding (Qtls)':  row.bonding,
            'Bonding %':              totalBonding > 0 ? (row.bonding / totalBonding * 100).toFixed(2) : '0.00',
            'Adjusted Requirement':   row.adjusted,
            'Forecast (T+3)':         row.forecastT3,
            'Excel Model Indent':     row.dWeightIndent.toFixed(2),
            'ML Allocated Requirement': row.mlAdjusted !== undefined ? row.mlAdjusted.toFixed(2) : '',
            'ML Predicted Maturity':  row.mlMaturity !== undefined ? row.mlMaturity.toFixed(4) : '',
            'ML Wind-Down Mode':      row.mlCapped ? 'YES' : '',
            'ML Recommended Indent':  row.indentToRaise.toFixed(2),
            'Band Low':               row.bandLow ?? '',
            'Band High':              row.bandHigh ?? '',
            'Band Status':            row.bandStatus ?? '',
        }));
        exportToCsv(dataToExport, `${calculationName.replace(/\s+/g, '_')}_recommendations`);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList size={20} /> Recommended Indents
                </h2>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition-colors"
                    aria-label="Export results to CSV"
                >
                    <Download size={16} /> Export
                </button>
            </div>

            {/* ML layer banner */}
            {hasMl && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-4 py-2.5 rounded-lg border text-sm bg-indigo-50 border-indigo-200">
                    <span className="font-semibold text-indigo-800 flex items-center gap-1.5">
                        <Sparkles size={15} /> Smart recommendation
                    </span>
                    <span className="text-slate-500 text-xs">
                        Each centre's order = its share of today's requirement ÷ its predicted delivery rate
                        (learned from 4 seasons: season phase, farm &amp; festival calendar, recent trend).
                        Hover any value to see why. The classical Excel figure stays alongside for comparison.
                    </span>
                    {mlWeightedMaturity !== undefined && (
                        <span className="text-indigo-700 font-medium text-xs whitespace-nowrap">
                            Expected delivery rate today: {(mlWeightedMaturity * 100).toFixed(1)}%
                        </span>
                    )}
                    {windDownCount > 0 && (
                        <span className="text-amber-700 font-medium text-xs whitespace-nowrap">
                            🌙 Season wind-down: following your latest placements ({windDownCount} centres)
                        </span>
                    )}
                </div>
            )}

            {/* v2 feedback loop banner */}
            {feedbackOn && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-4 py-2.5 rounded-lg border text-sm bg-emerald-50 border-emerald-200">
                    <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                        <Users size={15} /> Your input
                    </span>
                    <span className="text-slate-500 text-xs">
                        Fill in <strong>Your Number</strong> only for centres you would order differently —
                        blank means you agree with the app. Where the gap is more than 10% we ask why, because
                        the reason is what teaches the model something it cannot see in the cane data.
                    </span>
                    <span className="text-emerald-700 font-medium text-xs whitespace-nowrap">
                        {enteredCount === 0
                            ? 'No changes entered'
                            : `${enteredCount} centre${enteredCount === 1 ? '' : 's'} changed`}
                    </span>
                    {loadError && (
                        <span className="text-amber-700 font-medium text-xs">
                            Input unavailable: {loadError}. The recommendation above is unaffected.
                        </span>
                    )}
                </div>
            )}

            {/* Season phase banner — historical band context (reference only) */}
            {hasBands && phaseStyle && (
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-4 py-2 rounded-lg border text-sm ${phaseStyle.bg}`}>
                    <span className={`font-semibold ${phaseStyle.text}`}>
                        {phaseStyle.label}
                        {weekOfSeason !== undefined && <span className="font-normal ml-1">(Week {weekOfSeason})</span>}
                    </span>
                    {overallBandLo !== undefined && (
                        <>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500 text-xs">Historical mill band (reference):</span>
                            <span className="text-slate-600">{overallBandLo.toLocaleString()} – {overallBandHigh?.toLocaleString()} qtl</span>
                            <span className="text-slate-600">(typical {overallBandMid?.toLocaleString()})</span>
                            <span className={`font-medium ${
                                overallStatus === 'within' ? 'text-green-700' :
                                overallStatus === 'above'  ? 'text-amber-700' : 'text-slate-600'
                            }`}>
                                — today's total {totalIndentToRaise.toLocaleString(undefined, { maximumFractionDigits: 0 })} qtl is {overallStatus} range
                            </span>
                        </>
                    )}
                </div>
            )}

            <div className="overflow-auto max-h-[600px] border rounded-lg custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-20">
                        <tr>
                            <th scope="col" className="px-6 py-3 rounded-tl-lg bg-slate-100">Centre</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100" title="Cane promised on paper by this centre's farmers for the season">Actual Bonding (Qtls)</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100" title="This centre's share of total bonding">Bonding %</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100" title="Classical requirement: today's run rate split by bonding share, plus the yard stock correction">Adjusted</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100" title="Cane already on its way for T+3 from the last three days' orders (their late-arriving portions)">Forecast (T+3)</th>
                            {hasBands && <th scope="col" className="px-4 py-3 text-right bg-slate-100 text-slate-400 text-xs font-normal" title="Historical range for this centre in this season week — reference only, does not change the numbers">Band Low</th>}
                            {hasBands && <th scope="col" className="px-4 py-3 text-right bg-slate-100 text-slate-400 text-xs font-normal" title="Historical range for this centre in this season week — reference only, does not change the numbers">Band High</th>}
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100" title="The classical spreadsheet formula reproduced exactly: computed per centre WITHOUT the centre mapping (as Excel does), then summed for merged rows like GATE">Excel Model</th>
                            <th scope="col"
                                className={`px-6 py-3 text-right bg-[#eef2ff] text-[#312e81] font-bold z-20 ${feedbackOn ? 'sticky right-[180px] shadow-none' : 'sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]'}`}
                                title="Recommended order: centre requirement (by real 14-day throughput share) ÷ predicted delivery rate. Hover a value for its breakdown.">
                                ML Recommended
                            </th>
                            {feedbackOn && (
                                <th scope="col"
                                    className="px-4 py-3 text-right bg-emerald-50 text-emerald-900 font-bold sticky right-0 z-20 w-[180px] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]"
                                    title="What you would order. Leave blank where you agree with the app — blank means agreement. Enter a number only for centres you would order differently.">
                                    Your Number
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row) => {
                            const bondingPercentage = totalBonding > 0 ? (row.bonding / totalBonding) * 100 : 0;
                            const badge = row.bandStatus ? STATUS_BADGE[row.bandStatus] : null;
                            return (
                                <tr key={row.centreId} className="bg-white border-b hover:bg-slate-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                        {row.centreName} <span className="text-slate-400">({row.centreId})</span>
                                    </th>
                                    <td className="px-6 py-4 text-right">{row.bonding.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-600 italic">{bondingPercentage.toFixed(2)}%</td>
                                    <td className="px-6 py-4 text-right">{row.adjusted.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">{row.forecastT3.toLocaleString()}</td>
                                    {hasBands && (
                                        <td className="px-4 py-4 text-right text-slate-400 text-xs">
                                            {row.bandLow !== undefined ? row.bandLow.toLocaleString() : '—'}
                                        </td>
                                    )}
                                    {hasBands && (
                                        <td className="px-4 py-4 text-right text-slate-400 text-xs">
                                            {row.bandHigh !== undefined ? row.bandHigh.toLocaleString() : '—'}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right text-slate-600">
                                        {row.dWeightIndent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td
                                        className={`px-6 py-4 text-right font-bold text-lg text-[#312e81] bg-[#eef2ff] z-10 ${feedbackOn ? 'sticky right-[180px]' : 'sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]'}`}
                                        title={row.mlMaturity !== undefined
                                            ? `Expected delivery rate: ${(row.mlMaturity * 100).toFixed(1)}% of what is ordered`
                                              + (row.mlAdjusted !== undefined ? ` | Centre requirement (14-day throughput share): ${row.mlAdjusted.toFixed(0)} qtl` : '')
                                              + (row.mlCapped ? ' | 🌙 Season wind-down: following your latest placement for this centre' : '')
                                            : undefined}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            {badge && (
                                                <span title={badge.label} className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${badge.dot}`}></span>
                                            )}
                                            {row.indentToRaise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </td>
                                    {feedbackOn && (
                                        <td className="px-4 py-4 bg-emerald-50 sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                            <PlantInputCell
                                                centreId={row.centreId}
                                                appIndent={row.indentToRaise}
                                                value={plant[row.centreId]?.value ?? null}
                                                reasonCode={plant[row.centreId]?.reasonCode ?? null}
                                                reasonNote={plant[row.centreId]?.reasonNote ?? null}
                                                reasonCodes={reasonCodes}
                                                saveState={saveStates[row.centreId] ?? 'idle'}
                                                disabled={!ledgerReady}
                                                onChange={handlePlantChange}
                                            />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="font-bold text-slate-800 bg-slate-100 sticky bottom-0 z-20">
                        <tr>
                            <td className="px-6 py-4 text-left rounded-bl-lg bg-slate-100">TOTALS</td>
                            <td className="px-6 py-4 text-right bg-slate-100">{totalBonding.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right bg-slate-100">100.00%</td>
                            <td colSpan={hasBands ? 4 : 2} className="px-6 py-4 bg-slate-100"></td>
                            <td className="px-6 py-4 text-right bg-slate-100 text-slate-600">
                                {totalExcelIndent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`px-6 py-4 text-right bg-[#eef2ff] text-[#312e81] text-lg z-20 ${feedbackOn ? 'sticky right-[180px]' : 'sticky right-0 rounded-br-lg shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]'}`}>
                                {totalIndentToRaise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {feedbackOn && (
                                <td className="px-4 py-4 text-right bg-emerald-50 text-emerald-900 text-lg rounded-br-lg sticky right-0 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]"
                                    title="Your total: your own numbers where entered, the app's where left blank">
                                    {totalPlant.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                            )}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
