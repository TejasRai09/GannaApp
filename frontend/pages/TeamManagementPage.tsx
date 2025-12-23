import React, { useState, useMemo, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import type { Page } from '../App';
import type { UserRole } from '../types';
import { useUsers } from '../hooks/useUsers';
import { Users, Plus, Trash2, Edit, User as UserIcon, Eye } from 'lucide-react';

interface TeamManagementPageProps {
    onNavigate: (page: Page) => void;
    onLogout: () => void;
}

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
    const roleMap = {
        admin: { label: 'Admin', icon: <UserIcon size={12}/>, color: 'bg-blue-100 text-blue-800' },
        user: { label: 'User', icon: <UserIcon size={12}/>, color: 'bg-green-100 text-green-800' },
        viewer: { label: 'Viewer', icon: <Eye size={12}/>, color: 'bg-slate-100 text-slate-800' },
        superadmin: {label: 'Super Admin', icon: <UserIcon size={12}/>, color: 'bg-red-100 text-red-800'}
    };
    const { label, icon, color } = roleMap[role];
    return <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${color}`}>{icon}{label}</span>;
}

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({ onNavigate, onLogout }) => {
    const { currentUser } = useAuth();
    const { users, organizations, addUser, deleteUser, isLoading, error: usersError, refreshData } = useUsers();

    const getOrgName = useCallback(
        (orgId?: string | number) => organizations.find(o => o.id === String(orgId))?.name || 'Unknown organization',
        [organizations]
    );

    const visibleUsers = useMemo(() => {
        if (!currentUser) return [];
        const base = currentUser.role === 'superadmin'
            ? users.filter(u => u.role !== 'superadmin')
            : users
                .filter(u => String(u.organizationId) === String(currentUser.organizationId))
                .filter(u => u.role !== 'superadmin');
        return base.map(u => ({ ...u, organizationName: getOrgName(u.organizationId) }));
    }, [currentUser, users, getOrgName]);

    const orgName = useMemo(() => {
        if (!currentUser) return 'Your';
        const org = organizations.find(o => o.id === String(currentUser.organizationId));
        return org?.name || 'Your';
    }, [currentUser, organizations]);

    const pageTitle = currentUser?.role === 'superadmin' ? 'All Users' : `${orgName} Team`;

    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('user');
    const [error, setError] = useState('');

    const handleDeleteUser = (userId: string) => {
        if (!currentUser) return;
        const target = users.find(u => u.id === userId);
        if (!target) return;
        if (target.role === 'superadmin') return; // never show for admin, extra guard
        if (window.confirm(`Delete user "${target.name}" permanently?`)) {
            deleteUser(userId).catch((err: any) => setError(err?.message || 'Failed to delete user'));
        }
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setError('');
        addUser({
            name: newUserName,
            email: newUserEmail,
            password: newUserPassword,
            role: newUserRole,
            organizationId: currentUser.organizationId,
        }).catch((err: any) => setError(err?.message || 'Failed to add user'));
        // Reset form
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('user');
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <Header pageTitle="Team Management" onNavigate={onNavigate} onLogout={onLogout} />
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                 <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">{pageTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                             <h3 className="text-lg font-bold text-slate-800 mb-4">All Team Members</h3>
                             {usersError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md mb-2">{usersError}</p>}
                             {isLoading && <p className="text-sm text-slate-500">Loading...</p>}
                             <ul className="space-y-3">
                                {visibleUsers.map(user => (
                                    <li key={user.id} className="p-3 bg-slate-50 border rounded-md flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-sm text-slate-600">{user.email}</p>
                                            {currentUser?.role === 'superadmin' && (
                                                <p className="text-xs text-slate-500">Org: {user.organizationName}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RoleBadge role={user.role} />
                                            {currentUser?.role === 'admin' && user.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                    title="Delete user"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                             <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Member</h3>
                             {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md mb-2">{error}</p>}
                             <form onSubmit={handleAddUser} className="space-y-3">
                                <div>
                                    <label htmlFor="tm-name" className="text-sm font-medium text-slate-700">Full Name</label>
                                    <input id="tm-name" type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" required />
                                </div>
                                <div>
                                    <label htmlFor="tm-email" className="text-sm font-medium text-slate-700">Email</label>
                                    <input id="tm-email" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" required />
                                </div>
                                <div>
                                    <label htmlFor="tm-pass" className="text-sm font-medium text-slate-700">Password</label>
                                    <input id="tm-pass" type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm" required />
                                </div>
                                <div>
                                    <label htmlFor="tm-role" className="text-sm font-medium text-slate-700">Role</label>
                                    <select id="tm-role" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                                        <option value="user">User</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#003580] text-white font-semibold rounded-lg hover:bg-[#002a66]"><Plus size={18}/> Add Member</button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}