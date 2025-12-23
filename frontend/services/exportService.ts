/**
 * Converts an array of objects to a CSV string.
 * @param data Array of objects to convert.
 * @returns A string in CSV format.
 */
const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
            // Escape quotes by doubling them and wrap if it contains commas, quotes, or newlines
            if (/[",\n]/.test(cell)) {
                cell = `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};

/**
 * Triggers a browser download for the given CSV text.
 * @param csvString The CSV content to download.
 * @param filename The desired name for the downloaded file.
 */
export const exportToCsv = (data: any[], filename: string): void => {
    const csvString = convertToCSV(data);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
