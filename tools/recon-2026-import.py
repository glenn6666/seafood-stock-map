#!/usr/bin/env python3
"""蟹老大中港店對帳：從對方試算表「安星對帳」（xlsx 匯出，只讀）產生 2026 起的匯入 SQL。
用法：python3 tools/recon-2026-import.py 蟹老大中港店.xlsx out.sql
- 日期只偶爾填：往下沿用（forward-fill）。2026 起點＝第一個日期 ≥ 2026-01-01 的列；之前全部列合計成一筆「期初餘額」（日期 2026-01-01）。
- 起點之後若出現年份 < 2026 的日期（打錯年份），改為 2026 同月同日。
- 金額取 F 欄試算表計算後的值（與對方 G2 =SUM(F:F) 相同）。
- 只新增：id 由內容＋同內容出現次數決定，重複執行 INSERT OR IGNORE 不會重複；試算表新增列時再跑一次只會補新的列。
"""
import sys,hashlib,datetime,json,openpyxl
src,out=sys.argv[1],sys.argv[2];ACC="蟹老大"
V=list(openpyxl.load_workbook(src,data_only=True,read_only=True)["安星對帳"].iter_rows(values_only=True))
BAD=[]
def ymd(v):
  if isinstance(v,datetime.datetime):return v.date()
  if isinstance(v,(int,float)) and 19000000<v<21000000:
    v=int(v)
    try:return datetime.date(v//10000,v//100%100,v%100)
    except ValueError:BAD.append(v);return None
  return None
def num(v):return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else None
start=next(i for i,r in enumerate(V[1:],2) if (d:=ymd(r[0])) and d>=datetime.date(2026,1,1))
opening=0.0;rows=[];cur=None;fixed=[]
for i,r in enumerate(V[1:],2):
  d=ymd(r[0])
  if i>=start and d and d.year<2026:fixed.append((i,str(d)));d=d.replace(year=2026)
  if d:cur=d
  amt=num(r[5]) if len(r)>5 else None
  if amt is None or amt==0:continue
  if i<start:opening+=amt;continue
  st=r[1] if isinstance(r[1],str) else ("" if r[1] is None else str(r[1]))
  up,q=num(r[3]),num(r[4])
  if up is None or q is None:up,q=amt,1.0
  rows.append(dict(row=i,date=str(cur),status=st.strip(),item=str(r[2] or "").strip(),up=up,q=q,amt=round(amt,6)))
now=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
esc=lambda s:"'"+str(s).replace("'","''")+"'"
sql=[];occ={}
def ins(id_,seq,date,item,up,q,amt,status):
  h=hashlib.sha256(id_.encode()).hexdigest()[:22]
  sql.append(f"INSERT OR IGNORE INTO ledger_prepaid (id,account,seq,item,unit_price,qty,amount,checked,status,hash,created_at,entry_date,direction,payment_id) VALUES ({esc(id_)},{esc(ACC)},{seq},{esc(item)},{up!r},{q!r},{amt!r},'',{esc(status)},{esc(h)},{esc(now)},{esc(date)},{esc('we_owe' if amt<0 else 'they_owe')},NULL);")
op=round(opening,6)
ins("sheet2026:opening",1,"2026-01-01",f"期初餘額（對方試算表「安星對帳」第 2～{start-1} 列合計）",op,1.0,op,"期初")
for r in rows:
  k=f"{r['date']}|{r['status']}|{r['item']}|{round(r['up'],4)}|{round(r['q'],4)}|{round(r['amt'],4)}";n=occ.get(k,0)+1;occ[k]=n
  ins("sheet2026:"+hashlib.sha256(f"{k}|{n}".encode()).hexdigest()[:24],r["row"],r["date"],r["item"],r["up"],r["q"],r["amt"],r["status"])
open(out,"w").write("\n".join(sql)+"\n")
months={}
for r in rows:months.setdefault(r["date"][:7],[0,0,0]);m=months[r["date"][:7]];m[0]+=1;m[1 if r["amt"]>0 else 2]+=r["amt"]
print(json.dumps({"boundaryRow":start,"boundaryDate":str(ymd(V[start-1][0])),"opening":round(opening,2),"rows2026":len(rows),"closing":round(opening+sum(r["amt"] for r in rows),2),
 "yearFixed":fixed,"badDates":sorted(set(BAD)),"months":{k:[v[0],round(v[1],2),round(v[2],2),round(v[1]+v[2],2)] for k,v in sorted(months.items())},"lastDate":rows[-1]["date"]},ensure_ascii=False,indent=1))
