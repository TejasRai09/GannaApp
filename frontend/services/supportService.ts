import { apiFetch } from './apiClient';
import type { SupportTicketStatus } from '../types';

export async function createTicket(token: string, subject: string, description: string, category?: string) {
  return apiFetch(`/api/support`, {
    method: 'POST',
    token,
    body: JSON.stringify({ subject, description, category })
  });
}

export async function fetchMyOrgTickets(token: string) {
  return apiFetch(`/api/support/my-org`, { token });
}

export async function fetchAllTickets(token: string) {
  return apiFetch(`/api/support/all`, { token });
}

export async function updateTicketStatus(token: string, id: string, status: SupportTicketStatus, category?: string) {
  return apiFetch(`/api/support/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ status, category })
  });
}
