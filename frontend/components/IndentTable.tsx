import React from 'react';
import type { CalculationResults } from '../types';
import { ClipboardList, Download } from 'lucide-react';
import { exportToCsv } from '../services/exportService';

interface IndentTableProps {
    results: CalculationResults;
    calculationName: string;
}

export const IndentTable: React.FC<IndentTableProps> = ({ results, calculationName }) => {
    const { tableData } = results;

    const totalIndentToRaise = tableData.reduce((sum, row) => sum + row.indentToRaise, 0);
    const totalBonding = tableData.reduce((sum, row) => sum + row.bonding, 0);
    
    const handleExport = () => {
        const dataToExport = tableData.map(row => ({
            'Centre ID': row.centreId,
            'Centre Name': row.centreName,
            'Actual Bonding (Qtls)': row.bonding,
            'Bonding %': totalBonding > 0 ? (row.bonding / totalBonding * 100).toFixed(2) : '0.00',
            'Adjusted': row.adjusted,
            'Forecast (T+3)': row.forecastT3,
            'Indent To Raise Today': row.indentToRaise,
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
            <div className="overflow-auto max-h-[600px] border rounded-lg custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-20">
                        <tr>
                            <th scope="col" className="px-6 py-3 rounded-tl-lg bg-slate-100">Centre</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100">Actual Bonding (Qtls)</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100">Bonding %</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100">Adjusted</th>
                            <th scope="col" className="px-6 py-3 text-right bg-slate-100">Forecast (T+3)</th>
                            <th scope="col" className="px-6 py-3 rounded-tr-lg text-right bg-[#e6f0ff] text-[#001f4c] font-bold sticky right-0 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Indent To Raise Today</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row) => {
                            const bondingPercentage = totalBonding > 0 ? (row.bonding / totalBonding) * 100 : 0;
                            return (
                                <tr key={row.centreId} className="bg-white border-b hover:bg-slate-50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                        {row.centreName} <span className="text-slate-400">({row.centreId})</span>
                                    </th>
                                    <td className="px-6 py-4 text-right">{row.bonding.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-600 italic">{bondingPercentage.toFixed(2)}%</td>
                                    <td className="px-6 py-4 text-right">{row.adjusted.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">{row.forecastT3.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-lg text-[#003580] bg-[#e6f0ff] sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">{row.indentToRaise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="font-bold text-slate-800 bg-slate-100 sticky bottom-0 z-20">
                        <tr>
                            <td className="px-6 py-4 text-left rounded-bl-lg bg-slate-100">TOTALS</td>
                            <td className="px-6 py-4 text-right bg-slate-100">{totalBonding.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right bg-slate-100">100.00%</td>
                            <td colSpan={2} className="px-6 py-4 bg-slate-100"></td>
                            <td className="px-6 py-4 text-right bg-[#e6f0ff] text-[#001f4c] text-lg rounded-br-lg sticky right-0 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">{totalIndentToRaise.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};