import type { User } from '../types';

const API_BASE = '/api';

interface LoginResponse {
    ok: boolean;
    token: string;
    user: any;
    error?: string;
}

interface SignupResponse {
    ok?: boolean;
    error?: string;
    userId?: number;
}

export interface AuthSession {
    token: string;
    user: User;
}

const mapUser = (raw: any): User => ({
    id: String(raw.id ?? raw.user_id ?? ''),
    email: raw.email ?? '',
    name: raw.name ?? raw.full_name ?? raw.username ?? '',
    role: (raw.role ?? 'user') as User['role'],
    organizationId: String(raw.org_id ?? raw.organization_id ?? raw.organizationId ?? ''),
    createdAt: raw.created_at ?? new Date().toISOString(),
});

export const authService = {
    async login(email: string, password: string): Promise<AuthSession> {
        const resp = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data: LoginResponse = await resp.json().catch(() => ({ ok: false, error: 'Invalid response' } as any));
        if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'Login failed');
        }
        return { token: data.token, user: mapUser(data.user) };
    },

    async signup(orgId: number, name: string, email: string, password: string): Promise<void> {
        const resp = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, name, email, password })
        });
        const data: SignupResponse = await resp.json().catch(() => ({ ok: false, error: 'Invalid response' }));
        if (!resp.ok || data.ok === false) {
            throw new Error(data.error || 'Signup failed');
        }
    },

    async impersonate(token: string, userId: string): Promise<AuthSession> {
        const resp = await fetch(`${API_BASE}/auth/impersonate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ userId })
        });
        const data: any = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'Impersonation failed');
        }
        return { token: data.token, user: mapUser(data.user) };
    },

    mapUser,
};