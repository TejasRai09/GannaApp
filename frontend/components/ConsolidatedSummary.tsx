
import React, { useMemo, useState } from 'react';
import type { CalculationRun, StoredData, Indent, Purchase, Bonding } from '../types';
import { TrendChart } from './TrendChart';
import { parseDate, addDays, daysBetween, isSameDay, formatDateGB } from '../services/dateUtils';
import { TrendingUp, ClipboardCheck, Lightbulb, BarChart3, Target, Activity, Search, Waves, AlertCircle, Clock, Filter, PieChart } from 'lucide-react';
import { InfoIcon } from './InfoIcon';

interface ConsolidatedSummaryProps {
    indentData: StoredData<Indent> | null;
    purchaseData: StoredData<Purchase> | null;
    bondingData: StoredData<Bonding> | null;
    calculationHistory: CalculationRun[];
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
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

const ActionCard: React.FC<{ title: string; value: number }> = ({ title, value }) => (
    <div className="flex-1 bg-slate-50 p-3 rounded-lg border text-center">
        <p className="text-xs text-slate-500 font-semibold uppercase">{title}</p>
        <p className="text-xl font-bold text-[#003580] my-1">{Math.round(value).toLocaleString()}</p>
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
    const { indentData, purchaseData, bondingData, calculationHistory, seasonTotalDays, seasonalCrushingCapacity } = props;
    
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
        const safeDate = (val: any, fallback: Date) => {
            const d = val instanceof Date ? val : new Date(val);
            return isNaN(d.getTime()) ? fallback : d;
        };
        const currentDate = safeDate(latestCalc.inputs.currentDate, new Date());
        const plantStartDate = safeDate(parseDate(latestCalc.inputs.plantStartDate), new Date(new Date().getFullYear(), 9, 1));
        
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

        const scopeMetrics = {
            effectiveRequirement,
            forecastT3,
            overrunPercentage
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
        const remainingDays = Math.max(1, seasonTotalDays - daysLapsed);
        const remainingQtyNeeded = Math.max(0, seasonalCrushingCapacity - totalSeasonPurchases);
        const netRequiredRunRate = remainingQtyNeeded / remainingDays;

        const seasonStats = {
            currentDate,
            plantStartDate,
            daysLapsed,
            totalDays: seasonTotalDays,
            cumulativeRunRate,
            netRequiredRunRate,
            totalSeasonPurchases,
            globalSeasonPurchases, 
            centerBondingQty
        };

        // --- 3. Performance Table Data (Last 5 Days) - Scoped ---
        const performanceTableData = [];
        for (let i = 1; i <= 5; i++) {
            const date = addDays(currentDate, -i);
            
            const historyRun = calculationHistory.find(run => {
                const runDate = new Date(run.inputs.currentDate);
                return isSameDay(runDate, date);
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
                predictedIndent = historyRun ? historyRun.results.tableData.reduce((s, r) => s + r.indentToRaise, 0) : 0;
            } else {
                if (historyRun) {
                    const centerRow = historyRun.results.tableData.find(r => r.centreId === selectedScope);
                    const breakdownRow = historyRun.results.indentCalculationBreakdown?.find(r => r.centreId === selectedScope);
                    
                    historicTarget = breakdownRow ? breakdownRow.requirementByBonding : (centerRow?.adjusted || 0);
                    predictedIndent = centerRow ? centerRow.indentToRaise : 0;
                }
            }

            const variance = (predictedIndent > 0) ? (actualIndent - predictedIndent) / predictedIndent : 0;

            performanceTableData.push({
                date,
                target: historicTarget,
                predicted: historyRun ? predictedIndent : null,
                actual: actualIndent,
                variance,
                cumulativeRate: dailyCumulRate
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
                const key = row.indentDate.toISOString();
                if (!aggregatedMatrix.has(key)) {
                    aggregatedMatrix.set(key, {
                        indentDate: row.indentDate,
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
                    const dayDiff = Math.round((new Date(entry.purchaseDate).getTime() - new Date(row.indentDate).getTime()) / (1000 * 3600 * 24));
                    
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
            const issueDate = addDays(loopDate, -3);
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

            const distribution = aggRow ? {
                d1: aggRow.d1, d2: aggRow.d2, d3: aggRow.d3, d4: aggRow.d4
            } : {
                d1: { qty: 0, type: 'Actual' }, d2: { qty: 0, type: 'Actual' }, d3: { qty: 0, type: 'Actual' }, d4: { qty: 0, type: 'Actual' }
            };

            unifiedLifecycleData.push({
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
    }, [indentData, purchaseData, bondingData, calculationHistory, seasonTotalDays, seasonalCrushingCapacity, dailyTarget, selectedScope]);

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
                        <div>
                            <p className="text-xs uppercase tracking-wider text-blue-300 mb-1">Cumulative Rate</p>
                            <p className="text-2xl font-bold font-mono">{Math.round(seasonStats.cumulativeRunRate).toLocaleString()}</p>
                            <p className="text-[10px] text-blue-300">Avg. Daily Purchase</p>
                        </div>
                        <div className="pl-8 border-l border-blue-800">
                            {selectedScope === 'all' ? (
                                <>
                                    <p className="text-xs uppercase tracking-wider text-cyan-300 mb-1 font-bold">Net Required Rate</p>
                                    <p className="text-2xl font-bold font-mono text-cyan-300">{Math.round(seasonStats.netRequiredRunRate).toLocaleString()}</p>
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
                        value={`${Math.round(scopeMetrics.effectiveRequirement).toLocaleString()}`} 
                        subtext={`Target for T+3 (${selectedScope === 'all' ? 'Plant' : 'Center'})`}
                        tooltip="The adjusted daily crushing target. If viewing All Centers, this is based on plant capacity. If viewing a single Center, this is its specific 'Requirement by Bonding'."
                        icon={<Target size={20} className="text-blue-600"/>} 
                        color="bg-blue-100" 
                    />
                    <KPICard 
                        title="Forecast Pipeline" 
                        value={`${Math.round(scopeMetrics.forecastT3).toLocaleString()}`} 
                        subtext="Expected on T+3 from past"
                        tooltip="The quantity of cane expected to arrive on T+3 resulting from indents already placed in the previous three days (the 'pipeline' quantity) for the selected scope."
                        icon={<BarChart3 size={20} className="text-purple-600"/>} 
                        color="bg-purple-100" 
                    />
                    <KPICard 
                        title={selectedScope === 'all' ? "Plant Overrun" : "Center Overrun"} 
                        value={`${(scopeMetrics.overrunPercentage > 0 ? '+' : '')}${(scopeMetrics.overrunPercentage * 100).toFixed(2)}%`} 
                        subtext="Systemic Adjustment"
                        tooltip="The historical percentage difference between Actual Purchases and Indented Quantities for the selected scope. Positive means farmers supply more than ordered."
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
                                    <th className="px-3 py-2 rounded-l-md">Date</th>
                                    <th className="px-3 py-2 text-right">Target</th>
                                    <th className="px-3 py-2 text-right">Predicted Indent</th>
                                    <th className="px-3 py-2 text-right">Actual Indent</th>
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
                                            {row.predicted ? row.predicted.toLocaleString(undefined, {maximumFractionDigits: 0}) : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                                            {row.actual > 0 ? row.actual.toLocaleString() : <span className="text-slate-300">-</span>}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-bold text-xs ${row.variance === 0 ? 'text-slate-300' : row.variance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                            {row.variance !== 0 ? (row.variance > 0 ? '+' : '') + (row.variance * 100).toFixed(1) + '%' : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{Math.round(row.cumulativeRate).toLocaleString()}</td>
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
                                    const getCellClass = (cell: { qty: number, type: 'Actual' | 'Forecast' }) => {
                                        if (cell.type === 'Forecast') return "text-orange-600 bg-orange-50 font-medium font-mono";
                                        return "text-blue-600 font-medium font-mono";
                                    };

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
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d1)}`}>{Math.round(row.distribution.d1.qty).toLocaleString()}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d2)}`}>{Math.round(row.distribution.d2.qty).toLocaleString()}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d3)}`}>{Math.round(row.distribution.d3.qty).toLocaleString()}</td>
                                            <td className={`px-2 py-1 text-center ${getCellClass(row.distribution.d4)}`}>{Math.round(row.distribution.d4.qty).toLocaleString()}</td>
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
