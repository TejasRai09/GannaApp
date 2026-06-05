"""Debug: compare our algorithm's data vs Excel's Forecast_Day1 for GATE on Jan 27, 2023."""
import openpyxl, sys
from datetime import datetime, timedelta
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

XLSM = "IndentingModel_TestFilexlsm.xlsm"
T = datetime(2023, 1, 27)

wb = openpyxl.load_workbook(XLSM, read_only=True, data_only=True)

# Read indent sheet - show GATE rows around Jan 16-30
ws_i = wb['Indent']
print("=== GATE (code=1) INDENT rows Jan 14-31 2023 ===")
for row in ws_i.iter_rows(min_row=2, values_only=True):
    code = row[0]; d = row[2]; qty = row[4]
    if code != 1: continue
    if isinstance(d, datetime) and datetime(2023,1,14) <= d <= datetime(2023,1,31):
        print(f"  code={code}, indent_date={d.date()}, qty={qty}")

print()
# Read purchase sheet - show GATE purchases for indent dates Jan 16-29 2023
ws_p = wb['Purchase']
print("=== GATE (code=1) PURCHASE rows where indent_date is Jan 14-30 ===")
for row in ws_p.iter_rows(min_row=2, values_only=True):
    code = row[0]; pur_d = row[2]; ind_d = row[3]; qty = row[5]
    if code != 1: continue
    if isinstance(ind_d, datetime) and datetime(2023,1,14) <= ind_d <= datetime(2023,1,30):
        print(f"  pur_date={pur_d.date()}, indent_date={ind_d.date()}, qty={qty}")

# Now check overrun: total purchases vs total indents in the Excel data
ws_i2 = wb['Indent']
ws_p2 = wb['Purchase']
plant_start = datetime(2022, 11, 15)

all_indents = defaultdict(float)
for row in ws_i2.iter_rows(min_row=2, values_only=True):
    if row[0] is None or row[2] is None: continue
    d = row[2]; qty = row[4] or 0
    if isinstance(d, datetime) and plant_start <= d <= T:
        all_indents[d] += qty

all_purchases = defaultdict(float)
# Only purchases where purchase_date <= T-4 (closed indents only)
T4 = T - timedelta(days=4)
for row in ws_p2.iter_rows(min_row=2, values_only=True):
    if row[0] is None or row[2] is None: continue
    pur_d = row[2]; ind_d = row[3]; qty = row[5] or 0
    if isinstance(pur_d, datetime) and isinstance(ind_d, datetime):
        if plant_start <= ind_d <= T4:  # only closed indents
            all_purchases[pur_d] += qty

total_ind = sum(v for d, v in all_indents.items() if d <= T4)
total_pur = sum(v for d, v in all_purchases.items())
print(f"\n=== OVERRUN (closed indents only, indent_date <= T-4 = Jan 23) ===")
print(f"Total indents (closed): {total_ind:,.2f}")
print(f"Total purchases (for closed indents): {total_pur:,.2f}")
if total_ind > 0:
    print(f"Overrun: {total_pur/total_ind - 1:.5f} ({(total_pur/total_ind - 1)*100:.3f}%)")

print(f"\n=== Excel reported overrun (from Forecast_Day1) = 9.2943% ===")
