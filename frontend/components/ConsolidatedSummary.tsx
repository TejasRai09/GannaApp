
import React, { useMemo, useState, useEffect } from 'react';
import type { CalculationRun, StoredData, Indent, Purchase, Bonding } from '../types';
import { TrendChart } from './TrendChart';
import { parseDate, addDays, daysBetween, isSameDay, formatDateGB } from '../services/dateUtils';
import { Loader2, TrendingUp, ClipboardCheck, Lightbulb, BarChart3, Target, Activity, Search, Waves, AlertCircle, AlertTriangle, Clock, Filter, PieChart } from 'lucide-react';
import { InfoIcon } from './InfoIcon';

interface ConsolidatedSummaryProps {
    indentData: StoredData<Indent> | null;
    purchaseData: StoredData<Purchase> | null;
    bondingData: StoredData<Bonding> | null;
    calculationHistory: CalculationRun[];
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
    /** The organisation's configured season start, YYYY-MM-DD. Used when a saved
     *  calculation has none of its own, instead of guessing at 1 October. */
    orgSeasonStartDate?: string | null;
    /** Days between placing an indent and its delivery day. Configured per org. */
    deliveryLagDays?: number;
}

// Helper to safely find values in loose CSV data (handles 'Code ', 'code', 'Center Name', etc.)
const getValue = (row: any, possibleKeys: string[]): string => {
    if (!row) return '';
    const keys = Object.keys(row);
    const normalizedKeysMap = keys.reduce((acc, k) => {
        acc[k.toLowerCase().trim()] = k;
        return acc;
    }, {} as Record<string, string>);

    for (const key of possibleKeys) {
        const foundKey = normalizedKeysMap[key.toLowerCase().trim()];
        if (foundKey) return row[foundKey];
    }
    return '';
};

const KPICard: React.FC<{
    title: string;
    value: string;
    subtext: string;
    tooltip: string;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, subtext, tooltip, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-md border hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
            <InfoIcon text={tooltip} widthClass="w-48" />
        </div>
        <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{subtext}</p>
        </div>
    </div>
);

const RangeSelector: React.FC<{
    current: string;
    options: string[];
    onChange: (val: string) => void;
    extraAction?: React.ReactNode;
}> = ({ current, options, onChange, extraAction }) => (
    <div className="flex items-center gap-2">
        {extraAction}
        <div className="flex bg-slate-100 rounded-lg p-1">
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        current === opt 
                        ? 'bg-white text-slate-800 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
);

const ChartCard: React.FC<{
    title: string;
    subtitle: string;
    tooltip: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerAction?: React.ReactNode;
}> = ({ title, subtitle, tooltip, icon, children, className = "", headerAction }) => (
    <div className={`bg-white p-5 rounded-xl shadow-md border flex flex-col h-[350px] ${className}`}>
        <div className="flex justify-between items-start mb-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="text-slate-400">{icon}</div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {title}
                    </h3>
                    <InfoIcon text={tooltip} />
                </div>
                <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            {headerAction}
        </div>
        <div className="flex-1 min-h-0 w-full">
            {children}
        </div>
    </div>
);

/**
 * Whole number, or an em-dash when there is no number to show.
 *
 * Math.round(NaN).toLocaleString() renders the literal string "NaN", which is
 * how this dashboard came to show NaN in four places at once. A dash says
 * "nothing to show here" honestly; "NaN" says the app is broken.
 */
const fmtInt = (v: unknown): string =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString() : '—';

/** Percentage with a sign, or an em-dash. */
const fmtPct = (v: unknown, dp = 2): string =>
    typeof v === 'number' && Number.isFinite(v)
        ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(dp)}%`
        : '—';

const ActionCard: React.FC<{ title: string; value: number }> = ({ title, value }) => (
    <div className="flex-1 bg-slate-50 p-3 rounded-lg border text-center">
        <p className="text-xs text-slate-500 font-semibold uppercase">{title}</p>
        <p className="text-xl font-bold text-[#003580] my-1">{fmtInt(value)}</p>
        <p className="text-[10px] text-slate-400">Qtls to order</p>
    </div>
);

const SectionHeader: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <div className="text-[#003580]">{icon}</div>
        <h3 className="font-bold text-slate-800">{title}</h3>
    </div>
);

export const ConsolidatedSummary: React.FC<ConsolidatedSummaryProps> = (props) => {
    const { indentData, purchaseData, bondingData, calculationHistory, seasonTotalDays, seasonalCrushingCapacity, orgSeasonStartDate } = props;
    const deliveryLagDays = props.deliveryLagDays ?? 3;
    
    // Global Scope State
    const [selectedScope, setSelectedScope] = useState('all');

    // View State
    const [dailyTarget, setDailyTarget] = useState(100000);
    const [rhythmRange, setRhythmRange] = useState('30D');
    const [pipelineRange, setPipelineRange] = useState('7D');
    const [behaviorRange, setBehaviorRange] = useState('Season');
    const [isBehaviorSmoothed, setIsBehaviorSmoothed] = useState(true);

    const availableCenters = useMemo(() => {
        if (!bondingData?.data) return [];
        return bondingData.data
            .map(b => ({ 
                id: getValue(b, ['Code']).trim(), 
                name: getValue(b, ['Center', 'Center Name']).trim() || getValue(b, ['Code']) 
            }))
            .filter(c => c.id) // Filter out empty rows
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [bondingData]);

    const { 
        latestCalculation, 
        snapshotData, 
        supplyRhythmData, 
        pipelineConfidenceData, 
        fieldBehaviorData, 
        breakdownDataMaps,
        seasonStats,
        performanceTableData,
        unifiedLifecycleData,
        scopeMetrics
    } = useMemo(() => {
        if (!purchaseData?.data || !indentData?.data || !bondingData?.data || calculationHistory.length === 0) {
            return { 
                latestCalculation: null, snapshotData: null, supplyRhythmData: [], 
                pipelineConfidenceData: [], fieldBehaviorData: [], breakdownDataMaps: {},
                seasonStats: null, performanceTableData: [], unifiedLifecycleData: [], scopeMetrics: null
            };
        }

        const latestCalc = calculationHistory[0];
        // null and '' must fall through to the fallback. new Date(null) is the
        // EPOCH, not an invalid date, so an isNaN check alone lets 1970 past —
        // which is how an unset season start silently became 01/01/1970 and put
        // every calculation into late-season wind-down mode.
        const safeDate = (val: any, fallback: Date) => {
            if (val === null || val === undefined || val === '') return fallback;
            const d = val instanceof Date ? val : new Date(val);
            if (isNaN(d.getTime())) return fallback;
            // Nothing in this app predates the app. A date this old means a
            // parse fell through to the epoch somewhere upstream.
            if (d.getFullYear() < 2000) return fallback;
            return d;
        };
        const currentDate = safeDate(latestCalc.inputs.currentDate, new Date());
        // Fall back to the organisation's configured season start before
        // guessing. Guessing at 1 October is how this screen reported "Start:
        // 01/10/2026" when the real season begins on the 30th.
        const orgStart = orgSeasonStartDate ? new Date(orgSeasonStartDate) : null;
        const seasonFallback = orgStart && !isNaN(orgStart.getTime()) && orgStart.getFullYear() >= 2000
            ? orgStart
            : new Date(new Date().getFullYear(), 9, 1);
        const plantStartDate = safeDate(parseDate(latestCalc.inputs.plantStartDate), seasonFallback);
        
        if (latestCalc.results.effectiveRequirement) {
            setDailyTarget(Math.round(latestCalc.results.effectiveRequirement));
        }

        // --- 1. Scoped Metric Calculations ---
        
        let effectiveRequirement = latestCalc.results.effectiveRequirement;
        let forecastT3 = latestCalc.results.totalForecastT3;
        let overrunPercentage = latestCalc.results.overrunPercentage;
        
        if (selectedScope !== 'all') {
            const centerCalcRow = latestCalc.results.indentCalculationBreakdown.find(r => r.centreId === selectedScope);
            if (centerCalcRow) {
                effectiveRequirement = centerCalcRow.requirementByBonding;
                forecastT3 = centerCalcRow.forecastT3;
            }
            
            const centerIndents = indentData.data
                .filter(i => getValue(i, ['Code']).trim() === selectedScope)
                .reduce((s, i) => s + (parseFloat(getValue(i, ['Qty in Qtls', 'Qty']))||0), 0);
            
            const centerPurchases = purchaseData.data
                .filter(p => getValue(p, ['Code']).trim() === selectedScope)
                .reduce((s, p) => s + (parseFloat(getValue(p, ['Qty in Qtls', 'Qty']))||0), 0);
            
            overrunPercentage = centerIndents > 0 ? (centerPurchases / centerIndents) - 1 : 0;
        }

        /**
         * Delivery rate over SETTLED indent days only.
         *
         * overrunPercentage compares every indent ever placed against every
         * purchase received, which includes indent dates that have not happened
         * yet. Cane cannot have arrived against a future order, so that figure
         * is structurally terrible: it read -43% while the mill was actually
         * running at 89%. It is left untouched because the Excel comparison
         * column divides by it; this is the honest number to SHOW.
         *
         * An indent day is settled once cane has had its full four-day arrival
         * window (D1 to D4) to come in.
         */
        const settledDelivery = (() => {
            const inScope = (row: any) =>
                selectedScope === 'all' || getValue(row, ['Code']).trim() === selectedScope;

            let latestArrival: Date | null = null;
            for (const row of purchaseData.data) {
                const d = parseDate(getValue(row, ['Purchase Date']));
                if (d && (!latestArrival || d > latestArrival)) latestArrival = d;
            }
            if (!latestArrival) return null;
            // Fully settled means the whole D1..D4 window has passed.
            const cutoff = addDays(latestArrival, -3);

            let ordered = 0, arrived = 0;
            for (const row of indentData.data) {
                if (!inScope(row)) continue;
                const d = parseDate(getValue(row, ['Indent Date']));
                if (d && d <= cutoff) ordered += parseFloat(getValue(row, ['Qty in Qtls', 'Qty'])) || 0;
            }
            for (const row of purchaseData.data) {
                if (!inScope(row)) continue;
                const d = parseDate(getValue(row, ['Indent Date']));
                if (d && d <= cutoff) arrived += parseFloat(getValue(row, ['Qty in Qtls', 'Qty'])) || 0;
            }
            if (ordered <= 0) return null;
            return { rate: arrived / ordered, ordered, arrived, cutoff };
        })();

        const scopeMetrics = {
            effectiveRequirement,
            forecastT3,
            overrunPercentage,
            settledDelivery
        };


        // --- 2. Season Stats Calculation (Scoped) ---
        const daysLapsed = Math.max(1, daysBetween(plantStartDate, currentDate));
        
        // Filter Purchases for Scope
        const filteredPurchases = purchaseData.data.filter(p => selectedScope === 'all' || getValue(p, ['Code']).trim() === selectedScope);
        
        const totalSeasonPurchases = filteredPurchases.reduce((sum, p) => {
            const d = parseDate(getValue(p, ['Purchase Date']));
            // Robust check: ensure dates are valid
            if (d && d >= plantStartDate && d <= currentDate) {
                return sum + (parseFloat(getValue(p, ['Qty in Qtls', 'Qty'])) || 0);
            }
            return sum;
        }, 0);

        const globalSeasonPurchases = purchaseData.data.reduce((sum, p) => {
             const d = parseDate(getValue(p, ['Purchase Date']));
             if (d && d >= plantStartDate && d <= currentDate) return sum + (parseFloat(getValue(p, ['Qty in Qtls', 'Qty'])) || 0);
             return sum;
        }, 0);
        
        const centerBonding = bondingData.data.find(b => getValue(b, ['Code']).trim() === selectedScope);
        const centerBondingQty = centerBonding ? parseFloat(getValue(centerBonding, ['Bonding'])) : 0;

        const cumulativeRunRate = totalSeasonPurchases / daysLapsed;

        /**
         * Cane received per day over the last seven days with data.
         *
         * The cumulative average is still needed below, to work out what is
         * left to crush, but it is a poor description of how the mill is
         * running now: it carries the whole ramp-up forever. It read 66,350
         * while the mill was actually taking around 90,000 a day, and it would
         * have taken weeks to catch up. The recent rate is what anyone looking
         * at this screen actually wants to know.
         */
        const recentRunRate = (() => {
            let latest: Date | null = null;
            for (const row of purchaseData.data) {
                if (selectedScope !== 'all' && getValue(row, ['Code']).trim() !== selectedScope) continue;
                const d = parseDate(getValue(row, ['Purchase Date']));
                if (d && (!latest || d > latest)) latest = d;
            }
            if (!latest) return null;
            const from = addDays(latest, -6);   // seven days inclusive
            let qty = 0;
            for (const row of purchaseData.data) {
                if (selectedScope !== 'all' && getValue(row, ['Code']).trim() !== selectedScope) continue;
                const d = parseDate(getValue(row, ['Purchase Date']));
                if (d && d >= from && d <= latest) {
                    qty += parseFloat(getValue(row, ['Qty in Qtls', 'Qty'])) || 0;
                }
            }
            // Early in the season there may be fewer than seven days of data.
            const days = Math.max(1, Math.min(7, daysBetween(plantStartDate, latest) + 1));
            return { rate: qty / days, days, latest };
        })();

        const remainingDays = Math.max(1, seasonTotalDays - daysLapsed);
        const remainingQtyNeeded = Math.max(0, seasonalCrushingCapacity - totalSeasonPurchases);
        const netRequiredRunRate = remainingQtyNeeded / remainingDays;

        const seasonStats = {
            currentDate,
            plantStartDate,
            daysLapsed,
            totalDays: seasonTotalDays,
            cumulativeRunRate,
            recentRunRate,
            netRequiredRunRate,
            totalSeasonPurchases,
            globalSeasonPurchases, 
            centerBondingQty
        };

        // --- 3. Performance Table Data (Last 5 Days) - Scoped ---
        // This table compares the app's indent with the plant team's indent for
        // the same delivery day. Both exist as soon as the order is placed, so
        // there is no reason to stop at yesterday: the indent file already holds
        // the plant team's orders up to three days ahead (placed on the 22nd
        // for delivery on the 25th). Anchor on the last delivery day the file
        // reaches, never past the day the current run itself is for.
        let lastIndentDay: Date | null = null;
        for (const row of indentData.data) {
            const d = parseDate(getValue(row, ['Indent Date']));
            if (d && (!lastIndentDay || d > lastIndentDay)) lastIndentDay = d;
        }
        const runDeliveryDay = addDays(currentDate, deliveryLagDays);
        const performanceAnchor = lastIndentDay
            ? (lastIndentDay > runDeliveryDay ? runDeliveryDay : lastIndentDay)
            : addDays(currentDate, -1);
        // Cane received up to a day is only known while the purchase file
        // reaches that day.
        let lastPurchaseDay: Date | null = null;
        for (const row of purchaseData.data) {
            const d = parseDate(getValue(row, ['Purchase Date']));
            if (d && (!lastPurchaseDay || d > lastPurchaseDay)) lastPurchaseDay = d;
        }

        const performanceTableData = [];
        for (let i = 0; i < 5; i++) {
            const date = addDays(performanceAnchor, -i);
            
            // A run made on day X recommends for delivery on X + the lag, so the
            // run that predicted THIS row is the one made `lag` days earlier.
            // Matching run-day straight against delivery-day compared the
            // recommendation written on the 15th with the indent placed for the
            // 15th — two different days' decisions.
            const historyRun = calculationHistory.find(run => {
                const runDate = new Date(run.inputs.currentDate);
                if (isNaN(runDate.getTime())) return false;
                return isSameDay(addDays(runDate, deliveryLagDays), date);
            });
            
            const actualIndent = indentData.data
                .filter(item => selectedScope === 'all' || getValue(item, ['Code']).trim() === selectedScope)
                .reduce((sum, item) => {
                    const d = parseDate(getValue(item, ['Indent Date']));
                    return (d && isSameDay(d, date)) ? sum + (parseFloat(getValue(item, ['Qty in Qtls', 'Qty'])) || 0) : sum;
                }, 0);

            const purchasesUpToDate = purchaseData.data
                .filter(item => selectedScope === 'all' || getValue(item, ['Code']).trim() === selectedScope)
                .reduce((sum, item) => {
                    const d = parseDate(getValue(item, ['Purchase Date']));
                    return (d && d >= plantStartDate && d <= date) ? sum + (parseFloat(getValue(item, ['Qty in Qtls', 'Qty'])) || 0) : sum;
                }, 0);
            
            const daysLapsedAtDate = Math.max(1, daysBetween(plantStartDate, date));
            const dailyCumulRate = purchasesUpToDate / daysLapsedAtDate;

            let historicTarget = 0;
            let predictedIndent = 0;

            if (selectedScope === 'all') {
                historicTarget = historyRun ? historyRun.inputs.totalDailyRequirement : dailyTarget;
                // Prefer the total stored with the run. The history list omits
                // results_json because results are megabytes each, so tableData
                // is empty for every run except the one currently open — which
                // left this whole column showing a dash.
                predictedIndent = historyRun
                    ? (historyRun.totalIndent
                        ?? historyRun.results.tableData.reduce((s, r) => s + r.indentToRaise, 0))
                    : 0;
            } else {
                if (historyRun) {
                    const centerRow = historyRun.results.tableData.find(r => r.centreId === selectedScope);
                    const breakdownRow = historyRun.results.indentCalculationBreakdown?.find(r => r.centreId === selectedScope);
                    
                    historicTarget = breakdownRow ? breakdownRow.requirementByBonding : (centerRow?.adjusted || 0);
                    predictedIndent = centerRow ? centerRow.indentToRaise : 0;
                }
            }

            // Variance needs BOTH sides. An unknown actual is not a zero actual:
            // treating it as one produced a confident -100.0%, which reads as
            // "we ordered nothing" when the truth is "the order is not in the
            // uploaded file yet".
            const variance = (predictedIndent > 0 && actualIndent > 0)
                ? (actualIndent - predictedIndent) / predictedIndent
                : null;

            performanceTableData.push({
                date,
                target: historicTarget,
                predicted: historyRun ? predictedIndent : null,
                actual: actualIndent,
                variance,
                cumulativeRate: lastPurchaseDay && date <= lastPurchaseDay ? dailyCumulRate : null
            });
        }

        // --- 4. Unified Indent Lifecycle (T-3 to T+3) - Scoped ---
        const unifiedLifecycleData = [];
        const openIndentMatrix = latestCalc.results.openIndentMatrix;

        const aggregatedMatrix = new Map<string, {
            indentDate: Date,
            indentQty: number,
            arrivedQty: number,
            d1: { qty: number, type: 'Actual' | 'Forecast' },
            d2: { qty: number, type: 'Actual' | 'Forecast' },
            d3: { qty: number, type: 'Actual' | 'Forecast' },
            d4: { qty: number, type: 'Actual' | 'Forecast' }
        }>();

        openIndentMatrix.forEach(centerData => {
            if (selectedScope !== 'all' && centerData.centreId !== selectedScope) return;

            centerData.data.forEach(row => {
                // A run reloaded from the database has been through JSON, so
                // every date in it is a STRING, not a Date. Calling
                // toISOString() on it throws and takes the whole page down.
                // Live, in-memory runs still carry real Dates, so this has to
                // cope with both.
                const indentDate = row.indentDate instanceof Date
                    ? row.indentDate
                    : new Date(row.indentDate as any);
                if (isNaN(indentDate.getTime())) return;

                const key = indentDate.toISOString();
                if (!aggregatedMatrix.has(key)) {
                    aggregatedMatrix.set(key, {
                        indentDate,
                        indentQty: 0,
                        arrivedQty: 0,
                        d1: { qty: 0, type: 'Actual' },
                        d2: { qty: 0, type: 'Actual' },
                        d3: { qty: 0, type: 'Actual' },
                        d4: { qty: 0, type: 'Actual' }
                    });
                }
                const aggRow = aggregatedMatrix.get(key)!;
                aggRow.indentQty += row.indentQty;

                row.entries.forEach(entry => {
                    const dayDiff = Math.round((new Date(entry.purchaseDate).getTime() - indentDate.getTime()) / (1000 * 3600 * 24));
                    
                    if (entry.type === 'Actual') {
                        aggRow.arrivedQty += entry.quantity;
                    }

                    if (dayDiff <= 0) {
                        aggRow.d1.qty += entry.quantity;
                        aggRow.d1.type = entry.type;
                    } else if (dayDiff === 1) {
                        aggRow.d2.qty += entry.quantity;
                        aggRow.d2.type = entry.type;
                    } else if (dayDiff === 2) {
                        aggRow.d3.qty += entry.quantity;
                        aggRow.d3.type = entry.type;
                    } else if (dayDiff >= 3) {
                        aggRow.d4.qty += entry.quantity;
                        aggRow.d4.type = entry.type;
                    }
                });
            });
        });

        for (let i = -3; i <= 3; i++) {
            const loopDate = addDays(currentDate, i);
            const issueDate = addDays(loopDate, -deliveryLagDays);
            const isForecastRow = i === 3;
            
            let status: 'Fully Open' | 'Partially Open' | 'Closed' | 'Recommendation' = 'Partially Open';
            if (isForecastRow) status = 'Recommendation';
            else if (loopDate >= currentDate) status = 'Fully Open'; 
            else if (i < 0) status = 'Partially Open'; 

            const aggRow = aggregatedMatrix.get(loopDate.toISOString());

            let indentQty = aggRow ? aggRow.indentQty : 0;
            if (indentQty === 0 && !isForecastRow) {
                 indentQty = indentData.data
                    .filter(item => selectedScope === 'all' || getValue(item, ['Code']).trim() === selectedScope)
                    .reduce((sum, item) => {
                        const d = parseDate(getValue(item, ['Indent Date']));
                        return (d && isSameDay(d, loopDate)) ? sum + (parseFloat(getValue(item, ['Qty in Qtls', 'Qty'])) || 0) : sum;
                    }, 0);
            }

            const arrivedQty = aggRow ? aggRow.arrivedQty : 0;

            // A day with no row in the saved matrix has no arrival breakdown at
            // all — the indent for it had not been placed when the calculation
            // ran. Four zeros claim the opposite: that the order exists and
            // nothing is expected against it. Mark it unknown instead, and the
            // table prints a dash.
            const distribution = aggRow ? {
                d1: aggRow.d1, d2: aggRow.d2, d3: aggRow.d3, d4: aggRow.d4
            } : {
                d1: { qty: null, type: 'Unknown' }, d2: { qty: null, type: 'Unknown' },
                d3: { qty: null, type: 'Unknown' }, d4: { qty: null, type: 'Unknown' },
            };
            const knownFromRun = Boolean(aggRow);

            unifiedLifecycleData.push({
                knownFromRun,
                indentDate: loopDate, issueDate, status, indentQty, arrivedQty, distribution
            });
        }


        // --- Chart Data Preparation (Scoped & Robust) ---
        const seasonStartDate = seasonStats.plantStartDate;
        const fetchStartDate = seasonStartDate; 
        
        const rawCenterMapping = latestCalc.inputs.centerMapping || {};
        const centerMapping: { [key: string]: string } = {};
        for(const key in rawCenterMapping) centerMapping[key.trim()] = rawCenterMapping[key].trim();
        
        const originalGateCenterCodes = bondingData.data
            .filter(b => {
                const name = getValue(b, ['Center', 'Center Name']);
                return name.toUpperCase().includes('GATE');
            })
            .map(b => getValue(b, ['Code']).trim());
            
        const mappedGateCenterCodes = new Set(originalGateCenterCodes.map(originalCode => centerMapping[originalCode] || originalCode));

        const relevantRecommendations = latestCalc.results.tableData.filter(r => selectedScope === 'all' || r.centreId === selectedScope);
        const gateIndent = relevantRecommendations.filter(r => mappedGateCenterCodes.has(r.centreId)).reduce((sum, r) => sum + r.indentToRaise, 0);
        const centerIndent = relevantRecommendations.filter(r => !mappedGateCenterCodes.has(r.centreId)).reduce((sum, r) => sum + r.indentToRaise, 0);
        
        const snapshotData = { actions: { gateIndent, centerIndent } };

        const purchaseBreakdown = new Map<string, any[]>();
        const overrunBreakdown = new Map<string, any[]>();
        const dailyStats = new Map<string, { date: string; purchase: number; indent: number; forecast: number }>();

        indentData.data.forEach(i => {
            const code = getValue(i, ['Code']).trim();
            if (selectedScope !== 'all' && code !== selectedScope) return;
            
            const date = parseDate(getValue(i, ['Indent Date']));
            if (date && date >= fetchStartDate && date <= currentDate) {
                const key = date.toISOString().split('T')[0];
                if (!dailyStats.has(key)) dailyStats.set(key, { date: key, purchase: 0, indent: 0, forecast: 0 });
                dailyStats.get(key)!.indent += (parseFloat(getValue(i, ['Qty in Qtls', 'Qty'])) || 0);
            }
        });

        purchaseData.data.forEach(p => {
            const code = getValue(p, ['Code']).trim();
            if (selectedScope !== 'all' && code !== selectedScope) return;
            
            const date = parseDate(getValue(p, ['Purchase Date']));
            if (date && date >= fetchStartDate && date <= currentDate) {
                const key = date.toISOString().split('T')[0];
                if (!dailyStats.has(key)) dailyStats.set(key, { date: key, purchase: 0, indent: 0, forecast: 0 });
                const qty = parseFloat(getValue(p, ['Qty in Qtls', 'Qty'])) || 0;
                dailyStats.get(key)!.purchase += qty;
                if (!purchaseBreakdown.has(key)) purchaseBreakdown.set(key, []);
                purchaseBreakdown.get(key)!.push({ center: code, name: getValue(p, ['Center Name']), purchases: qty });
            }
        });

        const sortedKeys = Array.from(dailyStats.keys()).sort();
        const supplyRhythmData = sortedKeys.map(key => dailyStats.get(key)!);

        // --- Pipeline Confidence Logic (Scoped) ---
        const allDates = new Set<string>();
        indentData.data.forEach(item => {
            const d = parseDate(getValue(item, ['Indent Date']));
            if (d && d >= seasonStartDate) allDates.add(d.toISOString().split('T')[0]);
        });
        calculationHistory.forEach(run => {
            const runDate = new Date(run.inputs.currentDate);
            if (runDate >= seasonStartDate) {
                const targetDate = addDays(runDate, 3);
                allDates.add(targetDate.toISOString().split('T')[0]);
            }
        });

        const sortedPipelineKeys = Array.from(allDates).sort();

        const pipelineConfidenceRaw = sortedPipelineKeys.map(dateKey => {
            const targetDate = new Date(dateKey + 'T00:00:00.000Z');
            
            const actualIndent = indentData.data
                .filter(item => selectedScope === 'all' || getValue(item, ['Code']).trim() === selectedScope)
                .reduce((sum, item) => {
                    const d = parseDate(getValue(item, ['Indent Date']));
                    return (d && isSameDay(d, targetDate)) ? sum + (parseFloat(getValue(item, ['Qty in Qtls', 'Qty'])) || 0) : sum;
                }, 0);

            const calculationDate = addDays(targetDate, -3);
            const matchingRun = calculationHistory.find(run => 
                isSameDay(new Date(run.inputs.currentDate), calculationDate)
            );
            
            let systemRec = 0;
            if (matchingRun) {
                systemRec = matchingRun.results.tableData
                    .filter(r => selectedScope === 'all' || r.centreId === selectedScope)
                    .reduce((s, r) => s + r.indentToRaise, 0);
            }

            return {
                date: dateKey,
                system: systemRec,
                actual: actualIndent
            };
        });


        const fieldBehaviorData = sortedKeys.map(key => {
            const s = dailyStats.get(key)!;
            if (s.indent === 0) return null;
            const overrunPct = (s.purchase / s.indent * 100) - 100;
            return { date: key, overrun: overrunPct };
        }).filter(Boolean) as any[];

        // Breakdown Maps logic needs same robustness
        const centerDailyMap = new Map<string, Map<string, {indent: number, purchase: number, name: string}>>();
        indentData.data.forEach(i => {
            const code = getValue(i, ['Code']).trim();
            if (selectedScope !== 'all' && code !== selectedScope) return;
            const d = parseDate(getValue(i, ['Indent Date']));
            if(!d || d < fetchStartDate || d > currentDate) return;
            const k = d.toISOString().split('T')[0];
            if(!centerDailyMap.has(k)) centerDailyMap.set(k, new Map());
            
            const row = centerDailyMap.get(k)!.get(code) || { indent: 0, purchase: 0, name: getValue(i, ['Center Name']) };
            row.indent += parseFloat(getValue(i, ['Qty in Qtls', 'Qty'])) || 0;
            centerDailyMap.get(k)!.set(code, row);
        });
        purchaseData.data.forEach(p => {
            const code = getValue(p, ['Code']).trim();
            if (selectedScope !== 'all' && code !== selectedScope) return;
            const d = parseDate(getValue(p, ['Purchase Date']));
            if(!d || d < fetchStartDate || d > currentDate) return;
            const k = d.toISOString().split('T')[0];
            if(!centerDailyMap.has(k)) centerDailyMap.set(k, new Map());
            
            const row = centerDailyMap.get(k)!.get(code) || { indent: 0, purchase: 0, name: getValue(p, ['Center Name']) };
            row.purchase += parseFloat(getValue(p, ['Qty in Qtls', 'Qty'])) || 0;
            centerDailyMap.get(k)!.set(code, row);
        });
        centerDailyMap.forEach((centerMap, dateKey) => {
            const breakdown = Array.from(centerMap.entries()).map(([code, data]) => ({
                center: code, name: data.name, variance: data.purchase - data.indent
            }));
            overrunBreakdown.set(dateKey, breakdown);
        });

        return {
            latestCalculation: latestCalc,
            snapshotData,
            supplyRhythmData,
            pipelineConfidenceData: pipelineConfidenceRaw,
            fieldBehaviorData,
            breakdownDataMaps: { purchases: purchaseBreakdown, overrun: overrunBreakdown },
            seasonStats,
            performanceTableData,
            unifiedLifecycleData,
            scopeMetrics
        };
    }, [indentData, purchaseData, bondingData, calculationHistory, seasonTotalDays, seasonalCrushingCapacity, orgSeasonStartDate, deliveryLagDays, dailyTarget, selectedScope]);

    // --- Filter Logic ---
    const filterDataByRange = (data: any[], range: string, currentDate: Date | undefined, seasonStart: Date | undefined, extendForwardDays: number = 0) => {
        if (!data || data.length === 0 || !currentDate) return [];
        
        let cutoffDate = new Date(currentDate);
        if (range === '7D') cutoffDate = addDays(currentDate, -7);
        else if (range === '15D') cutoffDate = addDays(currentDate, -15);
        else if (range === '30D') cutoffDate = addDays(currentDate, -30);
        else if (range === 'Season') {
            // Fallback Logic: If seasonStart is exactly today (default state) or undefined, 
            // show last 180 days to prevent empty charts for historical data.
            const isDefaultStart = !seasonStart || isSameDay(seasonStart, currentDate);
            if (isDefaultStart) {
                cutoffDate = addDays(currentDate, -180);
            } else {
                cutoffDate = seasonStart!;
            }
        } else {
            cutoffDate = addDays(currentDate, -30); 
        }

        const cutoffISO = cutoffDate.toISOString().split('T')[0];
        const maxDate = addDays(currentDate, extendForwardDays);
        const maxISO = maxDate.toISOString().split('T')[0];

        return data.filter(d => d.date >= cutoffISO && d.date <= maxISO);
    };

    const filteredRhythmData = useMemo(() => 
        filterDataByRange(supplyRhythmData, rhythmRange, seasonStats?.currentDate, seasonStats?.plantStartDate),
    [supplyRhythmData, rhythmRange, seasonStats]);

    const filteredPipelineData = useMemo(() => 
        filterDataByRange(pipelineConfidenceData, pipelineRange, seasonStats?.currentDate, seasonStats?.plantStartDate, 3),
    [pipelineConfidenceData, pipelineRange, seasonStats]);

    // Calculate Variance Insight
    const pipelineVarianceMetric = useMemo(() => {
        if (filteredPipelineData.length === 0) return null;
        let totalVarianceSum = 0;
        let count = 0;
        filteredPipelineData.forEach(d => {
            const sys = Number(d.system);
            const act = Number(d.actual);
            if (sys > 0 && act > 0) {
                totalVarianceSum += ((act - sys) / sys);
                count++;
            }
        });
        return count > 0 ? (totalVarianceSum / count) : 0;
    }, [filteredPipelineData]);

    const filteredBehaviorData = useMemo(() => {
        let data = filterDataByRange(fieldBehaviorData, behaviorRange, seasonStats?.currentDate, seasonStats?.plantStartDate);
        
        if (isBehaviorSmoothed && data.length > 0) {
            data = data.map((item, index, array) => {
                const start = Math.max(0, index - 2);
                const subset = array.slice(start, index + 1);
                const avg = subset.reduce((sum, curr) => sum + curr.overrun, 0) / subset.length;
                return { ...item, overrun: avg };
            });
        }
        return data;
    }, [fieldBehaviorData, behaviorRange, isBehaviorSmoothed, seasonStats]);


    /**
     * The run's detail arrives AFTER the data files do.
     *
     * The list endpoint omits results_json for speed, so a run reaches this
     * component with an empty results object and its detail is fetched a beat
     * later. Rendering during that gap drew a half-built dashboard: delivery
     * rate present, because it comes from the raw files, but recommendations
     * at zero and every run-derived metric blank. It looked broken, and the
     * numbers it showed were wrong rather than merely missing.
     *
     * So hold the whole panel until the run is actually here. A spinner is
     * honest; a zero is not.
     */
    const runStillLoading =
        calculationHistory.length > 0
        && ((calculationHistory[0].results?.tableData?.length ?? 0) === 0);

    // A spinner that never ends is worse than a wrong number, so give up after
    // a while and say so. Covers both a failed fetch and a run that genuinely
    // has no detail stored.
    const [loadTimedOut, setLoadTimedOut] = useState(false);
    useEffect(() => {
        if (!runStillLoading) { setLoadTimedOut(false); return; }
        const t = setTimeout(() => setLoadTimedOut(true), 20000);
        return () => clearTimeout(t);
    }, [runStillLoading, calculationHistory[0]?.id]);

    // A cleared file is not a missing file: { data: [] } passes every guard
    // above and then silently zeroes everything derived from it. Bonding was
    // wiped this morning and the only visible symptom was GATE INDENT 0.
    const emptyDatasets = [
        { label: 'Bonding', rows: bondingData?.data?.length ?? 0,
          effect: 'the gate cannot be identified and centre shares cannot be worked out' },
        { label: 'Indent', rows: indentData?.data?.length ?? 0,
          effect: 'no orders can be matched to deliveries' },
        { label: 'Purchase', rows: purchaseData?.data?.length ?? 0,
          effect: 'no arrivals or delivery rates can be measured' },
    ].filter(x => x.rows === 0);

    if (emptyDatasets.length > 0) {
        return (
            <div className="m-1 p-5 rounded-xl bg-red-50 border border-red-300 text-red-900">
                <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold">
                            {emptyDatasets.map(x => x.label).join(' and ')} data is missing
                        </p>
                        <p className="text-sm mt-1">
                            The file was cleared or never uploaded, so{' '}
                            {emptyDatasets.map(x => x.effect).join(', and ')}. Figures on this page
                            would read zero rather than be unavailable, so they are held back.
                        </p>
                        <p className="text-sm mt-2">
                            Upload it again under <strong>Manage Data</strong>, then run the
                            calculation.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (runStillLoading && loadTimedOut) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-md text-center">
                <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
                <h3 className="text-lg font-bold text-slate-800">Could not load the latest calculation</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                    The figures are saved and intact — this is a loading problem, not a data one.
                    Reload the page to try again.
                </p>
            </div>
        );
    }

    if (runStillLoading) {
        return (
            <div className="bg-white p-10 rounded-xl shadow-md text-center">
                <Loader2 size={26} className="mx-auto text-[#003580] mb-3 animate-spin" />
                <h3 className="text-lg font-bold text-slate-800">Loading the latest calculation…</h3>
                <p className="text-slate-500 text-sm mt-1">
                    Fetching {calculationHistory[0].name}.
                </p>
            </div>
        );
    }

    if (!latestCalculation || !snapshotData || !seasonStats || !scopeMetrics) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md text-center">
                <Lightbulb size={24} className="mx-auto text-yellow-500 mb-2"/>
                <h3 className="text-xl font-bold text-slate-800">Summary Not Available</h3>
                <p className="text-slate-500 mt-1">Run a new calculation to generate the consolidated dashboard.</p>
            </div>
        );
    }
    
    const progressPercent = (seasonStats.daysLapsed / seasonStats.totalDays) * 100;

    return (
        <div className="space-y-6">
            
            {/* Scope Filter Header */}
            <div className="flex justify-end items-center mb-2">
                <div className="flex items-center gap-3 bg-white p-1 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2 px-3 text-slate-600 font-semibold text-sm">
                        <Filter size={16} />
                        Scope:
                    </div>
                    <select
                        value={selectedScope}
                        onChange={(e) => setSelectedScope(e.target.value)}
                        className="bg-slate-50 border-none text-sm font-bold text-[#003580] focus:ring-0 cursor-pointer py-1.5 pl-2 pr-8 rounded-md"
                    >
                        <option value="all">Global Plant View</option>
                        {availableCenters.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* A calculation run before the season start was set came back as all
                zeros, because an empty start date parsed to the epoch and pushed
                every centre into late-season wind-down mode. Those runs are still
                in history, so say plainly that the figures below are stale rather
                than letting a page of dashes look like a fresh answer. */}
            {(() => {
                const day = seasonStats.daysLapsed;
                const stale = !Number.isFinite(day) || day < 0 || day > seasonStats.totalDays * 3;
                if (!stale) return null;
                return (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>
                            <strong>These figures are from an out-of-date calculation.</strong>{' '}
                            It was run before the season start date was set, so it has no valid
                            season to measure against and came back empty. Run the calculation
                            again to refresh the dashboard.
                        </span>
                    </div>
                );
            })()}

            {/* Everything below is read out of a SAVED run. If the source files
                were replaced after that run was made, the arrivals it recorded are
                whatever the old file happened to contain — and a day the old file
                barely covered shows as a confident zero rather than as "not known
                yet". That is indistinguishable from a real zero on screen, so the
                only honest thing is to say the run is behind the data. */}
            {(() => {
                const runAt = latestCalculation.timestamp;
                const uploads = [indentData, purchaseData, bondingData]
                    .map(f => (f?.lastUpdated ? new Date(f.lastUpdated).getTime() : NaN))
                    .filter(t => Number.isFinite(t) && t > 0);
                if (!uploads.length || !Number.isFinite(runAt) || runAt <= 0) return null;
                const newest = Math.max(...uploads);
                // A minute of slack: the upload and the run that follows it are
                // seconds apart and must not trip this.
                if (newest <= runAt + 60_000) return null;
                const when = (t: number) => {
                    const d = new Date(t);
                    return `${formatDateGB(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                };
                return (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>
                            <strong>The data files are newer than this calculation.</strong>{' '}
                            The files were updated on {when(newest)}, but these figures come from a
                            run made on {when(runAt)}. Cane recorded since then is not counted below,
                            so arrivals will read low. Run the calculation again to refresh it.
                        </span>
                    </div>
                );
            })()}

            {/* 1. Season Status Header (Context Aware) */}
            <div className={`text-white p-4 rounded-xl shadow-lg border ${selectedScope === 'all' ? 'bg-[#001f4c] border-[#003580]' : 'bg-[#003580] border-[#001f4c]'}`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    {/* Left: Progress */}
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-end mb-1 text-sm text-blue-200">
                            <span>Season Progress</span>
                            <span className="font-mono text-white">Day {seasonStats.daysLapsed} / {seasonStats.totalDays}</span>
                        </div>
                        <div className="w-full bg-blue-900/50 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2.5 rounded-full" style={{ width: `${Math.min(100, progressPercent)}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-blue-300">
                            <span>Start: {formatDateGB(seasonStats.plantStartDate)}</span>
                            <span>Running Indent: {formatDateGB(seasonStats.currentDate)}</span>
                        </div>
                    </div>

                    {/* Middle & Right: Metrics (Conditionals based on Scope) */}
                    <div className="flex gap-8 text-center md:text-right">
                        {/* Cane taken so far. It was only ever implied here — you had to
                            multiply the cumulative rate by the day count yourself — and it
                            is the first thing anyone asks. */}
                        <div>
                            <p className="text-xs uppercase tracking-wider text-blue-300 mb-1">Cane Received</p>
                            <p className="text-2xl font-bold font-mono">{fmtInt(seasonStats.totalSeasonPurchases)}</p>
                            <p className="text-[10px] text-blue-300">
                                Season to date
                                {selectedScope === 'all' && seasonalCrushingCapacity > 0
                                    ? ` · ${((seasonStats.totalSeasonPurchases / seasonalCrushingCapacity) * 100).toFixed(1)}% of capacity`
                                    : ''}
                            </p>
                        </div>
                        <div className="pl-8 border-l border-blue-800">
                            <p className="text-xs uppercase tracking-wider text-blue-300 mb-1">Current Rate</p>
                            <p className="text-2xl font-bold font-mono">
                                {fmtInt(seasonStats.recentRunRate ? seasonStats.recentRunRate.rate : null)}
                            </p>
                            <p className="text-[10px] text-blue-300"
                               title={`Season average is ${fmtInt(seasonStats.cumulativeRunRate)}/day, but that still carries the ramp-up and understates how the mill is running now.`}>
                                {seasonStats.recentRunRate
                                    ? `Last ${seasonStats.recentRunRate.days} days · season avg ${fmtInt(seasonStats.cumulativeRunRate)}`
                                    : 'Avg. Daily Purchase'}
                            </p>
                        </div>
                        <div className="pl-8 border-l border-blue-800">
                            {selectedScope === 'all' ? (
                                <>
                                    <p className="text-xs uppercase tracking-wider text-cyan-300 mb-1 font-bold">Net Required Rate</p>
                                    <p className="text-2xl font-bold font-mono text-cyan-300">{fmtInt(seasonStats.netRequiredRunRate)}</p>
                                    <p className="text-[10px] text-blue-300">To Meet 100% Capacity</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs uppercase tracking-wider text-cyan-300 mb-1 font-bold">Center Fulfillment</p>
                                    <p className="text-2xl font-bold font-mono text-cyan-300">
                                        {seasonStats.centerBondingQty > 0 ? ((seasonStats.totalSeasonPurchases / seasonStats.centerBondingQty) * 100).toFixed(1) : '0.0'}%
                                    </p>
                                    <p className="text-[10px] text-blue-300">Of Total Bonding</p>
                                </>
                            )}
                        </div>
                        {selectedScope !== 'all' && (
                            <div className="pl-8 border-l border-blue-800">
                                <p className="text-xs uppercase tracking-wider text-white mb-1 font-bold">Contribution</p>
                                <p className="text-2xl font-bold font-mono text-white">
                                    {seasonStats.globalSeasonPurchases > 0 ? ((seasonStats.totalSeasonPurchases / seasonStats.globalSeasonPurchases) * 100).toFixed(2) : '0.00'}%
                                </p>
                                <p className="text-[10px] text-blue-300">Of Total Plant Supply</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Top Row: Recommendations & KPIs (Context Aware) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
                <div className="md:col-span-1 bg-white p-4 rounded-xl shadow-md border flex flex-col justify-between h-full">
                    <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <ClipboardCheck size={16} className="text-[#003580]"/> Recommendations
                    </h3>
                    <div className="flex gap-3">
                        <ActionCard title="Gate Indent" value={snapshotData.actions.gateIndent} />
                        <ActionCard title="Center Indent" value={snapshotData.actions.centerIndent} />
                    </div>
                </div>
                
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                    <KPICard 
                        title="Effective Requirement" 
                        value={fmtInt(scopeMetrics.effectiveRequirement)} 
                        subtext={`Target for T+3 (${selectedScope === 'all' ? 'Plant' : 'Center'})`}
                        tooltip="The adjusted daily crushing target. If viewing All Centers, this is based on plant capacity. If viewing a single Center, this is its specific 'Requirement by Bonding'."
                        icon={<Target size={20} className="text-blue-600"/>} 
                        color="bg-blue-100" 
                    />
                    <KPICard 
                        title="Forecast Pipeline" 
                        value={fmtInt(scopeMetrics.forecastT3)} 
                        subtext="Expected on T+3 from past"
                        tooltip="The quantity of cane expected to arrive on T+3 resulting from indents already placed in the previous three days (the 'pipeline' quantity) for the selected scope."
                        icon={<BarChart3 size={20} className="text-purple-600"/>} 
                        color="bg-purple-100" 
                    />
                    <KPICard
                        title={selectedScope === 'all' ? "Delivery Rate" : "Centre Delivery Rate"}
                        value={scopeMetrics.settledDelivery
                            ? `${(scopeMetrics.settledDelivery.rate * 100).toFixed(1)}%`
                            : '—'}
                        subtext={scopeMetrics.settledDelivery
                            ? `${Math.round(scopeMetrics.settledDelivery.arrived).toLocaleString()} of ${Math.round(scopeMetrics.settledDelivery.ordered).toLocaleString()} qtl`
                            : 'No settled days yet'}
                        tooltip="Cane that arrived as a share of cane ordered, counting only indent days whose full four-day arrival window has passed. Recent days are excluded because their cane is still coming in, and days in the future are excluded because no cane can have arrived against them yet — including either makes the mill look far worse than it is."
                        icon={<TrendingUp size={20} className="text-orange-600"/>}
                        color="bg-orange-100"
                    />
                </div>
            </div>

            {/* 3. New Middle Section: Operational Engine Room */}
            <div className="space-y-6">
                {/* Top Row: Performance Table (Full Width) */}
                <div className="bg-white p-5 rounded-xl shadow-md border">
                    <SectionHeader title={`Performance Review (${selectedScope === 'all' ? 'Global' : 'Center Scope'}) - Last 5 Days`} icon={<Activity size={20} />} />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                                <tr>
                                    {/* These are DELIVERY days, not the days a calculation
                                        was run. A run made on the 11th predicts for the 14th,
                                        so a bare "Date" header made the table look as though
                                        it contradicted itself. */}
                                    <th className="px-3 py-2 rounded-l-md" title="The day the cane was wanted. The indent for it was placed three days earlier.">Delivery Date</th>
                                    <th className="px-3 py-2 text-right">Target</th>
                                    <th className="px-3 py-2 text-right" title="What the app recommended ordering for this delivery day, from the calculation run three days before it.">Predicted Indent</th>
                                    <th className="px-3 py-2 text-right" title="Slips issued for this delivery day, from the uploaded indent file. The decided indent in the crushing report is usually lower.">Indent Issued (Slips)</th>
                                    <th className="px-3 py-2 text-right">Var %</th>
                                    <th className="px-3 py-2 text-right rounded-r-md">Cumul. Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {performanceTableData.map((row, idx) => (
                                    <tr key={idx} className={`hover:bg-slate-50 ${idx === 0 ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-3 py-2 font-medium text-slate-800">
                                            {row.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-500">{row.target.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {row.predicted
                                                ? row.predicted.toLocaleString(undefined, {maximumFractionDigits: 0})
                                                : <span className="text-slate-400 text-xs italic" title={`No calculation was run on ${formatDateGB(addDays(row.date, -deliveryLagDays))}, which is when the indent for this delivery day was placed.`}>not run</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                                            {row.actual > 0 ? row.actual.toLocaleString() : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-bold text-xs ${row.variance === 0 ? 'text-slate-300' : row.variance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                            {row.variance === null || row.variance === undefined
                                                ? <span className="text-slate-300" title="The indent for this delivery day is not in the uploaded file yet.">-</span>
                                                : (row.variance > 0 ? '+' : '') + (row.variance * 100).toFixed(1) + '%'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                                            {row.cumulativeRate !== null && row.cumulativeRate > 0
                                                ? Math.round(row.cumulativeRate).toLocaleString()
                                                : <span className="text-slate-300" title="No purchases recorded between the season start and this day.">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom Row: Unified Indent Lifecycle Table */}
                <div className="bg-white p-5 rounded-xl shadow-md border">
                    <SectionHeader title={`Unified Indent Lifecycle (${selectedScope === 'all' ? 'All Centers' : 'Single Center View'})`} icon={<Clock size={20} />} />
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 font-bold text-slate-600 uppercase">
                                <tr>
                                    <th className="px-3 py-2 rounded-l-md">Status</th>
                                    <th className="px-3 py-2">Issue Date</th>
                                    <th className="px-3 py-2">Indent Date</th>
                                    <th className="px-3 py-2 text-right">Indent Qty</th>
                                    <th className="px-3 py-2 text-right border-r border-slate-200">Arrived Qty</th>
                                    <th className="px-2 py-2 text-center">D1</th>
                                    <th className="px-2 py-2 text-center">D2</th>
                                    <th className="px-2 py-2 text-center">D3</th>
                                    <th className="px-2 py-2 text-center rounded-r-md">D4+</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {unifiedLifecycleData.map((row, idx) => {
                                    const isRecommendation = row.status === 'Recommendation';
                                    let badge = null;
                                    
                                    if (row.status === 'Fully Open') {
                                        badge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#e0f2fe] text-[#0ea5e9]">FULLY OPEN</span>;
                                    } else if (row.status === 'Partially Open') {
                                        badge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef9c3] text-[#ca8a04]">PARTIALLY OPEN</span>;
                                    } else if (row.status === 'Recommendation') {
                                        badge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">RECOMMENDATION</span>;
                                    } else {
                                        badge = <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">Closed</span>;
                                    }

                                    // Helper for cell coloring
                                    const getCellClass = (cell: { qty: number | null; type: string }) => {
                                        if (cell.qty === null || cell.type === 'Unknown') return "text-slate-300 font-mono";
                                        if (cell.type === 'Forecast') return "text-orange-600 bg-orange-50 font-medium font-mono";
                                        return "text-blue-600 font-medium font-mono";
                                    };
                                    // A dash where the saved run has no breakdown for this day.
                                    const dCell = (cell: { qty: number | null; type: string }) =>
                                        cell.qty === null ? '-' : Math.round(cell.qty).toLocaleString();

                                    const arrivedClass = isRecommendation ? "text-slate-400 italic font-mono" : "text-blue-700 font-bold font-mono";

                                    return (
                                        <tr key={idx} className={`hover:bg-slate-50 ${isRecommendation ? 'bg-orange-50/20' : ''}`}>
                                            <td className="px-3 py-2 whitespace-nowrap">{badge}</td>
                                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                                                {row.issueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">
                                                {row.indentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">
                                                {row.indentQty > 0 ? Math.round(row.indentQty).toLocaleString() : '-'}
                                            </td>
                                            <td className={`px-3 py-2 text-right border-r border-slate-100 ${arrivedClass}`}>
                                                {isRecommendation ? 'Pending' : (row.arrivedQty > 0 ? Math.round(row.arrivedQty).toLocaleString() : '-')}
                                            </td>
                                            {/* Breakdown Columns */}
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d1)}`}>{dCell(row.distribution.d1)}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d2)}`}>{dCell(row.distribution.d2)}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d3)}`}>{dCell(row.distribution.d3)}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d4)}`}>{dCell(row.distribution.d4)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="mt-3 flex justify-end gap-4 text-[10px] font-semibold border-t pt-2">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 rounded-full"></span> Actual Arrivals</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span> Forecasted Arrivals</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Charts Section (Updated with Slicers) */}
            <ChartCard 
                title="Supply Rhythm" 
                subtitle="Comparison of Indent Placed vs. Actual Arrivals."
                tooltip="This chart compares what you asked for (The Line) versus what actually arrived at the gate (The Bar). If the bars match the line, your supply chain is running perfectly. If there is a gap, it means indents aren't effectively driving the field."
                icon={<Activity size={20}/>}
                className="col-span-full"
                headerAction={
                    <RangeSelector 
                        current={rhythmRange} 
                        options={['7D', '15D', '30D', 'Season']} 
                        onChange={setRhythmRange} 
                    />
                }
            >
                <TrendChart 
                    data={filteredRhythmData} 
                    series={[
                        { key: 'purchase', name: 'Actual Purchase', color: '#3b82f6', type: 'bar' },
                        { key: 'indent', name: 'Indent Placed', color: '#a855f7', type: 'line' }
                    ]}
                    // Removed target prop
                    dailyBreakdownData={breakdownDataMaps.purchases}
                    breakdownType="purchases"
                    description="This chart compares what you asked for (The Line) versus what actually arrived at the gate (The Bar). If the bars match the line, your supply chain is running perfectly. If there is a gap, it means indents aren't effectively driving the field."
                />
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard 
                    title="Pipeline Confidence" 
                    subtitle="System Recommendation vs. Team Compliance."
                    tooltip="This checks if your team followed the system's advice. We compare the recommendation the system generated 3 days ago (Grey Dashed Line) against the actual indent your team placed today (Green Bar). If they match, you are fully utilizing the automation."
                    icon={<Search size={20}/>}
                    headerAction={
                        <RangeSelector 
                            current={pipelineRange} 
                            options={['7D', '15D', '30D', 'Season']} 
                            onChange={setPipelineRange} 
                        />
                    }
                >
                    <div className="h-full flex flex-col">
                        <div className="flex-1 min-h-0">
                            <TrendChart 
                                data={filteredPipelineData} 
                                series={[
                                    { key: 'system', name: 'System Rec (Calculated 3 Days Prior)', color: '#94a3b8', type: 'dashed' },
                                    { key: 'actual', name: 'Actual Indent (For This Day)', color: '#10b981', type: 'bar' },
                                ]}
                                breakdownType="forecast_variance" // Reusing standard tooltip logic for now
                                description="This checks if your team followed the system's advice. We compare the recommendation the system generated 3 days ago (Grey Dashed Line) against the actual indent your team placed today (Green Bar). If they match, you are fully utilizing the automation."
                            />
                        </div>
                        {pipelineVarianceMetric !== null && (
                            <div className={`mt-2 py-1 px-3 rounded-md border flex items-center justify-between text-xs font-semibold ${pipelineVarianceMetric > 0.1 || pipelineVarianceMetric < -0.1 ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                                <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Average Variance ({pipelineRange})</span>
                                <span className="font-mono">{pipelineVarianceMetric > 0 ? '+' : ''}{(pipelineVarianceMetric * 100).toFixed(1)}%</span>
                            </div>
                        )}
                    </div>
                </ChartCard>

                <ChartCard 
                    title="Field Behavior" 
                    subtitle="Daily variation between Ordered and Received quantity."
                    tooltip="This tracks the daily 'Overrun' percentage. Bars going up mean farmers brought more cane than you ordered (Over-supply). Bars going down mean they brought less (Under-supply). Use this trend to adjust your future safety margins."
                    icon={<TrendingUp size={20}/>}
                    headerAction={
                        <RangeSelector 
                            current={behaviorRange} 
                            options={['7D', '15D', '30D', 'Season']} 
                            onChange={setBehaviorRange}
                            extraAction={
                                <button
                                    onClick={() => setIsBehaviorSmoothed(!isBehaviorSmoothed)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-colors ${
                                        isBehaviorSmoothed 
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                    title="Toggle 3-Day Rolling Average"
                                >
                                    <Waves size={12} />
                                    {isBehaviorSmoothed ? 'Smooth On' : 'Smooth Off'}
                                </button>
                            } 
                        />
                    }
                >
                    <TrendChart 
                        data={filteredBehaviorData} 
                        series={[
                            { key: 'overrun', name: isBehaviorSmoothed ? 'Overrun % (3D Avg)' : 'Overrun %', color: '#6366f1', type: 'bar' }
                        ]}
                        dailyBreakdownData={breakdownDataMaps.overrun}
                        breakdownType="overrun_variance"
                        description="This tracks the daily 'Overrun' percentage. Bars going up mean farmers brought more cane than you ordered (Over-supply). Bars going down mean they brought less (Under-supply). Use this trend to adjust your future safety margins."
                    />
                </ChartCard>
            </div>
        </div>
    );
};
