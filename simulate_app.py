"""
simulate_app.py
Runs the EXACT same algorithm as calculationService.ts using the CSV test files.
The output should match the app's results exactly for the same parameters.

Usage:  python simulate_app.py
Adjust the PARAMETERS section below to match what you enter in the app.
"""

import csv, sys, math
from datetime import datetime, timedelta
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# ─── PARAMETERS — match exactly what you enter in the app ───────────────────
CURRENT_DATE        = datetime(2025, 12, 12)   # T
PLANT_START_DATE    = datetime(2025, 10, 24)   # first indent date in your files
PLANT_CAPACITY_PCT  = 80                        # e.g. 80 for 80%
TOTAL_DAILY_REQ     = 100_000                   # Qtl (max daily capacity)
STD_STOCK_GATE      = 9_000                     # Qtl
STD_STOCK_CENTRE    = 6_000                     # Qtl
AVAIL_STOCK_GATE    = 3_145                     # Qtl (from yard balance Dec 11 = T-1)
AVAIL_STOCK_CENTRE  = 15_989                    # Qtl (from yard balance Dec 11 = T-1)
# ─────────────────────────────────────────────────────────────────────────────

BONDING_FILE        = r"Current Season Files for Testing\bonding_data.csv"
INDENT_FILE         = r"Current Season Files for Testing\11Dec_ Season Indent.csv"
PURCHASE_FILE       = r"Current Season Files for Testing\11Dec_Purchase.csv"
MAPPING_FILE        = r"Current Season Files for Testing\Center Mapping.csv"

# ─── Date parser ─────────────────────────────────────────────────────────────
def parse_date(s):
    s = s.strip()
    for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None

# ─── 1. Read center mapping ──────────────────────────────────────────────────
mapping = {}  # source_code_str → target_code_str
with open(MAPPING_FILE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        src = str(row.get('Source', row.get('source', ''))).strip()
        tgt = str(row.get('Target', row.get('target', ''))).strip()
        if src and tgt:
            mapping[src] = tgt

def apply_mapping(code_str):
    return mapping.get(str(code_str).strip(), str(code_str).strip())

# ─── 2. Read bonding ─────────────────────────────────────────────────────────
bonding = {}  # code_str → {name, qty, is_gate}
with open(BONDING_FILE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        code = apply_mapping(str(row.get('Code', '')).strip())
        name_raw = (row.get('Center Name', row.get('Centre Name', ''))).strip()
        qty_s    = str(row.get('Bonding', row.get('bonding', '0'))).replace(',', '').strip()
        qty      = float(qty_s) if qty_s else 0
        if not code: continue
        if code in bonding:
            bonding[code]['qty'] += qty
        else:
            bonding[code] = {'name': name_raw, 'qty': qty,
                              'is_gate': 'GATE' in name_raw.upper()}

print(f"Bonding:   {len(bonding)} centers")

total_bonding    = sum(v['qty'] for v in bonding.values())
total_gate_bond  = sum(v['qty'] for v in bonding.values() if     v['is_gate'])
total_ctr_bond   = sum(v['qty'] for v in bonding.values() if not v['is_gate'])

# ─── 3. Read indents ─────────────────────────────────────────────────────────
indents = defaultdict(float)  # (code, date) → qty
with open(INDENT_FILE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        code = apply_mapping(str(row.get('Code', '')).strip())
        d    = parse_date(str(row.get('Indent Date', row.get('Date', ''))))
        qty  = float(str(row.get('Qty in Qtls', '0')).replace(',', '')) or 0
        if code and d:
            indents[(code, d)] += qty

print(f"Indents:   {len(indents)} records")

# ─── 4. Read purchases ───────────────────────────────────────────────────────
purchases = []  # list of (code, indent_date, purchase_date, qty)
with open(PURCHASE_FILE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        code  = apply_mapping(str(row.get('Code', '')).strip())
        pur_d = parse_date(str(row.get('Purchase Date', row.get('Date', ''))))
        ind_d = parse_date(str(row.get('Indent Date', '')))
        qty   = float(str(row.get('Qty in Qtls', '0')).replace(',', '')) or 0
        if code and pur_d and ind_d:
            purchases.append((code, ind_d, pur_d, qty))

print(f"Purchases: {len(purchases)} records")

# ─── 5. Season-wide overrun ──────────────────────────────────────────────────
# Denominator: CLOSED indents only (indent_date <= T-4, i.e. fully received)
# Numerator: ALL purchases in the season (matching Excel formula)
T_MINUS_4 = CURRENT_DATE - timedelta(days=4)   # Dec 8 for T=Dec 12

total_ind_qty = sum(
    qty for (c, d), qty in indents.items()
    if PLANT_START_DATE <= d <= T_MINUS_4
)
total_pur_qty = sum(
    qty for (c, ind_d, pur_d, qty) in purchases
)
overrun = (total_pur_qty / total_ind_qty - 1) if total_ind_qty > 0 else 0

print(f"\nSeason overrun:  {overrun*100:.4f}%")
print(f"Total indents:   {total_ind_qty:,.0f} Qtl")
print(f"Total purchases: {total_pur_qty:,.0f} Qtl")

effective_req = TOTAL_DAILY_REQ * (PLANT_CAPACITY_PCT / 100)
print(f"Effective req:   {effective_req:,.0f} Qtl")

# ─── 6. D-weight helpers ─────────────────────────────────────────────────────
T = CURRENT_DATE

def compute_recent_d_weights(code):
    """Simple average of per-indent D-rates for last 4 closed indents (T-7 to T-4)."""
    rates = []
    for delta in range(4):
        ind_date = T - timedelta(days=4 + delta)
        if ind_date < T - timedelta(days=7):
            break
        ind_qty = indents.get((code, ind_date), 0)
        if ind_qty <= 0:
            continue
        d1 = d2 = d3 = d4 = 0.0
        for (pc, pid, ppd, pqty) in purchases:
            if pc != code or pid != ind_date:
                continue
            diff = (ppd - ind_date).days
            if diff <= 0:    d1 += pqty
            elif diff == 1:  d2 += pqty
            elif diff == 2:  d3 += pqty
            else:            d4 += pqty
        rates.append({'d1': d1/ind_qty, 'd2': d2/ind_qty,
                      'd3': d3/ind_qty, 'd4': d4/ind_qty})
    if not rates:
        return None
    n = len(rates)
    return {k: sum(r[k] for r in rates)/n for k in ('d1','d2','d3','d4')}

def compute_season_d_weights(code):
    rates = []
    t4 = T - timedelta(days=4)
    for (c, ind_d), ind_qty in indents.items():
        if c != code or ind_d < PLANT_START_DATE or ind_d > t4 or ind_qty <= 0:
            continue
        d1 = d2 = d3 = d4 = 0.0
        for (pc, pid, ppd, pqty) in purchases:
            if pc != code or pid != ind_d:
                continue
            diff = (ppd - ind_d).days
            if diff <= 0:    d1 += pqty
            elif diff == 1:  d2 += pqty
            elif diff == 2:  d3 += pqty
            else:            d4 += pqty
        rates.append({'d1': d1/ind_qty, 'd2': d2/ind_qty,
                      'd3': d3/ind_qty, 'd4': d4/ind_qty})
    if not rates:
        return {'d1': 0, 'd2': 0, 'd3': 0, 'd4': 0}
    n = len(rates)
    return {k: sum(r[k] for r in rates)/n for k in ('d1','d2','d3','d4')}

# ─── 7. Calculate per center ─────────────────────────────────────────────────
T0, T1, T2 = T, T + timedelta(days=1), T + timedelta(days=2)

results = []
for code, b in bonding.items():
    if b['qty'] <= 0:
        continue

    # D-weights: recent first, season fallback
    w = compute_recent_d_weights(code)
    if w is None or w['d1'] < 0.05:
        w = compute_season_d_weights(code)

    # Requirement by bonding
    req_by_bonding = effective_req * (b['qty'] / total_bonding)

    # Stock adjustment
    if b['is_gate']:
        diff = STD_STOCK_GATE - AVAIL_STOCK_GATE
        stock_adj = diff * (b['qty'] / total_gate_bond) if total_gate_bond > 0 else 0
    else:
        diff = STD_STOCK_CENTRE - AVAIL_STOCK_CENTRE
        stock_adj = diff * (b['qty'] / total_ctr_bond) if total_ctr_bond > 0 else 0

    adj_req = req_by_bonding + stock_adj

    # Forecast T+3
    i_t0 = indents.get((code, T0), 0)
    i_t1 = indents.get((code, T1), 0)
    i_t2 = indents.get((code, T2), 0)
    forecast_t3 = i_t2 * w['d2'] + i_t1 * w['d3'] + i_t0 * w['d4']

    # Final indent
    gap = max(0, adj_req - forecast_t3)
    target = gap / (1 + overrun) if overrun > -1 else 0
    final  = target / w['d1'] if w['d1'] > 0 else 0

    results.append({
        'code': code, 'name': b['name'],
        'bonding': b['qty'], 'is_gate': b['is_gate'],
        'req_by_bonding': req_by_bonding, 'stock_adj': stock_adj,
        'adj_req': adj_req, 'forecast_t3': forecast_t3,
        'gap': gap, 'indent': final,
        'd1': w['d1'], 'd2': w['d2'], 'd3': w['d3'], 'd4': w['d4'],
    })

results.sort(key=lambda x: x['name'])

# ─── 8. Print results ────────────────────────────────────────────────────────
print(f"\n{'='*90}")
print(f"GannaApp Simulation — T = {T.date()} | DR = {TOTAL_DAILY_REQ:,} | PC = {PLANT_CAPACITY_PCT}%")
print(f"Std Gate = {STD_STOCK_GATE:,} | Avail Gate = {AVAIL_STOCK_GATE:,} | "
      f"Std Ctr = {STD_STOCK_CENTRE:,} | Avail Ctr = {AVAIL_STOCK_CENTRE:,}")
print(f"{'='*90}")
print(f"{'Center':<35} {'Bonding':>10} {'AdjReq':>10} {'FcstT3':>10} {'Gap':>10} {'Indent':>10}")
print(f"{'-'*90}")

total_indent = 0
for r in results:
    if r['indent'] > 0.01 or r['adj_req'] > 1:
        print(f"{r['name']:<35} {r['bonding']:>10,.0f} {r['adj_req']:>10,.1f} "
              f"{r['forecast_t3']:>10,.1f} {r['gap']:>10,.1f} {r['indent']:>10,.1f}")
    total_indent += r['indent']

print(f"{'-'*90}")
print(f"{'TOTAL':<35} {total_bonding:>10,.0f} {'':>10} {'':>10} {'':>10} {total_indent:>10,.1f}")
print(f"{'='*90}")

# ─── 9. GATE detail ──────────────────────────────────────────────────────────
gate = next((r for r in results if r['is_gate']), None)
if gate:
    print(f"\n--- GATE Detailed Breakdown (T = {T.date()}) ---")
    print(f"  Bonding share:     {gate['bonding']/total_bonding*100:.4f}%")
    print(f"  Req by bonding:    {gate['req_by_bonding']:,.2f}")
    print(f"  Stock diff (gate): {STD_STOCK_GATE - AVAIL_STOCK_GATE:+,.0f}")
    print(f"  Stock adjustment:  {gate['stock_adj']:+,.2f}")
    print(f"  Adjusted req:      {gate['adj_req']:,.2f}")
    print(f"  Open indents:")
    t0_qty = indents.get((gate['code'], T0), 0)
    t1_qty = indents.get((gate['code'], T1), 0)
    t2_qty = indents.get((gate['code'], T2), 0)
    print(f"    T+0 ({T0.date()}): {t0_qty:,.0f} Qtl  x D4={gate['d4']:.4f} = {t0_qty*gate['d4']:,.1f}")
    print(f"    T+1 ({T1.date()}): {t1_qty:,.0f} Qtl  x D3={gate['d3']:.4f} = {t1_qty*gate['d3']:,.1f}")
    print(f"    T+2 ({T2.date()}): {t2_qty:,.0f} Qtl  x D2={gate['d2']:.4f} = {t2_qty*gate['d2']:,.1f}")
    print(f"  Forecast T+3:      {gate['forecast_t3']:,.2f}")
    print(f"  Gap:               {gate['gap']:,.2f}")
    print(f"  Overrun:           {overrun*100:.4f}%")
    print(f"  Target arrival:    {gate['gap']/(1+overrun):,.2f}")
    print(f"  D1 weight:         {gate['d1']:.5f}")
    print(f"  FINAL INDENT:      {gate['indent']:,.2f} Qtl")
    print(f"\n  D-weights: D1={gate['d1']:.4f}, D2={gate['d2']:.4f}, "
          f"D3={gate['d3']:.4f}, D4={gate['d4']:.4f}")
