import openpyxl, sys

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook('IndentingModel_TestFilexlsm.xlsm', read_only=True, data_only=True)
ws = wb['Forecast_Day1']
rows = list(ws.iter_rows(min_col=1, max_col=25, values_only=True))
print(f"Total rows: {len(rows)}")
for i, row in enumerate(rows[:120]):
    if any(v is not None for v in row):
        print(f"Row {i+1:3d}: {list(row)}")
