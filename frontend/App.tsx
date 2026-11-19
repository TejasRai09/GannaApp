
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AuditPage } from './pages/AuditPage';
import { AccessDenied } from './components/common/AccessDenied';
import { isUsableSeasonStart } from './services/settingsService';
import { getOrgSettings, saveOrgSettings, type OrgSettings } from './services/seasonService';
import { can } from './services/permissions';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { HistoryPage } from './pages/HistoryPage';
import { VariancePage } from './pages/VariancePage';
import { HelpPage } from './pages/HelpPage';
import { SuperadminPage } from './pages/SuperadminPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { BrandingPage } from './pages/BrandingPage';
import { PricingPage } from './pages/PricingPage';
// FIX: Update import for CalculationInputs
import { syncOutcomes } from './services/feedbackService';
import { calculateRecommendedIndents } from './services/calculationService';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { fetchOrgData, saveOrgData } from './services/orgDataService';
import { fetchCalculations, fetchCalculation, saveCalculation, deleteCalculation } from './services/calculationsService';
import { createTicket, fetchAllTickets, fetchMyOrgTickets, updateTicketStatus } from './services/supportService';
// FIX: Update import for CalculationInputs
import type { Bonding, Indent, Purchase, CalculationRun, StoredData, User, SupportTicket, SupportTicketStatus, CalculationInputs, Constraint, YardBalanceRow } from './types';
import { generateId } from './utils/utils';
import { isSameDay, parseDate, addDays } from './services/dateUtils';

export type Page = 'home' | 'login' | 'signup' | 'dashboard' | 'calculator' | 'history' | 'help' | 'superadmin' | 'team' | 'pricing' | 'branding' | 'variance' | 'audit';
export type DataType = 'bonding' | 'indent' | 'purchase';
export type HomePageTheme = 'ganna' | 'millniti' | 'indentsahayak';


const DEFAULT_CENTER_MAPPING = { '26': '1', '27': '1', '36': '1', '37': '1', '38': '1', '135': '1' };

const AppContent: React.FC = () => {
    const { currentUser, token, login, logout, impersonate, refreshOrganization } = useAuth();
    const { showToast } = useToast();
    const [page, setPage] = useState<Page>('home');
    const [homePageTheme, setHomePageTheme] = useState<HomePageTheme>('ganna');
    
    // Org-scoped data state
    const [bondingData, setBondingData] = useState<StoredData<Bonding> | null>(null);
    const [indentData, setIndentData] = useState<StoredData<Indent> | null>(null);
    const [purchaseData, setPurchaseData] = useState<StoredData<Purchase> | null>(null);
    const [yardBalanceData, setYardBalanceData] = useState<StoredData<YardBalanceRow> | null>(null);
    const [calculationHistory, setCalculationHistory] = useState<CalculationRun[]>([]);
    
    // Global data state
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    
    // Calculation parameters
    // Loaded from the server, not defaulted here. An empty season start parses
    // to the epoch, which puts every calculation into late-season wind-down mode
    // and returns zero for every centre, so the app refuses to calculate until
    // this holds a real date rather than guessing one.
    const [plantStartDate, setPlantStartDate] = useState<string>('');
    const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
    // Operating parameters, configured per organisation. Null until loaded; the
    // calculation falls back to its own built-in defaults in that case.
    const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
    const [seasonTotalDays, setSeasonTotalDays] = useState<number>(180);
    const [seasonalCrushingCapacity, setSeasonalCrushingCapacity] = useState<number>(18000000);
    const [plantCapacity, setPlantCapacity] = useState<number>(80);
    const [totalDailyRequirement, setTotalDailyRequirement] = useState<number>(100000);
    const [plannedDailyIndent, setPlannedDailyIndent] = useState<number>(0); // 0 = off; late-season operator plan
    const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [standardStockCentre, setStandardStockCentre] = useState<number>(6000);
    const [standardStockGate, setStandardStockGate] = useState<number>(9000);
    const [availableStockCentre, setAvailableStockCentre] = useState<number>(6000);
    const [availableStockGate, setAvailableStockGate] = useState<number>(9000);
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    
    const [activeCalculationId, setActiveCalculationId] = useState<string | null>(null);
    const fetchedRunIds = useRef(new Set<string>());

    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const [dataGridModal, setDataGridModal] = useState<{ isOpen: boolean; data: any[] | null; title: string; dataType: DataType | null }>({ isOpen: false, data: null, title: '', dataType: null });
    const [manualAppendModal, setManualAppendModal] = useState<{ isOpen: boolean; dataType: 'indent' | 'purchase' | null }>({ isOpen: false, dataType: null });
    const [isLogicModalOpen, setIsLogicModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    const [centerMapping, setCenterMapping] = useState<{ [key: string]: string }>(DEFAULT_CENTER_MAPPING);

    const handleSetTheme = useCallback((theme: HomePageTheme) => {
        setHomePageTheme(theme);
    }, []);

    const mapTicket = useCallback((t: any): SupportTicket => ({
        id: String(t.id ?? ''),
        timestamp: t.created_at || new Date().toISOString(),
        userId: String(t.user_id ?? ''),
        userName: t.user_name || '',
        userEmail: t.user_email || '',
        organizationId: String(t.org_id ?? t.organization_id ?? ''),
        organizationName: t.organization_name || 'My Org',
        team: (t.category || 'general') as any,
        subject: t.subject || '',
        description: t.description || '',
        fileUrl: t.file_url,
        status: (t.status || 'open') as SupportTicketStatus,
    }), []);

    const mapCalculationRun = useCallback((r: any): CalculationRun => {
        /**
         * A JSON column reaches us either already parsed, as an object, or as
         * a string, depending on how the driver handled it.
         *
         * The object case has to be checked BEFORE any toString fallback.
         * Every object has toString, so an earlier version fell into that
         * branch, produced "[object Object]", failed to parse it and returned
         * { raw: "[object Object]" } — silently discarding the entire run.
         * That emptied the dashboard while the API was returning perfect data.
         */
        const safeParse = (val: any) => {
            if (val === null || val === undefined) return {};
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch { return {}; }
            }
            if (typeof val === 'object') return val;
            return {};
        };
        const ensureArray = (v: any) => (Array.isArray(v) ? v : []);

        const inputsRaw = r.inputs_json ?? r.inputs;
        const resultsRaw = r.results_json ?? r.results;
        const parsedResults = safeParse(resultsRaw) || {};
        const normalizedResults: any = {
            ...parsedResults,
            tableData: ensureArray((parsedResults as any).tableData ?? (parsedResults as any).results),
            indentCalculationBreakdown: ensureArray((parsedResults as any).indentCalculationBreakdown),
            openIndentMatrix: ensureArray((parsedResults as any).openIndentMatrix),
            forecastBreakdown: ensureArray((parsedResults as any).forecastBreakdown),
            maturityAnalysisPurchases: ensureArray((parsedResults as any).maturityAnalysisPurchases),
            fullSeasonAnalysis: ensureArray((parsedResults as any).fullSeasonAnalysis),
            closedIndentAnalysis: ensureArray((parsedResults as any).closedIndentAnalysis),
        };

        return {
            id: String(r.id),
            name: r.name,
            timestamp: new Date(r.created_at || Date.now()).getTime(),
            inputs: safeParse(inputsRaw),
            results: normalizedResults,
            // Computed and stored at save time. The history list cannot carry
            // results_json (megabytes per run), so without this every row
            // summed an empty tableData and displayed 0.00 Qtls.
            totalIndent: r.total_indent !== undefined && r.total_indent !== null
                ? Number(r.total_indent)
                : undefined,
            centreCount: r.centre_count ?? undefined,
        } as CalculationRun;
    }, []);

    const loadOrgData = useCallback(async () => {
        if (!currentUser || currentUser.role === 'superadmin' || !token) return;
        try {
            const [dataResp, calcResp, ticketResp] = await Promise.all([
                fetchOrgData(token),
                fetchCalculations(token),
                fetchMyOrgTickets(token),
            ]);

            const files = dataResp.files || [];
            // Same shape trap as safeParse: check the already-parsed cases
            // before any toString fallback, because every object has toString
            // and "[object Object]" is not valid JSON.
            const parseJson = (val: any) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') {
                    try { return JSON.parse(val); } catch { return []; }
                }
                if (typeof val === 'object') return val;
                return [];
            };
            const parseFile = (kind: string) => {
                const f = files.find((x: any) => x.data_type === kind.toUpperCase());
                if (!f) return null;
                const parsed = parseJson(f.data ?? f.data_json);
                return { fileName: f.file_name || kind, lastUpdated: f.last_updated || new Date().toISOString(), data: parsed } as StoredData<any>;
            };
            setBondingData(parseFile('bonding'));
            setIndentData(parseFile('indent'));
            setPurchaseData(parseFile('purchase'));
            setYardBalanceData(parseFile('yard_balance'));
            const runs = (calcResp.runs || []).map(mapCalculationRun);
            // MERGE, do not overwrite. These runs come from the list endpoint,
            // which omits results_json, so they all carry an empty results
            // object. If this runs again after a run's detail has been fetched
            // — and it does, whenever the effect that calls it re-fires — it
            // would wipe those results, and the fetch guard, having already
            // recorded an attempt, would refuse to fetch them again. The
            // dashboard then sat empty until it timed out.
            setCalculationHistory(prev => runs.map((fresh: CalculationRun) => {
                const existing = prev.find(r => r.id === fresh.id);
                return (existing?.results?.tableData?.length ?? 0) > 0 ? existing! : fresh;
            }));

            setSupportTickets((ticketResp.tickets || []).map(mapTicket));
        } catch (e: any) {
            console.error('[loadOrgData] error', e);
            setError(e.message || 'Failed to load organization data');
        }
    }, [currentUser, token, mapTicket, mapCalculationRun]);

    useEffect(() => {
        const loadSupportTickets = async () => {
            if (currentUser?.role !== 'superadmin' || !token) return;
            try {
                const ticketResp = await fetchAllTickets(token);
                setSupportTickets((ticketResp.tickets || []).map(mapTicket));
            } catch (e: any) {
                setError(e.message || 'Failed to load support tickets');
            }
        };
        loadSupportTickets();
    }, [currentUser, token, mapTicket]);

    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'superadmin') {
                setPage('superadmin');
            } else {
                setPage('dashboard');
                loadOrgData();
            }
        } else {
            setPage('home');
        }
    }, [currentUser, loadOrgData]);

    // Season settings live on the server so they are set once and shared by the
    // whole organisation. They used to be React state initialised to '', which
    // reset on every reload and silently zeroed every calculation.
    useEffect(() => {
        if (!token || !currentUser || currentUser.role === 'superadmin') return;
        let cancelled = false;
        (async () => {
            try {
                const { settings } = await getOrgSettings(token);
                if (cancelled) return;
                setOrgSettings(settings);
                if (isUsableSeasonStart(settings.seasonStartDate)) {
                    setPlantStartDate(settings.seasonStartDate!);
                }
                if (settings.seasonTotalDays) setSeasonTotalDays(settings.seasonTotalDays);
                if (settings.seasonalCrushingCapacity) {
                    setSeasonalCrushingCapacity(settings.seasonalCrushingCapacity);
                }
                // Daily defaults, pre-filled rather than hardcoded in this file.
                if (settings.defaultDailyRequirement) setTotalDailyRequirement(settings.defaultDailyRequirement);
                if (settings.standardStockCentre) setStandardStockCentre(settings.standardStockCentre);
                if (settings.standardStockGate) setStandardStockGate(settings.standardStockGate);
                if (settings.plantCapacity) setPlantCapacity(settings.plantCapacity);
            } catch {
                // A settings failure must not block the rest of the app; the
                // calculate guard below still prevents a bad run.
            } finally {
                if (!cancelled) setSettingsLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [token, currentUser]);

    // Auto-populate available stock from the most recent yard balance entry on or before currentDate
    useEffect(() => {
        if (!yardBalanceData?.data?.length || !currentDate) return;
        const target = new Date(currentDate + 'T00:00:00.000Z');
        const entries = yardBalanceData.data
            .map(r => {
                const rawDate = (r as any).Date || (r as any).date || '';
                const rawGate = (r as any).Gate ?? (r as any).gate ?? 0;
                const rawCentre = (r as any).Centre ?? (r as any).centre ?? 0;
                return {
                    date: parseDate(String(rawDate)),
                    gate: parseFloat(String(rawGate)) || 0,
                    centre: parseFloat(String(rawCentre)) || 0,
                };
            })
            .filter(e => e.date !== null)
            .sort((a, b) => a.date!.getTime() - b.date!.getTime());
        const match = [...entries].reverse().find(e => e.date!.getTime() <= target.getTime());
        if (match) {
            setAvailableStockGate(match.gate);
            setAvailableStockCentre(match.centre);
        }
    }, [yardBalanceData, currentDate]);

    // Refresh history when navigating to the history page (in case another session added/deleted runs)
    // Merges DB runs with in-memory results so the active calculation doesn't lose its data.
    useEffect(() => {
        const refreshHistory = async () => {
            if (page !== 'history' || !token || !currentUser || currentUser.role === 'superadmin') return;
            try {
                const calcResp = await fetchCalculations(token);
                const newRuns = (calcResp.runs || []).map(mapCalculationRun);
                const newIds = new Set(newRuns.map((r: CalculationRun) => r.id));
                setCalculationHistory(prev => {
                    // Preserve in-memory results; keep memory-only runs (temp IDs) at the end
                    const merged = newRuns.map((nr: CalculationRun) => {
                        const existing = prev.find(r => r.id === nr.id);
                        return (existing?.results?.tableData?.length ?? 0) > 0 ? existing! : nr;
                    });
                    const memoryOnly = prev.filter(r => !newIds.has(r.id));
                    return [...merged, ...memoryOnly];
                });
            } catch (e: any) {
                setError(e?.message || 'Failed to load history');
            }
        };
        refreshHistory();
    }, [page, token, currentUser, mapCalculationRun]);

    // Pull the full results for whichever run is actually being displayed.
    //
    // The list endpoint omits results_json so the history loads fast, which
    // means every run arrives with an empty results object rather than none at
    // all. That is fine for a history row, but the DASHBOARD renders the newest
    // run and never sets activeCalculationId — so nothing ever fetched its
    // results and it drew a permanently empty shell: zero recommendations,
    // 0.00 totals in history, and nothing whatsoever for a viewer, who never
    // opens a history item. The data was always saved; it was never read back.
    //
    // So fall back to the newest run when nothing is explicitly selected.
    const displayedRunId = activeCalculationId ?? calculationHistory[0]?.id ?? null;

    // The dashboard only needs the summary. Ask for the full run only when a
    // calculation has been opened deliberately, because the detailed analysis
    // tabs are the only thing that reads the heavy arrays, and those arrays
    // grow with the season. Cached per id AND per depth, so opening a run that
    // was previously loaded as a summary still fetches the rest.
    const wantFull = Boolean(activeCalculationId);
    const fetchKey = displayedRunId ? `${displayedRunId}:${wantFull ? 'full' : 'summary'}` : null;

    useEffect(() => {
        if (!displayedRunId || !fetchKey || !token) return;
        if (fetchedRunIds.current.has(fetchKey)) return;
        const target = calculationHistory.find(r => r.id === displayedRunId);
        if (!target) return;
        // A summary already in memory still needs replacing when the full run
        // is wanted, so only skip when what we have is deep enough.
        const hasTable = (target.results?.tableData?.length ?? 0) > 0;
        const hasHeavy = (target.results?.maturityAnalysisPurchases?.length ?? 0) > 0;
        if (hasTable && (!wantFull || hasHeavy)) return;

        // The guard marks a fetch as IN FLIGHT, not as "ever attempted". If the
        // results are wiped later for any reason, this must be able to fetch
        // them again rather than leaving the dashboard permanently empty —
        // which is exactly what a stale "already tried" flag caused.
        fetchedRunIds.current.add(fetchKey);
        fetchCalculation(token, displayedRunId, !wantFull)
            .then(resp => {
                if (resp?.run) {
                    const loaded = mapCalculationRun(resp.run);
                    setCalculationHistory(prev => prev.map(r => r.id === displayedRunId ? loaded : r));
                }
            })
            .catch(() => undefined)
            .finally(() => { fetchedRunIds.current.delete(fetchKey); });
    }, [displayedRunId, fetchKey, wantFull, token, calculationHistory, mapCalculationRun]);
    
    const openDataGridModal = (dataType: DataType) => {
        const dataMap = {
            bonding: { data: bondingData, title: 'Bonding Data' },
            indent: { data: indentData, title: 'Indent Data' },
            purchase: { data: purchaseData, title: 'Purchase Data' },
        };
        const selected = dataMap[dataType];
        if (selected.data) {
            setDataGridModal({ isOpen: true, data: selected.data.data, title: selected.title, dataType });
        }
    };
    const closeDataGridModal = () => setDataGridModal({ isOpen: false, data: null, title: '', dataType: null });

    const openManualAppendModal = (dataType: 'indent' | 'purchase') => {
        setManualAppendModal({ isOpen: true, dataType });
    };
    const closeManualAppendModal = () => setManualAppendModal({ isOpen: false, dataType: null });

    const handleSaveSettings = (
        newMapping: { [key: string]: string },
        newAssumptions: { startDate: string, totalDays: number, capacity: number }
    ) => {
        if (!currentUser || !currentUser.organizationId) return;

        setCenterMapping(newMapping);
        setActiveCalculationId(null);

        // The season start, length and capacity are facts about the SEASON, and
        // a season is a record a superadmin owns. Changing them here would set
        // them for this browser only and quietly disagree with what everyone
        // else sees, so they are applied for this session and the operator is
        // told where they actually live.
        const seasonTouched =
            newAssumptions.startDate !== plantStartDate
            || newAssumptions.totalDays !== seasonTotalDays
            || newAssumptions.capacity !== seasonalCrushingCapacity;

        setPlantStartDate(newAssumptions.startDate);
        setSeasonTotalDays(newAssumptions.totalDays);
        setSeasonalCrushingCapacity(newAssumptions.capacity);

        if (!token) {
            setInfo("Settings updated. Start a new calculation to apply changes.");
            return;
        }

        // Only the daily operating defaults are the auditor's to persist.
        saveOrgSettings(token, {
            defaultDailyRequirement: totalDailyRequirement,
            standardStockCentre,
            standardStockGate,
            plantCapacity,
        })
            .then(() => setInfo(
                seasonTouched
                    ? "Daily defaults saved. The season dates apply to this session only — ask a superadmin to change the season record so everyone sees the same thing."
                    : "Daily defaults saved for your organisation. Start a new calculation to apply them."
            ))
            .catch((e: any) =>
                setError(`Applied for this session, but could not be saved: ${e?.message ?? 'unknown error'}`)
            );
    };
    
    const handleCalculate = useCallback(async (name: string, isScenario: boolean = false, overrideInputs?: Partial<CalculationInputs>) => {
        if (!currentUser || !currentUser.organizationId) {
            setError("No user or organization context.");
            return;
        }
        const orgId = currentUser.organizationId;

        if (!bondingData?.data || !indentData?.data || !purchaseData?.data) {
            setError("Please upload all three required files.");
            return;
        }
        if (!currentDate) {
            setError("Please set the current date.");
            return;
        }
        // Refuse rather than calculate on a missing season start. Without this
        // the date parses to the epoch, week-of-season computes to thousands,
        // every centre falls into late-season wind-down mode, and the run
        // returns zero everywhere while still looking like it succeeded. A
        // visible error beats a silent page of zeros.
        if (!isUsableSeasonStart(plantStartDate)) {
            setError(
                "Set the season start date before calculating. " +
                "Without it the app cannot tell which week of the season this is, " +
                "and every centre would come back as zero. Settings → Season Start Date."
            );
            return;
        }
        if (!can.calculate(currentUser.role)) {
            setError("Your role can view the numbers but not run a calculation.");
            return;
        }

        setError(null);
        setInfo(null);
        setIsLoading(true);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const inputs: CalculationInputs = {
                bondingData: bondingData.data, 
                indentData: indentData.data, 
                purchaseData: purchaseData.data,
                plantCapacity, totalDailyRequirement, plannedDailyIndent,
                currentDate: new Date(currentDate + 'T00:00:00.000Z'),
                centerMapping,
                standardStockCentre,
                standardStockGate,
                availableStockCentre,
                availableStockGate,
                plantStartDate,
                seasonTotalDays,
                seasonalCrushingCapacity,
                constraints,
                // Operating parameters. Omitted when settings have not loaded,
                // in which case the calculation uses the same defaults it always had.
                deliveryLagDays: orgSettings?.deliveryLagDays,
                lateSeasonWeek: orgSettings?.lateSeasonWeek,
                throughputWindowDays: orgSettings?.throughputWindowDays,
                dweightFallbackThreshold: orgSettings?.dweightFallbackThreshold,
                gateMatchPattern: orgSettings?.gateMatchPattern,
                ...overrideInputs // Apply overrides from simulation if any
            };
            const results = calculateRecommendedIndents(inputs);

            const newRun: CalculationRun = {
                id: generateId('run'),
                name: name || `Calculation for ${currentDate}`,
                timestamp: Date.now(),
                inputs: {
                    plantCapacity: inputs.plantCapacity, 
                    totalDailyRequirement: inputs.totalDailyRequirement,
                    currentDate: inputs.currentDate, 
                    centerMapping: inputs.centerMapping,
                    standardStockCentre: inputs.standardStockCentre, 
                    standardStockGate: inputs.standardStockGate, 
                    availableStockCentre: inputs.availableStockCentre, 
                    availableStockGate: inputs.availableStockGate,
                    plantStartDate: inputs.plantStartDate, 
                    seasonTotalDays: inputs.seasonTotalDays, 
                    seasonalCrushingCapacity: inputs.seasonalCrushingCapacity,
                    constraints: inputs.constraints
                },
                results,
                isScenario
            };
            
            setCalculationHistory(prev => {
                const newRunDate = newRun.inputs.currentDate;
                
                // Filtering Logic:
                // If it's a standard run (not scenario), overwrite existing standard runs for the same day.
                // If it's a scenario, keep everything (append).
                
                let historyWithoutConflicts = prev;
                
                if (!isScenario) {
                    historyWithoutConflicts = prev.filter(run => {
                        const runDate = new Date(run.inputs.currentDate);
                        const isSame = isSameDay(runDate, newRunDate);
                        // Remove if same day AND existing run is NOT a scenario.
                        // (We keep scenarios even if we overwrite the main run, typically)
                        if (isSame && !run.isScenario) return false;
                        return true;
                    });
                }

                const newHistory = [newRun, ...historyWithoutConflicts];
                return newHistory;
            });
            setActiveCalculationId(newRun.id);

            if (token) {
                try {
                    // newRun.inputs, NOT inputs. The full object carries the whole
                    // source dataset — every bonding, indent and purchase row —
                    // and saving that put a complete copy of the season inside
                    // every run. Twenty runs made the history list a 100 MB,
                    // 22-second download on every single login. The source data
                    // already lives in org_data_files; a run needs only the
                    // parameters it was executed with.
                    const resp = await saveCalculation(token, newRun.name, newRun.inputs as any, results);
                    if (resp?.run) {
                        const dbId = String(resp.run.id);
                        // Keep the in-memory results (already correct) — just swap the temp ID for the DB ID
                        setCalculationHistory(prev =>
                            prev.map(r => r.id === newRun.id ? { ...r, id: dbId } : r)
                        );
                        setActiveCalculationId(dbId);
                    }
                } catch (e) {
                    console.warn('Failed to persist calculation to backend', e);
                }

                // v2 feedback loop: fill in what was actually indented and what
                // actually arrived, from the files already uploaded, so the plant
                // team never types an outcome by hand. Arrivals keep landing for
                // about three days, so a trailing window is re-swept each run and
                // the recent days firm up as late deliveries come in.
                try {
                    const sweep: Date[] = [];
                    for (let back = 1; back <= 21; back++) {
                        sweep.push(addDays(inputs.currentDate, 3 - back));
                    }
                    await syncOutcomes(
                        token,
                        indentData.data,
                        purchaseData.data,
                        sweep,
                        inputs.centerMapping,
                    );
                } catch (e) {
                    // Never let outcome backfill break the calculation itself.
                    console.warn('Outcome sync skipped', e);
                }
            }

        } catch (e: any) {
            setError(`Calculation failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [
        bondingData, indentData, purchaseData, plantCapacity, totalDailyRequirement, plannedDailyIndent,
        currentDate, centerMapping, standardStockCentre, standardStockGate,
        availableStockCentre, availableStockGate, plantStartDate, seasonTotalDays, seasonalCrushingCapacity, constraints, currentUser, token
    ]);
    
    const parseFileContent = (text: string): any[] => {
        const lines = text.trim().split(/\r\n|\n/);
        if (lines.length < 2) throw new Error("CSV file is empty or has no data rows.");
        const headerLine = lines.shift()!;
        const headers = headerLine.split(',').map(h => h.trim());
        return lines.map(line => {
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
            const entry: { [key: string]: string } = {};
            headers.forEach((header, i) => { if (header) entry[header] = values[i] || ''; });
            return entry;
        });
    };

    const handleFileUpdate = (kind: DataType, setter: (data: StoredData<any> | null) => void, file: File) => {
        if (!token) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = parseFileContent(text);
                const storedObject: StoredData<any> = {
                    fileName: file.name,
                    lastUpdated: new Date().toISOString(),
                    data: parsedData
                };
                await saveOrgData(token, kind, file.name, parsedData);
                setter(storedObject);
                setActiveCalculationId(null);
                setError(null);
            } catch (err: any) {
                setError(`Error parsing ${file.name}: ${err.message}`);
                setter(null);
            }
        };
        reader.onerror = () => { setError(`Error reading file ${file.name}.`); setter(null); };
        reader.readAsText(file);
    };
    
    const handleMappingFileUpload = (file: File) => {
        if (!currentUser || !currentUser.organizationId) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.trim().split(/\r\n|\n/);
                if (lines.length < 2) throw new Error("CSV has no data rows.");
                
                const headerLine = lines.shift()!;
                const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                const sourceIndex = headers.indexOf('source');
                const targetIndex = headers.indexOf('target');

                if (sourceIndex === -1 || targetIndex === -1) {
                    throw new Error("CSV must contain 'Source' and 'Target' columns.");
                }

                const newMapping: { [key: string]: string } = {};
                lines.forEach(line => {
                    const values = line.split(',');
                    const source = values[sourceIndex]?.trim().replace(/"/g, '');
                    const target = values[targetIndex]?.trim().replace(/"/g, '');
                    if (source && target) {
                        newMapping[source] = target;
                    }
                });

                setCenterMapping(newMapping);
                setInfo("Center mapping updated from file.");
            } catch (err: any) {
                setError(`Error parsing mapping file: ${err.message}`);
            }
        };
        reader.onerror = () => setError('Error reading mapping file.');
        reader.readAsText(file);
    };

    const handleYardBalanceFileUpdate = (file: File) => {
        if (!token) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = parseFileContent(text);
                const storedObject: StoredData<YardBalanceRow> = {
                    fileName: file.name,
                    lastUpdated: new Date().toISOString(),
                    data: parsedData as YardBalanceRow[],
                };
                await saveOrgData(token, 'yard_balance', file.name, parsedData);
                setYardBalanceData(storedObject);
                setError(null);
            } catch (err: any) {
                setError(`Error parsing ${file.name}: ${err.message}`);
            }
        };
        reader.onerror = () => setError(`Error reading file ${file.name}.`);
        reader.readAsText(file);
    };

    const handleDeleteYardBalance = () => {
        if (!token) return;
        setYardBalanceData(null);
        saveOrgData(token, 'yard_balance', 'Cleared', []).catch(() => undefined);
    };

    const handleDeleteData = (type: DataType | 'mapping') => {
        if (!token) return;
        if (type === 'bonding') {
            setBondingData(null);
            saveOrgData(token, 'bonding', 'Cleared', []).catch(() => undefined);
        } else if (type === 'indent') {
            setIndentData(null);
            saveOrgData(token, 'indent', 'Cleared', []).catch(() => undefined);
        } else if (type === 'purchase') {
            setPurchaseData(null);
            saveOrgData(token, 'purchase', 'Cleared', []).catch(() => undefined);
        } else if (type === 'mapping') {
            setCenterMapping(DEFAULT_CENTER_MAPPING);
            setInfo("Center mapping reset to system defaults.");
        }
    };
    
    const handleManualAppend = (newRecords: any[], dataType: 'indent' | 'purchase') => {
        if (!token) return;
        const existingData = dataType === 'indent' ? indentData : purchaseData;
        const setter = dataType === 'indent' ? setIndentData : setPurchaseData;

        if (!existingData) {
            const storedObject: StoredData<any> = { fileName: 'Manual Entry', lastUpdated: new Date().toISOString(), data: newRecords };
            saveOrgData(token, dataType, storedObject.fileName, storedObject.data).catch(() => undefined);
            setter(storedObject);
            setInfo(`Saved ${newRecords.length} new records.`);
            return;
        }

        const uniqueKeyFn = dataType === 'indent'
            ? (row: any) => `${row.Code?.trim()}-${row['Indent Date']?.trim()}`
            : (row: any) => `${row.Code?.trim()}-${row['Purchase Date']?.trim()}-${row['Indent Date']?.trim()}`;
        const existingKeys = new Set(existingData.data.map(uniqueKeyFn));
        const newUniqueRecords = newRecords.filter(row => !existingKeys.has(uniqueKeyFn(row)));
        if (newUniqueRecords.length === 0) {
            setInfo(`Append operation complete. No new records were found. All ${newRecords.length} records were duplicates.`);
            return;
        }
        const combinedData = [...existingData.data, ...newUniqueRecords];
        const storedObject: StoredData<any> = { fileName: existingData.fileName || 'Manual Entry', lastUpdated: new Date().toISOString(), data: combinedData };
        saveOrgData(token, dataType, storedObject.fileName, storedObject.data).catch(() => undefined);
        setter(storedObject);
        setActiveCalculationId(null);
        setInfo(`Successfully appended ${newUniqueRecords.length} new records. ${newRecords.length - newUniqueRecords.length} duplicates were skipped.`);
    };
    
    const handleGridSave = (updatedData: any[], dataType: DataType) => {
        if (!token) return;
        const keyMap = {
            bonding: { current: bondingData, setter: setBondingData },
            indent: { current: indentData, setter: setIndentData },
            purchase: { current: purchaseData, setter: setPurchaseData },
        };
        const { current, setter } = keyMap[dataType];
        const storedObject: StoredData<any> = { fileName: current?.fileName || 'Edited Data', lastUpdated: new Date().toISOString(), data: updatedData };
        saveOrgData(token, dataType, storedObject.fileName, storedObject.data).catch(() => undefined);
        setter(storedObject);
        setActiveCalculationId(null);
        setInfo(`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data updated with ${updatedData.length} records.`);
        closeDataGridModal();
    };

    const handleLoginSuccess = (session: { token: string; user: any }) => {
        login(session as any);
        const friendlyName = session.user?.name || session.user?.email || 'there';
        showToast(`Welcome, ${friendlyName}!`, 'success');
        refreshOrganization();
    };
    
    const handleClearAllData = () => {
        if (!token) return;
        if (window.confirm("Are you sure you want to clear all stored data for your organization? This cannot be undone.")) {
            Promise.all([
                saveOrgData(token, 'bonding', 'Cleared', []).catch(() => undefined),
                saveOrgData(token, 'indent', 'Cleared', []).catch(() => undefined),
                saveOrgData(token, 'purchase', 'Cleared', []).catch(() => undefined),
                saveOrgData(token, 'yard_balance', 'Cleared', []).catch(() => undefined),
            ]).finally(() => {
                setBondingData(null);
                setIndentData(null);
                setPurchaseData(null);
                setYardBalanceData(null);
                setActiveCalculationId(null);
                setCalculationHistory([]);
                setInfo('All stored data for your organization has been cleared.');
            });
        }
    };

    const handleLogout = () => {
        logout();
        setActiveCalculationId(null);
        setBondingData(null);
        setIndentData(null);
        setPurchaseData(null);
        setYardBalanceData(null);
        setCalculationHistory([]);
        showToast('Signed out', 'info');
    };
    
    const handleViewHistoryItem = (id: string) => {
        setPage('calculator');
        setActiveCalculationId(id);
        // The auto-fetch useEffect will load full results from DB if they're not in memory
    };

    const handleDeleteHistoryItem = async (id: string) => {
        if (!currentUser || !currentUser.organizationId) return;
        console.log('[history] delete clicked', { id, activeCalculationId });
        setCalculationHistory(prev => prev.filter(item => item.id !== id));
        if (activeCalculationId === id) setActiveCalculationId(null);

        if (!token) return;
        try {
            await deleteCalculation(token, id);
            console.log('[history] delete API success', { id });
            const calcResp = await fetchCalculations(token);
            console.log('[history] reload after delete', { count: calcResp?.runs?.length });
            const newRuns = (calcResp.runs || []).map(mapCalculationRun);
            const newIds = new Set(newRuns.map((r: CalculationRun) => r.id));
            setCalculationHistory(prev => {
                const merged = newRuns.map((nr: CalculationRun) => {
                    const existing = prev.find(r => r.id === nr.id);
                    return (existing?.results?.tableData?.length ?? 0) > 0 ? existing! : nr;
                });
                const memoryOnly = prev.filter(r => !newIds.has(r.id));
                return [...merged, ...memoryOnly];
            });
            showToast('Calculation deleted', 'success');
        } catch (e: any) {
            console.error('[history] delete failed', e);
            showToast(e?.message || 'Failed to delete calculation', 'error');
            try {
                const calcResp = await fetchCalculations(token);
                console.log('[history] reload after delete failure', { count: calcResp?.runs?.length });
                const fallbackRuns = (calcResp.runs || []).map(mapCalculationRun);
                const fallbackIds = new Set(fallbackRuns.map((r: CalculationRun) => r.id));
                setCalculationHistory(prev => {
                    const merged = fallbackRuns.map((nr: CalculationRun) => {
                        const existing = prev.find(r => r.id === nr.id);
                        return (existing?.results?.tableData?.length ?? 0) > 0 ? existing! : nr;
                    });
                    const memoryOnly = prev.filter(r => !fallbackIds.has(r.id));
                    return [...merged, ...memoryOnly];
                });
            } catch (_) {
                // ignore secondary failure
            }
        }
    };
    
    const handleRaiseTicket = async (ticketData: Omit<SupportTicket, 'id' | 'timestamp' | 'userId' | 'userName' | 'userEmail' | 'organizationId' | 'organizationName' | 'status'>) => {
        if (!token) return;
        try {
            await createTicket(token, ticketData.subject, ticketData.description, ticketData.team);
            if (currentUser?.role === 'superadmin') {
                const resp = await fetchAllTickets(token);
                setSupportTickets((resp.tickets || []).map(mapTicket));
            } else {
                const resp = await fetchMyOrgTickets(token);
                setSupportTickets((resp.tickets || []).map(mapTicket));
            }
        } catch (e: any) {
            setError(e.message || 'Failed to submit ticket');
        }
    };
    
    const handleUpdateTicketStatus = async (ticketId: string, newStatus: SupportTicketStatus) => {
        if (!token) return;
        try {
            await updateTicketStatus(token, ticketId, newStatus);
            const resp = currentUser?.role === 'superadmin'
                ? await fetchAllTickets(token)
                : await fetchMyOrgTickets(token);
            setSupportTickets((resp.tickets || []).map(mapTicket));
        } catch (e: any) {
            setError(e.message || 'Failed to update ticket status');
        }
    };
    
    const handleUpdateBranding = (_logoBase64: string | null) => {
        setInfo('Branding updates are not yet wired to the backend.');
    };

    const navigateToCalculator = () => {
        setActiveCalculationId(null);
        setError(null);
        setInfo(null);
        setPage('calculator');
    };

    const navigate = (targetPage: Page) => setPage(targetPage);
    const activeCalculation = calculationHistory.find(c => c.id === activeCalculationId) || null;

    if (!currentUser) {
        if (page === 'home') {
            return <HomePage onNavigate={navigate} theme={homePageTheme} />;
        }
        if (page === 'pricing') return <PricingPage onNavigate={navigate} />;
        if (page === 'login') return <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />;
        if (page === 'signup') return <SignupPage onNavigate={navigate} />;
        return <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={navigate} />;
    }
    
    // Role gates. These decide what is RENDERED; the server enforces the same
    // rules on every request behind them. A viewer who types a URL lands on a
    // plain refusal rather than a half-working screen.
    const role = currentUser.role;
    const denied = (what: string) => (
        <AccessDenied what={what} role={role} onNavigate={navigate} onLogout={handleLogout} />
    );

    if (page === 'superadmin') {
        if (role !== 'superadmin') return denied('the platform console');
        return <SuperadminPage onLogout={handleLogout} onImpersonate={impersonate} theme={homePageTheme} onSetTheme={handleSetTheme} supportTickets={supportTickets} onUpdateTicketStatus={handleUpdateTicketStatus} />;
    }
    if (page === 'team') {
        if (!can.manageUsers(role)) return denied('team management');
        return <TeamManagementPage onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (page === 'audit') {
        if (!can.viewAudit(role)) return denied('the activity log');
        return <AuditPage onNavigate={navigate} onLogout={handleLogout} />;
    }
    if (page === 'branding') {
        if (!can.editBranding(role)) return denied('branding');
        return <BrandingPage onNavigate={navigate} onLogout={handleLogout} onUpdateBranding={handleUpdateBranding} />;
    }
    if (page === 'calculator' && !can.calculate(role)) return denied('the calculator');
    // History exposes every past run and its inputs, which is working
    // material rather than something to publish to the whole directory.
    if (page === 'history' && !can.viewHistory(role)) return denied('calculation history');
    
    if (page === 'dashboard') {
        return <DashboardPage
            onNavigate={navigate} onLogout={handleLogout} bondingData={bondingData}
            indentData={indentData} purchaseData={purchaseData} yardBalanceData={yardBalanceData}
            calculationHistory={calculationHistory}
            infoMessage={info} onGoToCalculator={navigateToCalculator} onViewHistoryItem={handleViewHistoryItem}
            onClearAllData={handleClearAllData} seasonTotalDays={seasonTotalDays}
            orgSeasonStartDate={plantStartDate || null}
            deliveryLagDays={orgSettings?.deliveryLagDays}
            seasonalCrushingCapacity={seasonalCrushingCapacity}
            centerMapping={centerMapping}
            handleFileUpdate={handleFileUpdate}
            handleMappingFileUpload={handleMappingFileUpload}
            handleDeleteData={handleDeleteData}
            setBondingData={setBondingData}
            setIndentData={setIndentData}
            setPurchaseData={setPurchaseData}
            openDataGridModal={openDataGridModal}
            openManualAppendModal={openManualAppendModal}
            dataGridModal={dataGridModal}
            manualAppendModal={manualAppendModal}
            closeDataGridModal={closeDataGridModal}
            closeManualAppendModal={closeManualAppendModal}
            handleGridSave={handleGridSave}
            handleManualAppend={handleManualAppend}
            handleYardBalanceFileUpload={handleYardBalanceFileUpdate}
            handleDeleteYardBalance={handleDeleteYardBalance}
        />;
    }
    if (page === 'history') {
        return <HistoryPage history={calculationHistory} onNavigate={navigate} onView={handleViewHistoryItem}
            onDelete={handleDeleteHistoryItem} onLogout={handleLogout} />;
    }
    if (page === 'variance') return <VariancePage onNavigate={navigate} onLogout={handleLogout} />;
    if (page === 'help') return <HelpPage onNavigate={navigate} onLogout={handleLogout} onRaiseTicket={handleRaiseTicket} />;

    return (
        <CalculatorPage 
            bondingData={bondingData} indentData={indentData} purchaseData={purchaseData}
            activeCalculation={activeCalculation} error={error} info={info}
            isLoading={isLoading} currentDate={currentDate} plantStartDate={plantStartDate}
            seasonTotalDays={seasonTotalDays} seasonalCrushingCapacity={seasonalCrushingCapacity}
            plantCapacity={plantCapacity} totalDailyRequirement={totalDailyRequirement}
            standardStockCentre={standardStockCentre} standardStockGate={standardStockGate}
            availableStockCentre={availableStockCentre} availableStockGate={availableStockGate}
            centerMapping={centerMapping} dataGridModal={dataGridModal}
            manualAppendModal={manualAppendModal} isLogicModalOpen={isLogicModalOpen}
            isSettingsModalOpen={isSettingsModalOpen}
            setBondingData={setBondingData} setIndentData={setIndentData} setPurchaseData={setPurchaseData}
            setCurrentDate={setCurrentDate} setPlantStartDate={setPlantStartDate} setSeasonTotalDays={setSeasonTotalDays}
            setSeasonalCrushingCapacity={setSeasonalCrushingCapacity} setPlantCapacity={setPlantCapacity}
            setTotalDailyRequirement={setTotalDailyRequirement}
            plannedDailyIndent={plannedDailyIndent} setPlannedDailyIndent={setPlannedDailyIndent}
            setStandardStockCentre={setStandardStockCentre}
            setStandardStockGate={setStandardStockGate} setAvailableStockCentre={setAvailableStockCentre}
            setAvailableStockGate={setAvailableStockGate} setIsLogicModalOpen={setIsLogicModalOpen}
            setIsSettingsModalOpen={setIsSettingsModalOpen}
            onNavigate={navigate} onLogout={handleLogout} handleFileUpdate={handleFileUpdate}
            handleManualAppend={handleManualAppend} handleCalculate={handleCalculate} onClearAllData={handleClearAllData}
            handleSaveSettings={handleSaveSettings} handleGridSave={handleGridSave}
            openDataGridModal={openDataGridModal} closeDataGridModal={closeDataGridModal}
            openManualAppendModal={openManualAppendModal} closeManualAppendModal={closeManualAppendModal}
            // Constraint Props
            constraints={constraints}
            setConstraints={setConstraints}
        />
    );
};

const App: React.FC = () => (
    <ToastProvider>
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    </ToastProvider>
);

export default App;