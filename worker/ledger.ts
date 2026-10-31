// 後台記帳（取代／並行 Google 試算表「安星水產記帳」）。只有記帳負責人（管理員）可用。
import {HttpError,requireRole,nowIso,sha256,bookkeepingExport,type Env,type Actor} from "./index";
import {entryKey,LEDGER_COLS} from "../web/src/lib/ledger-shared";

const DATE=/^\d{4}-\d{2}-\d{2}$/,YM=/^\d{4}-\d{2}$/;
const str=(v:unknown,max=500)=>{const t=v===null||v===undefined?"":String(v).trim();if(t.length>max)throw new HttpError(400,"文字過長");return t};
const n=(v:unknown)=>{const x=typeof v==="number"?v:parseFloat(String(v??"").replace(/,/g,""));if(v===""||v===null||v===undefined)return 0;if(!Number.isFinite(x)||Math.abs(x)>1e11)throw new HttpError(400,"數字不正確");return x};
const nn=(v:unknown)=>v===null||v===undefined||v===""?null:n(v);
const r2=(x:number)=>Math.round(x*100)/100;
const who=(a:Actor)=>a.kind==="user"?a.username:"管理密碼";
const INCOME_EXCLUDE=new Set(["股東投資"]);           // 不算營業額
const COGS=new Set(["進貨支出","團購支出"]);            // 銷貨成本
const PNL_ITEMIZE=new Set(["水費","電費","燃料費","網路、公司電話費","房租"]); // 損益表單列顯示的店面支出細項（同試算表）

async function readBig(request:Request):Promise<any>{
 if(!request.headers.get("Content-Type")?.startsWith("application/json"))throw new HttpError(415,"需要 JSON 資料");
 const t=await request.text();if(t.length>2_000_000)throw new HttpError(413,"資料過大，請分批匯入");
 let v:any;try{v=JSON.parse(t)}catch{throw new HttpError(400,"JSON 格式不正確")}
 if(!v||typeof v!=="object"||Array.isArray(v))throw new HttpError(400,"資料格式不正確");return v;
}
async function owner(env:Env){return (await env.DB.prepare("SELECT value FROM settings WHERE key='ledger_owner'").first<{value:string}>())?.value??""}
/** 記帳只給管理員；若已設定「只限本人」，只有該帳號可用（原管理密碼也不行） */
async function ledgerActor(env:Env,actor:Actor|null){
 const a=requireRole(actor,"admin");const o=await owner(env);
 if(o&&(a.kind!=="user"||a.id!==o))throw new HttpError(403,"記帳資料只限負責人查看");
 return {a,o};
}
const hashOf=async(e:any)=>(await sha256(entryKey(e))).slice(0,22);

type Entry={date:string;rawDate:string;kind:string;category:string;item:string;note:string;qty:number;unitPrice:number;tax:number;amount:number;signed:number;staff:string;party:string;recorder:string;company:string;contact:string;taxId:string;payMethod:string;bank:string;postedDate:string;cashNote:string};
function cleanEntry(b:any,fallbackRecorder:string):Entry{
 const date=str(b.date,10);if(!DATE.test(date)||isNaN(Date.parse(date))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)throw new HttpError(400,"日期不正確");
 const kind=str(b.kind,4);if(kind!=="收入"&&kind!=="支出")throw new HttpError(400,"收支需為收入或支出");
 const category=str(b.category,40);if(!category)throw new HttpError(400,"請選擇會計項目");
 const qty=b.qty===undefined||b.qty===""?1:n(b.qty),unitPrice=n(b.unitPrice),tax=n(b.tax);
 const amount=b.amount===undefined||b.amount===""||b.amount===null?r2(qty*unitPrice+tax):n(b.amount);
 const signed=b.signed===undefined||b.signed===""||b.signed===null?(kind==="收入"?amount:-amount):n(b.signed);
 const pd=str(b.postedDate,10);
 return {date,rawDate:str(b.rawDate,20)||date.replace(/-/g,""),kind,category,item:str(b.item,80),note:str(b.note,2000),qty,unitPrice,tax,amount,signed,staff:str(b.staff,40),party:str(b.party,80),recorder:str(b.recorder,40)||fallbackRecorder,company:str(b.company,80),contact:str(b.contact,80),taxId:str(b.taxId,20),payMethod:str(b.payMethod,20),bank:str(b.bank,40),postedDate:DATE.test(pd)?pd:"",cashNote:str(b.cashNote,300)};
}
const ENTRY_SQL="INSERT INTO ledger_entries (id,entry_date,raw_date,kind,category,item,note,qty,unit_price,tax,amount,signed,staff,party,recorder,company,contact,tax_id,pay_method,bank,posted_date,cash_note,source,web_key,hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
const entryBind=(id:string,e:Entry,source:string,webKey:string|null,hash:string)=>[id,e.date,e.rawDate,e.kind,e.category,e.item,e.note,e.qty,e.unitPrice,e.tax,e.amount,e.signed,e.staff,e.party,e.recorder,e.company,e.contact,e.taxId,e.payMethod,e.bank,e.postedDate,e.cashNote,source,webKey,hash,nowIso(),nowIso()];
const outEntry=(r:any)=>({id:r.id,date:r.entry_date,rawDate:r.raw_date,kind:r.kind,category:r.category,item:r.item,note:r.note,qty:r.qty,unitPrice:r.unit_price,tax:r.tax,amount:r.amount,signed:r.signed,staff:r.staff,party:r.party,recorder:r.recorder,company:r.company,contact:r.contact,taxId:r.tax_id,payMethod:r.pay_method,bank:r.bank,postedDate:r.posted_date,cashNote:r.cash_note,source:r.source,updatedAt:r.updated_at});
/** 轉回試算表「每日收支紀錄」28 欄（公式欄位留空由試算表計算） */
function sheetRow(e:any){const r=Array(LEDGER_COLS.length).fill("");
 r[1]=`${e.category} ${e.item}`;r[2]=e.date.replace(/-/g,"");r[4]=e.category;r[5]=e.item;r[6]=e.note;r[7]=String(e.qty);r[8]=String(e.unitPrice);r[9]=e.staff;r[11]=e.tax?String(e.tax):"";
 r[14]=e.party;r[15]=e.recorder;r[16]=e.company;r[17]=e.contact;r[18]=e.taxId;r[19]=e.payMethod;r[20]=e.bank;r[23]=e.postedDate?e.postedDate.replace(/-/g,"/"):"";r[24]=e.cashNote;return r}

async function listEntries(env:Env,url:URL){
 const q=url.searchParams,from=q.get("from")??"",to=q.get("to")??"";
 if(!DATE.test(from)||!DATE.test(to)||from>to)throw new HttpError(400,"請選擇正確的日期區間");
 const w=["deleted=0","entry_date BETWEEN ? AND ?"],b:unknown[]=[from,to];
 for(const [k,col] of [["category","category"],["item","item"],["party","party"],["staff","staff"],["kind","kind"],["source","source"]] as const){const v=q.get(k);if(v){w.push(`${col}=?`);b.push(v.slice(0,80))}}
 const s=q.get("q");if(s){w.push("(note LIKE ? OR item LIKE ? OR party LIKE ?)");const l=`%${s.slice(0,60).replace(/[%_]/g,"")}%`;b.push(l,l,l)}
 const where=w.join(" AND ");
 const tot=await env.DB.prepare(`SELECT COUNT(*) AS n,COALESCE(SUM(CASE WHEN signed>0 THEN signed END),0) AS income,COALESCE(SUM(CASE WHEN signed<0 THEN signed END),0) AS expense,COALESCE(SUM(signed),0) AS net FROM ledger_entries WHERE ${where}`).bind(...b).first<any>();
 const limit=Math.min(5000,Math.max(1,parseInt(q.get("limit")??"500",10)||500));
 const {results}=await env.DB.prepare(`SELECT * FROM ledger_entries WHERE ${where} ORDER BY entry_date DESC,created_at DESC LIMIT ?`).bind(...b,limit).all<any>();
 const entries=results.map(outEntry);
 return {entries,total:{count:tot.n,income:r2(tot.income),expense:r2(tot.expense),net:r2(tot.net)},truncated:tot.n>entries.length,columns:LEDGER_COLS,sheetRows:q.get("sheet")?entries.slice().reverse().map(sheetRow):undefined};
}
async function importEntries(env:Env,rows:any[],rec:string){
 let inserted=0,skipped=0;const errors:string[]=[];
 const clean:{e:Entry;h:string;occ:number}[]=[];
 for(const [i,r] of rows.entries()){try{const e=cleanEntry(r,rec);clean.push({e,h:await hashOf(e),occ:Math.max(1,parseInt(r.occ,10)||1)})}catch(x){errors.push(`第 ${i+1} 筆：${(x as Error).message}`)}}
 const hs=[...new Set(clean.map(c=>c.h))];const have=new Map<string,number>();
 for(let i=0;i<hs.length;i+=90){const part=hs.slice(i,i+90);const {results}=await env.DB.prepare(`SELECT hash,COUNT(*) AS c FROM ledger_entries WHERE deleted=0 AND hash IN (${part.map(()=>"?").join(",")}) GROUP BY hash`).bind(...part).all<any>();for(const r of results)have.set(r.hash,r.c)}
 const stmts:D1PreparedStatement[]=[];
 for(const c of clean){const h=have.get(c.h)??0;if(h>=c.occ){skipped++;continue}have.set(c.h,h+1);inserted++;stmts.push(env.DB.prepare(ENTRY_SQL).bind(...entryBind(crypto.randomUUID(),c.e,"sheet",null,c.h)))}
 for(let i=0;i<stmts.length;i+=80)await env.DB.batch(stmts.slice(i,i+80));
 return {inserted,skipped,errors:errors.slice(0,50)};
}
/** 網站訂單每日彙總寫入（同一天只會有一筆收入、一筆成本，重算時更新金額） */
async function syncWeb(env:Env,a:Actor,from:string,to:string){
 const u=new URL(`https://x/?from=${from}&to=${to}`);const res=await bookkeepingExport(env,a,u);
 const stmts:D1PreparedStatement[]=[];let n=0;
 const {results:old}=await env.DB.prepare("SELECT web_key FROM ledger_entries WHERE web_key IS NOT NULL AND entry_date BETWEEN ? AND ? AND deleted=0").bind(from,to).all<any>();
 const keep=new Set<string>();
 for(const d of res.days){
  const parts=[`網站訂單 ${d.orders} 筆`];if(d.discount>0)parts.push(`優惠券 ${d.couponOrders} 筆折 NT$${d.discount}（原價 NT$${d.subtotal}）`);if(d.pending)parts.push(`其中 ${d.pending} 筆尚未完成`);
  const mk=async(key:string,e:Entry)=>{keep.add(key);n++;const h=await hashOf(e);
   stmts.push(env.DB.prepare(`${ENTRY_SQL} ON CONFLICT(web_key) WHERE web_key IS NOT NULL DO UPDATE SET qty=excluded.qty,unit_price=excluded.unit_price,amount=excluded.amount,signed=excluded.signed,note=excluded.note,hash=excluded.hash,deleted=0,updated_at=excluded.updated_at`).bind(...entryBind(crypto.randomUUID(),e,"web",key,h)))};
  const base={date:d.date,rawDate:d.date.replace(/-/g,""),qty:1,tax:0,staff:"",recorder:"網站",company:"",contact:"",taxId:"",payMethod:"",bank:"",postedDate:"",cashNote:""};
  await mk(`web:${d.date}:income`,{...base,kind:"收入",category:"網站收入",item:"網站訂單",note:parts.join("；"),unitPrice:d.total,amount:d.total,signed:d.total,party:"網站顧客"});
  if(d.cost>0)await mk(`web:${d.date}:cost`,{...base,kind:"支出",category:"進貨支出",item:"網站訂單成本",note:`網站訂單商品成本（${d.orders} 筆訂單）${d.costMissingLines?`；${d.costMissingLines} 項缺成本未計`:""}`,unitPrice:d.cost,amount:d.cost,signed:-d.cost,party:"網站訂單成本"});
 }
 for(const o of old)if(!keep.has(o.web_key))stmts.push(env.DB.prepare("UPDATE ledger_entries SET deleted=1,updated_at=? WHERE web_key=?").bind(nowIso(),o.web_key)); // 該日訂單全取消
 for(let i=0;i<stmts.length;i+=80)await env.DB.batch(stmts.slice(i,i+80));
 return {synced:n,days:res.days.length};
}

// ---------- 報表 ----------
async function monthly(env:Env,year:string){
 if(!/^\d{4}$/.test(year))throw new HttpError(400,"年度不正確");
 const {results}=await env.DB.prepare("SELECT category,substr(entry_date,1,7) AS ym,SUM(signed) AS v FROM ledger_entries WHERE deleted=0 AND entry_date LIKE ? GROUP BY category,ym").bind(`${year}-%`).all<any>();
 const cats=await catOrder(env);const rows=new Map<string,number[]>();for(const c of cats)rows.set(c,Array(12).fill(0));
 for(const r of results){if(!rows.has(r.category))rows.set(r.category,Array(12).fill(0));rows.get(r.category)![+r.ym.slice(5)-1]+=r.v}
 const list=[...rows].map(([category,m])=>({category,months:m.map(Math.round),total:Math.round(m.reduce((s,x)=>s+x,0))}));
 const profit=Array(12).fill(0).map((_,i)=>list.reduce((s,r)=>s+r.months[i],0));
 return {year,rows:list,profit,profitTotal:profit.reduce((s,x)=>s+x,0)};
}
async function catOrder(env:Env){const {results}=await env.DB.prepare("SELECT category,MIN(sort) AS s FROM ledger_categories GROUP BY category ORDER BY s").all<any>();return results.map(r=>r.category as string)}
async function daily(env:Env,ym:string){
 if(!YM.test(ym))throw new HttpError(400,"年月不正確");
 const {results}=await env.DB.prepare("SELECT category,CAST(substr(entry_date,9,2) AS INTEGER) AS d,SUM(signed) AS v FROM ledger_entries WHERE deleted=0 AND entry_date LIKE ? GROUP BY category,d").bind(`${ym}-%`).all<any>();
 const days=new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();const cats=await catOrder(env);const rows=new Map<string,number[]>();for(const c of cats)rows.set(c,Array(days).fill(0));
 for(const r of results){if(!rows.has(r.category))rows.set(r.category,Array(days).fill(0));rows.get(r.category)![r.d-1]+=r.v}
 const list=[...rows].map(([category,v])=>({category,days:v.map(Math.round),total:Math.round(v.reduce((s,x)=>s+x,0))}));
 const net=Array(days).fill(0).map((_,i)=>list.reduce((s,r)=>s+r.days[i],0));
 return {ym,days,rows:list,net,total:net.reduce((s,x)=>s+x,0)};
}
const prevYm=(ym:string)=>{const d=new Date(+ym.slice(0,4),+ym.slice(5)-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
async function pnlOf(env:Env,ym:string){
 const {results}=await env.DB.prepare("SELECT kind,category,item,SUM(signed) AS v FROM ledger_entries WHERE deleted=0 AND entry_date LIKE ? GROUP BY kind,category,item").bind(`${ym}-%`).all<any>();
 const income=new Map<string,number>(),expense=new Map<string,number>();let cogs=0,capital=0;
 for(const r of results){
  if(r.v>=0&&r.kind==="收入"){if(INCOME_EXCLUDE.has(r.category))capital+=r.v;else income.set(r.category,(income.get(r.category)??0)+r.v);continue}
  if(COGS.has(r.category)){cogs+=-r.v;continue}
  const label=r.category==="店面支出"&&PNL_ITEMIZE.has(r.item)?r.item:r.category==="員工支出"?"薪資支出":r.category;
  expense.set(label,(expense.get(label)??0)-r.v);
 }
 const incomeTotal=[...income.values()].reduce((s,x)=>s+x,0),expenseTotal=[...expense.values()].reduce((s,x)=>s+x,0);
 return {income:Object.fromEntries([...income].map(([k,v])=>[k,Math.round(v)])),incomeTotal:Math.round(incomeTotal),cogs:Math.round(cogs),gross:Math.round(incomeTotal-cogs),expense:Object.fromEntries([...expense].map(([k,v])=>[k,Math.round(v)])),expenseTotal:Math.round(expenseTotal),capital:Math.round(capital),profit:Math.round(incomeTotal-cogs-expenseTotal+capital)};
}
async function pnl(env:Env,ym:string){
 if(!YM.test(ym))throw new HttpError(400,"年月不正確");const p=prevYm(ym);
 const [cur,prev]=await Promise.all([pnlOf(env,ym),pnlOf(env,p)]);
 const {results}=await env.DB.prepare("SELECT ym,section,label,amount,sort FROM ledger_balance WHERE ym IN (?,?) ORDER BY sort,label").bind(ym,p).all<any>();
 return {ym,prevYm:p,current:cur,previous:prev,balance:results.filter(r=>r.ym===ym),balancePrev:results.filter(r=>r.ym===p)};
}
async function yearly(env:Env){
 const {results}=await env.DB.prepare("SELECT substr(entry_date,1,7) AS ym,category,kind,SUM(signed) AS v FROM ledger_entries WHERE deleted=0 GROUP BY ym,category,kind").all<any>();
 const m=new Map<string,{revenue:number;cogs:number;profit:number}>();
 for(const r of results){const x=m.get(r.ym)??{revenue:0,cogs:0,profit:0};x.profit+=r.v;
  if(r.kind==="收入"&&!INCOME_EXCLUDE.has(r.category))x.revenue+=r.v;if(COGS.has(r.category))x.cogs-=r.v;m.set(r.ym,x)}
 return {months:[...m].sort().map(([ym,x])=>({ym,revenue:Math.round(x.revenue),cogs:Math.round(x.cogs),profit:Math.round(x.profit)}))};
}

// ---------- 主檔 ----------
async function meta(env:Env){
 const [c,o,ct,em]=await Promise.all([env.DB.prepare("SELECT id,category,item,kind,sort,active FROM ledger_categories ORDER BY sort,id").all<any>(),env.DB.prepare("SELECT kind,value FROM ledger_options ORDER BY kind,sort").all<any>(),env.DB.prepare("SELECT name FROM ledger_contacts ORDER BY name").all<any>(),env.DB.prepare("SELECT name FROM ledger_employees WHERE active=1 ORDER BY name").all<any>()]);
 const opts:Record<string,string[]>={};for(const r of o.results)(opts[r.kind]??=[]).push(r.value);
 const range=await env.DB.prepare("SELECT MIN(entry_date) AS a,MAX(entry_date) AS b,COUNT(*) AS n FROM ledger_entries WHERE deleted=0").first<any>();
 return {categories:c.results.map(r=>({...r,active:!!r.active})),options:opts,contacts:ct.results.map(r=>r.name),employees:em.results.map(r=>r.name),range:{from:range?.a??null,to:range?.b??null,count:range?.n??0}};
}
async function upsertMany(env:Env,kind:string,rows:any[],extra:any={}){
 if(!Array.isArray(rows)||rows.length>3000)throw new HttpError(400,"資料筆數不正確（每次最多 3000 筆）");
 const t=nowIso();const st:D1PreparedStatement[]=[];
 for(const r of rows){if(!r||typeof r!=="object")continue;
  if(kind==="categories"){const k=str(r.kind,4);if(!str(r.category,40)||(k!=="收入"&&k!=="支出"))continue;st.push(env.DB.prepare("INSERT INTO ledger_categories (category,item,kind,sort,active) VALUES (?,?,?,?,?) ON CONFLICT(category,item) DO UPDATE SET kind=excluded.kind,sort=excluded.sort,active=excluded.active").bind(str(r.category,40),str(r.item,80),k,Math.round(n(r.sort)),r.active===false?0:1))}
  else if(kind==="options"){if(!str(r.value,60)||!/^[a-zA-Z]{2,12}$/.test(str(r.kind,12)))continue;st.push(r.delete?env.DB.prepare("DELETE FROM ledger_options WHERE kind=? AND value=?").bind(str(r.kind),str(r.value,60)):env.DB.prepare("INSERT OR IGNORE INTO ledger_options (kind,value,sort) VALUES (?,?,?)").bind(str(r.kind),str(r.value,60),Math.round(n(r.sort))))}
  else if(kind==="contacts"){const nm=str(r.name,80);if(!nm)continue;st.push(r.delete?env.DB.prepare("DELETE FROM ledger_contacts WHERE name=?").bind(nm):env.DB.prepare("INSERT INTO ledger_contacts (name,company,contact,tax_id,phone,address,note,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET company=excluded.company,contact=excluded.contact,tax_id=excluded.tax_id,phone=excluded.phone,address=excluded.address,note=excluded.note,updated_at=excluded.updated_at").bind(nm,str(r.company,80),str(r.contact,80),str(r.taxId,20),str(r.phone,60),str(r.address,200),str(r.note,500),t))}
  else if(kind==="employees"){const nm=str(r.name,40);if(!nm)continue;st.push(env.DB.prepare("INSERT INTO ledger_employees (name,title,daily_wage,hourly_wage,monthly_wage,active,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET title=excluded.title,daily_wage=excluded.daily_wage,hourly_wage=excluded.hourly_wage,monthly_wage=excluded.monthly_wage,active=excluded.active,updated_at=excluded.updated_at").bind(nm,str(r.title,20),nn(r.dailyWage),nn(r.hourlyWage),nn(r.monthlyWage),r.active===false?0:1,t))}
  else if(kind==="payroll"){const nm=str(r.name,40),ym=str(r.ym,7);if(!nm||!YM.test(ym))continue;st.push(r.delete?env.DB.prepare("DELETE FROM ledger_payroll WHERE name=? AND ym=?").bind(nm,ym):env.DB.prepare("INSERT INTO ledger_payroll (name,ym,base,overtime,bonus,year_end,late,leave,labor_ins,health_ins,pension,net_pay,note,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name,ym) DO UPDATE SET base=excluded.base,overtime=excluded.overtime,bonus=excluded.bonus,year_end=excluded.year_end,late=excluded.late,leave=excluded.leave,labor_ins=excluded.labor_ins,health_ins=excluded.health_ins,pension=excluded.pension,net_pay=excluded.net_pay,note=excluded.note,updated_at=excluded.updated_at").bind(nm,ym,n(r.base),n(r.overtime),n(r.bonus),n(r.yearEnd),n(r.late),n(r.leave),n(r.laborIns),n(r.healthIns),n(r.pension),r.netPay===undefined||r.netPay===""?n(r.base)+n(r.overtime)+n(r.bonus)+n(r.yearEnd)+n(r.late)+n(r.leave)+n(r.laborIns)+n(r.healthIns):n(r.netPay),str(r.note,300),t))}
  else if(kind==="pos"){const d=str(r.date,10);if(!DATE.test(d))continue;st.push(r.delete?env.DB.prepare("DELETE FROM ledger_pos_daily WHERE sale_date=?").bind(d):env.DB.prepare("INSERT INTO ledger_pos_daily (sale_date,gross,discount,cash,other_pay,customers,revenue,uber,source,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sale_date) DO UPDATE SET gross=excluded.gross,discount=excluded.discount,cash=excluded.cash,other_pay=excluded.other_pay,customers=excluded.customers,revenue=excluded.revenue,uber=excluded.uber,source=excluded.source,updated_at=excluded.updated_at").bind(d,n(r.gross),n(r.discount),n(r.cash),n(r.otherPay),Math.round(n(r.customers)),n(r.revenue),n(r.uber),str(extra.source??"manual",10),t))}
  else if(kind==="balance"){const ym=str(r.ym,7),sec=str(r.section,20),lb=str(r.label,60);if(!YM.test(ym)||!sec||!lb)continue;st.push(r.delete?env.DB.prepare("DELETE FROM ledger_balance WHERE ym=? AND section=? AND label=?").bind(ym,sec,lb):env.DB.prepare("INSERT INTO ledger_balance (ym,section,label,amount,sort,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(ym,section,label) DO UPDATE SET amount=excluded.amount,sort=excluded.sort,updated_at=excluded.updated_at").bind(ym,sec,lb,n(r.amount),Math.round(n(r.sort)),t))}
  else throw new HttpError(400,"未知的資料類型");
 }
 for(let i=0;i<st.length;i+=80)await env.DB.batch(st.slice(i,i+80));
 return {saved:st.length};
}
async function prepaidImport(env:Env,account:string,rows:any[]){
 if(!Array.isArray(rows)||rows.length>3000)throw new HttpError(400,"資料筆數不正確");
 const occ=new Map<string,number>();const st:D1PreparedStatement[]=[];let inserted=0,skipped=0;
 const {results}=await env.DB.prepare("SELECT hash,COUNT(*) AS c FROM ledger_prepaid WHERE account=? AND deleted=0 GROUP BY hash").bind(account).all<any>();const have=new Map(results.map(r=>[r.hash,r.c]));
 for(const r of rows){const item=str(r.item,200),up=n(r.unitPrice),q=r.qty===undefined?1:n(r.qty),amt=r.amount===undefined?r2(up*q):n(r.amount);
  const h=(await sha256(`${item}|${r2(up)}|${r2(q)}|${r2(amt)}`)).slice(0,22);const k=(occ.get(h)??0)+1;occ.set(h,k);
  if((have.get(h)??0)>=k){skipped++;continue}have.set(h,(have.get(h)??0)+1);inserted++;
  st.push(env.DB.prepare("INSERT INTO ledger_prepaid (id,account,seq,item,unit_price,qty,amount,checked,status,hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),account,Math.round(n(r.seq)),item,up,q,amt,str(r.checked,10),str(r.status,200),h,nowIso()))}
 for(let i=0;i<st.length;i+=80)await env.DB.batch(st.slice(i,i+80));
 return {inserted,skipped};
}
const acct=(v:unknown)=>{const a=str(v,40);if(!a)throw new HttpError(400,"請指定對帳對象");return a};

export async function ledgerRoute(request:Request,env:Env,url:URL,actor:Actor|null):Promise<unknown>{
 const p=url.pathname.slice("/api/ledger".length),m=request.method,q=url.searchParams;
 const {a,o}=await ledgerActor(env,actor);
 if(p==="/access"&&m==="GET")return {ok:true,locked:!!o,isOwner:a.kind==="user"&&a.id===o,canLock:a.kind==="user"};
 if(p==="/access"&&m==="POST"){if(a.kind!=="user")throw new HttpError(403,"請用個人帳號登入後再設定");const b=await readBig(request);
  if(b.lock)await env.DB.prepare("INSERT INTO settings (key,value,updated_at,updated_by) VALUES ('ledger_owner',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(a.id,nowIso(),a.username).run();
  else await env.DB.prepare("DELETE FROM settings WHERE key='ledger_owner'").run();return {ok:true,locked:!!b.lock}}
 if(p==="/meta"&&m==="GET")return meta(env);
 if(p==="/entries"&&m==="GET")return listEntries(env,url);
 if(p==="/entries"&&m==="POST"){const e=cleanEntry(await readBig(request),who(a));const id=crypto.randomUUID();await env.DB.prepare(ENTRY_SQL).bind(...entryBind(id,e,"manual",null,await hashOf(e))).run();return {entry:outEntry(await env.DB.prepare("SELECT * FROM ledger_entries WHERE id=?").bind(id).first())}}
 const em=p.match(/^\/entries\/([0-9a-f-]{36})(\/delete)?$/);
 if(em&&m==="PATCH"){const cur=await env.DB.prepare("SELECT * FROM ledger_entries WHERE id=? AND deleted=0").bind(em[1]).first<any>();if(!cur)throw new HttpError(404,"找不到這筆紀錄");
  const b=await readBig(request);const e=cleanEntry({...outEntry(cur),amount:undefined,signed:undefined,...b},cur.recorder);
  await env.DB.prepare("UPDATE ledger_entries SET entry_date=?,raw_date=?,kind=?,category=?,item=?,note=?,qty=?,unit_price=?,tax=?,amount=?,signed=?,staff=?,party=?,recorder=?,company=?,contact=?,tax_id=?,pay_method=?,bank=?,posted_date=?,cash_note=?,hash=?,updated_at=? WHERE id=?")
   .bind(e.date,e.date.replace(/-/g,""),e.kind,e.category,e.item,e.note,e.qty,e.unitPrice,e.tax,e.amount,e.signed,e.staff,e.party,e.recorder,e.company,e.contact,e.taxId,e.payMethod,e.bank,e.postedDate,e.cashNote,await hashOf(e),nowIso(),em[1]).run();
  return {entry:outEntry(await env.DB.prepare("SELECT * FROM ledger_entries WHERE id=?").bind(em[1]).first())}}
 if(em&&em[2]&&m==="POST"){const r=await env.DB.prepare("UPDATE ledger_entries SET deleted=1,updated_at=? WHERE id=? AND deleted=0").bind(nowIso(),em[1]).run();if(!r.meta.changes)throw new HttpError(404,"找不到這筆紀錄");return {ok:true}}
 if(p==="/import"&&m==="POST"){const b=await readBig(request);
  if(b.kind==="entries"){if(!Array.isArray(b.rows)||b.rows.length>1500)throw new HttpError(400,"每批最多 1500 筆");return importEntries(env,b.rows,who(a))}
  if(b.kind==="prepaid")return prepaidImport(env,acct(b.account),b.rows);
  return upsertMany(env,String(b.kind),b.rows,{source:b.kind==="pos"?"pos":"manual"})}
 if(p==="/sync-web"&&m==="POST"){const b=await readBig(request);if(!DATE.test(b.from)||!DATE.test(b.to)||b.from>b.to)throw new HttpError(400,"日期區間不正確");return syncWeb(env,a,b.from,b.to)}
 if(p==="/report/monthly"&&m==="GET")return monthly(env,q.get("year")??"");
 if(p==="/report/daily"&&m==="GET")return daily(env,q.get("ym")??"");
 if(p==="/report/pnl"&&m==="GET")return pnl(env,q.get("ym")??"");
 if(p==="/report/yearly"&&m==="GET")return yearly(env);
 const table:Record<string,[string,string]>={contacts:["SELECT * FROM ledger_contacts ORDER BY name",""],employees:["SELECT * FROM ledger_employees ORDER BY active DESC,name",""],options:["SELECT * FROM ledger_options ORDER BY kind,sort",""],categories:["SELECT * FROM ledger_categories ORDER BY sort,id",""]};
 const k=p.slice(1);
 if(table[k]&&m==="GET")return {rows:(await env.DB.prepare(table[k][0]).all()).results};
 if(["contacts","employees","options","categories","payroll","pos","balance"].includes(k)&&m==="POST"){const b=await readBig(request);return upsertMany(env,k,Array.isArray(b.rows)?b.rows:[b])}
 if(k==="payroll"&&m==="GET"){const nm=q.get("name"),ym=q.get("ym");const w=["1=1"],b:unknown[]=[];if(nm){w.push("name=?");b.push(nm)}if(ym&&/^\d{4}(-\d{2})?$/.test(ym)){w.push("ym LIKE ?");b.push(ym+"%")}
  const {results}=await env.DB.prepare(`SELECT * FROM ledger_payroll WHERE ${w.join(" AND ")} ORDER BY ym DESC,name`).bind(...b).all();
  const ent=nm?(await env.DB.prepare("SELECT * FROM ledger_entries WHERE deleted=0 AND staff=? ORDER BY entry_date DESC LIMIT 500").bind(nm).all()).results.map(outEntry):[];
  return {rows:results,entries:ent}}
 if(k==="pos"&&m==="GET"){const ym=q.get("ym")??"";if(!YM.test(ym))throw new HttpError(400,"年月不正確");
  const {results}=await env.DB.prepare("SELECT * FROM ledger_pos_daily WHERE sale_date LIKE ? ORDER BY sale_date").bind(ym+"-%").all<any>();
  const led=await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN category='店面收入' THEN signed END),0) AS shop,COALESCE(SUM(CASE WHEN category='UBER收入' THEN signed END),0) AS uber FROM ledger_entries WHERE deleted=0 AND entry_date LIKE ?").bind(ym+"-%").first<any>();
  return {rows:results,ledger:{shop:Math.round(led.shop),uber:Math.round(led.uber)}}}
 if(k==="prepaid"&&m==="GET"){const ac=acct(q.get("account")??"龍龍");const {results}=await env.DB.prepare("SELECT * FROM ledger_prepaid WHERE account=? AND deleted=0 ORDER BY seq,created_at").bind(ac).all<any>();
  const accts=(await env.DB.prepare("SELECT DISTINCT account FROM ledger_prepaid WHERE deleted=0").all<any>()).results.map(r=>r.account);
  return {account:ac,accounts:accts,rows:results,balance:r2(results.reduce((s,r)=>s+r.amount,0))}}
 if(k==="prepaid"&&m==="POST"){const b=await readBig(request);const ac=acct(b.account);
  if(b.deleteId){await env.DB.prepare("UPDATE ledger_prepaid SET deleted=1 WHERE id=? AND account=?").bind(str(b.deleteId,40),ac).run();return {ok:true}}
  if(b.id){await env.DB.prepare("UPDATE ledger_prepaid SET checked=?,status=? WHERE id=? AND account=?").bind(str(b.checked,10),str(b.status,200),str(b.id,40),ac).run();return {ok:true}}
  const max=(await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS s FROM ledger_prepaid WHERE account=?").bind(ac).first<any>()).s;
  const up=n(b.unitPrice),qq=b.qty===undefined||b.qty===""?1:n(b.qty);
  await env.DB.prepare("INSERT INTO ledger_prepaid (id,account,seq,item,unit_price,qty,amount,checked,status,hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),ac,max+1,str(b.item,200),up,qq,r2(up*qq),str(b.checked,10),str(b.status,200),(await sha256(`${str(b.item,200)}|${r2(up)}|${r2(qq)}|${r2(up*qq)}`)).slice(0,22),nowIso()).run();return {ok:true}}
 throw new HttpError(404,"Not found");
}
