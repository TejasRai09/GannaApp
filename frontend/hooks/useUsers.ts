import { useState, useEffect, useCallback } from 'react';
import type { User, Organization } from '../types';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrgUsers, fetchAllUsers, createUser, deleteUser as deleteUserApi } from '../services/usersService';
import { fetchOrgs, createOrg, deleteOrg as deleteOrgApi } from '../services/orgService';

export const useUsers = () => {
    const { currentUser, token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!token || !currentUser) return;
        setIsLoading(true);
        setError(null);
        try {
            if (currentUser.role === 'superadmin') {
                const orgResp: any = await fetchOrgs(token);
                setOrganizations((orgResp.organizations || []).map((o: any) => ({
                    id: String(o.id),
                    name: o.name,
                    createdAt: o.created_at || new Date().toISOString(),
                    status: o.is_active ? 'active' : 'suspended',
                })));
                const userResp: any = await fetchAllUsers(token);
                setUsers((userResp.users || []).map((u: any) => ({
                    id: String(u.id),
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    organizationId: String(u.org_id),
                    createdAt: u.created_at || new Date().toISOString(),
                })));
            } else {
                const userResp: any = await fetchMyOrgUsers(token);
                setUsers((userResp.users || []).map((u: any) => ({
                    id: String(u.id),
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    organizationId: String(u.org_id),
                    createdAt: u.created_at || new Date().toISOString(),
                })));
            }
        } catch (e: any) {
            setError(e.message || 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }, [token, currentUser]);

    useEffect(() => {
        load();
    }, [load]);

    const addUser = async (user: Omit<User, 'id' | 'createdAt'>) => {
        if (!token) return;
        try {
            const payload: any = { name: user.name, email: user.email, password: user.password, role: user.role };
            if (user.organizationId) payload.orgId = user.organizationId;
            await createUser(token, payload);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to create user');
        }
    };

    const deleteUser = async (userId: string) => {
        if (!token) return;
        try {
            await deleteUserApi(token, userId);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to delete user');
        }
    };
    
    const addOrganization = async (name: string) => {
        if (!token) return;
        try {
            await createOrg(token, name);
            await load();
        } catch(e: any) {
            setError(e.message || 'Failed to create organization');
        }
    };

    const deleteOrganization = async (orgId: string) => {
        if (!token) return;
        try {
            await deleteOrgApi(token, orgId);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to delete organization');
        }
    };

    return { users, organizations, isLoading, error, refreshData: load, addUser, addOrganization, deleteUser, deleteOrganization };
};
