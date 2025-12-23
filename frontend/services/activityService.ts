import { storageService } from './storageService';
import type { ActivityLog } from '../types';
import { generateId } from '../utils/utils';

const { ACTIVITY_LOG } = storageService.KEYS;

const getActivities = (): ActivityLog[] => {
    return storageService.getItem<ActivityLog[]>(ACTIVITY_LOG) || [];
};

const logActivity = (log: Omit<ActivityLog, 'id' | 'timestamp'>): void => {
    const activities = getActivities();
    const newLog: ActivityLog = {
        ...log,
        id: generateId('log'),
        timestamp: new Date().toISOString(),
    };
    // Add to the beginning and limit to 50 entries
    const updatedActivities = [newLog, ...activities].slice(0, 50);
    storageService.setItem(ACTIVITY_LOG, updatedActivities);
};

export const activityService = {
    getActivities,
    logActivity,
};
