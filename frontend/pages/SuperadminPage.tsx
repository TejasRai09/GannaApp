
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { useUsers } from '../hooks/useUsers';
import type { User, Organization, SupportTicket, SupportTicketStatus } from '../types';
import { Building, Users, Plus, BarChart2, UserCheck, Search, LogIn, Palette, Save, CheckCircle, Ticket, Trash2 } from 'lucide-react';
import { timeAgo } from '../utils/utils';
import type { HomePageTheme } from '../App';
import { formatDateTimeGB } from '../services/dateUtils';

interface SuperadminPageProps {
    onLogout: () => void;
    onImpersonate: (user: User) => void;
    theme: HomePageTheme;
    onSetTheme: (theme: HomePageTheme) => void;
    supportTickets: SupportTicket[];
    onUpdateTicketStatus: (ticketId: string, newStatus: SupportTicketStatus) => void;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-slate-50 p-4 rounded-lg border flex items-start gap-4">
        <div className="mt-1 text-blue-600">{icon}</div>
        <div>
            <h5 className="text-sm font-semibold text-slate-600">{title}</h5>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);

const StatusBadge: React.FC<{ status: SupportTicketStatus }> = ({ status }) => {
    const statusMap = {
        open: 'bg-blue-100 text-blue-800',
        in_progress: 'bg-yellow-100 text-yellow-800',
        closed: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusMap[status]}`}>{status.replace('_', ' ')}</span>;
}

export const SuperadminPage: React.FC<SuperadminPageProps> = (props) => {
    const { onLogout, onImpersonate, theme, onSetTheme, supportTickets, onUpdateTicketStatus } = props;
    const { users, organizations, addUser, addOrganization, deleteUser, deleteOrganization, error } = useUsers();
    
    const [activeTab, setActiveTab] = useState<'dashboard' |'orgs' | 'users' | 'tickets'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [newOrgName, setNewOrgName] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserOrg, setNewUserOrg] = useState<string>('');
    
    // State for theme settings
    const [selectedTheme, setSelectedTheme] = useState<HomePageTheme>(theme);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

    // Sync local state if prop changes (e.g., after saving)
    useEffect(() => {
        setSelectedTheme(theme);
    }, [theme]);
    
    useEffect(() => {
        // Set default org for user creation form
        if (organizations.length > 0 && !newUserOrg) {
            setNewUserOrg(organizations[0].id);
        }
    }, [organizations, newUserOrg]);

    const getOrgName = useCallback(
        (orgId?: string | number) => organizations.find(o => o.id === String(orgId))?.name || 'Unknown organization',
        [organizations]
    );
    
    const { kpis, chartData } = useMemo(() => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const recentUsers = users.filter(u => new Date(u.createdAt) > thirtyDaysAgo);
        const recentOrgs = organizations.filter(o => new Date(o.createdAt) > thirtyDaysAgo);

        const growthData = Array.from({ length: 5 }, (_, i) => {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            return {
                name: month.toLocaleString('default', { month: 'short' }),
                users: users.filter(u => {
                    const d = new Date(u.createdAt);
                    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
                }).length,
                 orgs: organizations.filter(o => {
                    const d = new Date(o.createdAt);
                    return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
                }).length,
            };
        }).reverse();
        
        return {
            kpis: {
                totalOrgs: organizations.length,
                totalUsers: users.length,
                newUsers30d: recentUsers.length,
                newOrgs30d: recentOrgs.length,
            },
            chartData: growthData
        };
    }, [users, organizations]);
    
    const filteredOrgs = useMemo(() => organizations.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase())), [organizations, searchTerm]);
    const filteredUsers = useMemo(() => users
        .filter(u => {
            const term = searchTerm.toLowerCase();
            return u.name.toLowerCase().includes(term)
                || u.email.toLowerCase().includes(term)
                || getOrgName(u.organizationId).toLowerCase().includes(term);
        })
        .map(u => ({ ...u, organizationName: getOrgName(u.organizationId) })), [users, searchTerm, getOrgName]);
    const filteredTickets = useMemo(() => supportTickets.filter(t => 
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.userName.toLowerCase().includes(searchTerm.toLowerCase())
    ), [supportTickets, searchTerm]);
    
    const handleAddOrg = (e: React.FormEvent) => {
        e.preventDefault();
        if (newOrgName.trim()) {
            addOrganization(newOrgName.trim());
            setNewOrgName('');
        }
    };
    
    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUserName.trim() && newUserEmail.trim() && newUserPassword.trim() && newUserOrg) {
            addUser({
                name: newUserName.trim(),
                email: newUserEmail.trim(),
                password: newUserPassword.trim(),
                organizationId: newUserOrg,
                role: 'admin'
            });
            setNewUserName('');
            setNewUserEmail('');
            setNewUserPassword('');
        }
    };

    const handleDeleteOrg = (orgId: string, orgName: string) => {
        if (window.confirm(`Delete organization "${orgName}"? This cannot be undone.`)) {
            deleteOrganization(orgId);
        }
    };

    const handleDeleteUser = (userId: string, userName: string) => {
        if (window.confirm(`Delete user "${userName}"?`)) {
            deleteUser(userId);
        }
    };
    
    const handleThemeSave = () => {
        onSetTheme(selectedTheme);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <Header pageTitle="Superadmin Mission Control" onNavigate={() => {}} onLogout={onLogout} />
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-md">
                    <div className="border-b border-slate-200">
                        <nav className="flex space-x-2 p-2 overflow-x-auto">
                             <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-[#e6f0ff] text-[#003580]' : 'text-slate-500 hover:bg-slate-100'}`}><BarChart2 size={16}/> Dashboard</button>
                            <button onClick={() => setActiveTab('orgs')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'orgs' ? 'bg-[#e6f0ff] text-[#003580]' : 'text-slate-500 hover:bg-slate-100'}`}><Building size={16}/> Organizations</button>
                            <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'users' ? 'bg-[#e6f0ff] text-[#003580]' : 'text-slate-500 hover:bg-slate-100'}`}><Users size={16}/> Users</button>
                            <button onClick={() => setActiveTab('tickets')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'tickets' ? 'bg-[#e6f0ff] text-[#003580]' : 'text-slate-500 hover:bg-slate-100'}`}><Ticket size={16}/> Support Tickets</button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 text-sm" role="alert"><span>{error}</span></div>}
                        
                        {activeTab === 'dashboard' && (
                           <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard title="Total Organizations" value={kpis.totalOrgs} icon={<Building size={24} />} />
                                    <StatCard title="Total Users" value={kpis.totalUsers} icon={<Users size={24} />} />
                                    <StatCard title="Open Tickets" value={supportTickets.filter(t => t.status === 'open').length} icon={<Ticket size={24} />} />
                                    <StatCard title="New Users (30d)" value={kpis.newUsers30d} icon={<Users size={24} />} />
                                </div>
                                <div className="mt-6 pt-6 border-t">
                                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        <Palette size={20} /> Global Theme Settings
                                    </h3>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-lg border">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedTheme('ganna')} className={`px-3 py-1.5 rounded-md font-semibold text-sm ${selectedTheme === 'ganna' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 hover:bg-slate-300'}`}>GANNA</button>
                                                <button onClick={() => setSelectedTheme('millniti')} className={`px-3 py-1.5 rounded-md font-semibold text-sm ${selectedTheme === 'millniti' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-200 hover:bg-slate-300'}`}>MillNiti</button>
                                                <button onClick={() => setSelectedTheme('indentsahayak')} className={`px-3 py-1.5 rounded-md font-semibold text-sm ${selectedTheme === 'indentsahayak' ? 'bg-green-600 text-white shadow' : 'bg-slate-200 hover:bg-slate-300'}`}>IndentSahayak</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {saveStatus === 'saved' && <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600"><CheckCircle size={16} /><span>Saved!</span></div>}
                                            <button onClick={handleThemeSave} disabled={selectedTheme === theme} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold text-sm rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50"><Save size={16} /> Save Changes</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'orgs' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-slate-800">Manage Organizations</h3>
                                    <input type="text" placeholder="Search orgs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-md text-sm" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-2">
                                        {filteredOrgs.map(org => (
                                            <div key={org.id} className="p-3 bg-slate-50 border rounded-md flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">{org.name}</p>
                                                    <p className="text-xs text-slate-500">{org.status === 'active' ? 'Active' : 'Suspended'}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDeleteOrg(org.id, org.name)}
                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                        title="Delete organization"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <h4 className="text-md font-bold text-slate-800 mb-2">Create New Organization</h4>
                                        <form onSubmit={handleAddOrg} className="space-y-3"><input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} className="block w-full px-3 py-2 border rounded-md text-sm" placeholder="Org Name" required /><button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#003580] text-white font-semibold rounded-lg hover:bg-[#002a66]"><Plus size={18}/> Create</button></form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                           <div>
                                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Manage Users</h3><input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border rounded-md text-sm" /></div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                     <div className="md:col-span-2 space-y-2">
                                        {filteredUsers.map(user => (
                                            <div key={user.id} className="p-3 bg-slate-50 border rounded-md flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold">{user.name}</p>
                                                    <p className="text-sm text-slate-600">{user.email}</p>
                                                    <p className="text-xs text-slate-500">Role: {user.role}</p>
                                                    <p className="text-xs text-slate-500">Org: {user.organizationName}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {user.role !== 'superadmin' && (
                                                        <button onClick={() => onImpersonate(user)} className="flex items-center gap-1.5 px-2 py-1 bg-white text-xs rounded-md border">
                                                            <LogIn size={12}/> Log in as
                                                        </button>
                                                    )}
                                                    {user.role !== 'superadmin' && (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id, user.name)}
                                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                            title="Delete user"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <h4 className="text-md font-bold text-slate-800 mb-2">Create New Org Admin</h4>
                                        <form onSubmit={handleAddUser} className="space-y-3"><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full Name" className="block w-full px-3 py-2 border rounded-md text-sm" required /><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email" className="block w-full px-3 py-2 border rounded-md text-sm" required /><input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Password" className="block w-full px-3 py-2 border rounded-md text-sm" required /><select value={newUserOrg} onChange={e => setNewUserOrg(e.target.value)} className="block w-full px-3 py-2 border rounded-md text-sm" required><option value="" disabled>Select organization</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select><button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#003580] text-white font-semibold rounded-lg hover:bg-[#002a66]"><Plus size={18}/> Create</button></form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tickets' && (
                             <div>
                                <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">All Support Tickets</h3><input type="text" placeholder="Search tickets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="px-3 py-1.5 border rounded-md text-sm" /></div>
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Date</th>
                                                <th className="px-4 py-3 text-left">Organization</th>
                                                <th className="px-4 py-3 text-left">User</th>
                                                <th className="px-4 py-3 text-left">Subject</th>
                                                <th className="px-4 py-3 text-left">Status</th>
                                                <th className="px-4 py-3 text-left">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTickets.map(ticket => (
                                                <tr key={ticket.id} className="border-b last:border-0 hover:bg-slate-50">
                                                    <td className="px-4 py-2 whitespace-nowrap" title={formatDateTimeGB(ticket.timestamp)}>{timeAgo(ticket.timestamp)}</td>
                                                    <td className="px-4 py-2 font-semibold">{ticket.organizationName}</td>
                                                    <td className="px-4 py-2">{ticket.userName}</td>
                                                    <td className="px-4 py-2">{ticket.subject}</td>
                                                    <td className="px-4 py-2"><StatusBadge status={ticket.status} /></td>
                                                    <td className="px-4 py-2">
                                                        <select value={ticket.status} onChange={e => onUpdateTicketStatus(ticket.id, e.target.value as SupportTicketStatus)} className="block w-full px-2 py-1 border-slate-300 rounded-md text-xs">
                                                            <option value="open">Open</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="closed">Closed</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};
