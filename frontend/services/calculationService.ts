
import type { 
    CalculationResults, 
    DWeights,
    NormalizedBonding,
    NormalizedIndent,
    NormalizedPurchase,
    ClosedIndentAnalysis,
    CenterDWeights,
    ForecastBreakdownRow,
    ForecastContribution,
    OpenIndentMatrixData,
    OpenIndentMatrixRow,
    OpenIndentMatrixEntry,
    IndentCalculationBreakdownRow,
    Bonding,
    Indent,
    Purchase,
    IndentResultRow,
    CalculationInputs,
    RiskAnalysisItem
} from '../types';
import { parseDate, addDays, isSameDay, formatDateGB } from './dateUtils';


/**
 * Finds a value in an object by checking a list of possible keys.
 * The comparison is case-insensitive and ignores spaces.
 * @param row The object to search in.
 * @param possibleKeys An array of possible keys to look for.
 * @returns The value found, or undefined if no key matches.
 */
const findValue = (row: { [key: string]: any }, possibleKeys: string[]): string | undefined => {
    const actualKeysMap: { [normalizedKey: string]: string } = {};
    for (const key in row) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            actualKeysMap[key.toLowerCase().replace(/\s/g, '')] = key;
        }
    }

    for (const pKey of possibleKeys) {
        const normalizedPKey = pKey.toLowerCase().replace(/\s/g, '');
        if (actualKeysMap[normalizedPKey]) {
            const value = row[actualKeysMap[normalizedPKey]];
            return value !== null && value !== undefined ? String(value) : undefined;
        }
    }
    return undefined;
};


// --- Data Normalization ---
const normalizeIndents = (data: any[], centerMapping: { [key: string]: string }): NormalizedIndent[] => {
    const indentMap = new Map<string, { centreId: string; raisedFor: Date; qty: number }>(); // key: 'centreId-dateISO'

    for (const row of data) {
        const originalCentreId = findValue(row, ['Code'])?.trim();
        if (!originalCentreId) continue;

        const centreId = centerMapping[originalCentreId] || originalCentreId;
        const raisedFor = parseDate(findValue(row, ['Indent Date']) as string);
        const qty = parseFloat(findValue(row, ['Qty in Qtls', 'Qty']) || '0');

        if (centreId && raisedFor && qty > 0) {
            const key = `${centreId}-${raisedFor.toISOString()}`;
            const existing = indentMap.get(key);
            if (existing) {
                existing.qty += qty;
            } else {
                indentMap.set(key, { centreId, raisedFor, qty });
            }
        }
    }

    return Array.from(indentMap.values());
};

const normalizePurchases = (data: any[], centerMapping: { [key: string]: string }): NormalizedPurchase[] => {
    return data.map(row => {
        const originalCentreId = findValue(row, ['Code'])?.trim();
        const centreId = originalCentreId ? (centerMapping[originalCentreId] || originalCentreId) : undefined;
        return {
            centreId: centreId,
            purchaseDate: parseDate(findValue(row, ['Purchase Date']) as string),
            raisedFor: parseDate(findValue(row, ['Indent Date']) as string),
            qty: parseFloat(findValue(row, ['Qty in Qtls', 'Qty']) || '0')
        };
    }).filter(item => 
        item.centreId && 
        item.purchaseDate && 
        typeof item.qty === 'number' && item.qty > 0
    ) as NormalizedPurchase[];
};

const normalizeBonding = (data: any[], centerMapping: { [key: string]: string }): NormalizedBonding[] => {
    const bondingByCenter = new Map<string, { name: string; qty: number }>();
    data.forEach(row => {
        const originalId = findValue(row, ['Code'])?.trim();
        if (!originalId) return;

        const id = centerMapping[originalId] || originalId;
        const name = findValue(row, ['Center', 'Center Name'])?.trim();
        const qtyStr = findValue(row, ['Bonding']);
        const qty = parseFloat(qtyStr || '0');

        if (id && name && qty > 0) {
            const existing = bondingByCenter.get(id) || { name, qty: 0 };
            existing.qty += qty;
            bondingByCenter.set(id, existing);
        }
    });
    return Array.from(bondingByCenter.entries()).map(([centreId, data]) => ({
        centreId,
        centreName: data.name,
        qty: data.qty,
        isGate: data.name.toUpperCase().trim().includes('GATE'),
    }));
};

interface MaturityWeightsResult {
    centerWeights: Map<string, DWeights>;
    globalWeights: DWeights;
    closedIndentAnalysis: ClosedIndentAnalysis[]; // For T-7 to T-4 UI Tab
    centerDWeights: CenterDWeights[];
    maturityAnalysisPurchases: NormalizedPurchase[];
    fullSeasonAnalysis: ClosedIndentAnalysis[]; // For New Full Maturity Tab
    seasonDWeights: CenterDWeights[]; // For New Full Maturity Tab
}

/**
 * Calculates an average of ratios, but only includes entries where the ratio is > 0.
 * Behaves like AVERAGEIF(range, ">0") in Excel.
 */
const calculateAverageOfPositiveRatios = (
    analyses: ClosedIndentAnalysis[], 
    key: 'd1' | 'd2' | 'd3' | 'd4'
): number => {
    const purchaseKey = `${key}Purchases` as keyof ClosedIndentAnalysis;
    if (!analyses || analyses.length === 0) return 0;

    const positiveRatios = analyses
        .map(a => a.indentQty > 0 ? (a[purchaseKey] as number) / a.indentQty : 0)
        .filter(r => isFinite(r) && r > 0);

    if (positiveRatios.length === 0) return 0;

    const sumOfRatios = positiveRatios.reduce((sum, ratio) => sum + ratio, 0);
    return sumOfRatios / positiveRatios.length;
};

const analyzeIndentMaturity = (
    indent: NormalizedIndent,
    relevantPurchases: NormalizedPurchase[],
    bondingMap: Map<string, string>,
    isFullSeasonLogic: boolean = false
): ClosedIndentAnalysis => {
    let d1Sum = 0, d2Sum = 0, d3Sum = 0, d4Sum = 0;
    const MS_PER_DAY = 1000 * 3600 * 24;
    const utcIndent = Date.UTC(indent.raisedFor.getUTCFullYear(), indent.raisedFor.getUTCMonth(), indent.raisedFor.getUTCDate());

    for (const p of relevantPurchases) {
        const utcPurchase = Date.UTC(p.purchaseDate.getUTCFullYear(), p.purchaseDate.getUTCMonth(), p.purchaseDate.getUTCDate());
        const dayDiff = (utcPurchase - utcIndent) / MS_PER_DAY;

        if (isFullSeasonLogic) {
            // Strict day-by-day logic for the Full Maturity Analysis tab
            if (dayDiff === 0) d1Sum += p.qty;
            else if (dayDiff === 1) d2Sum += p.qty;
            else if (dayDiff === 2) d3Sum += p.qty;
            else if (dayDiff === 3) d4Sum += p.qty;
            // Any other dayDiff is ignored for this specific view
        } else {
            // Standard cumulative logic for the main forecast engine
            if (dayDiff <= 0) d1Sum += p.qty;
            else if (dayDiff === 1) d2Sum += p.qty;
            else if (dayDiff === 2) d3Sum += p.qty;
            else if (dayDiff >= 3) d4Sum += p.qty;
        }
    }

    return {
        centreId: indent.centreId,
        centreName: bondingMap.get(indent.centreId) || 'Unknown',
        raisedFor: indent.raisedFor,
        indentQty: indent.qty,
        d1Purchases: d1Sum,
        d2Purchases: d2Sum,
        d3Purchases: d3Sum,
        d4Purchases: d4Sum,
        totalPurchases: d1Sum + d2Sum + d3Sum + d4Sum
    };
};

const deriveMaturityWeights = (
    indents: NormalizedIndent[], 
    purchases: NormalizedPurchase[], 
    bonding: NormalizedBonding[],
    currentDate: Date,
    plantStartDate: Date
): MaturityWeightsResult => {
    const bondingMap = new Map(bonding.map(b => [b.centreId, b.centreName]));
    
    const purchasesByIndent = new Map<string, NormalizedPurchase[]>();
    for (const p of purchases) {
        if (p.raisedFor) {
            const key = `${p.centreId}-${p.raisedFor.toISOString()}`;
            if (!purchasesByIndent.has(key)) purchasesByIndent.set(key, []);
            purchasesByIndent.get(key)!.push(p);
        }
    }

    const t_minus_4 = addDays(currentDate, -4);
    // A "closed" indent is one where the D4 purchase window has passed.
    // The D4 purchase for a T-4 indent happens on T-1, so indents <= T-4 are closed.
    const closedIndents = indents.filter(indent => indent.raisedFor <= t_minus_4);

    // This is for the "Full Maturity" tab. It uses ALL indents for the season (not just closed ones)
    // and calls the analysis function with isFullSeasonLogic = true.
    const fullSeasonAnalysis = indents
        .filter(indent => indent.raisedFor >= plantStartDate)
        .map(indent => analyzeIndentMaturity(indent, purchasesByIndent.get(`${indent.centreId}-${indent.raisedFor.toISOString()}`) || [], bondingMap, true));

    // This is for the main forecast engine and the "Recent Maturity" tab.
    // It only uses recent CLOSED indents and calls the analysis function with the default logic (isFullSeasonLogic = false).
    const t_minus_7 = addDays(currentDate, -7);
    const recentClosedIndents = closedIndents.filter(indent => indent.raisedFor >= t_minus_7);
    const closedIndentAnalysis = recentClosedIndents.map(indent => analyzeIndentMaturity(indent, purchasesByIndent.get(`${indent.centreId}-${indent.raisedFor.toISOString()}`) || [], bondingMap));
    
    const centerDWeights: CenterDWeights[] = [];
    const centerWeights = new Map<string, DWeights>();

    for (const center of bonding) {
        const recentAnalyses = closedIndentAnalysis.filter(a => a.centreId === center.centreId);
        const seasonAnalyses = fullSeasonAnalysis.filter(a => a.centreId === center.centreId);
        
        const recent_avg_d1 = recentAnalyses.reduce((sum, a) => sum + (a.indentQty > 0 ? a.d1Purchases / a.indentQty : 0), 0) / (recentAnalyses.length || 1);
        const recent_avg_d2 = recentAnalyses.reduce((sum, a) => sum + (a.indentQty > 0 ? a.d2Purchases / a.indentQty : 0), 0) / (recentAnalyses.length || 1);
        const recent_avg_d3 = recentAnalyses.reduce((sum, a) => sum + (a.indentQty > 0 ? a.d3Purchases / a.indentQty : 0), 0) / (recentAnalyses.length || 1);
        const recent_avg_d4 = recentAnalyses.reduce((sum, a) => sum + (a.indentQty > 0 ? a.d4Purchases / a.indentQty : 0), 0) / (recentAnalyses.length || 1);

        const season_avg_d1 = calculateAverageOfPositiveRatios(seasonAnalyses, 'd1');
        const season_avg_d2 = calculateAverageOfPositiveRatios(seasonAnalyses, 'd2');
        const season_avg_d3 = calculateAverageOfPositiveRatios(seasonAnalyses, 'd3');
        const season_avg_d4 = calculateAverageOfPositiveRatios(seasonAnalyses, 'd4');
        
        const d1 = recent_avg_d1 < 0.1 ? season_avg_d1 : recent_avg_d1;
        const d2 = recent_avg_d2 < 0.1 ? season_avg_d2 : recent_avg_d2;
        const d3 = recent_avg_d3 < 0.1 ? season_avg_d3 : recent_avg_d3;
        const d4 = recent_avg_d4 < 0.1 ? season_avg_d4 : recent_avg_d4;

        const weights = { d1, d2, d3, d4 };
        centerWeights.set(center.centreId, weights);
        
        centerDWeights.push({
            centreId: center.centreId, centreName: center.centreName,
            ...weights,
            d1_fallback_used: recent_avg_d1 < 0.1, recent_avg_d1,
            d2_fallback_used: recent_avg_d2 < 0.1, recent_avg_d2,
            d3_fallback_used: recent_avg_d3 < 0.1, recent_avg_d3,
            d4_fallback_used: recent_avg_d4 < 0.1, recent_avg_d4,
        });
    }

    const seasonDWeights: CenterDWeights[] = bonding.map(center => {
        const seasonAnalyses = fullSeasonAnalysis.filter(a => a.centreId === center.centreId);
        return {
            centreId: center.centreId, centreName: center.centreName,
            d1: calculateAverageOfPositiveRatios(seasonAnalyses, 'd1'),
            d2: calculateAverageOfPositiveRatios(seasonAnalyses, 'd2'),
            d3: calculateAverageOfPositiveRatios(seasonAnalyses, 'd3'),
            d4: calculateAverageOfPositiveRatios(seasonAnalyses, 'd4'),
        };
    });
    
    // FIX: Changed `recentClosedIndents` to `closedIndentAnalysis` to correctly access `d*Purchases` and `indentQty` properties.
    const globalWeights = {
        d1: closedIndentAnalysis.reduce((s,a) => s+a.d1Purchases, 0) / closedIndentAnalysis.reduce((s,a) => s+a.indentQty, 1),
        d2: closedIndentAnalysis.reduce((s,a) => s+a.d2Purchases, 0) / closedIndentAnalysis.reduce((s,a) => s+a.indentQty, 1),
        d3: closedIndentAnalysis.reduce((s,a) => s+a.d3Purchases, 0) / closedIndentAnalysis.reduce((s,a) => s+a.indentQty, 1),
        d4: closedIndentAnalysis.reduce((s,a) => s+a.d4Purchases, 0) / closedIndentAnalysis.reduce((s,a) => s+a.indentQty, 1),
    };
    
    return { centerWeights, globalWeights, closedIndentAnalysis, centerDWeights, maturityAnalysisPurchases: purchases, fullSeasonAnalysis, seasonDWeights };
};


const calculateForecasts = (indents: NormalizedIndent[], centerWeights: Map<string, DWeights>, currentDate: Date, bonding: NormalizedBonding[]): { forecastBreakdown: ForecastBreakdownRow[], totalForecastT3: number } => {
    const t_plus_1 = addDays(currentDate, 1);
    const t_plus_2 = addDays(currentDate, 2);
    const today = currentDate;

    let totalForecastT3 = 0;
    const forecastBreakdown = bonding.map(b => {
        const weights = centerWeights.get(b.centreId) || {d1:0,d2:0,d3:0,d4:0};
        const indent_t2 = indents.find(i => i.centreId === b.centreId && isSameDay(i.raisedFor, t_plus_2));
        const indent_t1 = indents.find(i => i.centreId === b.centreId && isSameDay(i.raisedFor, t_plus_1));
        const indent_t0 = indents.find(i => i.centreId === b.centreId && isSameDay(i.raisedFor, today));

        const d2_contribution: ForecastContribution = { indentDate: indent_t2?.raisedFor ?? null, indentQty: indent_t2?.qty || 0, weight: weights.d2, result: (indent_t2?.qty || 0) * weights.d2 };
        const d3_contribution: ForecastContribution = { indentDate: indent_t1?.raisedFor ?? null, indentQty: indent_t1?.qty || 0, weight: weights.d3, result: (indent_t1?.qty || 0) * weights.d3 };
        const d4_contribution: ForecastContribution = { indentDate: indent_t0?.raisedFor ?? null, indentQty: indent_t0?.qty || 0, weight: weights.d4, result: (indent_t0?.qty || 0) * weights.d4 };
        
        // D1 contribution is not from a past indent, it will be from the new indent. Initialize it as zero.
        const d1_contribution: ForecastContribution = { indentDate: addDays(currentDate, 3), indentQty: 0, weight: weights.d1, result: 0 };

        const centerForecast = d2_contribution.result + d3_contribution.result + d4_contribution.result;
        totalForecastT3 += centerForecast;
        
        return {
            centreId: b.centreId, centreName: b.centreName, bonding: b.qty,
            contributions: { d1: d1_contribution, d2: d2_contribution, d3: d3_contribution, d4: d4_contribution },
            totalForecast: centerForecast
        };
    });

    return { forecastBreakdown, totalForecastT3 };
};


const calculateOpenIndentMatrix = (
    indents: NormalizedIndent[],
    purchases: NormalizedPurchase[],
    centerWeights: Map<string, DWeights>,
    bonding: NormalizedBonding[],
    currentDate: Date,
    recommendedIndents: IndentResultRow[]
): { matrix: OpenIndentMatrixData[], headers: Date[] } => {
    const startDate = addDays(currentDate, -3);
    const endDate = addDays(currentDate, 6); // Extended to T+6

    const headers: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        headers.push(new Date(d));
    }

    const t_plus_3 = addDays(currentDate, 3);
    const recommendedIndentsMap = new Map(recommendedIndents.map(i => [i.centreId, i.indentToRaise]));
    
    const newIndentRow: NormalizedIndent[] = bonding.map(b => ({
        centreId: b.centreId,
        raisedFor: t_plus_3,
        qty: recommendedIndentsMap.get(b.centreId) || 0
    }));

    const openIndentDates = new Set<string>();
    for (let d = new Date(addDays(currentDate, -3)); d <= t_plus_3; d.setUTCDate(d.getUTCDate() + 1)) {
        openIndentDates.add(d.toISOString());
    }

    // Filter out any existing indents for T+3 that are being replaced by the new calculation.
    const newIndentCenterIds = new Set(newIndentRow.map(i => i.centreId));
    const filteredExistingIndents = indents.filter(i => {
        if (!openIndentDates.has(i.raisedFor.toISOString())) {
            return false; // Not an open indent
        }
        if (isSameDay(i.raisedFor, t_plus_3)) {
            // If it's for T+3, only include it if it's NOT in the new indent list
            return !newIndentCenterIds.has(i.centreId);
        }
        return true; // It's an open indent for a different day
    });
    
    const relevantIndents = [...filteredExistingIndents, ...newIndentRow];
    
    const matrix = bonding.map(center => {
        const centerIndents = relevantIndents.filter(i => i.centreId === center.centreId);
        const weights = centerWeights.get(center.centreId) || {d1:0,d2:0,d3:0,d4:0};

        const data: OpenIndentMatrixRow[] = centerIndents.map(indent => {
            const relevantPurchases = purchases.filter(p => p.centreId === indent.centreId && p.raisedFor && isSameDay(p.raisedFor, indent.raisedFor));
            
            const actualsMap = new Map<string, number>();
            const MS_PER_DAY = 1000 * 3600 * 24;

            for (const p of relevantPurchases) {
                const dayDiff = (p.purchaseDate.getTime() - indent.raisedFor.getTime()) / MS_PER_DAY;
                let bucketDate: Date;
                if (dayDiff <= 0) bucketDate = indent.raisedFor;
                else if (dayDiff === 1) bucketDate = addDays(indent.raisedFor, 1);
                else if (dayDiff === 2) bucketDate = addDays(indent.raisedFor, 2);
                else bucketDate = addDays(indent.raisedFor, 3);

                const bucketISO = bucketDate.toISOString();
                actualsMap.set(bucketISO, (actualsMap.get(bucketISO) || 0) + p.qty);
            }

            const entries: OpenIndentMatrixEntry[] = headers.map(header => {
                const isPast = header.getTime() < currentDate.getTime();
                
                let quantity = 0;
                let dWeight: number | undefined;
                let dWeightLabel: 'D1'|'D2'|'D3'|'D4' | undefined;
                let type: 'Actual' | 'Forecast';

                if (isPast) {
                    type = 'Actual';
                    quantity = actualsMap.get(header.toISOString()) || 0;
                } else {
                    type = 'Forecast';
                    const dayDiff = Math.round((header.getTime() - indent.raisedFor.getTime()) / MS_PER_DAY);

                    if (dayDiff === 0) { quantity = indent.qty * weights.d1; dWeight = weights.d1; dWeightLabel = 'D1'; }
                    else if (dayDiff === 1) { quantity = indent.qty * weights.d2; dWeight = weights.d2; dWeightLabel = 'D2'; }
                    else if (dayDiff === 2) { quantity = indent.qty * weights.d3; dWeight = weights.d3; dWeightLabel = 'D3'; }
                    else if (dayDiff === 3) { quantity = indent.qty * weights.d4; dWeight = weights.d4; dWeightLabel = 'D4'; }
                    else { quantity = 0; } // Outside the 4-day forecast window
                }
                
                return { purchaseDate: header, quantity, type, dWeight, dWeightLabel, indentQty: indent.qty };
            });

            return { indentDate: indent.raisedFor, indentQty: indent.qty, entries };
        }).sort((a,b) => a.indentDate.getTime() - b.indentDate.getTime());

        return { centreId: center.centreId, centreName: center.centreName, data };
    });
    
    return { matrix, headers };
};

export const calculateRecommendedIndents = (inputs: CalculationInputs): CalculationResults => {
    const { bondingData, indentData, purchaseData, plantCapacity, totalDailyRequirement, currentDate, centerMapping, standardStockCentre, standardStockGate, availableStockCentre, availableStockGate, plantStartDate: plantStartDateStr, constraints } = inputs;

    const plantStartDate = parseDate(plantStartDateStr) || new Date();
    
    const nBonding = normalizeBonding(bondingData, centerMapping);
    const nIndents = normalizeIndents(indentData, centerMapping);
    const nPurchases = normalizePurchases(purchaseData, centerMapping);

    const { centerWeights, globalWeights, closedIndentAnalysis, centerDWeights, maturityAnalysisPurchases, fullSeasonAnalysis, seasonDWeights } = deriveMaturityWeights(nIndents, nPurchases, nBonding, currentDate, plantStartDate);
    
    const { forecastBreakdown, totalForecastT3 } = calculateForecasts(nIndents, centerWeights, currentDate, nBonding);

    // --- PHASE 3: Logic Engine for Constraints ---
    const t_plus_3 = addDays(currentDate, 3);
    const riskAnalysis: RiskAnalysisItem[] = [];

    // 1. Mill Constraint Logic (Demand Side)
    // If mill is down on T+3 (when D1 cane arrives), reduce requirement.
    const millConstraint = constraints.find(c => c.type === 'mill' && isSameDay(parseDate(c.date)!, t_plus_3));
    
    let effectiveRequirement = totalDailyRequirement * (plantCapacity / 100);
    
    if (millConstraint) {
        const originalReq = effectiveRequirement;
        const reduction = effectiveRequirement * millConstraint.impactFactor;
        effectiveRequirement = effectiveRequirement - reduction;
        
        riskAnalysis.push({
            date: t_plus_3,
            type: 'mill',
            originalValue: originalReq,
            constrainedValue: effectiveRequirement,
            deficit: reduction,
            message: `Mill constraint on ${formatDateGB(t_plus_3)} (${millConstraint.description}) reduced effective requirement by ${(millConstraint.impactFactor * 100).toFixed(0)}%.`
        });
    }

    // 2. Field Constraint Logic (Supply Side)
    // If rain is predicted on T+3 (when forecasted cane is arriving), calculate deficit.
    // NOTE: This does NOT auto-adjust the indent calculation as per requirements. It only creates a warning.
    const fieldConstraint = constraints.find(c => c.type === 'field' && isSameDay(parseDate(c.date)!, t_plus_3));
    
    if (fieldConstraint) {
        const originalForecast = totalForecastT3;
        const reduction = totalForecastT3 * fieldConstraint.impactFactor;
        const constrainedForecast = totalForecastT3 - reduction;
        
        riskAnalysis.push({
            date: t_plus_3,
            type: 'field',
            originalValue: originalForecast,
            constrainedValue: constrainedForecast,
            deficit: reduction,
            message: `Field constraint on ${formatDateGB(t_plus_3)} (${fieldConstraint.description}) is projected to impact arrivals by ~${Math.round(reduction).toLocaleString()} Qtls.`
        });
    }

    // ---------------------------------------------

    const totalIndentQty = nIndents.reduce((sum, i) => sum + i.qty, 0);
    const totalPurchaseQty = nPurchases.reduce((sum, p) => sum + p.qty, 0);
    const overrunPercentage = totalIndentQty > 0 ? (totalPurchaseQty / totalIndentQty) - 1 : 0;

    const totalBonding = nBonding.reduce((sum, b) => sum + b.qty, 0);
    const totalBondingGate = nBonding.filter(b => b.isGate).reduce((sum, b) => sum + b.qty, 0);
    const totalBondingCentre = nBonding.filter(b => !b.isGate).reduce((sum, b) => sum + b.qty, 0);

    const stockDiffGate = standardStockGate - availableStockGate;
    const stockDiffCentre = standardStockCentre - availableStockCentre;

    const indentCalculationBreakdown: IndentCalculationBreakdownRow[] = nBonding.map(center => {
        const bondingPercentage = center.qty / totalBonding;
        const requirementByBonding = effectiveRequirement * bondingPercentage;
        
        let stockAdjustment = 0;
        if (center.isGate && totalBondingGate > 0) {
            stockAdjustment = stockDiffGate * (center.qty / totalBondingGate);
        } else if (!center.isGate && totalBondingCentre > 0) {
            stockAdjustment = stockDiffCentre * (center.qty / totalBondingCentre);
        }

        const adjustedRequirement = requirementByBonding + stockAdjustment;
        const forecastT3 = forecastBreakdown.find(f => f.centreId === center.centreId)?.totalForecast || 0;
        const netRequirement = Math.max(0, adjustedRequirement - forecastT3);
        const targetArrival = netRequirement / (1 + overrunPercentage);
        const d1Weight = centerWeights.get(center.centreId)?.d1 || 0;
        const finalIndent = d1Weight > 0 ? targetArrival / d1Weight : 0;
        
        return {
            centreId: center.centreId, centreName: center.centreName, effectiveRequirement, bonding: center.qty, totalBonding,
            bondingPercentage, requirementByBonding, stockAdjustment, adjustedRequirement, forecastT3,
            netRequirement, overrunPercentage, targetArrival, d1Weight, finalIndent
        };
    });

    const tableData: IndentResultRow[] = indentCalculationBreakdown.map(row => ({
        centreId: row.centreId,
        centreName: row.centreName,
        bonding: row.bonding,
        adjusted: row.adjustedRequirement,
        forecastT3: row.forecastT3,
        indentToRaise: row.finalIndent,
    }));
    
    const { matrix, headers } = calculateOpenIndentMatrix(nIndents, nPurchases, centerWeights, nBonding, currentDate, tableData);

    return {
        dWeights: globalWeights,
        overrunPercentage,
        effectiveRequirement,
        totalForecastT3,
        tableData,
        closedIndentAnalysis,
        centerDWeights,
        forecastBreakdown,
        maturityAnalysisPurchases,
        openIndentMatrix: matrix,
        openIndentMatrixHeaders: headers,
        indentCalculationBreakdown,
        fullSeasonAnalysis,
        seasonDWeights,
        riskAnalysis
    };
};