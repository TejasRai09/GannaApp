/**
 * ML maturity layer — sits ON TOP of the Excel-exact indent formula.
 *
 * The Excel formula sizes an indent as:
 *     indent = (requirement − forecast) / (1 + overrun) / D1
 * where (1 + overrun) is really "expected maturity": the fraction of an indent
 * that actually arrives as cane. The app's classic estimate is a global
 * purchases/indents ratio; this layer replaces it with a per-centre prediction:
 *
 *     blended = clip( 0.5 × linearModel(features) + 0.5 × recentWindowEstimate )
 *
 * The linear model was trained on 4 seasons (~55k centre-indents) with
 * leave-one-season-out validation; the 50/50 blend with the recent-window
 * estimate gave the best out-of-sample arrival error. Features use ONLY data
 * available at decision time (closed indents, calendar, centre attributes).
 */
import { ML_MODEL, EVENT_CALENDAR } from './mlModel';

export interface MlFeatureInputs {
    /** Delivery date of the indent being sized (T+3). */
    deliveryDate: Date;
    plantStartDate: Date;
    isGate: boolean;
    /** Centre bonding in qtls (0/unknown → imputed). */
    bonding: number;
    /** Centre maturity (purchases/indent) over closed deliveries T−7..T−4; null if none. */
    lagCentreRecent: number | null;
    /** Centre maturity over deliveries T−18..T−4; null if none. */
    lagCentreLong: number | null;
    /** Plant-wide maturity over closed deliveries T−7..T−4; null if none. */
    lagPlantRecent: number | null;
}

const MS_PER_DAY = 86_400_000;

const dayOfYear = (d: Date): number => {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    return Math.floor((d.getTime() - start) / MS_PER_DAY);
};

export type EventBucket = 'farm' | 'festival' | 'rain' | 'edge' | 'other' | 'normal';

/** Look up the agricultural/festival calendar (built from 3 flagged seasons) by day-of-year. */
export const getEventBucket = (deliveryDate: Date): EventBucket => {
    return (EVENT_CALENDAR[String(dayOfYear(deliveryDate))] as EventBucket | undefined) ?? 'normal';
};

const clip = (v: number): number => {
    const [lo, hi] = ML_MODEL.clip;
    return Math.min(hi, Math.max(lo, v));
};

/** Raw linear-model maturity prediction (unclipped inputs → clipped output). */
export const predictMaturity = (inp: MlFeatureInputs): number => {
    const daysFromStart = Math.round((inp.deliveryDate.getTime() - inp.plantStartDate.getTime()) / MS_PER_DAY);
    const ev = getEventBucket(inp.deliveryDate);

    const raw: { [k: string]: number | null } = {
        day_of_season: daysFromStart,
        week_of_season: Math.floor(daysFromStart / 7) + 1,
        month: inp.deliveryDate.getUTCMonth() + 1,
        dow: (inp.deliveryDate.getUTCDay() + 6) % 7, // python weekday(): Mon=0
        is_gate: inp.isGate ? 1 : 0,
        log_bonding: inp.bonding > 0 ? Math.log1p(inp.bonding) : null,
        lag_c_7_10: inp.lagCentreRecent,
        lag_c_7_21: inp.lagCentreLong,
        lag_p_7_10: inp.lagPlantRecent,
        ev_farm: ev === 'farm' ? 1 : 0,
        ev_festival: ev === 'festival' ? 1 : 0,
        ev_rain: ev === 'rain' ? 1 : 0,
        ev_edge: ev === 'edge' ? 1 : 0,
    };

    let acc = ML_MODEL.intercept;
    for (const f of ML_MODEL.features) {
        const v = raw[f];
        const x = (v === null || v === undefined || Number.isNaN(v)) ? ML_MODEL.medians[f] : v;
        acc += ML_MODEL.coefficients[f] * x;
    }
    return clip(acc);
};

/**
 * Final blended maturity used to size the indent.
 * 50% linear model + 50% the app's classic recent-window estimate.
 */
export const blendedMaturity = (inp: MlFeatureInputs): { maturity: number; mlPrediction: number; recentEstimate: number } => {
    const mlPrediction = predictMaturity(inp);
    const recentRaw = inp.lagCentreRecent ?? inp.lagPlantRecent ?? 1.0;
    const recentEstimate = clip(recentRaw);
    const w = ML_MODEL.blendWeightMl;
    const maturity = clip(w * mlPrediction + (1 - w) * recentEstimate);
    return { maturity, mlPrediction, recentEstimate };
};
