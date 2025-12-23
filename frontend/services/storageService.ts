export const STORAGE_KEYS = {
    // App Data
    HISTORY: 'calculationHistory',
    BONDING: 'bondingData',
    INDENT: 'indentData',
    PURCHASE: 'purchaseData',
    // Settings
    SEASON_START_DATE: 'seasonStartDate',
    SEASON_TOTAL_DAYS: 'seasonTotalDays',
    SEASONAL_CRUSHING_CAPACITY: 'seasonalCrushingCapacity',
    CENTER_MAPPING: 'centerMapping',
    // Multi-tenant data
    USERS: 'ganna_users',
    ORGANIZATIONS: 'ganna_organizations',
    ACTIVITY_LOG: 'ganna_activityLog',
    SUPPORT_TICKETS: 'ganna_support_tickets',
    GLOBAL_THEME: 'ganna_global_theme',
    IMPERSONATOR: 'ganna_impersonator'
};

const getKey = (key: string, organizationId: string): string => `org_${organizationId}_${key}`;

const setItem = (key: string, value: any, organizationId?: string): void => {
    const storageKey = organizationId ? getKey(key, organizationId) : key;
    try {
        localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save item "${storageKey}" to localStorage`, e);
    }
};

const getItem = <T,>(key: string, organizationId?: string): T | null => {
    const storageKey = organizationId ? getKey(key, organizationId) : key;
    try {
        const item = localStorage.getItem(storageKey);
        return item ? (JSON.parse(item) as T) : null;
    } catch (e) {
        console.error(`Failed to retrieve item "${storageKey}" from localStorage`, e);
        return null;
    }
};

const removeItem = (key: string, organizationId?: string): void => {
    const storageKey = organizationId ? getKey(key, organizationId) : key;
    try {
        localStorage.removeItem(storageKey);
    } catch (e) {
        console.error(`Failed to remove item "${storageKey}" from localStorage`, e);
    }
};

const clearOrgData = (organizationId: string): void => {
    removeItem(STORAGE_KEYS.BONDING, organizationId);
    removeItem(STORAGE_KEYS.INDENT, organizationId);
    removeItem(STORAGE_KEYS.PURCHASE, organizationId);
    removeItem(STORAGE_KEYS.HISTORY, organizationId);
    removeItem(STORAGE_KEYS.SEASON_START_DATE, organizationId);
    removeItem(STORAGE_KEYS.SEASON_TOTAL_DAYS, organizationId);
    removeItem(STORAGE_KEYS.SEASONAL_CRUSHING_CAPACITY, organizationId);
    removeItem(STORAGE_KEYS.CENTER_MAPPING, organizationId);
};

export const storageService = {
    setItem,
    getItem,
    removeItem,
    clearOrgData,
    KEYS: STORAGE_KEYS,
};