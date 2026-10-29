/**
 * Version 2 feedback loop — client for /api/feedback.
 *
 * What gets compared is the FORECAST, not the order. The indent is the plant
 * team's own decision, so recording their indent number measured nothing; the
 * prediction hidden inside an indent is "if we order this much, how much cane
 * will actually come in?". That is what the model predicts, and the one thing
 * both sides can be judged on.
 *
 * Recorded per centre per delivery day:
 *   1. the app's recommendation, and the arrival it expects against it
 *      (saved automatically after each run)
 *   2. the cane the plant team expects to arrive, the order their expectation
 *      assumes, and why they differ  (entered by hand, only where they differ)
 *   3. what was actually indented
 *   4. what actually arrived         (known three days later)
 *
 * Both forecasts are scored against (4), never against each other, and never
 * against (3) — the order is a decision, only the arrival is a fact.
 */
import { apiFetch } from './apiClient';
import type { IndentResultRow } from '../types';

export interface ReasonCode {
  code: string;
  label: string;
}

export interface LedgerRow {
  delivery_date: string;
  centre_id: string;
  centre_name: string | null;
  is_gate: 0 | 1;
  app_indent: string | null;
  app_expected_arrival: string | null;
  excel_indent: string | null;
  plant_indent: string | null;
  plant_expected_arrival: string | null;
  plant_basis_indent: string | null;
  reason_code: string | null;
  reason_note: string | null;
  saw_recommendation: 0 | 1 | null;
  actual_indent: string | null;
  actual_arrival: string | null;
  requirement: string | null;
  d1_weight: string | null;
  ml_maturity: string | null;
  week_of_season: number | null;
}

/**
 * One delivery day, both ordering decisions measured against the requirement.
 *
 *   requirement  what the mill needed
 *   ordered      what the plant team actually indented
 *   arrived      what actually turned up against that order
 *   appOrdered   what the app said to order
 *   appArrived   what the app's order WOULD have brought, at the yield
 *                actually observed that day
 */
export interface ScorecardDay {
  deliveryDate: string;
  centres: number;
  requirement: number;
  ordered: number;
  appOrdered: number;
  arrived: number;
  appArrived: number;
  /** Signed: positive means more cane than needed, negative means short. */
  plantMiss: number;
  appMiss: number;
  winner: 'app' | 'plant' | 'tie';
}

export interface ScorecardCentre {
  centreId: string;
  centreName: string | null;
  isGate: boolean;
  centres: number;
  requirement: number;
  ordered: number;
  appOrdered: number;
  arrived: number;
  appArrived: number;
  plantMiss: number;
  appMiss: number;
}

export interface ScorecardTotals {
  days: number;
  centres: number;
  requirement: number;
  ordered: number;
  appOrdered: number;
  arrived: number;
  appArrived: number;
  plantAbsError: number;
  appAbsError: number;
  /** Signed, summed over days: the direction the mill was wrong in. */
  plantBias: number;
  appBias: number;
  plantWins: number;
  appWins: number;
}

export interface Scorecard {
  overall: ScorecardTotals;
  byDay: ScorecardDay[];
  byCentre: ScorecardCentre[];
  coverage: {
    total_days: number;
    total_rows: number;
    with_ordered: number;
    with_arrived: number;
  };
}

/** MySQL DATE wants YYYY-MM-DD, and it must be the local date, not UTC. */
export const toIsoDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Numeric columns come back from MySQL as strings. */
export const n = (v: string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * The cane the app expects to actually receive against its own recommendation.
 *
 * mlMaturity is TOTAL maturity — every purchase linked back to the indent, over
 * all the days the cane trickles in on — which is exactly how actual_arrival is
 * measured, so the two are directly comparable.
 *
 * In normal mode this equals the requirement, because the recommendation is
 * requirement / maturity. It is still computed from the recommendation rather
 * than read off the requirement, because late-season wind-down mode sets the
 * indent to the mill's own latest placement and breaks that identity.
 */
export const appExpectedArrival = (row: IndentResultRow): number | null =>
  row.mlMaturity && row.mlMaturity > 0 ? row.indentToRaise * row.mlMaturity : null;

export const getReasonCodes = (token: string) =>
  apiFetch<{ ok: boolean; reasonCodes: ReasonCode[] }>('/api/feedback/reason-codes', { token });

/**
 * Save what the app recommended. Called after each calculation run; safe to
 * call repeatedly for the same day, as it only overwrites the app's own
 * columns and leaves any plant-team entry or outcome untouched.
 */
export const savePredictions = (
  token: string,
  deliveryDate: Date,
  rows: IndentResultRow[],
  isGateMap: Map<string, boolean>,
  runId?: number,
) =>
  apiFetch<{ ok: boolean; saved: number }>('/api/feedback/predictions', {
    method: 'POST',
    token,
    body: JSON.stringify({
      deliveryDate: toIsoDate(deliveryDate),
      runId,
      rows: rows.map((r) => ({
        centreId: r.centreId,
        centreName: r.centreName,
        isGate: isGateMap.get(r.centreId) ?? false,
        appIndent: r.indentToRaise,
        appExpectedArrival: appExpectedArrival(r),
        excelIndent: r.dWeightIndent,
        requirement: r.mlAdjusted ?? r.adjusted,
        forecastT3: r.forecastT3,
        mlMaturity: r.mlMaturity,
        weekOfSeason: r.weekOfSeason,
      })),
    }),
  });

/**
 * The plant team's forecast for one centre: the cane they expect to receive,
 * and the order that expectation assumes.
 *
 * basisIndent must be the order the number was typed against — the app's
 * recommendation unless they said they will order something else. It is sent
 * and stored rather than inferred later, so a re-run that moves the
 * recommendation cannot silently rewrite the yield they implied.
 *
 * Pass plantExpectedArrival: null to clear the entry.
 */
export const savePlantExpectation = (
  token: string,
  deliveryDate: Date,
  centreId: string,
  plantExpectedArrival: number | null,
  basisIndent: number | null,
  plantIndent: number | null = null,
  reasonCode?: string | null,
  reasonNote?: string | null,
  sawRecommendation = true,
) =>
  apiFetch<{ ok: boolean }>('/api/feedback/plant', {
    method: 'PUT',
    token,
    body: JSON.stringify({
      deliveryDate: toIsoDate(deliveryDate),
      centreId,
      plantExpectedArrival,
      basisIndent,
      plantIndent,
      reasonCode,
      reasonNote,
      sawRecommendation,
    }),
  });

export const saveOutcomes = (
  token: string,
  deliveryDate: Date,
  rows: { centreId: string; actualIndent?: number | null; actualArrival?: number | null }[],
  source: 'manual' | 'import' = 'import',
) =>
  apiFetch<{ ok: boolean; updated: number }>('/api/feedback/outcomes', {
    method: 'POST',
    token,
    body: JSON.stringify({ deliveryDate: toIsoDate(deliveryDate), rows, source }),
  });

/**
 * Backfill outcomes (3) and (4) from the uploaded files, so the plant team
 * never has to type them in.
 *
 *   actual_indent  = indent rows whose Indent Date is that delivery day
 *   actual_arrival = purchase rows linked back to that same Indent Date
 *
 * The purchase file carries the Indent Date it fulfils, which is what makes
 * the arrival attributable to the order that caused it. Arrivals keep landing
 * for about three days after the delivery date, so recent days are swept
 * repeatedly and simply firm up as the late deliveries come in.
 */
export const syncOutcomes = async (
  token: string,
  indentRows: any[],
  purchaseRows: any[],
  dates: Date[],
  centerMapping: { [k: string]: string } = {},
): Promise<{ days: number; rowsWritten: number }> => {
  const pick = (row: any, keys: string[]): string => {
    for (const k of keys) {
      for (const actual of Object.keys(row)) {
        if (actual.trim().toLowerCase() === k.toLowerCase()) {
          const v = row[actual];
          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
        }
      }
    }
    return '';
  };
  const qty = (row: any) => Number(pick(row, ['Qty in Qtls', 'Qty'])) || 0;
  const mapped = (code: string) => centerMapping[code] || code;

  // Bucket both files by delivery date once, rather than re-scanning per day.
  const byDate = (rows: any[], dateKeys: string[]) => {
    const out = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const raw = pick(r, dateKeys);
      if (!raw) continue;
      const d = parseLooseDate(raw);
      if (!d) continue;
      const key = toIsoDate(d);
      const centre = mapped(pick(r, ['Code', 'c_Code']));
      if (!centre) continue;
      if (!out.has(key)) out.set(key, new Map());
      const m = out.get(key)!;
      m.set(centre, (m.get(centre) || 0) + qty(r));
    }
    return out;
  };

  const indentByDate = byDate(indentRows, ['Indent Date']);
  const arrivalByDate = byDate(purchaseRows, ['Indent Date']);

  let days = 0, rowsWritten = 0;
  for (const d of dates) {
    const key = toIsoDate(d);
    const ind = indentByDate.get(key);
    const arr = arrivalByDate.get(key);
    if (!ind && !arr) continue;

    const centres = new Set<string>([...(ind?.keys() ?? []), ...(arr?.keys() ?? [])]);
    const rows = Array.from(centres).map((centreId) => ({
      centreId,
      actualIndent: ind?.get(centreId) ?? null,
      actualArrival: arr?.get(centreId) ?? null,
    }));
    if (rows.length === 0) continue;

    try {
      const r = await saveOutcomes(token, d, rows, 'import');
      rowsWritten += r.updated;
      days++;
    } catch {
      // A day with no prediction rows yet simply has nothing to attach to.
      // That is normal when backfilling, so it must not abort the sweep.
    }
  }
  return { days, rowsWritten };
};

/** Handles the dd-mm-yyyy / dd-MMM-yyyy / ISO forms the uploaded files use. */
const parseLooseDate = (s: string): Date | null => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const m = /^(\d{1,2})[-/\s]([A-Za-z]{3,}|\d{1,2})[-/\s](\d{2,4})/.exec(s);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = /^\d+$/.test(m[2]) ? Number(m[2]) - 1 : MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (mon < 0 || mon > 11 || !day) return null;
  return new Date(year, mon, day);
};

export const getLedger = (token: string, from: Date, to: Date, centreId = 'all') =>
  apiFetch<{ ok: boolean; rows: LedgerRow[] }>(
    `/api/feedback/ledger?from=${toIsoDate(from)}&to=${toIsoDate(to)}&centreId=${encodeURIComponent(centreId)}`,
    { token },
  );

export const getScorecard = (token: string, from: Date, to: Date) =>
  apiFetch<{ ok: boolean } & Scorecard>(
    `/api/feedback/scorecard?from=${toIsoDate(from)}&to=${toIsoDate(to)}`,
    { token },
  );

/**
 * Volume-weighted accuracy: total absolute miss as a share of total
 * requirement, subtracted from 100. The same measure used to validate v1.
 * Averaging daily percentages would let a near-zero day dominate.
 */
export const fulfilmentPct = (absError: number, requirement: number): number | null =>
  requirement > 0 ? 100 - (absError / requirement) * 100 : null;

/**
 * Signed miss as a share of requirement. Positive means more cane arrived than
 * was needed — the yard builds up. Negative means the mill ran short. The two
 * cost very different things, so the direction is reported, not just the size.
 */
export const biasPct = (bias: number, requirement: number): number | null =>
  requirement > 0 ? (bias / requirement) * 100 : null;

/** Delivered share of what was ordered. */
export const yieldPct = (arrived: number, ordered: number): number | null =>
  ordered > 0 ? (arrived / ordered) * 100 : null;
