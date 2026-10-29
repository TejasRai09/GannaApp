/**
 * Activity log — admin only.
 *
 * Shows who did what, when, and from where. The server scopes this to the
 * admin's own organisation and rejects the request outright for anyone below
 * admin, so this page never has to be the thing keeping the data private.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, RefreshCcw, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Header } from '../components/common/Header';
import { useAuth } from '../context/AuthContext';
import { formatDateTimeGB } from '../services/dateUtils';
import { getAuditLog, actionLabel, isAlarming, type AuditRow, type AuditActionCount } from '../services/auditService';
import type { Page } from '../App';

interface Props {
    onNavigate: (p: Page) => void;
    onLogout: () => void;
}

const ROLE_TONE: Record<string, string> = {
    admin: 'bg-indigo-100 text-indigo-800',
    auditor: 'bg-emerald-100 text-emerald-800',
    viewer: 'bg-slate-100 text-slate-700',
    superadmin: 'bg-amber-100 text-amber-800',
};

/** Only the parts of a detail blob worth reading at a glance. */
const summarise = (row: AuditRow): string => {
    const d = row.detail;
    if (!d || typeof d !== 'object') return '';
    const parts: string[] = [];
    if (d.provider) parts.push(d.provider === 'microsoft' ? 'via Microsoft' : 'with a password');
    if (d.provisioned) parts.push('new account');
    if (d.reason) parts.push(String(d.reason));
    if (d.role) parts.push(`role: ${d.role}`);
    if (d.email) parts.push(String(d.email));
    if (d.seasonStartDate) parts.push(`season start ${d.seasonStartDate}`);
    if (d.impersonated) parts.push(`as ${d.impersonated}`);
    return parts.join(' · ');
};

export const AuditPage: React.FC<Props> = ({ onNavigate, onLogout }) => {
    const { token } = useAuth();

    const [rows, setRows] = useState<AuditRow[]>([]);
    const [actions, setActions] = useState<AuditActionCount[]>([]);
    const [action, setAction] = useState('all');
    const [limit, setLimit] = useState(200);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const r = await getAuditLog(token, { action, limit });
            setRows(r.rows);
            setActions(r.actions);
        } catch (e: any) {
            setError(e?.message || 'Could not load the activity log');
        } finally {
            setLoading(false);
        }
    }, [token, action, limit]);

    useEffect(() => { load(); }, [load]);

    const failedLogins = useMemo(
        () => rows.filter((r) => r.action === 'login_failed').length,
        [rows]
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <Header pageTitle="Activity Log" onNavigate={onNavigate} onLogout={onLogout} />
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

                <div className="flex flex-wrap justify-between items-end gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <ScrollText size={22} /> Activity Log
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Who did what, and when. Visible to admins only.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            aria-label="Filter by action"
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                        >
                            <option value="all">All activity</option>
                            {actions.map((a) => (
                                <option key={a.action} value={a.action}>
                                    {actionLabel(a.action)} ({a.n})
                                </option>
                            ))}
                        </select>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            aria-label="Number of entries"
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white"
                        >
                            <option value={100}>Last 100</option>
                            <option value={200}>Last 200</option>
                            <option value={500}>Last 500</option>
                            <option value={1000}>Last 1000</option>
                        </select>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50"
                        >
                            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {failedLogins > 0 && (
                    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                        <span>
                            <strong>{failedLogins}</strong> failed sign-in
                            {failedLogins === 1 ? '' : 's'} in this view. A few are normal — a burst
                            against one address is not.
                        </span>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {rows.length === 0 && !loading ? (
                        <div className="flex items-start gap-2 px-5 py-6 text-slate-600 text-sm">
                            <Info size={16} className="mt-0.5 flex-shrink-0" />
                            <span>Nothing recorded yet for this filter.</span>
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-[70vh]">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-600 uppercase bg-slate-50 sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">When</th>
                                        <th className="px-4 py-3 font-semibold">Who</th>
                                        <th className="px-4 py-3 font-semibold">Role</th>
                                        <th className="px-4 py-3 font-semibold">Action</th>
                                        <th className="px-4 py-3 font-semibold">Detail</th>
                                        <th className="px-4 py-3 font-semibold">From</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr
                                            key={r.id}
                                            className={`border-b border-slate-100 hover:bg-slate-50 ${
                                                isAlarming(r.action) ? 'bg-amber-50/40' : ''
                                            }`}
                                        >
                                            <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                                                {formatDateTimeGB(r.created_at)}
                                            </td>
                                            <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                                                {r.user_email ?? <span className="text-slate-400 italic">unknown</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {r.user_role && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ROLE_TONE[r.user_role] ?? 'bg-slate-100 text-slate-700'}`}>
                                                        {r.user_role}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`px-4 py-2.5 whitespace-nowrap font-medium ${isAlarming(r.action) ? 'text-amber-800' : 'text-slate-700'}`}>
                                                {actionLabel(r.action)}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-xs">{summarise(r)}</td>
                                            <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{r.ip ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
