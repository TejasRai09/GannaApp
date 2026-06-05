import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { User, Organization } from '../types';
import { authService, type AuthSession } from '../services/authService';
import { fetchMyOrg } from '../services/orgService';

interface AuthContextType {
    currentUser: User | null;
    currentOrganization: Organization | null;
    token: string | null;
    impersonator: User | null;
    login: (session: AuthSession) => void;
    logout: () => void;
    impersonate: (user: User) => void;
    stopImpersonating: () => void;
    isAuthenticated: boolean;
    refreshOrganization: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'gannaapp_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (stored) return JSON.parse(stored).user ?? null;
        } catch { }
        return null;
    });
    const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
    const [token, setToken] = useState<string | null>(() => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (stored) return JSON.parse(stored).token ?? null;
        } catch { }
        return null;
    });
    const [impersonator, setImpersonator] = useState<User | null>(null);

    const login = (session: AuthSession) => {
        setCurrentUser(session.user);
        setToken(session.token);
        try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: session.user, token: session.token }));
        } catch { }
    };

    const logout = () => {
        setCurrentUser(null);
        setImpersonator(null);
        setToken(null);
        setCurrentOrganization(null);
        try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { }
    };
    
    const impersonate = (userToImpersonate: User) => {
        if (!currentUser || currentUser.role !== 'superadmin') return;
        setImpersonator(currentUser);
        setCurrentUser(userToImpersonate);
    };

    const stopImpersonating = () => {
        if (!impersonator) return;
        setCurrentUser(impersonator);
        setImpersonator(null);
    };

    const refreshOrganization = useCallback(async () => {
        if (!token || !currentUser || currentUser.role === 'superadmin') {
            setCurrentOrganization(null);
            return;
        }
        try {
            const resp: any = await fetchMyOrg(token);
            const raw = resp.organization;
            if (raw) {
                setCurrentOrganization({
                    id: String(raw.id),
                    name: raw.name,
                    status: raw.is_active ? 'active' : 'suspended',
                    createdAt: raw.created_at || new Date().toISOString(),
                });
            }
        } catch (e) {
            // Fallback: clear org so UI shows a neutral label
            setCurrentOrganization(null);
        }
    }, [token, currentUser]);

    useEffect(() => {
        refreshOrganization();
    }, [refreshOrganization]);

    const value = {
        currentUser,
        currentOrganization,
        token,
        impersonator,
        login,
        logout,
        impersonate,
        stopImpersonating,
        isAuthenticated: !!currentUser,
        refreshOrganization,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};