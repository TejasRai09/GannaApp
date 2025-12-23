import { apiFetch } from './apiClient';
import type { CalculationInputs, CalculationResults, CalculationRun } from '../types';

export async function saveCalculation(token: string, name: string, inputs: CalculationInputs, results: CalculationResults) {
  return apiFetch(`/api/calculations`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name, inputs, results })
  });
}

export async function fetchCalculations(token: string) {
  return apiFetch<{ ok: boolean; runs: any[] }>(`/api/calculations/my-org`, { token });
}
