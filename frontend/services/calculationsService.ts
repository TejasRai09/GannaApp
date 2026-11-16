import { apiFetch } from './apiClient';
import type { CalculationInputs, CalculationResults, CalculationRun } from '../types';

export async function saveCalculation(token: string, name: string, inputs: CalculationInputs, results: CalculationResults) {
  return apiFetch<{ ok: boolean; run?: any }>(`/api/calculations`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name, inputs, results })
  });
}

export async function fetchCalculations(token: string) {
  return apiFetch<{ ok: boolean; runs: any[] }>(`/api/calculations/my-org`, { token });
}

/**
 * One saved run.
 *
 * `summary` drops the three arrays that only the detailed analysis tabs read
 * and that grow with the season (every linked purchase, every season indent).
 * They are most of the payload — by season end they would be tens of megabytes
 * — and the dashboard needs none of them.
 */
export async function fetchCalculation(token: string, runId: string, summary = false) {
  const qs = summary ? '?summary=1' : '';
  return apiFetch<{ ok: boolean; run: any }>(
    `/api/calculations/${encodeURIComponent(runId)}${qs}`, { token });
}

export async function deleteCalculation(token: string, runId: string) {
  return apiFetch(`/api/calculations/${encodeURIComponent(runId)}`, {
    method: 'DELETE',
    token,
  });
}
