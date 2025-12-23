/**
 * Parses a date input (Date object, timestamp, or string) into a valid UTC Date object.
 * Normalizes to UTC midnight to avoid timezone issues.
 * @param input The input to parse.
 * @returns A valid Date object or null if invalid.
 */
export const parseDate = (input: any): Date | null => {
    if (input === null || input === undefined) return null;

    let date: Date;

    if (input instanceof Date) {
        date = new Date(input.getTime());
    } else if (typeof input === 'number') {
        date = new Date(input);
    } else if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return null;

        // Check for ISO strings (e.g., 2023-10-27T00:00:00.000Z)
        if (trimmed.includes('T')) {
            date = new Date(trimmed);
        } 
        // Check for YYYY-MM-DD
        else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            date = new Date(`${trimmed}T00:00:00.000Z`);
        } 
        // Check for DD-MM-YYYY
        else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
            const [day, month, year] = trimmed.split('-');
            date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        } else {
            date = new Date(trimmed);
        }
    } else {
        return null;
    }

    // Crucial: Ensure the date is valid (not "Invalid Date")
    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
};

/**
 * Adds a specified number of days to a given date.
 * @param date The starting date.
 * @param days The number of days to add.
 * @returns A new Date object with the days added, or null if input is invalid.
 */
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date.getTime());
    if (isNaN(result.getTime())) return result;
    result.setUTCDate(result.getUTCDate() + days);
    return result;
};

/**
 * Checks if two Date objects represent the same day (ignoring time).
 * @param date1 The first date.
 * @param date2 The second date.
 * @returns True if they are the same day, false otherwise.
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
           date1.getUTCMonth() === date2.getUTCMonth() &&
           date1.getUTCDate() === date2.getUTCDate();
};

/**
 * Calculates the number of full days between two dates.
 * @param date1 The first date.
 * @param date2 The second date.
 * @returns The number of days between the two dates.
 */
export const daysBetween = (date1: Date, date2: Date): number => {
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0;
    const oneDay = 1000 * 60 * 60 * 24;
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.round(diffTime / oneDay);
};

/**
 * Formats a date to 'DD/MM/YYYY' string.
 * @param dateInput Date object, string, or timestamp number.
 * @returns Formatted string (e.g., "02/10/2023")
 */
export const formatDateGB = (dateInput: Date | string | number): string => {
    const date = parseDate(dateInput);
    if (!date) return 'Invalid Date';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

/**
 * Formats a date to 'DD/MM/YYYY, HH:MM:SS AM/PM' string.
 * @param dateInput Date object, string, or timestamp number.
 * @returns Formatted string (e.g., "02/10/2023, 02:30:00 pm")
 */
export const formatDateTimeGB = (dateInput: Date | string | number): string => {
    const date = parseDate(dateInput);
    if (!date) return 'Invalid Date';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(date).toUpperCase();
};