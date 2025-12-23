import React, { useState, useMemo } from 'react';
import type {
  CalculationResults,
  OpenIndentMatrixData,
  OpenIndentMatrixRow,
  OpenIndentMatrixEntry
} from '../types';
import { ForecastCalculationModal } from './ForecastCalculationModal';
import { Filter, TrendingUp, CheckCircle, Minus } from 'lucide-react';
import { addDays, parseDate, isSameDay } from '../services/dateUtils';
import { InfoIcon } from './InfoIcon';

/* ---------------------------------- Utils --------------------------------- */

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);

const toDateSafe = (d: any): Date | null => {
  if (d instanceof Date) return d;
  const parsed = parseDate(d);
  return parsed || null;
};

/* ---------------------------- Modal Data Type ------------------------------- */

interface CalculationModalData {
  centerName: string;
  indentDate: Date;
  purchaseDate: Date;
  indentQty: number;
  dWeight: number;
  dWeightLabel: string;
  forecastValue: number;
}

/* ------------------------------- Summary Card ------------------------------- */

const SummaryCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
}> = ({ title, value, icon, tooltip }) => (
  <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center">
    <div className="p-3 rounded-full mr-4 bg-slate-100 text-slate-600">
      {icon}
    </div>
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <InfoIcon text={tooltip} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

/* ---------------------------- Open Indent Matrix ---------------------------- */

const OpenIndentMatrix: React.FC<{
  matrix: OpenIndentMatrixData;
  headers: Date[];
  currentDate: Date;
  footerData: any;
  onCellClick: (data: CalculationModalData) => void;
}> = ({ matrix, headers, currentDate, footerData, onCellClick }) => {

  const entryMap = useMemo(() => {
    const map = new Map<string, Map<string, OpenIndentMatrixEntry>>();
    matrix.data.forEach(row => {
      const rowMap = new Map<string, OpenIndentMatrixEntry>();
      row.entries.forEach(e => {
        rowMap.set(e.purchaseDate.toISOString(), e);
      });
      map.set(row.indentDate.toISOString(), rowMap);
    });
    return map;
  }, [matrix]);

  const tPlus3 = addDays(currentDate, 3);

  return (
    <div className="overflow-auto max-h-[600px] border rounded-lg">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 bg-slate-100 z-30">
          <tr>
            <th colSpan={3} className="px-4 py-3 sticky left-0 bg-slate-100 z-40">
              INDENT DETAILS
            </th>
            <th colSpan={headers.length} className="px-4 py-3">
              PURCHASE / MATURITY DATE
            </th>
          </tr>
          <tr className="bg-slate-50">
            <th className="sticky left-0 w-[125px]">Indent Given On</th>
            <th className="sticky left-[125px] w-[125px]">Indent Date</th>
            <th className="sticky left-[250px] w-[110px] text-right">Indent Qty</th>
            {headers.map(h => (
              <th key={h.toISOString()} className="min-w-[100px] text-center">
                {formatDate(h)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {matrix.data.map(row => (
            <tr key={row.indentDate.toISOString()}>
              <td className="sticky left-0 bg-white">
                {formatDate(addDays(row.indentDate, -3))}
              </td>
              <td className="sticky left-[125px] bg-white">
                {formatDate(row.indentDate)}
              </td>
              <td className="sticky left-[250px] bg-white text-right">
                {row.indentQty ? Math.round(row.indentQty).toLocaleString() : '-'}
              </td>

              {headers.map(h => {
                const cell = entryMap
                  .get(row.indentDate.toISOString())
                  ?.get(h.toISOString());

                if (cell?.type === 'Forecast') {
                  return (
                    <td key={h.toISOString()} className="bg-green-50 text-right">
                      <button
                        className="w-full hover:underline"
                        onClick={() =>
                          onCellClick({
                            centerName: matrix.centreName,
                            indentDate: row.indentDate,
                            purchaseDate: h,
                            indentQty: cell.indentQty || 0,
                            dWeight: cell.dWeight || 0,
                            dWeightLabel: cell.dWeightLabel || '',
                            forecastValue: cell.quantity
                          })
                        }
                      >
                        {Math.round(cell.quantity).toLocaleString()}
                      </button>
                    </td>
                  );
                }

                return (
                  <td key={h.toISOString()} className="text-right">
                    {cell ? Math.round(cell.quantity).toLocaleString() : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        <tfoot className="bg-slate-100 font-semibold">
          <tr>
            <th colSpan={3} className="sticky left-0 bg-slate-100">
              Forecast from Past Indents
            </th>
            {headers.map(h => {
              const d = footerData?.[h.toISOString()];
              return (
                <td key={h.toISOString()} className="text-right">
                  {isSameDay(h, tPlus3) && d?.forecastFromPast
                    ? Math.round(d.forecastFromPast).toLocaleString()
                    : ''}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/* --------------------------- Forecast Breakdown ----------------------------- */

interface ForecastBreakdownProps {
  results: CalculationResults;
  currentDate: string;
}

export const ForecastBreakdown: React.FC<ForecastBreakdownProps> = ({
  results,
  currentDate: currentDateString
}) => {
  const currentDate =
    toDateSafe(currentDateString) || new Date();

  const headers = useMemo(
    () =>
      (results.openIndentMatrixHeaders || [])
        .map(toDateSafe)
        .filter(Boolean) as Date[],
    [results.openIndentMatrixHeaders]
  );

  const [selectedCenterId, setSelectedCenterId] = useState(
    results.centerDWeights?.[0]?.centreId || 'all'
  );

  const [modalData, setModalData] =
    useState<CalculationModalData | null>(null);

  const matrixToDisplay = useMemo(() => {
    const raw =
      selectedCenterId === 'all'
        ? results.openIndentMatrix?.[0]
        : results.openIndentMatrix?.find(m => m.centreId === selectedCenterId);

    if (!raw) return null;

    return {
      ...raw,
      data: raw.data.map(r => ({
        ...r,
        indentDate: toDateSafe(r.indentDate)!,
        entries: r.entries.map(e => ({
          ...e,
          purchaseDate: toDateSafe(e.purchaseDate)!
        }))
      }))
    };
  }, [results.openIndentMatrix, selectedCenterId]);

  if (!matrixToDisplay) {
    return <div className="p-6 text-center">No data available</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded border">
          <label className="flex gap-2 text-sm font-semibold mb-2">
            <Filter size={16} /> Filter by Center
          </label>
          <select
            value={selectedCenterId}
            onChange={e => setSelectedCenterId(e.target.value)}
            className="p-2 border rounded w-72"
          >
            <option value="all">All Centers</option>
            {results.centerDWeights.map(c => (
              <option key={c.centreId} value={c.centreId}>
                {c.centreName}
              </option>
            ))}
          </select>
        </div>

        <OpenIndentMatrix
          matrix={matrixToDisplay}
          headers={headers}
          currentDate={currentDate}
          footerData={{}}
          onCellClick={setModalData}
        />
      </div>

      <ForecastCalculationModal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
    </>
  );
};
