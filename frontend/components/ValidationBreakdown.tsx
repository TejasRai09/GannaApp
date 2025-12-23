
import React, { useMemo } from 'react';
import type { CalculationResults } from '../types';
import { CheckSquare } from 'lucide-react';

const formatNumber = (num: number, dec = 0) => num.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
const formatPercent = (num: number) => `${(num * 100).toFixed(2)}%`;

export const ValidationBreakdown: React.FC<{ results: CalculationResults }> = ({ results }) => {
    const data = results.indentCalculationBreakdown;

    const totals = useMemo(() => {
        if (!data || data.length === 0) {
            return {
                bonding: 0,
                requirementByBonding: 0,
                stockAdjustment: 0,
                adjustedRequirement: 0,
                forecastT3: 0,
                netRequirement: 0,
                targetArrival: 0,
                finalIndent: 0,
            };
        }
        return data.reduce((acc, row) => {
            acc.bonding += row.bonding;
            acc.requirementByBonding += row.requirementByBonding;
            acc.stockAdjustment += row.stockAdjustment;
            acc.adjustedRequirement += row.adjustedRequirement;
            acc.forecastT3 += row.forecastT3;
            acc.netRequirement += row.netRequirement;
            acc.targetArrival += row.targetArrival;
            acc.finalIndent += row.finalIndent;
            return acc;
        }, {
            bonding: 0,
            requirementByBonding: 0,
            stockAdjustment: 0,
            adjustedRequirement: 0,
            forecastT3: 0,
            netRequirement: 0,
            targetArrival: 0,
            finalIndent: 0,
        });
    }, [data]);

    return (
        <div className="space-y-6">
            <div className="overflow-auto max-h-[600px] border rounded-lg custom-scrollbar">
                <table className="min-w-full w-max text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-30">
                        <tr>
                            <th rowSpan={2} scope="col" className="px-4 py-3 sticky left-0 top-0 bg-slate-100 z-40 border-r font-semibold">Center</th>
                            <th colSpan={3} scope="colgroup" className="px-4 py-2 text-center border-b bg-slate-100">Step 1: Bonding</th>
                            <th colSpan={2} scope="colgroup" className="px-4 py-2 text-center border-b border-l bg-slate-100">Step 2: Stock</th>
                            <th colSpan={2} scope="colgroup" className="px-4 py-2 text-center border-b border-l bg-slate-100">Step 3: Forecast</th>
                            <th colSpan={2} scope="colgroup" className="px-4 py-2 text-center border-b border-l bg-slate-100">Step 4 & 5: Adjustments</th>
                            <th rowSpan={2} scope="col" className="px-4 py-3 border-l font-semibold bg-[#e6f0ff] text-[#001f4c] z-30 sticky right-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Final Indent</th>
                        </tr>
                        <tr className="bg-slate-50">
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">Bonding (Qtls)</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">Bonding (%)</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">Req. by Bonding</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right border-l bg-slate-50">Stock Adj.</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">Adjusted Req.</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right border-l bg-slate-50">Forecast (T+3)</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">Net Req.</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right border-l bg-slate-50">Target Arrival</th>
                            <th scope="col" className="px-3 py-2 font-semibold text-right bg-slate-50">D1 Weight</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {data.map((row) => (
                            <tr key={row.centreId} className="border-b hover:bg-slate-50 last:border-b-0">
                                <th scope="row" className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white hover:bg-slate-50 z-20 border-r">{row.centreName}</th>
                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.bonding)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatPercent(row.bondingPercentage)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.requirementByBonding)}</td>
                                <td className="px-3 py-2 text-right font-mono border-l">{formatNumber(row.stockAdjustment)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.adjustedRequirement)}</td>
                                <td className="px-3 py-2 text-right font-mono border-l">{formatNumber(row.forecastT3)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.netRequirement)}</td>
                                <td className="px-3 py-2 text-right font-mono border-l">{formatNumber(row.targetArrival)}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatPercent(row.d1Weight)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-lg text-[#003580] bg-[#e6f0ff] border-l sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">{formatNumber(row.finalIndent, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="font-bold text-slate-800 bg-slate-200 sticky bottom-0 z-30">
                        <tr>
                            <td className="px-4 py-3 text-left sticky left-0 bg-slate-200 z-30 border-r">TOTALS</td>
                            <td className="px-3 py-2 text-right bg-slate-200">{formatNumber(totals.bonding)}</td>
                            <td className="px-3 py-2 text-right bg-slate-200">100.00%</td>
                            <td className="px-3 py-2 text-right bg-slate-200">{formatNumber(totals.requirementByBonding)}</td>
                            <td className="px-3 py-2 text-right border-l bg-slate-200">{formatNumber(totals.stockAdjustment)}</td>
                            <td className="px-3 py-2 text-right bg-slate-200">{formatNumber(totals.adjustedRequirement)}</td>
                            <td className="px-3 py-2 text-right border-l bg-slate-200">{formatNumber(totals.forecastT3)}</td>
                            <td className="px-3 py-2 text-right bg-slate-200">{formatNumber(totals.netRequirement)}</td>
                            <td className="px-3 py-2 text-right border-l bg-slate-200">{formatNumber(totals.targetArrival)}</td>
                            <td className="px-3 py-2 text-right bg-slate-200"></td>
                            <td className="px-4 py-3 text-right bg-[#e6f0ff] text-[#001f4c] text-lg border-l sticky right-0 z-30 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">{formatNumber(totals.finalIndent, 2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
