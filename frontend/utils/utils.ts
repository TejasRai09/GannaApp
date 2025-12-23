/**
 * Generates a random ID with a given prefix.
 * e.g., generateId('user') => 'user_a1b2c3d4'
 */
export const generateId = (prefix: 'user' | 'org' | 'run' | 'log' | 'ticket' | 'constraint'): string => {
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${randomPart}`;
};


/**
 * Formats an ISO date string into a more readable format (e.g., "Jul 28, 2024").
 */
export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Converts an ISO date string to a "time ago" format (e.g., "5 minutes ago").
 */
export const timeAgo = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
};