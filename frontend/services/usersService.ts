import { apiFetch } from './apiClient';

export async function fetchMyOrgUsers(token: string) {
  return apiFetch(`/api/users/my-org`, { token });
}

export async function fetchAllUsers(token: string, orgId?: string) {
  const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
  return apiFetch(`/api/users/all${qs}`, { token });
}

export async function createUser(token: string, body: any) {
  return apiFetch(`/api/users`, {
    method: 'POST',
    token,
    body: JSON.stringify(body)
  });
}

export async function deleteUser(token: string, userId: string) {
  return apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    token,
  });
}
