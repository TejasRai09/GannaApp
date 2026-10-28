/**
 * Version 2 feedback loop — the plant team's own number, entered beside the
 * app's recommendation.
 *
 * Design rule: blank means agreement. The cane department enters a number ONLY
 * for centres they would order differently. If the app demanded a figure
 * against every centre every day it would be abandoned inside a week, and we
 * would learn nothing.
 *
 * A reason is asked for only once the gap is material (REASON_THRESHOLD), so
 * rounding a number up or down does not trigger a form.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { ReasonCode } from '../services/feedbackService';

/** Ask for a reason once the plant team's number differs by more than this. */
export const REASON_THRESHOLD = 0.10;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  centreId: string;
  appIndent: number;
  value: number | null;
  reasonCode: string | null;
  reasonNote: string | null;
  reasonCodes: ReasonCode[];
  saveState: SaveState;
  disabled?: boolean;
  onChange: (
    centreId: string,
    value: number | null,
    reasonCode: string | null,
    reasonNote: string | null,
  ) => void;
}

export const needsReason = (value: number | null, appIndent: number): boolean => {
  if (value === null) return false;
  if (appIndent <= 0) return value > 0;
  return Math.abs(value - appIndent) / appIndent > REASON_THRESHOLD;
};

export const PlantInputCell: React.FC<Props> = ({
  centreId, appIndent, value, reasonCode, reasonNote, reasonCodes,
  saveState, disabled, onChange,
}) => {
  // Local text state so typing is not fought by re-renders from the parent.
  const [text, setText] = useState(value === null ? '' : String(value));
  const lastCommitted = useRef<string>(value === null ? '' : String(value));

  useEffect(() => {
    const next = value === null ? '' : String(value);
    // Only accept an external change when it really differs, otherwise the
    // caret jumps while the user is mid-edit.
    if (next !== lastCommitted.current) {
      setText(next);
      lastCommitted.current = next;
    }
  }, [value]);

  const parsed = text.trim() === '' ? null : Number(text);
  const invalid = text.trim() !== '' && (!Number.isFinite(parsed) || (parsed as number) < 0);
  const requiresReason = !invalid && needsReason(parsed, appIndent);
  const missingReason = requiresReason && !reasonCode;

  const commit = () => {
    if (invalid) return;
    if (text === lastCommitted.current) return;
    lastCommitted.current = text;
    // Clearing the number clears its reason too, so a stale reason cannot
    // outlive the disagreement it explained.
    onChange(centreId, parsed, parsed === null ? null : reasonCode, parsed === null ? null : reasonNote);
  };

  const diffPct = value !== null && appIndent > 0 ? ((value - appIndent) / appIndent) * 100 : null;

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
          aria-label={`Your indent number for centre ${centreId}. Leave blank to agree with the app.`}
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

      {!invalid && diffPct !== null && Math.abs(diffPct) >= 0.05 && (
        <span className={`text-[10px] font-medium ${Math.abs(diffPct) > REASON_THRESHOLD * 100 ? 'text-amber-700' : 'text-slate-400'}`}>
          {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}% vs app
        </span>
      )}

      {requiresReason && (
        <div className="flex flex-col items-end gap-1 w-44">
          <select
            value={reasonCode ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(centreId, parsed, e.target.value || null, reasonNote)}
            aria-label={`Reason for differing from the app at centre ${centreId}`}
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
                if (note !== (reasonNote ?? null)) onChange(centreId, parsed, reasonCode, note);
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
