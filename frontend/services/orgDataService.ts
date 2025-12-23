import { apiFetch } from './apiClient';

export type OrgDataKind = 'bonding' | 'indent' | 'purchase';

export interface OrgDataFile<T> {
  id?: number;
  org_id?: number;
  data_type?: string;
  file_name: string;
  data_json?: string;
  data: T[];
  last_updated?: string;
}

export async function fetchOrgData<T = any>(token: string) {
  return apiFetch<{ ok: boolean; files: OrgDataFile<T>[] }>(`/api/org-data/my-org`, { token });
}

export async function saveOrgData<T = any>(token: string, kind: OrgDataKind, fileName: string, data: T[]) {
  return apiFetch(`/api/org-data/${kind}`, {
    method: 'POST',
    token,
    body: JSON.stringify({ fileName, data }),
  });
}
