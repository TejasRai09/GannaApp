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

export async function deleteCalculation(token: string, runId: string) {
  return apiFetch(`/api/calculations/${encodeURIComponent(runId)}`, {
    method: 'DELETE',
    token,
  });
}
