/**
 * Season and model control — superadmin.
 *
 * Two things live here, and they are separated on purpose.
 *
 * SEASONS are records, not a single date. A mill runs one season after another;
 * next year can be prepared in advance and switched to when the crush starts,
 * and what went before is still readable.
 *
 * MODEL PARAMETERS are the values that used to be literals in the calculation
 * code. Each default is exactly what was compiled in, so nothing behaves
 * differently until one is deliberately changed. They sit behind a superadmin
 * because a wrong value here is wrong everywhere at once without looking wrong
 * on any single screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    CalendarRange, Plus, Check, Trash2, AlertTriangle, Loader2, Save,
    SlidersHorizontal, Info, Power,
} from 'lucide-react';
import {
    getSeasons, createSeason, activateSeason, deleteSeason,
    getOrgSettings, saveOrgSettings, seasonNameFor,
    type Season, type OrgSettings,
} from '../services/seasonService';

interface Props {
    token: string;
    /** Which organisation to administer. */
    orgId?: number;
    orgName?: string;
}

const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** One tunable value, with the reason it matters stated beside it. */
const ParamField: React.FC<{
    label: string;
    hint: string;
    value: number | string;
    onChange: (v: string) => void;
    type?: 'number' | 'text';
    step?: string;
    suffix?: string;
    warn?: string;
}> = ({ label, hint, value, onChange, type = 'number', step, suffix, warn }) => (
    <div>
        <label className="block text-[13px] font-semibold text-slate-700">{label}</label>
        <div className="flex items-center gap-2 mt-1">
            <input
                type={type}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-36 px-3 py-2 rounded-lg border border-slate-300 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#003580]/30 focus:border-[#003580]"
            />
            {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-snug">{hint}</p>
        {warn && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 mt-1 leading-snug">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{warn}</span>
            </p>
        )}
    </div>
);

export const SeasonControl: React.FC<Props> = ({ token, orgId, orgName }) => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [settings, setSettings] = useState<OrgSettings | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // New season form
    const [newStart, setNewStart] = useState('');
    const [newName, setNewName] = useState('');
    const [newDays, setNewDays] = useState('180');
    const [newCapacity, setNewCapacity] = useState('');
    const [newActivate, setNewActivate] = useState(false);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const [s, cfg] = await Promise.all([getSeasons(token, orgId), getOrgSettings(token, orgId)]);
            setSeasons(s.seasons);
            setSettings(cfg.settings);
            setDraft({});
        } catch (e: any) {
            setError(e?.message || 'Could not load seasons');
        } finally {
            setLoading(false);
        }
    }, [token, orgId]);

    useEffect(() => { load(); }, [load]);

    // Suggest the conventional name from the start date, but let it be overridden.
    useEffect(() => {
        if (newStart && !newName) setNewName(seasonNameFor(newStart));
    }, [newStart, newName]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy('create');
        setError(null);
        try {
            await createSeason(token, {
                name: newName.trim(),
                startDate: newStart,
                totalDays: Number(newDays) || 180,
                crushingCapacity: newCapacity ? Number(newCapacity) : null,
                activate: newActivate,
                orgId,
            });
            setNewStart(''); setNewName(''); setNewDays('180'); setNewCapacity(''); setNewActivate(false);
            setNotice('Season created.');
            await load();
        } catch (e: any) {
            setError(e?.message || 'Could not create the season');
        } finally {
            setBusy(null);
        }
    };

    const handleActivate = async (s: Season) => {
        // Switching season re-frames every number on every screen, so it is
        // confirmed rather than being a single misplaced click.
        if (!window.confirm(
            `Make ${s.name} the active season?\n\n` +
            `Every screen will measure against a season starting ${fmtDate(s.startDate)}. ` +
            `Calculations already saved are not changed.`
        )) return;
        setBusy(`activate-${s.id}`);
        setError(null);
        try {
            await activateSeason(token, s.id);
            setNotice(`${s.name} is now the active season.`);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Could not switch season');
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async (s: Season) => {
        if (!window.confirm(`Delete the season ${s.name}? This cannot be undone.`)) return;
        setBusy(`delete-${s.id}`);
        setError(null);
        try {
            await deleteSeason(token, s.id);
            setNotice(`${s.name} deleted.`);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Could not delete the season');
        } finally {
            setBusy(null);
        }
    };

    const set = (k: string) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
    const val = (k: keyof OrgSettings) =>
        draft[k] !== undefined ? draft[k] : String(settings?.[k] ?? '');

    const handleSaveParams = async () => {
        if (Object.keys(draft).length === 0) return;
        setBusy('params');
        setError(null);
        try {
            const patch: any = { orgId };
            for (const [k, v] of Object.entries(draft)) {
                patch[k] = k === 'gateMatchPattern' ? v : Number(v);
            }
            const r = await saveOrgSettings(token, patch);
            setSettings(r.settings);
            setDraft({});
            setNotice('Parameters saved. They apply to the next calculation.');
        } catch (e: any) {
            setError(e?.message || 'Could not save the parameters');
        } finally {
            setBusy(null);
        }
    };

    const active = seasons.find((s) => s.isActive) ?? null;
    const dirty = Object.keys(draft).length > 0;

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
            )}
            {notice && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                    <Check size={16} className="mt-0.5 flex-shrink-0" /><span>{notice}</span>
                </div>
            )}

            {/* ── Seasons ───────────────────────────────────────────────── */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CalendarRange size={18} /> Seasons{orgName ? ` — ${orgName}` : ''}
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                    The active season is the frame every number is measured against. Without one, the
                    app refuses to calculate rather than guessing — an unset season start is what
                    silently returned zero for every centre.
                </p>

                {!active && !loading && (
                    <div className="flex items-start gap-2 px-4 py-3 mb-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span><strong>No active season.</strong> Calculations will be refused until one is set.</span>
                    </div>
                )}

                <div className="overflow-auto border rounded-lg mb-5">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-2.5 font-semibold">Season</th>
                                <th className="px-4 py-2.5 font-semibold">Starts</th>
                                <th className="px-4 py-2.5 text-right font-semibold">Days</th>
                                <th className="px-4 py-2.5 text-right font-semibold">Capacity (qtl)</th>
                                <th className="px-4 py-2.5 font-semibold">Status</th>
                                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {seasons.length === 0 && !loading && (
                                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No seasons yet.</td></tr>
                            )}
                            {seasons.map((s) => (
                                <tr key={s.id} className={`border-b border-slate-100 ${s.isActive ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                                    <td className="px-4 py-2.5 font-semibold text-slate-800">{s.name}</td>
                                    <td className="px-4 py-2.5 text-slate-600">{fmtDate(s.startDate)}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">{s.totalDays}</td>
                                    <td className="px-4 py-2.5 text-right text-slate-600">
                                        {s.crushingCapacity === null ? '—' : s.crushingCapacity.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {s.isActive
                                            ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold"><Power size={11} /> ACTIVE</span>
                                            : <span className="text-xs text-slate-400">inactive</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {!s.isActive && (
                                                <button
                                                    onClick={() => handleActivate(s)}
                                                    disabled={busy !== null}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
                                                >
                                                    {busy === `activate-${s.id}` ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                                                    Make active
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(s)}
                                                disabled={busy !== null || s.isActive}
                                                title={s.isActive ? 'Switch to another season before deleting this one' : 'Delete'}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <form onSubmit={handleCreate} className="border-t pt-5">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Add a season</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Start date</label>
                            <input type="date" required value={newStart} onChange={(e) => setNewStart(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                            <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="2026-27"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Total days</label>
                            <input type="number" required value={newDays} onChange={(e) => setNewDays(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Crushing capacity</label>
                            <input type="number" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} placeholder="18000000"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30" />
                        </div>
                        <div className="flex flex-col justify-end gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input type="checkbox" checked={newActivate} onChange={(e) => setNewActivate(e.target.checked)} />
                                Make active now
                            </label>
                            <button type="submit" disabled={busy !== null}
                                className="inline-flex justify-center items-center gap-2 px-4 py-2 bg-[#003580] text-white font-semibold text-sm rounded-lg hover:bg-[#002a66] disabled:opacity-50">
                                {busy === 'create' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* ── Model parameters ──────────────────────────────────────── */}
            {settings && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <SlidersHorizontal size={18} /> Model parameters
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 mb-4">
                        These were literals in the calculation code. Every default below is exactly the
                        value that was compiled in, so nothing changes until you change it.
                    </p>

                    <div className="flex items-start gap-2 px-4 py-3 mb-5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs">
                        <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <span>
                            These apply from the <strong>next calculation</strong>. Runs already saved keep
                            the parameters they were made with, so history stays honest.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ParamField
                            label="Delivery lag" suffix="days"
                            hint="Days between placing an indent and the delivery day it is raised for. The cadence of the whole app."
                            warn="Changing this moves every date the app works with. Verify against a known day before trusting the output."
                            value={val('deliveryLagDays')} onChange={set('deliveryLagDays')} />
                        <ParamField
                            label="Wind-down from week" suffix="of season"
                            hint="From this week, recommendations follow the mill's own latest placement instead of the model, because closure planning is not in the cane data."
                            value={val('lateSeasonWeek')} onChange={set('lateSeasonWeek')} />
                        <ParamField
                            label="Throughput window" suffix="days"
                            hint="How far back to look at actual arrivals when splitting the requirement between centres."
                            value={val('throughputWindowDays')} onChange={set('throughputWindowDays')} />
                        <ParamField
                            label="D-weight fallback" step="0.01"
                            hint="Below this recent delivery rate, use the season average instead. Stops a centre with almost no recent deliveries being ordered an enormous quantity."
                            value={val('dweightFallbackThreshold')} onChange={set('dweightFallbackThreshold')} />
                        <ParamField
                            label="Normal phase ends" suffix="week"
                            hint="Season shape, used for the reference bands only. Does not change any recommendation."
                            value={val('phaseNormalMaxWeek')} onChange={set('phaseNormalMaxWeek')} />
                        <ParamField
                            label="Pre-surge phase ends" suffix="week"
                            hint="Must be after the normal phase ends, or there is no pre-surge period at all."
                            value={val('phasePresurgeMaxWeek')} onChange={set('phasePresurgeMaxWeek')} />
                        <ParamField
                            label="Gate name contains" type="text"
                            hint="How a gate centre is recognised from its name. Was hardcoded, so renaming a centre silently broke gate allocation."
                            value={val('gateMatchPattern')} onChange={set('gateMatchPattern')} />
                    </div>

                    <h4 className="text-sm font-bold text-slate-700 mt-8 mb-1">Daily defaults</h4>
                    <p className="text-xs text-slate-500 mb-4">
                        Pre-filled on the calculator each day. An auditor can change these too.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <ParamField label="Daily requirement" suffix="qtl"
                            hint="Default target run rate."
                            value={val('defaultDailyRequirement')} onChange={set('defaultDailyRequirement')} />
                        <ParamField label="Standard centre stock" suffix="qtl"
                            hint="Yard stock a centre is expected to hold."
                            value={val('standardStockCentre')} onChange={set('standardStockCentre')} />
                        <ParamField label="Standard gate stock" suffix="qtl"
                            hint="Yard stock the gate is expected to hold."
                            value={val('standardStockGate')} onChange={set('standardStockGate')} />
                        <ParamField label="Plant capacity"
                            hint="Mill capacity figure used in the requirement calculation."
                            value={val('plantCapacity')} onChange={set('plantCapacity')} />
                    </div>

                    <div className="flex items-center gap-3 mt-7 pt-5 border-t">
                        <button
                            onClick={handleSaveParams}
                            disabled={!dirty || busy !== null}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#003580] text-white font-semibold text-sm rounded-lg hover:bg-[#002a66] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy === 'params' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            Save parameters
                        </button>
                        {dirty && (
                            <button onClick={() => setDraft({})} className="text-sm text-slate-500 hover:text-slate-800">
                                Discard changes
                            </button>
                        )}
                        {!dirty && <span className="text-xs text-slate-400">No unsaved changes</span>}
                    </div>
                </div>
            )}
        </div>
    );
};
