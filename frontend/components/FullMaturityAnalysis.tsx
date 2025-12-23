
import React, { useState, useMemo } from 'react';
import type { CalculationResults, CenterDWeights, ClosedIndentAnalysis } from '../types';
import { FileSpreadsheet, Percent, Filter } from 'lucide-react';

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);

const SeasonAverageCard: React.FC<{ weights?: CenterDWeights }> = ({ weights }) => {
    if (!weights) return null;

    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
             <div className="flex items-center gap-2 mb-3">
                <Percent size={20} className="text-[#003580]" />
                <h3 className="text-lg font-bold text-slate-900">Season Average D-Weights</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
                These are the weighted averages for this center across all closed indents this season, calculated using the special fallback logic. These values are used as the primary fallback when recent averages are unreliable.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm font-bold uppercase text-slate-500">Avg D1</p>
                    <p className="text-2xl font-semibold text-[#003580] font-mono">{(weights.d1 * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm font-bold uppercase text-slate-500">Avg D2</p>
                    <p className="text-2xl font-semibold text-[#003580] font-mono">{(weights.d2 * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm font-bold uppercase text-slate-500">Avg D3</p>
                    <p className="text-2xl font-semibold text-[#003580] font-mono">{(weights.d3 * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm font-bold uppercase text-slate-500">Avg D4</p>
                    <p className="text-2xl font-semibold text-[#003580] font-mono">{(weights.d4 * 100).toFixed(2)}%</p>
                </div>
            </div>
        </div>
    );
};

export const FullMaturityAnalysis: React.FC<{ results: CalculationResults }> = ({ results }) => {
    const { fullSeasonAnalysis, seasonDWeights } = results;
    const [selectedCenterId, setSelectedCenterId] = useState('all');

    const allCenters = useMemo(() => [
        { centreId: 'all', centreName: 'All Centers' },
        ...seasonDWeights.map(c => ({ centreId: c.centreId, centreName: c.centreName }))
            .sort((a, b) => a.centreName.localeCompare(b.centreName))
    ], [seasonDWeights]);
    
    const filteredSeasonAnalysis = useMemo(() => 
        selectedCenterId === 'all' 
            ? fullSeasonAnalysis 
            : fullSeasonAnalysis.filter(row => row.centreId === selectedCenterId), 
        [fullSeasonAnalysis, selectedCenterId]
    );

    const selectedCenterSeasonWeights = useMemo(() =>
        seasonDWeights.find(row => row.centreId === selectedCenterId),
        [seasonDWeights, selectedCenterId]
    );

    return (
        <div className="space-y-8">
            <div className="bg-slate-50 p-4 rounded-lg border">
                <label htmlFor="center-filter-full-maturity" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Filter size={16} /> Filter by Center
                </label>
                <select 
                    id="center-filter-full-maturity"
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    className="block w-full sm:w-72 p-2 text-sm border-slate-300 rounded-md shadow-sm focus:ring-[#003580] focus:border-[#003580]"
                >
                    {allCenters.map(center => (
                        <option key={center.centreId} value={center.centreId}>{center.centreName}</option>
                    ))}
                </select>
            </div>

            {selectedCenterId !== 'all' && <SeasonAverageCard weights={selectedCenterSeasonWeights} />}

            <div>
                 <div className="overflow-auto max-h-[600px] border rounded-lg custom-scrollbar">
                    <table className="min-w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                            <tr>
                                {["Centre", "Indent Date", "Indent Qty", "D1 Pur", "D2 Pur", "D3 Pur", "D4 Pur", "Total Pur", "D1 %", "D2 %", "D3 %", "D4 %"].map(h => 
                                    <th key={h} scope="col" className="px-4 py-3 bg-slate-100">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSeasonAnalysis.map((row, i) => (
                                <tr key={`${row.centreId}-${row.raisedFor.toISOString()}-${i}`} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{row.centreName}</td>
                                    <td className="px-4 py-3">{formatDate(row.raisedFor)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{row.indentQty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono">{row.d1Purchases.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right font-mono">{row.d2Purchases.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right font-mono">{row.d3Purchases.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right font-mono">{row.d4Purchases.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right font-semibold font-mono">{row.totalPurchases.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-600">{row.indentQty > 0 ? ((row.d1Purchases / row.indentQty) * 100).toFixed(2) + '%' : 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-600">{row.indentQty > 0 ? ((row.d2Purchases / row.indentQty) * 100).toFixed(2) + '%' : 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-600">{row.indentQty > 0 ? ((row.d3Purchases / row.indentQty) * 100).toFixed(2) + '%' : 'N/A'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-600">{row.indentQty > 0 ? ((row.d4Purchases / row.indentQty) * 100).toFixed(2) + '%' : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
