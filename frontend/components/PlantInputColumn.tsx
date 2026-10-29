/**
 * Version 2.1 feedback loop — the plant team's FORECAST, entered beside the
 * app's.
 *
 * Version 2 asked them for their own indent number. That measured nothing: the
 * indent is already their decision, so the column just recorded the same number
 * twice. The prediction actually buried inside an indent is "if we order this
 * much, how much cane will come in?" — so that is what this column asks for,
 * and it is the only thing both sides can be scored on.
 *
 * Design rule, unchanged: blank means agreement. The cane department enters a
 * number ONLY where they expect something different from the app. A form that
 * demanded a figure against every centre every day would be abandoned inside a
 * week, and we would learn nothing.
 *
 * A reason is asked for only once the two forecasts differ materially
 * (REASON_THRESHOLD), so rounding a number up or down does not trigger a form.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { ReasonCode } from '../services/feedbackService';

/** Ask for a reason once the two forecasts imply yields this far apart. */
export const REASON_THRESHOLD = 0.10;

/** Above this implied yield the number is almost certainly a typo, not a view. */
const IMPLAUSIBLE_YIELD = 2.0;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  centreId: string;
  /** What the app recommends ordering — the default basis for the forecast. */
  appIndent: number;
  /** What the app expects to actually receive against that order. */
  appExpected: number | null;
  /** The plant team's expected arrival, in quintals. */
  value: number | null;
  /** Their own order plan, if they intend to order something other than appIndent. */
  basisIndent: number | null;
  reasonCode: string | null;
  reasonNote: string | null;
  reasonCodes: ReasonCode[];
  saveState: SaveState;
  disabled?: boolean;
  onChange: (
    centreId: string,
    value: number | null,
    basisIndent: number | null,
    reasonCode: string | null,
    reasonNote: string | null,
  ) => void;
}

/** The order a forecast is stated against: their own plan, else the app's. */
export const basisFor = (basisIndent: number | null, appIndent: number): number =>
  basisIndent !== null && basisIndent > 0 ? basisIndent : appIndent;

/**
 * Both forecasts compared as yields, which is how the scorecard compares them.
 * Comparing quintals would flag a disagreement whenever they simply plan to
 * order a different amount, even where both expect the same delivery rate.
 */
export const needsReason = (
  value: number | null,
  basisIndent: number | null,
  appIndent: number,
  appExpected: number | null,
): boolean => {
  if (value === null) return false;
  // With no app forecast there is nothing to differ from, so nothing to explain.
  if (appExpected === null || appIndent <= 0) return false;
  const basis = basisFor(basisIndent, appIndent);
  if (basis <= 0) return false;
  const appYield = appExpected / appIndent;
  if (appYield <= 0) return value > 0;
  return Math.abs(value / basis - appYield) / appYield > REASON_THRESHOLD;
};

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

export const PlantInputCell: React.FC<Props> = ({
  centreId, appIndent, appExpected, value, basisIndent, reasonCode, reasonNote,
  reasonCodes, saveState, disabled, onChange,
}) => {
  // Local text state so typing is not fought by re-renders from the parent.
  const [text, setText] = useState(value === null ? '' : String(value));
  const lastCommitted = useRef<string>(value === null ? '' : String(value));
  const [basisText, setBasisText] = useState(basisIndent === null ? '' : String(basisIndent));
  // With no recommendation there is no default order to state the forecast
  // against, so the basis has to be asked for straight away.
  const [showBasis, setShowBasis] = useState(basisIndent !== null || appIndent <= 0);

  useEffect(() => {
    const next = value === null ? '' : String(value);
    // Only accept an external change when it really differs, otherwise the
    // caret jumps while the user is mid-edit.
    if (next !== lastCommitted.current) {
      setText(next);
      lastCommitted.current = next;
    }
  }, [value]);

  useEffect(() => {
    setBasisText(basisIndent === null ? '' : String(basisIndent));
    if (basisIndent !== null) setShowBasis(true);
  }, [basisIndent]);

  const parsed = text.trim() === '' ? null : Number(text);
  const invalid = text.trim() !== '' && (!Number.isFinite(parsed) || (parsed as number) < 0);

  const parsedBasis = basisText.trim() === '' ? null : Number(basisText);
  const basisInvalid = basisText.trim() !== ''
    && (!Number.isFinite(parsedBasis) || (parsedBasis as number) <= 0);
  const effectiveBasis = basisFor(basisInvalid ? null : parsedBasis, appIndent);

  const requiresReason = !invalid
    && needsReason(parsed, basisInvalid ? null : parsedBasis, appIndent, appExpected);
  const missingReason = requiresReason && !reasonCode;

  const plantYield = !invalid && parsed !== null && effectiveBasis > 0 ? parsed / effectiveBasis : null;
  const appYield = appExpected !== null && appIndent > 0 ? appExpected / appIndent : null;
  const implausible = plantYield !== null && plantYield > IMPLAUSIBLE_YIELD;

  const commit = () => {
    if (invalid || basisInvalid) return;
    if (text === lastCommitted.current) return;
    lastCommitted.current = text;
    // Clearing the forecast clears its reason and basis too, so neither can
    // outlive the disagreement it explained.
    onChange(
      centreId,
      parsed,
      parsed === null ? null : (parsedBasis ?? null),
      parsed === null ? null : reasonCode,
      parsed === null ? null : reasonNote,
    );
  };

  const commitBasis = () => {
    if (basisInvalid) return;
    // A basis on its own is not a forecast, so there is nothing to save yet.
    if (parsed === null) return;
    onChange(centreId, parsed, parsedBasis ?? null, reasonCode, reasonNote);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {saveState === 'saving' && <Loader2 size={13} className="animate-spin text-slate-400" aria-label="Saving" />}
        {saveState === 'saved' && <Check size={13} className="text-green-600" aria-label="Saved" />}
        {saveState === 'error' && <AlertCircle size={13} className="text-red-600" aria-label="Save failed" />}
        <input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="—"
          aria-label={`Cane you expect to arrive at centre ${centreId}, in quintals. Leave blank to agree with the app.`}
          className={`w-28 px-2 py-1.5 text-right rounded-md border text-sm font-semibold
            focus:outline-none focus:ring-2 focus:ring-[#003580]/40
            disabled:bg-slate-100 disabled:text-slate-400
            ${invalid
              ? 'border-red-400 bg-red-50 text-red-700'
              : missingReason
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : value !== null
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700'}`}
        />
      </div>

      {invalid && <span className="text-[10px] text-red-600">Enter a positive number</span>}

      {/* What the app expects, so the plant team has something to react to. */}
      {!invalid && appExpected !== null && (
        <span className="text-[10px] text-slate-400">
          app expects {fmt(appExpected)}
          {appYield !== null && ` (${(appYield * 100).toFixed(0)}%)`}
        </span>
      )}

      {/* Their own implied delivery rate, which is what actually gets scored. */}
      {plantYield !== null && (
        <span className={`text-[10px] font-medium ${
          implausible ? 'text-red-600' : requiresReason ? 'text-amber-700' : 'text-slate-500'}`}>
          you: {(plantYield * 100).toFixed(0)}% of {fmt(effectiveBasis)}
        </span>
      )}

      {implausible && (
        <span className="text-[10px] text-red-600 text-right w-44">
          More than twice the order — check the number
        </span>
      )}

      {/* The basis only needs stating when they plan to order off-recommendation.
          Until then it is the app's number, and asking would be noise. */}
      {parsed !== null && !showBasis && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowBasis(true)}
          className="text-[10px] text-[#003580] underline decoration-dotted hover:no-underline"
        >
          ordering a different amount?
        </button>
      )}

      {showBasis && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">on an order of</span>
          <input
            type="text"
            inputMode="decimal"
            value={basisText}
            disabled={disabled}
            onChange={(e) => setBasisText(e.target.value)}
            onBlur={commitBasis}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder={fmt(appIndent)}
            aria-label={`Order your expectation for centre ${centreId} assumes, in quintals. Leave blank to use the app's recommendation.`}
            className={`w-20 px-1.5 py-1 text-right rounded border text-[11px]
              focus:outline-none focus:ring-2 focus:ring-[#003580]/40
              ${basisInvalid ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}
          />
        </div>
      )}

      {requiresReason && (
        <div className="flex flex-col items-end gap-1 w-44">
          <select
            value={reasonCode ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(centreId, parsed, parsedBasis ?? null, e.target.value || null, reasonNote)}
            aria-label={`Reason your forecast differs from the app at centre ${centreId}`}
            className={`w-full px-1.5 py-1 text-[11px] rounded border bg-white
              focus:outline-none focus:ring-2 focus:ring-[#003580]/40
              ${missingReason ? 'border-amber-400 text-amber-900' : 'border-slate-200 text-slate-700'}`}
          >
            <option value="">Why? (required)</option>
            {reasonCodes.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
          {reasonCode && (
            <input
              type="text"
              defaultValue={reasonNote ?? ''}
              disabled={disabled}
              placeholder="Note (optional)"
              maxLength={500}
              onBlur={(e) => {
                const note = e.target.value.trim() || null;
                if (note !== (reasonNote ?? null)) onChange(centreId, parsed, parsedBasis ?? null, reasonCode, note);
              }}
              aria-label={`Optional note for centre ${centreId}`}
              className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 bg-white text-slate-600
                focus:outline-none focus:ring-2 focus:ring-[#003580]/40"
            />
          )}
        </div>
      )}
    </div>
  );
};
