'use strict';
/**
 * FULL-SEASON faithful app replay (permanent, in _replay/).
 * Extends the window to EVERY delivery day of the season that had actual indent
 * activity — from season start (early days run on fallbacks, exactly as the live
 * app would) to the last indent day. Uses the real daily Cane Requirement and
 * 8 A.M. yard balances. Shipped model, mapping ON, gross policy, wind-down follow
 * mode from week 14.
 *
 * usage: node run_full.js <label> <indentCsv> <purchaseCsv> <bondingCsv> <plantStart> <yardJson> <outCsv>
 */
const fs = require('fs');
const path = require('path');
const REP = __dirname;
const [LABEL, INDF, PURF, BONF, PS, YARDF, OUT] = process.argv.slice(2);
const { ML_MODEL: MODEL, EVENT_CALENDAR: CAL } = require(path.join(REP, 'mlModel.js'));
const YARD = JSON.parse(fs.readFileSync(YARDF));
const MS = 86400000;
const D = s => new Date(s + 'T00:00:00.000Z');
const addDays = (d, n) => new Date(d.getTime() + n * MS);
const iso = d => d.toISOString().slice(0, 10);
const PLANT_START = D(PS);
const STD_GATE = 9000, STD_CENTRE = 6000;
const MAPPING = { '26':'1','27':'1','36':'1','37':'1','38':'1','135':'1' };
const LATE_WEEK = 14;

function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines.shift().replace(/^﻿/, '').split(',').map(h => h.trim());
    return lines.map(line => {
        const vals = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        const o = {}; headers.forEach((h, i) => { if (h) o[h] = vals[i] || ''; }); return o;
    });
}
function parseDate(s) {
    if (!s) return null; s = s.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) { const [d, m, y] = s.split('-'); return D(`${y}-${m}-${d}`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return D(s);
    return null;
}
const bondingRaw = parseCsv(fs.readFileSync(BONF, 'utf8'));
const indentRaw = parseCsv(fs.readFileSync(INDF, 'utf8'));
const purchRaw = parseCsv(fs.readFileSync(PURF, 'utf8'));
const bondingByC = new Map();
for (const r of bondingRaw) {
    const orig = (r['Code'] || '').trim(); if (!orig) continue;
    const id = MAPPING[orig] || orig;
    const name = (r['Center'] || r['Center Name'] || '').trim();
    const qty = parseFloat(r['Bonding'] || '0');
    if (id && name && qty > 0) { const e = bondingByC.get(id) || { name, qty: 0 }; e.qty += qty; bondingByC.set(id, e); }
}
const nBonding = [...bondingByC.entries()].map(([centreId, d]) => ({ centreId, centreName: d.name, qty: d.qty,
    isGate: d.name.toUpperCase().includes('GATE') || centreId === '1' }));
const totalBonding = nBonding.reduce((s, b) => s + b.qty, 0);
const totBG = nBonding.filter(b => b.isGate).reduce((s, b) => s + b.qty, 0);
const totBC = nBonding.filter(b => !b.isGate).reduce((s, b) => s + b.qty, 0);
const indMap = new Map();
for (const r of indentRaw) {
    const orig = (r['Code'] || '').trim(); if (!orig) continue;
    const id = MAPPING[orig] || orig;
    const rf = parseDate(r['Indent Date']);
    const qty = parseFloat(r['Qty in Qtls'] || r['Qty'] || '0');
    if (id && rf && qty > 0) { const k = `${id}|${iso(rf)}`; indMap.set(k, (indMap.get(k) || 0) + qty); }
}
const purchases = [];
for (const r of purchRaw) {
    const orig = (r['Code'] || '').trim(); if (!orig) continue;
    const id = MAPPING[orig] || orig;
    const pd = parseDate(r['Purchase Date']);
    const rf = parseDate(r['Indent Date']);
    const qty = parseFloat(r['Qty in Qtls'] || r['Qty'] || '0');
    if (id && pd && qty > 0) purchases.push({ c: id, pd, rf, qty });
}
// FULL-SEASON delivery range: from earliest to latest indent delivery date
const deliveryDates = [...indMap.keys()].map(k => D(k.split('|')[1]).getTime());
const firstDelivery = new Date(Math.min(...deliveryDates));
const lastDelivery = new Date(Math.max(...deliveryDates));

const clip = v => Math.min(MODEL.clip[1], Math.max(MODEL.clip[0], v));
const dayOfYear = d => Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / MS);
function predictMaturity(inp) {
    const dos = Math.round((inp.delivery.getTime() - PLANT_START.getTime()) / MS);
    const ev = CAL[String(dayOfYear(inp.delivery))] || 'normal';
    const raw = { day_of_season: dos, week_of_season: Math.floor(dos / 7) + 1, month: inp.delivery.getUTCMonth() + 1,
        dow: (inp.delivery.getUTCDay() + 6) % 7, is_gate: inp.isGate ? 1 : 0,
        log_bonding: inp.bonding > 0 ? Math.log1p(inp.bonding) : null,
        lag_c_7_10: inp.lagCR, lag_c_7_21: inp.lagCL, lag_p_7_10: inp.lagPR,
        ev_farm: ev === 'farm' ? 1 : 0, ev_festival: ev === 'festival' ? 1 : 0, ev_rain: ev === 'rain' ? 1 : 0, ev_edge: ev === 'edge' ? 1 : 0 };
    let acc = MODEL.intercept;
    for (const f of MODEL.features) { const v = raw[f]; acc += MODEL.coefficients[f] * ((v === null || v === undefined || Number.isNaN(v)) ? MODEL.medians[f] : v); }
    return clip(acc);
}
function totFor(byIndent, key) { let t = 0; for (const p of (byIndent.get(key) || [])) t += p.qty; return t; }
const indList = [...indMap.entries()].map(([k, qty]) => { const [c, dIso] = k.split('|'); return { c, t: D(dIso).getTime(), d: D(dIso), qty, k }; });
const totalsByDay = new Map();
for (const [k, qty] of indMap) { const dIso = k.split('|')[1]; totalsByDay.set(dIso, (totalsByDay.get(dIso) || 0) + qty); }

const rows = [];
// decision day T ranges so delivery T+3 spans firstDelivery..lastDelivery
let firstT = addDays(firstDelivery, -3);
if (firstT.getTime() < PLANT_START.getTime()) firstT = new Date(PLANT_START);
const lastT = addDays(lastDelivery, -3);
for (let T = new Date(firstT); T.getTime() <= lastT.getTime(); T = addDays(T, 1)) {
    const tPlus3 = addDays(T, 3);
    const t4 = addDays(T, -4).getTime(), t7 = addDays(T, -7).getTime(), t18 = addDays(T, -18).getTime();
    const cutoffP = addDays(T, -1).getTime();
    const cutP = purchases.filter(p => p.pd.getTime() <= cutoffP);
    const byIndent = new Map();
    for (const p of cutP) { if (!p.rf) continue; const k = `${p.c}|${iso(p.rf)}`; if (!byIndent.has(k)) byIndent.set(k, []); byIndent.get(k).push(p); }
    const closed = indList.filter(i => i.t <= t4);
    const recent = closed.filter(i => i.t >= t7);
    const longW = closed.filter(i => i.t >= t18);
    let prP = 0, prQ = 0;
    for (const i of recent) { prP += totFor(byIndent, i.k); prQ += i.qty; }
    const lagPR = prQ > 0 ? prP / prQ : null;
    const lo14 = addDays(T, -14).getTime();
    const per = new Map(); let tot = 0;
    for (const p of cutP) if (p.pd.getTime() >= lo14) { per.set(p.c, (per.get(p.c) || 0) + p.qty); tot += p.qty; }
    const rawShare = new Map();
    for (const b of nBonding) { const tp = per.get(b.centreId); rawShare.set(b.centreId, (tp && tot > 0) ? tp / tot : b.qty / totalBonding); }
    const sum = [...rawShare.values()].reduce((s, v) => s + v, 0);
    const wos = Math.floor(Math.round((T.getTime() - PLANT_START.getTime()) / MS) / 7) + 1;

    const y = YARD[iso(T)] || {};
    const REQ = (y.req && y.req > 0) ? y.req : 100000;
    const diffG = STD_GATE - (y.yardGate != null ? y.yardGate : STD_GATE);
    const diffC = STD_CENTRE - (y.yardCentre != null ? y.yardCentre : STD_CENTRE);

    let appGate = 0, appCentre = 0, actGate = 0, actCentre = 0;
    for (const ctr of nBonding) {
        let cp = 0, cq = 0;
        for (const i of recent) if (i.c === ctr.centreId) { cp += totFor(byIndent, i.k); cq += i.qty; }
        const lagCR = cq > 0 ? cp / cq : null;
        let lp = 0, lq = 0;
        for (const i of longW) if (i.c === ctr.centreId) { lp += totFor(byIndent, i.k); lq += i.qty; }
        const lagCL = lq > 0 ? lp / lq : null;
        const mlMat = predictMaturity({ delivery: tPlus3, isGate: ctr.isGate, bonding: ctr.qty, lagCR, lagCL, lagPR });
        const mlShare = (rawShare.get(ctr.centreId) || 0) / sum;
        const stockAdj = ctr.isGate ? (totBG > 0 ? diffG * (ctr.qty / totBG) : 0)
                                    : (totBC > 0 ? diffC * (ctr.qty / totBC) : 0);
        const mlReq = REQ * mlShare + stockAdj;
        let mlIndent = mlReq > 0 ? mlReq / mlMat : 0;
        if (wos >= LATE_WEEK) {
            mlIndent = 0;
            for (const dd of [2, 1, 0]) {
                const dayTot = totalsByDay.get(iso(addDays(T, dd))) || 0;
                if (dayTot > 0) { mlIndent = indMap.get(`${ctr.centreId}|${iso(addDays(T, dd))}`) || 0; break; }
            }
        }
        const act = indMap.get(`${ctr.centreId}|${iso(tPlus3)}`) || 0;
        if (ctr.isGate) { appGate += mlIndent; actGate += act; } else { appCentre += mlIndent; actCentre += act; }
    }
    rows.push({ date: iso(tPlus3), req: REQ, yg: y.yardGate, yc: y.yardCentre,
                actCentre, actGate, actTot: actCentre + actGate,
                appCentre, appGate, appTot: appCentre + appGate });
}
let csv = 'Delivery Date,Cane Req Input,Yard Gate 8AM,Yard Centre 8AM,Actual Centres,Actual GATE,Actual Overall,App Centres,App GATE,App Overall,Var Centres,Var GATE,Var Overall,Var Centres %,Var GATE %,Var Overall %\n';
for (const r of rows) {
    const vp = (a, b) => b > 0 ? ((a - b) / b * 100).toFixed(1) : '';
    csv += [r.date, r.req, r.yg ?? '', r.yc ?? '',
            r.actCentre.toFixed(0), r.actGate.toFixed(0), r.actTot.toFixed(0),
            r.appCentre.toFixed(0), r.appGate.toFixed(0), r.appTot.toFixed(0),
            (r.appCentre - r.actCentre).toFixed(0), (r.appGate - r.actGate).toFixed(0), (r.appTot - r.actTot).toFixed(0),
            vp(r.appCentre, r.actCentre), vp(r.appGate, r.actGate), vp(r.appTot, r.actTot)].join(',') + '\n';
}
fs.writeFileSync(OUT, csv);
const mape = k => { const v = rows.filter(r => r['act' + k] > 0); return v.length ? v.reduce((s, r) => s + Math.abs(r['app' + k] / r['act' + k] - 1), 0) / v.length * 100 : 0; };
console.log(`${LABEL}: ${rows.length} delivery days [${rows[0].date}..${rows[rows.length-1].date}]  daily MAPE C/G/O: ${mape('Centre').toFixed(1)}/${mape('Gate').toFixed(1)}/${mape('Tot').toFixed(1)}`);
