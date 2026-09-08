"""Build the full-season Three-Season Results workbook from _replay CSVs.
Clear separation of ACCURACY (higher=better) vs VARIATION (lower=better)."""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

REP = os.path.dirname(os.path.abspath(__file__))
OUT = r'c:/Users/tejas.rai/Desktop/Projects/GannaApp/GannaApp_Three_Season_Results_FullSeason.xlsx'
SEASONS = [('2023-24','full_2324.csv'),('2024-25','full_2425.csv'),('2025-26','full_2526.csv')]
# season crushing days (days the plant had a cane requirement) — the true season length
CRUSH_DAYS = {'2023-24':135, '2024-25':145, '2025-26':158}
NAVY='FF0A2A5E'; GREEN='FF1A6A2A'; AMBER='FF9A6A00'; LIGHTGREEN='FFE8F4E8'; LIGHTGREY='FFF2F2F2'

def wmape(rows,a,b):  # volume-weighted variation
    n=0;d=0
    for r in rows:
        n+=abs(float(r[b])-float(r[a])); d+=float(r[a])
    return n/d*100 if d else 0

wb=Workbook(); sm=wb.active; sm.title='Summary'
sm.append(['GannaApp vs Actual Indents — Full-Season Validation (3 seasons)'])
sm['A1'].font=Font(bold=True,size=14,color=NAVY)
sm.append([])
sm.append(['','ACCURACY = how close the app came to the indent actually placed (higher is better).'])
sm['B3'].font=Font(bold=True,size=10,color=GREEN)
sm.append(['','VARIATION = the gap (lower is better).   ACCURACY = 100% − VARIATION.   Both are shown below; they are the same figure expressed two ways.'])
sm['B4'].font=Font(italic=True,size=9)
sm.append(['','Measured by cane volume (share of total quintals allocated correctly) — not distorted by holiday / near-zero-indent days.'])
sm['B5'].font=Font(italic=True,size=9)
sm.append([])

# two-tier header
sm.append(['','','','ACCURACY  (higher = better)','','','VARIATION  (lower = better)','',''])
gr=sm.max_row
sm.cell(row=gr,column=4).font=Font(bold=True,color='FFFFFFFF');
for col in (4,5,6):
    sm.cell(row=gr,column=col).fill=PatternFill('solid',fgColor=GREEN)
    sm.cell(row=gr,column=col).font=Font(bold=True,color='FFFFFFFF')
    sm.cell(row=gr,column=col).alignment=Alignment(horizontal='center')
for col in (7,8,9):
    sm.cell(row=gr,column=col).fill=PatternFill('solid',fgColor='FF888888')
    sm.cell(row=gr,column=col).font=Font(bold=True,color='FFFFFFFF')
    sm.cell(row=gr,column=col).alignment=Alignment(horizontal='center')
sm.merge_cells(start_row=gr,start_column=4,end_row=gr,end_column=6)
sm.merge_cells(start_row=gr,start_column=7,end_row=gr,end_column=9)

hdr=['Season','Scope','Days replayed','Centres','GATE','Overall','Centres','GATE','Overall']
sm.append(hdr); hr=sm.max_row
for i,c in enumerate(sm[hr],1):
    c.font=Font(bold=True,color='FFFFFFFF'); c.alignment=Alignment(horizontal='center',wrap_text=True)
    c.fill=PatternFill('solid',fgColor=GREEN if 4<=i<=6 else ('FF888888' if i>=7 else NAVY))

def load(file): return list(csv.reader(open(os.path.join(REP,file))))[1:]
for name,file in SEASONS:
    rows=load(file); N=len(rows)
    tr=rows[:N-20]
    rk=sorted(range(len(tr)), key=lambda i:-(abs(float(tr[i][9])/float(tr[i][6])-1) if float(tr[i][6])>0 else 0))
    rem=set(rk[:3]); clean=[r for i,r in enumerate(tr) if i not in rem]
    for scope,d,green in [('Whole season replayed',rows,False),
                          ('Excl. last 20 days (closing period)',tr,True),
                          ('Excl. 20 days + 3 outlier days',clean,False)]:
        wc,wg,wo=wmape(d,4,7),wmape(d,5,8),wmape(d,6,9)
        sm.append([name,scope,len(d),(100-wc)/100,(100-wg)/100,(100-wo)/100,wc/100,wg/100,wo/100])
        rr=sm.max_row
        for col in range(4,10): sm.cell(row=rr,column=col).number_format='0.0%'
        for col in (4,5,6):
            sm.cell(row=rr,column=col).fill=PatternFill('solid',fgColor=LIGHTGREEN)
            sm.cell(row=rr,column=col).font=Font(bold=True,color=GREEN)
        for col in (7,8,9):
            sm.cell(row=rr,column=col).fill=PatternFill('solid',fgColor=LIGHTGREY)
        if green:
            for col in (1,2,3): sm.cell(row=rr,column=col).font=Font(bold=True)
        if 'outlier' in scope:
            for col in (1,2,3): sm.cell(row=rr,column=col).font=Font(italic=True,color=AMBER)
for i,w in enumerate([10,34,13,10,10,10,10,10,10],1): sm.column_dimensions[get_column_letter(i)].width=w

# day-count clarification block
sr=sm.max_row+2
sm.cell(row=sr,column=1,value='What "days" means (three different counts — stated to avoid confusion):').font=Font(bold=True,color=NAVY)
sm.append(['','Season','Crushing days (plant had a cane requirement)','','Days any indent was placed','','Days replayed by the app','',''])
hr2=sm.max_row
for c in sm[hr2]:
    if c.value: c.font=Font(bold=True,size=9)
DAYCOUNTS={'2023-24':(135,155,154),'2024-25':(145,151,149),'2025-26':(158,163,160)}
for name,(cd,idd,rp) in DAYCOUNTS.items():
    sm.append(['',name,cd,'',idd,'',rp,'',''])
sm.append(['','The app can only be replayed from 3 days after the season starts (its first order needs prior history), so "days replayed" is slightly'])
sm.cell(row=sm.max_row,column=2).font=Font(italic=True,size=9)
sm.append(['','fewer than the days on which an indent was placed. The accuracy figures above are computed over the days replayed.'])
sm.cell(row=sm.max_row,column=2).font=Font(italic=True,size=9)

# notes
sr=sm.max_row+2
notes=[
 ('Notes:',True),
 ('• "Excl. last 20 days" removes the administrative closing period (final clearance orders and zero-indent days after crushing stops) — the principled headline figure.',False),
 ('• "Excl. 20 days + 3 outlier days" additionally removes the 3 largest single-day swings. For 2023-24 these are holiday / near-zero-indent days; for 2024-25 and 2025-26 they are genuine February wind-down misses — quote this row with care.',False),
 ('• 2023-24 is the weakest season: the mill\'s own day-to-day ordering that year was highly inconsistent, and its yard data comes from a scanned report.',False),
 ('• Each season sheet shows the daily detail with the real Cane Requirement and 8 A.M. yard balances used on that day.',False),
]
for txt,bold in notes:
    sm.append(['',txt]); sm.cell(row=sm.max_row,column=2).font=Font(bold=bold,italic=not bold,size=9,color=NAVY if bold else AMBER)

# ── detail sheets ──
for name,file in SEASONS:
    rows=load(file)
    ws=wb.create_sheet(f'{name} App vs Actual')
    hdr=['Delivery Date','Cane Req Input','Yard Gate 8AM','Yard Centre 8AM','Actual Centres','Actual GATE','Actual Overall','App Centres','App GATE','App Overall','Var Centres','Var GATE','Var Overall','Var Centres %','Var GATE %','Var Overall %']
    ws.append(hdr)
    for c in ws[1]:
        c.font=Font(bold=True,color='FFFFFFFF'); c.fill=PatternFill('solid',fgColor=NAVY); c.alignment=Alignment(horizontal='center',wrap_text=True)
    for r in rows:
        ws.append([r[0]]+[float(x) if x not in('','None') else None for x in r[1:]])
    n=len(rows)
    for col in range(2,14):
        for row in range(2,n+2): ws.cell(row=row,column=col).number_format='#,##0'
    for col in range(14,17):
        for row in range(2,n+2):
            cell=ws.cell(row=row,column=col); cell.number_format='0.0"%"'
            v=cell.value
            if v is not None and abs(v)>25: cell.font=Font(color='FFB03020')
    for i,w in enumerate([12,10,10,11,12,11,12,11,10,11,10,10,10,10,9,10],1):
        ws.column_dimensions[get_column_letter(i)].width=w
    ws.freeze_panes='A2'
    sr=n+3
    ws.cell(row=sr,column=1,value=f'WHOLE SEASON REPLAYED — {n} days (season had {CRUSH_DAYS[name]} crushing days):').font=Font(bold=True)
    ws.cell(row=sr+1,column=1,value='ACCURACY (higher = better)').font=Font(bold=True,color=GREEN)
    for i,(lab,v) in enumerate([('Centres',wmape(rows,4,7)),('GATE',wmape(rows,5,8)),('Overall',wmape(rows,6,9))]):
        ws.cell(row=sr+2+i,column=1,value='   '+lab).font=Font(bold=True)
        c=ws.cell(row=sr+2+i,column=4,value=(100-v)/100); c.number_format='0.0%'; c.font=Font(bold=True,color=GREEN)
        c2=ws.cell(row=sr+2+i,column=5,value=f'(variation {v:.1f}%)'); c2.font=Font(italic=True,size=9)

wb.save(OUT)
print('SAVED', OUT)
for name,file in SEASONS:
    rows=load(file); N=len(rows); tr=rows[:N-20]
    print(f'{name}: replayed={N} crushDays={CRUSH_DAYS[name]} | whole-season ACC O={100-wmape(rows,6,9):.1f}% | excl-20 ACC O={100-wmape(tr,6,9):.1f}%')
