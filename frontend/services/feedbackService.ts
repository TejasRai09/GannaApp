/**
 * Version 2 feedback loop — client for /api/feedback.
 *
 * Four numbers are recorded per centre per delivery day:
 *   1. what the app recommended      (saved automatically after each run)
 *   2. what the plant team would order, and why  (entered by hand, only where they disagree)
 *   3. what was actually indented
 *   4. what actually arrived         (known three days later)
 *
 * Both (1) and (2) are later scored against (4) — never against each other.
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
  excel_indent: string | null;
  plant_indent: string | null;
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

export interface ScorecardGroup {
  cases: number;
  actual_volume: string | null;
  app_abs_error: string | null;
  plant_abs_error: string | null;
  app_wins: number;
  plant_wins: number;
  centre_id?: string;
  centre_name?: string;
  is_gate?: 0 | 1;
  reason_code?: string;
}

export interface Scorecard {
  overall: ScorecardGroup;
  byCentre: ScorecardGroup[];
  byReason: ScorecardGroup[];
  coverage: { total_rows: number; with_plant: number; with_arrival: number };
}

/** MySQL DATE wants YYYY-MM-DD, and it must be the local date, not UTC. */
export const toIsoDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Numeric columns come back from MySQL as strings. */
export const n = (v: string | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

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
        excelIndent: r.dWeightIndent,
        requirement: r.mlAdjusted ?? r.adjusted,
        forecastT3: r.forecastT3,
        mlMaturity: r.mlMaturity,
        weekOfSeason: r.weekOfSeason,
      })),
    }),
  });

/** The plant team's own number. Pass plantIndent: null to clear it. */
export const savePlantInput = (
  token: string,
  deliveryDate: Date,
  centreId: string,
  plantIndent: number | null,
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
 * Volume-weighted accuracy, the same measure used to validate v1: total
 * absolute gap over total actual volume. Averaging daily percentages would let
 * near-zero days dominate the result.
 */
export const accuracyPct = (absError: string | null, volume: string | null): number | null => {
  const e = n(absError), v = n(volume);
  if (e === null || v === null || v <= 0) return null;
  return 100 - (e / v) * 100;
};
