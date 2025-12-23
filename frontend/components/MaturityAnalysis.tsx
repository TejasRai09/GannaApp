
import React, { useState, useMemo } from 'react';
import type { CalculationResults, CenterDWeights, ClosedIndentAnalysis } from '../types';
import { TestTube2, Percent, Filter,TrendingUp, CheckCircle } from 'lucide-react';
import { InfoIcon } from './InfoIcon';

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);

const FallbackIndicator: React.FC<{ fallbackUsed?: boolean }> = ({ fallbackUsed }) => {
    if (!fallbackUsed) return null;

    return (
        <div className="absolute top-1 right-1">
            <InfoIcon text="A fallback value (the center's full-season conditional average) was used because the recent average was below the 10% reliability threshold." />
        </div>
    );
};


// Component for the detailed date-vs-date matrix view
const SingleCenterMatrixView: React.FC<{
    closedIndentsInWindow: ClosedIndentAnalysis[]; // This will be the T-7 to T-4 indents for the selected center
    centerWeights: CenterDWeights; // The actual weights calculated and used by the engine
}> = ({ closedIndentsInWindow, centerWeights }) => {
    
    if (closedIndentsInWindow.length === 0) {
        return <p className="text-slate-500 text-sm p-4 bg-slate-50 rounded-lg">No closed indents found for this center in the T-7 to T-4 window.</p>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h4 className="text-md font-semibold text-slate-800 mb-3">Maturity Weights Matrix (%) - (T-7 to T-4)</h4>
                <p className="text-xs text-slate-500 mb-3">This table provides a localized view of performance in the T-7 to T-4 window. Each cell shows <code>(Total Purchases for Day / Total Indent) * 100</code>.</p>
                 <div className="overflow-auto max-h-[500px] border rounded-lg custom-scrollbar">
                    <table className="min-w-full text-sm text-left text-slate-500">
                       <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="px-4 py-3 bg-slate-100">Indent Date</th>
                                <th scope="col" className="px-4 py-3 text-center bg-slate-100">D1 Weight</th>
                                <th scope="col" className="px-4 py-3 text-center bg-slate-100">D2 Weight</th>
                                <th scope="col" className="px-4 py-3 text-center bg-slate-100">D3 Weight</th>
                                <th scope="col" className="px-4 py-3 text-center bg-slate-100">D4 Weight</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {closedIndentsInWindow.map(indent => {
                                const indentQty = indent.indentQty;
                                if (indentQty <= 0) return null;
                                return (
                                    <tr key={indent.raisedFor.toISOString()} className="border-b hover:bg-slate-50 last:border-b-0">
                                        <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{formatDate(indent.raisedFor)}</td>
                                        <td className="px-4 py-2 text-center font-mono">{((indent.d1Purchases / indentQty) * 100).toFixed(2)}%</td>
                                        <td className="px-4 py-2 text-center font-mono">{((indent.d2Purchases / indentQty) * 100).toFixed(2)}%</td>
                                        <td className="px-4 py-2 text-center font-mono">{((indent.d3Purchases / indentQty) * 100).toFixed(2)}%</td>
                                        <td className="px-4 py-2 text-center font-mono">{((indent.d4Purchases / indentQty) * 100).toFixed(2)}%</td>
                                    </tr>
                                );
                             })}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-6 pt-6 border-t">
                     <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={20} className="text-[#003580]" />
                        <h3 className="text-lg font-bold text-slate-900">Average Weights (from T-7 to T-4 indents)</h3>
                    </div>
                     <p className="text-sm text-slate-600 mb-4">This is a simple arithmetic average of the percentage values from the matrix above. These values are used to determine if a fallback is needed below.</p>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <p className="text-sm font-bold uppercase text-slate-500">Avg D1</p>
                            <p className="text-2xl font-semibold text-[#003580] font-mono">{(centerWeights.recent_avg_d1! * 100).toFixed(2)}%</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <p className="text-sm font-bold uppercase text-slate-500">Avg D2</p>
                            <p className="text-2xl font-semibold text-[#003580] font-mono">{(centerWeights.recent_avg_d2! * 100).toFixed(2)}%</p>
                        </div>
                         <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <p className="text-sm font-bold uppercase text-slate-500">Avg D3</p>
                            <p className="text-2xl font-semibold text-[#003580] font-mono">{(centerWeights.recent_avg_d3! * 100).toFixed(2)}%</p>
                        </div>
                         <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <p className="text-sm font-bold uppercase text-slate-500">Avg D4</p>
                            <p className="text-2xl font-semibold text-[#003580] font-mono">{(centerWeights.recent_avg_d4! * 100).toFixed(2)}%</p>
                        </div>
                     </div>
                </div>
                
                <div className="mt-8 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle size={20} className="text-green-600" />
                        <h3 className="text-lg font-bold text-slate-900">Final Forecast Weights</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        These are the final weights used for this center's forecast. If an "Average Weight" above was less than 10%, the center's full-season conditional average (averaging only positive, non-zero ratios) was used as a fallback (indicated by an info icon).
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <FallbackIndicator fallbackUsed={centerWeights.d1_fallback_used} />
                            <p className="text-sm font-bold uppercase text-slate-500">FINAL D1</p>
                            <p className="text-2xl font-semibold text-green-700 font-mono">{(centerWeights.d1 * 100).toFixed(2)}%</p>
                        </div>
                         <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <FallbackIndicator fallbackUsed={centerWeights.d2_fallback_used} />
                            <p className="text-sm font-bold uppercase text-slate-500">FINAL D2</p>
                            <p className="text-2xl font-semibold text-green-700 font-mono">{(centerWeights.d2 * 100).toFixed(2)}%</p>
                        </div>
                         <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <FallbackIndicator fallbackUsed={centerWeights.d3_fallback_used} />
                            <p className="text-sm font-bold uppercase text-slate-500">FINAL D3</p>
                            <p className="text-2xl font-semibold text-green-700 font-mono">{(centerWeights.d3 * 100).toFixed(2)}%</p>
                        </div>
                         <div className="bg-white p-3 rounded-lg border shadow-sm relative">
                            <FallbackIndicator fallbackUsed={centerWeights.d4_fallback_used} />
                            <p className="text-sm font-bold uppercase text-slate-500">FINAL D4</p>
                            <p className="text-2xl font-semibold text-green-700 font-mono">{(centerWeights.d4 * 100).toFixed(2)}%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const MaturityAnalysis: React.FC<{ results: CalculationResults }> = ({ results }) => {
    const { closedIndentAnalysis, centerDWeights } = results;
    const [selectedCenterId, setSelectedCenterId] = useState('all');

    const allCenters = useMemo(() => [
        { centreId: 'all', centreName: 'All Centers' },
        ...centerDWeights.map(c => ({ centreId: c.centreId, centreName: c.centreName }))
            .sort((a, b) => a.centreName.localeCompare(b.centreName))
    ], [centerDWeights]);
    
    // The data source for the main table view is always the T-7 to T-4 window.
    const filteredClosedIndentsForTable = useMemo(() => {
        if (selectedCenterId === 'all') {
            return closedIndentAnalysis;
        }
        return closedIndentAnalysis.filter(row => row.centreId === selectedCenterId);
    }, [closedIndentAnalysis, selectedCenterId]);

    // This is the full weight object for the selected center, containing final weights, recent averages, and fallback flags.
    const selectedCenterWeights = useMemo(() => {
        return centerDWeights.find(c => c.centreId === selectedCenterId);
    }, [centerDWeights, selectedCenterId]);


    return (
        <div className="space-y-8">
            <div className="bg-slate-50 p-4 rounded-lg border">
                <label htmlFor="center-filter-maturity" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Filter size={16} /> Filter by Center
                </label>
                <select 
                    id="center-filter-maturity"
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    className="block w-full sm:w-72 p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-[#003580] focus:border-[#003580]"
                >
                    {allCenters.map(center => (
                        <option key={center.centreId} value={center.centreId}>{center.centreName}</option>
                    ))}
                </select>
            </div>

            {selectedCenterId === 'all' ? (
                <>
                    <div>
                        <div className="overflow-auto max-h-[500px] border rounded-lg custom-scrollbar">
                            <table className="min-w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                                    <tr>
                                        {["Centre", "Indent Date", "Indent Qty", "D1 Purchase", "D2 Purchase", "D3 Purchase", "D4 Purchase", "Total Purchase"].map(h => 
                                            <th key={h} scope="col" className="px-4 py-3 bg-slate-100">{h}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClosedIndentsForTable.map((row, i) => (
                                        <tr key={i} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.centreName}</td>
                                            <td className="px-4 py-3">{formatDate(row.raisedFor)}</td>
                                            <td className="px-4 py-3 text-right">{row.indentQty.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">{row.d1Purchases.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right">{row.d2Purchases.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right">{row.d3Purchases.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right">{row.d4Purchases.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right font-semibold">{row.totalPurchases.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-3">
                            <Percent size={20} /> Final Calculated D-Weights
                        </h3>
                         <div className="overflow-auto max-h-[500px] border rounded-lg custom-scrollbar">
                            <table className="w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                                    <tr>
                                       {["Centre", "D1 Weight", "D2 Weight", "D3 Weight", "D4 Weight"].map(h => 
                                            <th key={h} scope="col" className="px-4 py-3 bg-slate-100">{h}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {centerDWeights.map((row) => (
                                        <tr key={row.centreId} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.centreName}</td>
                                            <td className="px-4 py-3 text-right font-mono">{(row.d1 * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-3 text-right font-mono">{(row.d2 * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-3 text-right font-mono">{(row.d3 * 100).toFixed(2)}%</td>
                                            <td className="px-4 py-3 text-right font-mono">{(row.d4 * 100).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                selectedCenterWeights && <SingleCenterMatrixView 
                    closedIndentsInWindow={filteredClosedIndentsForTable} 
                    centerWeights={selectedCenterWeights}
                />
            )}
        </div>
    );
};
