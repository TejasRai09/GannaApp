
export const parseCsv = <T,>(csvText: string): T[] => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
        return [];
    }

    const headerLine = lines.shift();
    if (!headerLine) return [];

    const headers = headerLine.split(',').map(h => h.trim());
    
    return lines.map(line => {
        // This is a simple parser. For robust CSV parsing, a library would be better,
        // but this handles basic comma-separated values and quoted fields.
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        
        const entry = {} as T;
        headers.forEach((header, i) => {
            if (header) {
                (entry as any)[header] = values[i] || '';
            }
        });
        return entry;
    });
};
