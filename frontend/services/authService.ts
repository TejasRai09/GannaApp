import type { User } from '../types';

const API_BASE = '/api';

interface LoginResponse {
    ok: boolean;
    token: string;
    user: any;
    error?: string;
}

export interface AuthSession {
    token: string;
    user: User;
}

const mapUser = (raw: any): User => ({
    id: String(raw.id ?? raw.user_id ?? ''),
    email: raw.email ?? '',
    name: raw.name ?? raw.full_name ?? raw.username ?? '',
    // Least privilege when the server sends something unexpected: an unknown
    // role must never be read as more access than it is.
    role: (raw.role ?? 'viewer') as User['role'],
    organizationId: String(raw.orgId ?? raw.org_id ?? raw.organization_id ?? raw.organizationId ?? ''),
    authProvider: (raw.authProvider ?? raw.auth_provider ?? 'local') as User['authProvider'],
    lastLoginAt: raw.lastLoginAt ?? raw.last_login_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
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

    /**
     * Sign in with Microsoft.
     *
     * The ID token is posted to the server, which verifies its signature
     * against Microsoft's published keys before trusting a single claim in it.
     * A first-time signer is provisioned as a VIEWER: the directory proves who
     * someone is, not what they may do.
     */
    async loginWithMicrosoft(idToken: string): Promise<AuthSession> {
        const resp = await fetch(`${API_BASE}/auth/microsoft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        const data: LoginResponse = await resp.json().catch(() => ({ ok: false, error: 'Invalid response' } as any));
        if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'Microsoft sign-in failed');
        }
        return { token: data.token, user: mapUser(data.user) };
    },

    async changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
        const resp = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data: any = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Could not change the password');
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