import { apiFetch } from './apiClient';

export async function fetchOrgs(token: string) {
  return apiFetch(`/api/orgs`, { token });
}

export async function createOrg(token: string, name: string, type?: string) {
  return apiFetch(`/api/orgs`, {
    method: 'POST',
    token,
    body: JSON.stringify({ name, type })
  });
}

export async function deleteOrg(token: string, orgId: string) {
  return apiFetch(`/api/orgs/${encodeURIComponent(orgId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchMyOrg(token: string) {
  return apiFetch(`/api/orgs/me`, { token });
}
