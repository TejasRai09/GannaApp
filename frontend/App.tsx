
import React, { useState, useCallback, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { HistoryPage } from './pages/HistoryPage';
import { HelpPage } from './pages/HelpPage';
import { SuperadminPage } from './pages/SuperadminPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { BrandingPage } from './pages/BrandingPage';
import { PricingPage } from './pages/PricingPage';
// FIX: Update import for CalculationInputs
import { calculateRecommendedIndents } from './services/calculationService';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { fetchOrgData, saveOrgData } from './services/orgDataService';
import { fetchCalculations, saveCalculation } from './services/calculationsService';
import { createTicket, fetchAllTickets, fetchMyOrgTickets, updateTicketStatus } from './services/supportService';
// FIX: Update import for CalculationInputs
import type { Bonding, Indent, Purchase, CalculationRun, StoredData, User, SupportTicket, SupportTicketStatus, CalculationInputs, Constraint } from './types';
import { generateId } from './utils/utils';
import { isSameDay } from './services/dateUtils';

export type Page = 'home' | 'login' | 'signup' | 'dashboard' | 'calculator' | 'history' | 'help' | 'superadmin' | 'team' | 'pricing' | 'branding';
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
    const [calculationHistory, setCalculationHistory] = useState<CalculationRun[]>([]);
    
    // Global data state
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    
    // Calculation parameters
    const [plantStartDate, setPlantStartDate] = useState<string>('');
    const [seasonTotalDays, setSeasonTotalDays] = useState<number>(180);
    const [seasonalCrushingCapacity, setSeasonalCrushingCapacity] = useState<number>(18000000);
    const [plantCapacity, setPlantCapacity] = useState<number>(80);
    const [totalDailyRequirement, setTotalDailyRequirement] = useState<number>(100000);
    const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [standardStockCentre, setStandardStockCentre] = useState<number>(30000);
    const [standardStockGate, setStandardStockGate] = useState<number>(10000);
    const [availableStockCentre, setAvailableStockCentre] = useState<number>(30000);
    const [availableStockGate, setAvailableStockGate] = useState<number>(10000);
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    
    const [activeCalculationId, setActiveCalculationId] = useState<string | null>(null);

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

    const loadOrgData = useCallback(async () => {
        if (!currentUser || currentUser.role === 'superadmin' || !token) return;
        try {
            console.log('[loadOrgData] start');
            const dataResp = await fetchOrgData(token);
            const files = dataResp.files || [];
            console.log('[loadOrgData] files', files.length, files[0]);
            const parseJson = (val: any) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try {
                    if (typeof val === 'string') return JSON.parse(val);
                    if (val?.toString) return JSON.parse(val.toString());
                } catch (_) {
                    return [];
                }
                return [];
            };
            const parseFile = (kind: string) => {
                const f = files.find((x: any) => x.data_type === kind.toUpperCase());
                console.log('[loadOrgData] parseFile', kind, f ? { id: f.id, data_type: f.data_type, file_name: f.file_name, has_data_json: !!f.data_json } : 'missing');
                if (!f) return null;
                const parsed = parseJson(f.data ?? f.data_json);
                return { fileName: f.file_name || kind, lastUpdated: f.last_updated || new Date().toISOString(), data: parsed } as StoredData<any>;
            };
            setBondingData(parseFile('bonding'));
            setIndentData(parseFile('indent'));
            setPurchaseData(parseFile('purchase'));
            const calcResp = await fetchCalculations(token);
            console.log('[loadOrgData] calc runs len', calcResp?.runs?.length, 'sample', calcResp?.runs?.[0]);
            const runs = (calcResp.runs || []).map((r: any) => {
                const inputsRaw = r.inputs_json ?? r.inputs;
                const resultsRaw = r.results_json ?? r.results;
                const safeParse = (val: any) => {
                    if (val === null || val === undefined) return {};
                    if (typeof val === 'string') {
                        try { return JSON.parse(val); } catch { return { raw: val }; }
                    }
                    if (val?.toString) {
                        try { return JSON.parse(val.toString()); } catch { return { raw: val.toString() }; }
                    }
                    return val;
                };
                const parsedResults = safeParse(resultsRaw) || {};
                const ensureArray = (v: any) => (Array.isArray(v) ? v : []);
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
                } as CalculationRun;
            });
            setCalculationHistory(runs);
            const ticketResp = await fetchMyOrgTickets(token);
            setSupportTickets((ticketResp.tickets || []).map(mapTicket));
        } catch (e: any) {
            console.error('[loadOrgData] error', e);
            setError(e.message || 'Failed to load organization data');
        }
    }, [currentUser, token, mapTicket]);

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
        setPlantStartDate(newAssumptions.startDate);
        setSeasonTotalDays(newAssumptions.totalDays);
        setSeasonalCrushingCapacity(newAssumptions.capacity);
        setInfo("Settings updated. Start a new calculation to apply changes.");
        setActiveCalculationId(null);
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

        setError(null);
        setInfo(null);
        setIsLoading(true);
        // If it's a scenario, we don't reset the ID yet because we might be viewing the base run
        // But eventually we will switch to the new scenario.
        setActiveCalculationId(null);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const inputs: CalculationInputs = {
                bondingData: bondingData.data, 
                indentData: indentData.data, 
                purchaseData: purchaseData.data,
                plantCapacity, totalDailyRequirement,
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
                    await saveCalculation(token, newRun.name, inputs, results);
                } catch (e) {
                    console.warn('Failed to persist calculation to backend', e);
                }
            }

        } catch (e: any) {
            setError(`Calculation failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [
        bondingData, indentData, purchaseData, plantCapacity, totalDailyRequirement,
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
            ]).finally(() => {
                setBondingData(null);
                setIndentData(null);
                setPurchaseData(null);
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
        setCalculationHistory([]);
        showToast('Signed out', 'info');
    };
    
    const handleViewHistoryItem = (id: string) => {
        setActiveCalculationId(id);
        setPage('calculator');
    };

    const handleDeleteHistoryItem = (id: string) => {
        if (!currentUser || !currentUser.organizationId) return;
        setCalculationHistory(prev => {
            const newHistory = prev.filter(item => item.id !== id);
            if (activeCalculationId === id) setActiveCalculationId(null);
            return newHistory;
        });
    };
    
    const handleRaiseTicket = async (ticketData: Omit<SupportTicket, 'id' | 'timestamp' | 'userId' | 'userName' | 'userEmail' | 'organizationId' | 'organizationName' | 'status'>) => {
        if (!token) return;
        try {
            await createTicket(token, ticketData.subject, ticketData.description, ticketData.category);
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
    
    if (page === 'superadmin') return <SuperadminPage onLogout={handleLogout} onImpersonate={impersonate} theme={homePageTheme} onSetTheme={handleSetTheme} supportTickets={supportTickets} onUpdateTicketStatus={handleUpdateTicketStatus} />;
    if (page === 'team') return <TeamManagementPage onNavigate={navigate} onLogout={handleLogout} />;
    if (page === 'branding') return <BrandingPage onNavigate={navigate} onLogout={handleLogout} onUpdateBranding={handleUpdateBranding} />;
    
    if (page === 'dashboard') {
        return <DashboardPage
            onNavigate={navigate} onLogout={handleLogout} bondingData={bondingData}
            indentData={indentData} purchaseData={purchaseData} calculationHistory={calculationHistory}
            infoMessage={info} onGoToCalculator={navigateToCalculator} onViewHistoryItem={handleViewHistoryItem}
            onClearAllData={handleClearAllData} seasonTotalDays={seasonTotalDays}
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
        />;
    }
    if (page === 'history') {
        return <HistoryPage history={calculationHistory} onNavigate={navigate} onView={handleViewHistoryItem}
            onDelete={handleDeleteHistoryItem} onLogout={handleLogout} />;
    }
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
            setTotalDailyRequirement={setTotalDailyRequirement} setStandardStockCentre={setStandardStockCentre}
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