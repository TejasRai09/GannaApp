"""
verify_against_excel.py
=======================
Comprehensive comparison of our algorithm vs the Excel model (IndentingModel_TestFilexlsm.xlsm)
for T = Jan 27, 2023 (the date that the Forecast_Day1 sheet was computed for).

Known ground-truth from the Excel Forecast_Day1 sheet:
  D1 = 0.26089, D2 = 0.43911, D3 = 0.26092, D4 = 0.14143
  Overrun          = 9.2943%
  GATE final indent = 58,673.12 Qtl

Run: python verify_against_excel.py
"""
import openpyxl, sys
from datetime import datetime, timedelta
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

XLSM = "IndentingModel_TestFilexlsm.xlsm"

# ---- Parameters from Report sheet ----------------------------------------
T              = datetime(2023, 1, 27)
PLANT_START    = datetime(2022, 11, 15)
DAILY_REQ      = 80_000
CAPACITY_PCT   = 80
EFF_REQ        = DAILY_REQ * (CAPACITY_PCT / 100)   # 64,000
STD_GATE       = 10_000
AVAIL_GATE     = 4_000
STD_CENTRE     = 6_000
AVAIL_CENTRE   = 8_000
T_MINUS_4      = T - timedelta(days=4)               # Jan 23

# ---- Ground-truth from Forecast_Day1 -------------------------------------
EXCEL = {
    'd1': 0.26089349451987265,
    'd2': 0.43911047921958535,
    'd3': 0.2609236431941794,
    'd4': 0.14143053376034115,
    'overrun': 0.09294321497351121,
    'gate_indent': 58673.12424319704,
}

print("=" * 70)
print(f"  Verification: Our Algorithm vs Excel Model")
print(f"  T = {T.date()} | Closed cutoff (T-4) = {T_MINUS_4.date()}")
print(f"  EFF_REQ = {EFF_REQ:,.0f} | STD_GATE={STD_GATE:,} | AVAIL_GATE={AVAIL_GATE:,}")
print(f"  STD_CTR={STD_CENTRE:,} | AVAIL_CTR={AVAIL_CENTRE:,}")
print("=" * 70)

wb = openpyxl.load_workbook(XLSM, read_only=True, data_only=True)

# ---- 1. Build gate_code -> main_code mapping from Centers sheet ----------
gate_to_main = {}   # e.g. 26 -> 7, 27 -> 8, etc.
ws_c = wb['Centers']
for row in ws_c.iter_rows(min_row=2, min_col=1, max_col=3, values_only=True):
    gate_code, main_code, name = row
    if gate_code is not None and main_code is not None:
        try:
            gate_to_main[int(gate_code)] = int(main_code)
        except (ValueError, TypeError):
            pass

print(f"\n[1] Gate-code -> Main-code mapping ({len(gate_to_main)} entries):")
for g, m in sorted(gate_to_main.items()):
    print(f"    Gate {g:3d}  ->  Main {m:3d}")

def resolve(code):
    """Map gate code to main code; pass through if no mapping exists."""
    c = int(code) if code is not None else None
    return gate_to_main.get(c, c)

# ---- 2. Read Bonding -------------------------------------------------------
bonding = {}   # main_code -> {name, qty, is_gate}
ws_b = wb['Bonding']
for row in ws_b.iter_rows(min_row=2, values_only=True):
    code = row[0]; name = row[1]; qty = row[2]
    if code is None or qty is None: continue
    bonding[int(code)] = {
        'name': str(name),
        'qty': float(qty),
        'is_gate': str(name).upper().startswith('GATE')
    }

total_bonding   = sum(v['qty'] for v in bonding.values())
total_gate_bond = sum(v['qty'] for v in bonding.values() if     v['is_gate'])
total_ctr_bond  = sum(v['qty'] for v in bonding.values() if not v['is_gate'])

print(f"\n[2] Bonding: {len(bonding)} centers  |  "
      f"Total={total_bonding:,.0f}  |  Gate={total_gate_bond:,.0f}  |  Ctr={total_ctr_bond:,.0f}")

# ---- 3. Read Indents (apply gate->main mapping) ----------------------------
indents = defaultdict(float)   # (main_code, date) -> qty
ws_i = wb['Indent']
for row in ws_i.iter_rows(min_row=2, values_only=True):
    raw_code = row[0]; d = row[2]; qty = row[4]
    if raw_code is None or d is None or qty is None: continue
    if not isinstance(d, datetime): continue
    code = resolve(raw_code)
    if PLANT_START <= d <= T:
        indents[(code, d)] += float(qty)

print(f"\n[3] Indents loaded: {len(indents)} (code, date) records")

# ---- 4. Read Purchases (apply gate->main mapping) --------------------------
purchases = []   # list of (main_code, indent_date, purchase_date, qty)
ws_p = wb['Purchase']
for row in ws_p.iter_rows(min_row=2, values_only=True):
    raw_code = row[0]; pur_d = row[2]; ind_d = row[3]; qty = row[5]
    if raw_code is None or pur_d is None or ind_d is None or qty is None: continue
    if not (isinstance(pur_d, datetime) and isinstance(ind_d, datetime)): continue
    code = resolve(raw_code)
    purchases.append((code, ind_d, pur_d, float(qty)))

print(f"[4] Purchases loaded: {len(purchases)} records")

# ---- 5. Season-wide overrun ------------------------------------------------
# Denominator: closed indent qty (raisedFor <= T-4)
# Numerator: ALL purchases
closed_keys = {(c, d) for (c, d) in indents if PLANT_START <= d <= T_MINUS_4}
total_ind_qty = sum(indents[k] for k in closed_keys)
total_pur_qty = sum(qty for (_, _, _, qty) in purchases)
our_overrun   = total_pur_qty / total_ind_qty - 1 if total_ind_qty > 0 else 0

print(f"\n[5] OVERRUN")
print(f"    Closed indent qty : {total_ind_qty:>15,.2f}")
print(f"    All purchases     : {total_pur_qty:>15,.2f}")
print(f"    Our overrun       : {our_overrun:>15.6f}  ({our_overrun*100:.4f}%)")
print(f"    Excel overrun     : {EXCEL['overrun']:>15.6f}  ({EXCEL['overrun']*100:.4f}%)")
pct_diff = abs(our_overrun - EXCEL['overrun']) / EXCEL['overrun'] * 100
status = 'OK' if pct_diff < 0.01 else f'DIFF {pct_diff:.3f}%'
print(f"    Status            : {status}")

# ---- 6. D-weight calculation for GATE (main code = 1) ---------------------
GATE_CODE = 1

def compute_d_weights(code):
    """Simple average of per-indent D-rates for the last 4 closed indents (T-7..T-4)."""
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
            if   diff <= 0: d1 += pqty
            elif diff == 1: d2 += pqty
            elif diff == 2: d3 += pqty
            else:           d4 += pqty
        rates.append({'d1': d1/ind_qty, 'd2': d2/ind_qty,
                      'd3': d3/ind_qty, 'd4': d4/ind_qty})
    if not rates:
        return None
    n = len(rates)
    return {k: sum(r[k] for r in rates)/n for k in ('d1','d2','d3','d4')}

gate_w = compute_d_weights(GATE_CODE)

print(f"\n[6] D-WEIGHTS for GATE (code {GATE_CODE}) — last 4 closed indents")
print(f"    {'':6s}  {'Ours':>12s}  {'Excel':>12s}  {'Diff %':>10s}  Status")
for k in ('d1','d2','d3','d4'):
    ours  = gate_w[k]
    excel = EXCEL[k]
    diff  = abs(ours - excel) / excel * 100
    status = 'OK' if diff < 0.01 else f'DIFF {diff:.4f}%'
    print(f"    {k.upper():6s}  {ours:12.8f}  {excel:12.8f}  {diff:10.6f}%  {status}")

# ---- 7. Forecast T+3 for GATE ------------------------------------------------
T0 = T                          # Jan 27
T1 = T + timedelta(days=1)      # Jan 28
T2 = T + timedelta(days=2)      # Jan 29
T3 = T + timedelta(days=3)      # Jan 30

i_t0 = indents.get((GATE_CODE, T0), 0)
i_t1 = indents.get((GATE_CODE, T1), 0)
i_t2 = indents.get((GATE_CODE, T2), 0)

our_forecast_t3 = (i_t2 * gate_w['d2'] +
                   i_t1 * gate_w['d3'] +
                   i_t0 * gate_w['d4'])

# From Forecast_Day1 open indent matrix (rows 50-52):
# Jan27 indent=32517, D4 portion arrives Jan30 = 32517 * D4 = 32517 * 0.14143 = 4,599
# Jan28 indent=24327, D3 portion arrives Jan30 = 24327 * D3 = 24327 * 0.26092 = 6,347
# Jan29 indent=27342 (TBD row), D2 portion arrives Jan30 = 27342 * D2 = 27342 * 0.43911 = 12,006
EXCEL_FORECAST_T3 = 4_598.896666 + 3_440.580594 + 7_133.349927  # from rows 50-52 col 'last' = D4 of Jan27, D3 of Jan28, D2 of Jan29...
# Recompute: these are the arrivals at Jan 30 for each open indent
# But "forecast" means open indents as of T, i.e., T+0=Jan27, T+1=Jan28, T+2=Jan29 deliver D4,D3,D2 at T+3=Jan30
excel_forecastT3_check = (i_t0 * EXCEL['d4'] + i_t1 * EXCEL['d3'] + i_t2 * EXCEL['d2'])

print(f"\n[7] FORECAST T+3 for GATE")
print(f"    Open indent T+0 ({T0.date()}): {i_t0:>10,.0f} Qtl")
print(f"    Open indent T+1 ({T1.date()}): {i_t1:>10,.0f} Qtl")
print(f"    Open indent T+2 ({T2.date()}): {i_t2:>10,.0f} Qtl")
print(f"    Our  forecastT3 : {our_forecast_t3:>15,.4f} Qtl")
print(f"    Excel-recalc T3 : {excel_forecastT3_check:>15,.4f} Qtl  (using Excel D-weights on same indents)")

# ---- 8. Adj requirement, gap, final indent for GATE -----------------------
gate_b      = bonding[GATE_CODE]
req_bonding = EFF_REQ * (gate_b['qty'] / total_bonding)
stock_adj   = (STD_GATE - AVAIL_GATE) * (gate_b['qty'] / total_gate_bond)
adj_req     = req_bonding + stock_adj

gap         = max(0, adj_req - our_forecast_t3)
target      = gap / (1 + our_overrun)
our_indent  = target / gate_w['d1'] if gate_w['d1'] > 0 else 0

print(f"\n[8] GATE FINAL INDENT")
print(f"    Gate bonding    : {gate_b['qty']:>15,.0f}")
print(f"    Total bonding   : {total_bonding:>15,.0f}")
print(f"    Req by bonding  : {req_bonding:>15,.4f}")
print(f"    Stock adj (gate): {stock_adj:>15,.4f}  (std={STD_GATE:,} - avail={AVAIL_GATE:,}) * share")
print(f"    Adj requirement : {adj_req:>15,.4f}")
print(f"    Forecast T+3    : {our_forecast_t3:>15,.4f}")
print(f"    Gap             : {gap:>15,.4f}")
print(f"    Overrun         : {our_overrun*100:>14,.4f}%")
print(f"    Target arrival  : {target:>15,.4f}")
print(f"    D1 weight       : {gate_w['d1']:>15.8f}")
print()
print(f"    {'':30s}  {'Ours':>12s}  {'Excel':>12s}  Status")
diff_pct = abs(our_indent - EXCEL['gate_indent']) / EXCEL['gate_indent'] * 100
status   = 'OK' if diff_pct < 0.1 else f'DIFF {diff_pct:.3f}%'
print(f"    {'GATE FINAL INDENT':30s}  {our_indent:12.2f}  {EXCEL['gate_indent']:12.2f}  {status}")

# ---- 9. All-centers calculation (show top 20 by indent, no Excel ref) -----
print(f"\n{'='*70}")
print(f"  Per-center calculation (all {len(bonding)} bonding centers)  |  Overrun={our_overrun*100:.4f}%")
print(f"{'='*70}")
print(f"  {'Center':<35} {'Bonding':>10} {'AdjReq':>10} {'FcstT3':>10} {'Indent':>10}")
print(f"  {'-'*75}")

results = []
for code, b in bonding.items():
    if b['qty'] <= 0:
        continue
    w = compute_d_weights(code)
    if w is None or w['d1'] < 0.05:
        # season fallback
        rates = []
        t4 = T - timedelta(days=4)
        for (c, ind_d), ind_qty in indents.items():
            if c != code or ind_d < PLANT_START or ind_d > t4 or ind_qty <= 0:
                continue
            d1 = d2 = d3 = d4 = 0.0
            for (pc, pid, ppd, pqty) in purchases:
                if pc != code or pid != ind_d: continue
                diff = (ppd - ind_d).days
                if diff <= 0: d1 += pqty
                elif diff == 1: d2 += pqty
                elif diff == 2: d3 += pqty
                else: d4 += pqty
            if ind_qty > 0:
                rates.append({'d1': d1/ind_qty, 'd2': d2/ind_qty, 'd3': d3/ind_qty, 'd4': d4/ind_qty})
        if rates:
            n = len(rates)
            w = {k: sum(r[k] for r in rates)/n for k in ('d1','d2','d3','d4')}
        else:
            w = {'d1': 0, 'd2': 0, 'd3': 0, 'd4': 0}

    req_b = EFF_REQ * (b['qty'] / total_bonding)
    if b['is_gate'] and total_gate_bond > 0:
        sadj = (STD_GATE - AVAIL_GATE) * (b['qty'] / total_gate_bond)
    elif not b['is_gate'] and total_ctr_bond > 0:
        sadj = (STD_CENTRE - AVAIL_CENTRE) * (b['qty'] / total_ctr_bond)
    else:
        sadj = 0

    adj_r  = req_b + sadj
    it0 = indents.get((code, T0), 0)
    it1 = indents.get((code, T1), 0)
    it2 = indents.get((code, T2), 0)
    fcast = it2 * w['d2'] + it1 * w['d3'] + it0 * w['d4']
    gap_c = max(0, adj_r - fcast)
    tgt   = gap_c / (1 + our_overrun)
    fin   = tgt / w['d1'] if w['d1'] > 0 else 0

    results.append({'code': code, 'name': b['name'], 'bonding': b['qty'],
                    'adj_req': adj_r, 'fcast': fcast, 'indent': fin,
                    'is_gate': b['is_gate']})

results.sort(key=lambda x: -x['indent'])
total_indent = sum(r['indent'] for r in results)

for r in results[:30]:
    gate_mark = ' [GATE]' if r['is_gate'] else ''
    print(f"  {r['name']:<35}{gate_mark} {r['bonding']:>10,.0f} {r['adj_req']:>10,.1f} "
          f"{r['fcast']:>10,.1f} {r['indent']:>10,.1f}")

print(f"  {'-'*75}")
print(f"  {'TOTAL ALL CENTERS':<35} {'':>10} {'':>10} {'':>10} {total_indent:>10,.1f}")

# ---- 10. Summary -----------------------------------------------------------
print(f"\n{'='*70}")
print(f"  FINAL VERDICT")
print(f"{'='*70}")
checks = [
    ('Overrun',           our_overrun,     EXCEL['overrun'],      0.01),
    ('D1 weight',         gate_w['d1'],    EXCEL['d1'],           0.01),
    ('D2 weight',         gate_w['d2'],    EXCEL['d2'],           0.01),
    ('D3 weight',         gate_w['d3'],    EXCEL['d3'],           0.01),
    ('D4 weight',         gate_w['d4'],    EXCEL['d4'],           0.01),
    ('GATE final indent', our_indent,      EXCEL['gate_indent'],  0.1),
]
all_ok = True
for label, ours, excel, tol_pct in checks:
    diff = abs(ours - excel) / abs(excel) * 100
    ok   = diff < tol_pct
    all_ok = all_ok and ok
    print(f"  {label:<22}: Ours={ours:>14.4f}  Excel={excel:>14.4f}  Diff={diff:.4f}%  "
          f"{'OK' if ok else 'FAIL'}")

print(f"\n  {'OVERALL: MATCH' if all_ok else 'OVERALL: MISMATCH -- see FAIL rows above'}")
print("=" * 70)
