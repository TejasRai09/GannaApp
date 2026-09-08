import bandsDataRaw from '../data/seasonal_bands.json';

const bandsData = bandsDataRaw as {
    bands: Record<string, Record<string, { lo: number; mid: number; hi: number }>>;
    surge_mults: Record<string, number>;
    centers: string[];
    overall_bands: Record<string, { lo: number; mid: number; hi: number }>;
};

export type BandPhase = 'Normal' | 'Pre-Surge' | 'Surge';
export type BandStatus = 'within' | 'above' | 'below';

export interface BandResult {
    lo: number;
    mid: number;
    hi: number;
    phase: BandPhase;
    weekOfSeason: number;
    phaseMultiplier: number;
    bandStatus: BandStatus;
}

export interface OverallBandResult {
    lo: number;
    mid: number;
    hi: number;
    weekOfSeason: number;
}

export function getWeekOfSeason(currentDate: Date, seasonStart: Date): number {
    const diffMs = currentDate.getTime() - seasonStart.getTime();
    return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

export function getPhase(week: number): { phase: BandPhase; multiplier: number } {
    if (week <= 12) return { phase: 'Normal', multiplier: 1.0 };
    if (week <= 15) return { phase: 'Pre-Surge', multiplier: 1.3 };
    return { phase: 'Surge', multiplier: 0 };
}

export function getOverallBand(
    weekOfSeason: number,
    phase: BandPhase,
    seasonFactor: number = 1.0
): OverallBandResult | null {
    const ob = bandsData.overall_bands;
    if (!ob) return null;

    let band = ob[String(weekOfSeason)];
    if (!band) {
        const availWeeks = Object.keys(ob).map(Number);
        if (availWeeks.length === 0) return null;
        const nearest = availWeeks.reduce((a, b) =>
            Math.abs(a - weekOfSeason) < Math.abs(b - weekOfSeason) ? a : b
        );
        band = ob[String(nearest)];
        if (!band) return null;
    }

    // Overall phase multiplier — surge is harder to estimate overall so use a conservative 1.5x
    const phaseMultiplier = phase === 'Surge' ? 1.5 : phase === 'Pre-Surge' ? 1.3 : 1.0;
    const adj = seasonFactor * phaseMultiplier;

    return {
        lo:  Math.round(band.lo  * adj),
        mid: Math.round(band.mid * adj),
        hi:  Math.round(band.hi  * adj),
        weekOfSeason,
    };
}

export function getBandResult(
    centreName: string,
    indent: number,
    currentDate: Date,
    seasonStart: Date,
    seasonFactor: number = 1.0
): BandResult | null {
    const week = getWeekOfSeason(currentDate, seasonStart);
    const { phase, multiplier } = getPhase(week);

    const centerBands = bandsData.bands[centreName];
    if (!centerBands) return null;

    let band = centerBands[String(week)];
    if (!band) {
        const availWeeks = Object.keys(centerBands).map(Number);
        if (availWeeks.length === 0) return null;
        const nearest = availWeeks.reduce((a, b) =>
            Math.abs(a - week) < Math.abs(b - week) ? a : b
        );
        band = centerBands[String(nearest)];
        if (!band) return null;
    }

    const phaseMultiplier = phase === 'Surge'
        ? (bandsData.surge_mults[centreName] ?? 2.5)
        : multiplier;

    const adj = seasonFactor * phaseMultiplier;
    const lo  = Math.round(band.lo  * adj);
    const hi  = Math.round(band.hi  * adj);
    const mid = Math.round(band.mid * adj);

    const bandStatus: BandStatus = indent < lo ? 'below' : indent > hi ? 'above' : 'within';

    return { lo, mid, hi, phase, weekOfSeason: week, phaseMultiplier, bandStatus };
}
