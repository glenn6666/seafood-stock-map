import {useEffect,useMemo,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import {parseLedgerWorkbook,sheetsFromXlsx,parsePosRows,POS_FIELDS,type Parsed} from "../lib/ledger-shared";
import "./ledger.css";

const today=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const thisYm=()=>today().slice(0,7);
const money=(n:number)=>(n<0?"-":"")+Math.abs(Math.round(n)).toLocaleString("en-US");
const lastDay=(ym:string)=>`${ym}-${String(new Date(+ym.slice(0,4),+ym.slice(5),0).getDate()).padStart(2,"0")}`;
async function api(path:string,body?:unknown){const r=await inventoryFetch("/api/ledger"+path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error(await errorText(r));return r.json()}
async function patch(path:string,body:unknown){const r=await inventoryFetch("/api/ledger"+path,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error(await errorText(r));return r.json()}
const tsvCell=(v:unknown)=>{const t=String(v??"");return /[\t\n"]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
const csvCell=(v:unknown)=>{const t=String(v??"");return /[,\n"]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
function downloadCsv(name:string,rows:unknown[][]){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
async function readSheets(file:File){const X=await import("xlsx");const buf=await file.arrayBuffer();const wb=/\.csv$/i.test(file.name)?X.read(new TextDecoder().decode(buf),{type:"string",cellDates:true}):X.read(buf,{cellDates:true});return sheetsFromXlsx(X,wb)}
type Meta={categories:{id:number;category:string;item:string;kind:string;active:boolean}[];options:Record<string,string[]>;contacts:string[];employees:string[];range:{from:string|null;to:string|null;count:number}};
const SUBS=[["entries","收支紀錄"],["monthly","月報"],["daily","日報"],["pnl","損益表"],["yearly","年度營業額"],["pos","每日營業額"],["payroll","員工薪資"],["contacts","客戶廠商"],["prepaid","團購對帳"],["settings","分類設定"],["import","匯入試算表"]] as const;
type Sub=typeof SUBS[number][0];

export default function Ledger(){
 const [sub,setSub]=useState<Sub>("entries"),[meta,setMeta]=useState<Meta|null>(null),[err,setErr]=useState(""),[access,setAccess]=useState<any>(null);
 const reload=()=>api("/meta").then(setMeta).catch(e=>setErr(e.message));
 useEffect(()=>{api("/access").then(a=>{setAccess(a);reload()}).catch(e=>setErr(e.message))},[]);
 if(err&&!meta)return <main className="admin-page"><h1>記帳</h1><p className="admin-msg warn" role="alert">{err}</p></main>;
 if(!meta)return <main className="admin-page"><p>讀取中…</p></main>;
 return <main className="admin-page ledger">
  <h1>記帳 <small className="ledger-range">{meta.range.count?`共 ${meta.range.count.toLocaleString()} 筆・${meta.range.from}～${meta.range.to}`:"尚無資料"}</small></h1>
  <nav className="ledger-sub" aria-label="記帳功能">{SUBS.map(([k,l])=><button key={k} className={sub===k?"active":""} onClick={()=>setSub(k)}>{l}</button>)}</nav>
  {!meta.range.count&&sub!=="import"&&<p className="admin-msg">還沒有記帳資料。可先到「匯入試算表」上傳 Google 試算表匯出的 xlsx。</p>}
  {sub==="entries"&&<Entries meta={meta} onChange={reload}/>}{sub==="monthly"&&<Monthly/>}{sub==="daily"&&<Daily/>}{sub==="pnl"&&<Pnl/>}{sub==="yearly"&&<Yearly/>}
  {sub==="pos"&&<Pos/>}{sub==="payroll"&&<Payroll meta={meta} onChange={reload}/>}{sub==="contacts"&&<Contacts onChange={reload}/>}{sub==="prepaid"&&<Prepaid/>}
  {sub==="settings"&&<Settings meta={meta} access={access} onChange={()=>{reload();api("/access").then(setAccess)}}/>}{sub==="import"&&<Import onDone={reload}/>}
 </main>;
}

// ---------- 收支紀錄 ----------
const EMPTY={date:today(),kind:"支出",category:"",item:"",note:"",qty:"1",unitPrice:"",tax:"",staff:"",party:"",payMethod:"",bank:"",postedDate:"",cashNote:"",company:"",contact:"",taxId:""};
function Entries({meta,onChange}:{meta:Meta;onChange:()=>void}){
 const [from,setFrom]=useState(thisYm()+"-01"),[to,setTo]=useState(lastDay(thisYm())),[cat,setCat]=useState(""),[q,setQ]=useState(""),[res,setRes]=useState<any>(null),[msg,setMsg]=useState(""),[form,setForm]=useState<any>(null);
 const load=async()=>{setMsg("");try{const p=new URLSearchParams({from,to,limit:"2000",sheet:"1"});if(cat)p.set("category",cat);if(q)p.set("q",q);setRes(await api("/entries?"+p))}catch(e:any){setMsg(e.message)}};
 useEffect(()=>{load()},[]);
 const cats=useMemo(()=>[...new Set(meta.categories.filter(c=>c.active).map(c=>c.category))],[meta]);
 const items=(c:string)=>meta.categories.filter(x=>x.category===c&&x.active&&x.item).map(x=>x.item);
 const kindOf=(c:string)=>meta.categories.find(x=>x.category===c)?.kind??"支出";
 async function save(e:React.FormEvent){e.preventDefault();try{const b={...form,kind:kindOf(form.category)};if(form.id)await patch("/entries/"+form.id,b);else await api("/entries",b);setForm(null);setMsg("已儲存。");await load();onChange()}catch(x:any){setMsg(x.message)}}
 async function del(id:string){if(!confirm("確定刪除這筆紀錄？"))return;try{await api(`/entries/${id}/delete`,{});await load();onChange()}catch(x:any){setMsg(x.message)}}
 async function sync(){try{const r=await api("/sync-web",{from,to});setMsg(`已同步網站訂單：${r.days} 天、${r.synced} 筆（每天一筆收入、一筆成本）。`);await load();onChange()}catch(x:any){setMsg(x.message)}}
 async function copy(){if(!res)return;try{await navigator.clipboard.writeText(res.sheetRows.map((r:string[])=>r.map(tsvCell).join("\t")).join("\n"));setMsg(`已複製 ${res.sheetRows.length} 列（28 欄）。貼到試算表「每日收支紀錄」最後一列的「項次」欄。`)}catch{setMsg("瀏覽器不允許複製，請改用下載。")}}
 const f=(k:string)=>({value:form[k]??"",onChange:(e:any)=>setForm({...form,[k]:e.target.value})});
 return <>
  <div className="admin-filter"><label>從 <input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="開始日期"/></label><label>到 <input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="結束日期"/></label>
   <select value={cat} onChange={e=>setCat(e.target.value)} aria-label="會計項目篩選"><option value="">全部會計項目</option>{cats.map(c=><option key={c}>{c}</option>)}</select>
   <input placeholder="搜尋內容／備註／廠商" value={q} onChange={e=>setQ(e.target.value)} aria-label="搜尋"/><button className="primary" onClick={load}>查詢</button></div>
  <div className="actions"><button className="primary" onClick={()=>setForm({...EMPTY})}>＋ 新增收支</button><button onClick={sync}>同步網站訂單</button>
   {res&&<><button onClick={copy}>複製（貼到試算表）</button><button onClick={()=>downloadCsv(`收支紀錄_${from}_${to}.csv`,[res.columns,...res.sheetRows])}>下載 CSV</button></>}</div>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  {form&&<form className="admin-card ledger-form" onSubmit={save} aria-label="收支表單"><h2>{form.id?"修改收支":"新增收支"}</h2><div className="grid">
   <label>日期<input type="date" required {...f("date")}/></label>
   <label>會計項目<select required value={form.category} onChange={e=>setForm({...form,category:e.target.value,item:""})} aria-label="會計項目"><option value="">請選擇</option>{cats.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>內容<input list="ledger-items" {...f("item")} aria-label="內容"/><datalist id="ledger-items">{items(form.category).map(i=><option key={i} value={i}/>)}</datalist></label>
   <label>數量<input inputMode="decimal" {...f("qty")}/></label><label>單價<input inputMode="decimal" required {...f("unitPrice")} aria-label="單價"/></label>
   <label>稅金<input inputMode="decimal" {...f("tax")}/></label>
   <label>客戶/廠商<input list="ledger-contacts" {...f("party")}/><datalist id="ledger-contacts">{meta.contacts.map(i=><option key={i} value={i}/>)}</datalist></label>
   <label>員工姓名<select {...f("staff")}><option value=""></option>{meta.employees.map(i=><option key={i}>{i}</option>)}</select></label>
   <label>付款方式<select {...f("payMethod")}><option value=""></option>{(meta.options.pay??[]).map(i=><option key={i}>{i}</option>)}</select></label>
   <label>郵局/銀行<select {...f("bank")}><option value=""></option>{[...(meta.options.bank??[]),...(meta.options.bankType??[])].map(i=><option key={i}>{i}</option>)}</select></label>
   <label>入帳日<input type="date" {...f("postedDate")}/></label><label>金流備註<input {...f("cashNote")}/></label>
  </div><label className="wide">備註<textarea rows={2} {...f("note")}/></label>
   <p className="admin-hint">{form.category?`${kindOf(form.category)}・總計 NT$${money((parseFloat(form.qty)||0)*(parseFloat(form.unitPrice)||0)+(parseFloat(form.tax)||0))}`:"選擇會計項目後自動判斷收入或支出"}</p>
   <div className="actions"><button className="primary">儲存</button><button type="button" onClick={()=>setForm(null)}>取消</button></div></form>}
  {res&&<><div className="admin-card ledger-total"><span>共 {res.total.count} 筆</span><span className="pos">收入 {money(res.total.income)}</span><span className="neg">支出 {money(res.total.expense)}</span><strong>淨額 {money(res.total.net)}</strong></div>
   {res.truncated&&<p className="admin-hint">只顯示最新 {res.entries.length} 筆，請縮小日期區間。</p>}
   <div className="export-table"><table className="ledger-table"><thead><tr><th>日期</th><th>會計項目</th><th>內容</th><th>備註</th><th>數量</th><th>單價</th><th>金額</th><th>客戶/廠商</th><th>付款</th><th></th></tr></thead>
    <tbody>{res.entries.map((e:any)=><tr key={e.id} className={e.source==="web"?"web":""}><td>{e.date}</td><td>{e.category}</td><td>{e.item}</td><td className="note">{e.note}</td><td>{e.qty}</td><td>{money(e.unitPrice)}</td><td className={e.signed<0?"neg":"pos"}>{money(e.signed)}</td><td>{e.party}</td><td>{e.payMethod}</td>
     <td className="row-actions">{e.source!=="web"&&<><button onClick={()=>setForm({...EMPTY,...e,qty:String(e.qty),unitPrice:String(e.unitPrice),tax:e.tax?String(e.tax):""})}>改</button><button onClick={()=>del(e.id)}>刪</button></>}{e.source==="web"&&<small>網站</small>}</td></tr>)}</tbody></table></div></>}
 </>;
}

// ---------- 報表 ----------
function Monthly(){
 const [year,setYear]=useState(thisYm().slice(0,4)),[r,setR]=useState<any>(null),[msg,setMsg]=useState("");
 useEffect(()=>{api("/report/monthly?year="+year).then(setR).catch(e=>setMsg(e.message))},[year]);
 return <><div className="admin-filter"><label>年度 <select value={year} onChange={e=>setYear(e.target.value)} aria-label="年度">{[0,1,2,3].map(i=>String(+thisYm().slice(0,4)-i)).map(y=><option key={y}>{y}</option>)}</select></label>{r&&<button onClick={()=>downloadCsv(`月報_${year}.csv`,[["會計項目",...Array.from({length:12},(_,i)=>`${year}年${i+1}月`),"合計"],...r.rows.map((x:any)=>[x.category,...x.months,x.total]),["營利",...r.profit,r.profitTotal]])}>下載 CSV</button>}</div>
  {msg&&<p className="admin-msg">{msg}</p>}
  {r&&<div className="export-table"><table className="ledger-table num" data-testid="monthly"><thead><tr><th>會計項目</th>{Array.from({length:12},(_,i)=><th key={i}>{i+1}月</th>)}<th>合計</th></tr></thead>
   <tbody><tr className="profit"><th>營利</th>{r.profit.map((v:number,i:number)=><td key={i} className={v<0?"neg":"pos"}>{money(v)}</td>)}<td className={r.profitTotal<0?"neg":"pos"}>{money(r.profitTotal)}</td></tr>
    {r.rows.map((x:any)=><tr key={x.category}><th>{x.category}</th>{x.months.map((v:number,i:number)=><td key={i} className={v<0?"neg":v>0?"pos":"zero"}>{money(v)}</td>)}<td>{money(x.total)}</td></tr>)}</tbody></table></div>}</>;
}
function Daily(){
 const [ym,setYm]=useState(thisYm()),[r,setR]=useState<any>(null);
 useEffect(()=>{api("/report/daily?ym="+ym).then(setR).catch(()=>setR(null))},[ym]);
 return <><div className="admin-filter"><label>年月 <input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="年月"/></label>{r&&<strong>月總計 {money(r.total)}</strong>}</div>
  {r&&<div className="export-table"><table className="ledger-table num"><thead><tr><th>會計項目</th>{r.net.map((_:any,i:number)=><th key={i}>{i+1}</th>)}<th>合計</th></tr></thead>
   <tbody><tr className="profit"><th>每日變動收支</th>{r.net.map((v:number,i:number)=><td key={i} className={v<0?"neg":"pos"}>{money(v)}</td>)}<td>{money(r.total)}</td></tr>
    {r.rows.map((x:any)=><tr key={x.category}><th>{x.category}</th>{x.days.map((v:number,i:number)=><td key={i} className={v<0?"neg":v>0?"pos":"zero"}>{v?money(v):""}</td>)}<td>{money(x.total)}</td></tr>)}</tbody></table></div>}</>;
}
const BAL_SECTIONS=["流動資產","非流動資產","負債","資本額","損益表備註"];
function Pnl(){
 const [ym,setYm]=useState(thisYm()),[r,setR]=useState<any>(null),[msg,setMsg]=useState(""),[nb,setNb]=useState({section:"流動資產",label:"",amount:""});
 const load=()=>api("/report/pnl?ym="+ym).then(setR).catch(e=>setMsg(e.message));useEffect(()=>{load()},[ym]);
 const line=(l:string,a:number|undefined,b:number|undefined,cls="")=><tr key={l} className={cls}><th>{l}</th><td>{money(a??0)}</td><td>{money(b??0)}</td><td>{money((a??0)-(b??0))}</td></tr>;
 async function saveBal(rows:any[]){try{await api("/balance",{rows});setNb({...nb,label:"",amount:""});load()}catch(e:any){setMsg(e.message)}}
 if(!r)return msg?<p className="admin-msg">{msg}</p>:null;
 const c=r.current,p=r.previous,keys=(a:any,b:any)=>[...new Set([...Object.keys(a),...Object.keys(b)])];
 const [y,m]=ym.split("-");
 return <><div className="admin-filter"><label>年月 <input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="年月"/></label></div>{msg&&<p className="admin-msg">{msg}</p>}
  <div className="pnl-grid"><div className="admin-card"><h2>安星水產損益表</h2><small>民國{+y-1911}年{+m}月（與上月 {r.prevYm} 比較）</small>
   <table className="ledger-table num pnl" data-testid="pnl"><thead><tr><th></th><th>本月</th><th>上月</th><th>差額</th></tr></thead><tbody>
    <tr className="sec"><th colSpan={4}>營業收入</th></tr>{keys(c.income,p.income).map(k=>line(k==="店面收入"?"銷貨收入":k,c.income[k],p.income[k]))}{line("收入合計",c.incomeTotal,p.incomeTotal,"sum")}
    <tr className="sec"><th colSpan={4}>營業成本</th></tr>{line("銷貨成本（進貨＋團購）",c.cogs,p.cogs)}{line("銷售毛利",c.gross,p.gross,"sum")}
    <tr className="sec"><th colSpan={4}>營業費用</th></tr>{keys(c.expense,p.expense).map(k=>line(k,c.expense[k],p.expense[k]))}{line("費用合計",c.expenseTotal,p.expenseTotal,"sum")}
    {(c.capital||p.capital)?line("股東投資（不算營業額）",c.capital,p.capital):null}
    {line("本月營餘",c.profit,p.profit,"profit")}
    {r.balance.filter((b:any)=>b.section==="損益表備註").map((b:any)=><tr key={b.label} className="memo"><th>備註：{b.label}</th><td>{money(b.amount)}</td><td colSpan={2}></td></tr>)}
   </tbody></table></div>
  <div className="admin-card"><h2>資產負債表（手動輸入）</h2>
   <table className="ledger-table num"><thead><tr><th></th><th>本月</th><th>上月</th><th></th></tr></thead><tbody>
    {BAL_SECTIONS.filter(s=>s!=="損益表備註").map(s=>{const rows=r.balance.filter((b:any)=>b.section===s),prev=r.balancePrev.filter((b:any)=>b.section===s);const labels=[...new Set([...rows,...prev].map((b:any)=>b.label))];
     return [<tr key={s} className="sec"><th colSpan={4}>{s}</th></tr>,...labels.map(l=>{const cur=rows.find((b:any)=>b.label===l);return <tr key={s+l}><th>{l}</th><td><input className="cell" defaultValue={cur?.amount??""} aria-label={`${l} 本月`} onBlur={e=>{if(e.target.value!==String(cur?.amount??""))saveBal([{ym,section:s,label:l,amount:e.target.value||0}])}}/></td><td>{money(prev.find((b:any)=>b.label===l)?.amount??0)}</td><td>{cur&&<button onClick={()=>saveBal([{ym,section:s,label:l,delete:true}])}>刪</button>}</td></tr>})]})}
    <tr className="sum"><th>總資產</th><td>{money(r.balance.filter((b:any)=>b.section.includes("資產")).reduce((s:number,b:any)=>s+b.amount,0))}</td><td>{money(r.balancePrev.filter((b:any)=>b.section.includes("資產")).reduce((s:number,b:any)=>s+b.amount,0))}</td><td></td></tr>
   </tbody></table>
   <div className="admin-filter"><select value={nb.section} onChange={e=>setNb({...nb,section:e.target.value})} aria-label="區塊">{BAL_SECTIONS.map(s=><option key={s}>{s}</option>)}</select><input placeholder="項目（例：庫存現金(店內)）" value={nb.label} onChange={e=>setNb({...nb,label:e.target.value})} aria-label="項目"/><input placeholder="金額" inputMode="decimal" value={nb.amount} onChange={e=>setNb({...nb,amount:e.target.value})} aria-label="金額"/>
    <button onClick={()=>nb.label&&saveBal([{ym,...nb,amount:nb.amount||0}])}>新增</button>
    {r.balancePrev.length>0&&<button onClick={()=>saveBal(r.balancePrev.filter((b:any)=>!r.balance.some((x:any)=>x.section===b.section&&x.label===b.label)).map((b:any)=>({ym,section:b.section,label:b.label,amount:b.amount,sort:b.sort})))}>沿用上月數字</button>}</div>
  </div></div></>;
}
function Yearly(){
 const [r,setR]=useState<any>(null);useEffect(()=>{api("/report/yearly").then(setR)},[]);
 if(!r)return null;const years=[...new Set(r.months.map((m:any)=>m.ym.slice(0,4)))] as string[];const get=(y:string,i:number)=>r.months.find((m:any)=>m.ym===`${y}-${String(i+1).padStart(2,"0")}`);
 const max=Math.max(1,...r.months.map((m:any)=>m.revenue));
 return <><div className="export-table"><table className="ledger-table num" data-testid="yearly"><thead><tr><th>月份</th>{years.map(y=><><th key={y+"r"}>{y}總營業額</th><th key={y+"c"}>{y}銷貨成本</th></>)}</tr></thead>
  <tbody>{Array.from({length:12},(_,i)=><tr key={i}><th>{i+1}月</th>{years.map(y=><><td key={y+"r"}>{get(y,i)?money(get(y,i).revenue):""}</td><td key={y+"c"}>{get(y,i)?money(get(y,i).cogs):""}</td></>)}</tr>)}
   <tr className="sum"><th>總計</th>{years.map(y=>{const ms=r.months.filter((m:any)=>m.ym.startsWith(y));return <><td key={y+"r"}>{money(ms.reduce((s:number,m:any)=>s+m.revenue,0))}</td><td key={y+"c"}>{money(ms.reduce((s:number,m:any)=>s+m.cogs,0))}</td></>})}</tr></tbody></table></div>
  <div className="admin-card"><h2>每月營業額</h2><div className="bars">{r.months.map((m:any)=><div key={m.ym} className="bar" title={`${m.ym} 營業額 ${money(m.revenue)}／成本 ${money(m.cogs)}`}><i style={{height:`${m.revenue/max*100}%`}}/><b style={{height:`${Math.max(0,m.cogs)/max*100}%`}}/><span>{m.ym.slice(2).replace("-","/")}</span></div>)}</div><small>藍：總營業額　橘：銷貨成本</small></div></>;
}

// ---------- 每日營業額（收銀機） ----------
function Pos(){
 const [ym,setYm]=useState(thisYm()),[r,setR]=useState<any>(null),[msg,setMsg]=useState(""),[up,setUp]=useState<any>(null);
 const load=()=>api("/pos?ym="+ym).then(setR).catch(e=>setMsg(e.message));useEffect(()=>{load()},[ym]);
 async function pick(file:File){setMsg("");try{const sh=await readSheets(file);const name=Object.keys(sh).find(k=>parsePosRows(sh[k]).rows.length)??Object.keys(sh)[0];const raw=sh[name];const p=parsePosRows(raw);setUp({file:file.name,raw,sheet:name,header:p.header,mapping:p.mapping,rowsParsed:p.rows})}catch(e:any){setMsg("無法讀取檔案："+e.message)}}
 function remap(k:string,v:string){const map={...up.mapping};if(v==="")delete map[k];else map[k]=+v;const hi=up.raw.findIndex((r:any)=>r.some((c:any)=>/期間|日期|營業日|date/i.test(String(c??""))));const p=parsePosRows(up.raw.slice(hi+1),map);setUp({...up,mapping:map,rowsParsed:p.rows})}
 const parsed=up?up.rowsParsed:[];
 async function commit(){try{const res=await api("/import",{kind:"pos",rows:parsed});setMsg(`已匯入 ${res.saved} 天的日結（同一天再次上傳會覆蓋）。`);setUp(null);load()}catch(e:any){setMsg(e.message)}}
 const tot=(k:string)=>r?r.rows.reduce((s:number,x:any)=>s+x[k],0):0;
 return <><div className="admin-filter"><label>年月 <input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="年月"/></label>
  <label className="file">上傳收銀機日結（xlsx／csv）<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&pick(e.target.files[0])} aria-label="上傳收銀機日結"/></label></div>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  {up&&<div className="admin-card"><h2>確認欄位對應：{up.file}</h2><p className="admin-hint">已依表頭自動對應，若不正確請改選。找到 {parsed.length} 天的資料。</p><div className="grid">
   {POS_FIELDS.map(([k,l])=><label key={k}>{l}<select value={up.mapping[k]??""} onChange={e=>remap(k,e.target.value)} aria-label={`對應 ${l}`}><option value="">（無）</option>{up.header.map((h:string,i:number)=><option key={i} value={i}>{h||`第 ${i+1} 欄`}</option>)}</select></label>)}</div>
   {parsed.length>0&&<p className="admin-hint">第一天：{parsed[0].date}　營收 {money(parsed[0].revenue)}　最後一天：{parsed.at(-1).date}</p>}
   <div className="actions"><button className="primary" disabled={!parsed.length} onClick={commit}>匯入 {parsed.length} 天</button><button onClick={()=>setUp(null)}>取消</button></div></div>}
  {r&&<><div className="admin-card ledger-total"><span>營收 {money(tot("revenue"))}</span><span>UBER {money(tot("uber"))}</span><span>人次 {tot("customers")}</span><span>收支紀錄「店面收入」{money(r.ledger.shop)}</span><span>「UBER收入」{money(r.ledger.uber)}</span></div>
   <div className="export-table"><table className="ledger-table num"><thead><tr><th>星期</th><th>日期</th><th>原銷售額</th><th>結帳折讓</th><th>現金</th><th>其他付款</th><th>消費人次</th><th>人均消費</th><th>營收金額</th><th>UBER</th><th>總計</th><th>帳差</th></tr></thead>
    <tbody>{r.rows.map((x:any)=><tr key={x.sale_date}><td>{"日一二三四五六"[new Date(x.sale_date).getDay()]}</td><td>{x.sale_date}</td><td>{money(x.gross)}</td><td>{money(x.discount)}</td><td>{money(x.cash)}</td><td>{money(x.other_pay)}</td><td>{x.customers}</td><td>{x.customers?money(x.revenue/x.customers):""}</td><td>{money(x.revenue)}</td><td>{money(x.uber)}</td><td>{money(x.revenue+x.uber)}</td><td className={Math.round(x.cash+x.other_pay-x.revenue)?"neg":""}>{money(x.cash+x.other_pay-x.revenue)}</td></tr>)}</tbody></table></div></>}</>;
}

// ---------- 員工 ----------
const PAY=[["base","本薪"],["overtime","加班"],["bonus","獎金"],["yearEnd","年終獎金"],["late","早退遲到"],["leave","請假"],["laborIns","勞保"],["healthIns","健保"],["pension","勞退提繳"],["netPay","實際支領"]] as const;
const PAYCOL:Record<string,string>={base:"base",overtime:"overtime",bonus:"bonus",yearEnd:"year_end",late:"late",leave:"leave",laborIns:"labor_ins",healthIns:"health_ins",pension:"pension",netPay:"net_pay"};
function Payroll({meta,onChange}:{meta:Meta;onChange:()=>void}){
 const [name,setName]=useState(""),[ym,setYm]=useState(""),[r,setR]=useState<any>(null),[emps,setEmps]=useState<any[]>([]),[f,setF]=useState<any>(null),[msg,setMsg]=useState("");
 const load=()=>{const p=new URLSearchParams();if(name)p.set("name",name);if(ym)p.set("ym",ym);api("/payroll?"+p).then(setR);api("/employees").then(x=>setEmps(x.rows))};useEffect(()=>{load()},[name,ym]);
 async function save(e:React.FormEvent){e.preventDefault();try{await api("/payroll",{rows:[f]});setF(null);setMsg("已儲存薪資。");load()}catch(x:any){setMsg(x.message)}}
 async function saveEmp(row:any){try{await api("/employees",{rows:[row]});load();onChange()}catch(x:any){setMsg(x.message)}}
 return <><div className="admin-filter"><select value={name} onChange={e=>setName(e.target.value)} aria-label="選擇員工"><option value="">全部員工</option>{meta.employees.map(n=><option key={n}>{n}</option>)}</select><label>年月 <input type="month" value={ym} onChange={e=>setYm(e.target.value)} aria-label="選擇年月"/></label>
  <button className="primary" onClick={()=>setF({name:name||meta.employees[0]||"",ym:ym||thisYm()})}>＋ 新增薪資</button></div>{msg&&<p className="admin-msg">{msg}</p>}
  {f&&<form className="admin-card" onSubmit={save}><div className="grid"><label>姓名<select value={f.name} onChange={e=>setF({...f,name:e.target.value})}>{meta.employees.map(n=><option key={n}>{n}</option>)}</select></label><label>年月<input type="month" required value={f.ym} onChange={e=>setF({...f,ym:e.target.value})}/></label>
   {PAY.map(([k,l])=><label key={k}>{l}<input inputMode="decimal" value={f[k]??""} placeholder={k==="netPay"?"空白＝自動加總":""} onChange={e=>setF({...f,[k]:e.target.value})}/></label>)}</div><div className="actions"><button className="primary">儲存</button><button type="button" onClick={()=>setF(null)}>取消</button></div></form>}
  {r&&<div className="export-table"><table className="ledger-table num"><thead><tr><th>姓名</th><th>年月</th>{PAY.map(([k,l])=><th key={k}>{l}</th>)}<th></th></tr></thead><tbody>{r.rows.map((x:any)=><tr key={x.name+x.ym}><th>{x.name}</th><td>{x.ym}</td>{PAY.map(([k])=><td key={k}>{money(x[PAYCOL[k]])}</td>)}<td><button onClick={()=>setF({name:x.name,ym:x.ym,...Object.fromEntries(PAY.map(([k])=>[k,String(x[PAYCOL[k]])]))})}>改</button></td></tr>)}</tbody></table></div>}
  {r&&name&&r.entries.length>0&&<details className="admin-card" open><summary>{name} 的收支紀錄（員工薪資報表）</summary><table className="ledger-table num"><tbody>{r.entries.map((e:any)=><tr key={e.id}><td>{e.date}</td><td>{e.category} {e.item}</td><td className="note">{e.note}</td><td>{money(e.signed)}</td></tr>)}</tbody></table></details>}
  <details className="admin-card"><summary>員工資料庫（{emps.length} 人）</summary><table className="ledger-table"><thead><tr><th>姓名</th><th>職位</th><th>日薪</th><th>時薪</th><th>月薪</th><th>在職</th></tr></thead><tbody>
   {emps.map(e=><tr key={e.name}><th>{e.name}</th>{(["title","daily_wage","hourly_wage","monthly_wage"] as const).map(k=><td key={k}><input className="cell" defaultValue={e[k]??""} onBlur={ev=>{if(ev.target.value!==String(e[k]??""))saveEmp({name:e.name,title:e.title,dailyWage:e.daily_wage,hourlyWage:e.hourly_wage,monthlyWage:e.monthly_wage,active:!!e.active,[{title:"title",daily_wage:"dailyWage",hourly_wage:"hourlyWage",monthly_wage:"monthlyWage"}[k]]:ev.target.value})}}/></td>)}
    <td><input type="checkbox" checked={!!e.active} onChange={ev=>saveEmp({name:e.name,title:e.title,dailyWage:e.daily_wage,hourlyWage:e.hourly_wage,monthlyWage:e.monthly_wage,active:ev.target.checked})}/></td></tr>)}</tbody></table>
   <AddRow fields={["姓名","職位"]} onAdd={([n,t])=>saveEmp({name:n,title:t})}/></details></>;
}
function AddRow({fields,onAdd}:{fields:string[];onAdd:(v:string[])=>void}){const [v,setV]=useState(fields.map(()=>""));
 return <div className="admin-filter">{fields.map((f,i)=><input key={f} placeholder={f} aria-label={"新增"+f} value={v[i]} onChange={e=>{const c=[...v];c[i]=e.target.value;setV(c)}}/>)}<button onClick={()=>{if(v[0].trim()){onAdd(v);setV(fields.map(()=>""))}}}>新增</button></div>}

function Contacts({onChange}:{onChange:()=>void}){
 const [rows,setRows]=useState<any[]>([]),[q,setQ]=useState("");const load=()=>api("/contacts").then(x=>setRows(x.rows));useEffect(()=>{load()},[]);
 const F=[["company","公司名稱"],["contact","聯絡人"],["tax_id","統編"],["phone","電話"],["address","地址"],["note","備註"]] as const;
 const save=async(row:any)=>{await api("/contacts",{rows:[row]});load();onChange()};
 const toIn=(x:any)=>({name:x.name,company:x.company,contact:x.contact,taxId:x.tax_id,phone:x.phone,address:x.address,note:x.note});
 return <><div className="admin-filter"><input placeholder="搜尋廠商" value={q} onChange={e=>setQ(e.target.value)} aria-label="搜尋廠商"/></div>
  <div className="export-table"><table className="ledger-table"><thead><tr><th>客戶/廠商</th>{F.map(([,l])=><th key={l}>{l}</th>)}<th></th></tr></thead><tbody>
   {rows.filter(r=>!q||JSON.stringify(r).includes(q)).map(r=><tr key={r.name}><th>{r.name}</th>{F.map(([k])=><td key={k}><input className="cell" defaultValue={r[k]} onBlur={e=>{if(e.target.value!==r[k])save({...toIn(r),[{tax_id:"taxId"}[k as "tax_id"]??k]:e.target.value})}}/></td>)}<td><button onClick={()=>confirm(`刪除 ${r.name}？`)&&api("/contacts",{rows:[{name:r.name,delete:true}]}).then(load)}>刪</button></td></tr>)}</tbody></table></div>
  <AddRow fields={["客戶/廠商","電話","地址"]} onAdd={([n,p,a])=>save({name:n,phone:p,address:a})}/></>;
}
function Prepaid(){
 const [acc,setAcc]=useState("龍龍"),[r,setR]=useState<any>(null),[f,setF]=useState({item:"",unitPrice:"",qty:"1",status:""});
 const load=()=>api("/prepaid?account="+encodeURIComponent(acc)).then(setR);useEffect(()=>{load()},[acc]);
 const post=async(b:any)=>{await api("/prepaid",{account:acc,...b});load()};
 return <><div className="admin-filter"><label>對帳對象 <input list="pp-acc" value={acc} onChange={e=>setAcc(e.target.value)} aria-label="對帳對象"/><datalist id="pp-acc">{(r?.accounts??[]).concat(["龍龍","右右"]).map((a:string)=><option key={a} value={a}/>)}</datalist></label>{r&&<strong data-testid="prepaid-balance">目前餘額 NT${r.balance.toLocaleString("en-US",{maximumFractionDigits:2})}</strong>}</div>
  <p className="admin-hint">預付貨款記正數，進貨／扣款記負數（單價填負數），與試算表「龍龍團購對帳」相同。</p>
  <div className="admin-filter"><input placeholder="品項" value={f.item} onChange={e=>setF({...f,item:e.target.value})} aria-label="品項"/><input placeholder="單價（扣款填負數）" inputMode="decimal" value={f.unitPrice} onChange={e=>setF({...f,unitPrice:e.target.value})} aria-label="單價"/><input placeholder="數量" inputMode="decimal" value={f.qty} onChange={e=>setF({...f,qty:e.target.value})} aria-label="數量"/>
   <select value={f.status} onChange={e=>setF({...f,status:e.target.value})} aria-label="狀態"><option value="">狀態</option><option>已匯款</option><option>已入庫</option><option>未到貨</option></select><button onClick={()=>f.item&&post(f).then(()=>setF({item:"",unitPrice:"",qty:"1",status:""}))}>新增</button></div>
  {r&&<div className="export-table"><table className="ledger-table num"><thead><tr><th>#</th><th>品項</th><th>單價</th><th>數量</th><th>金額</th><th>到貨正確</th><th>備註</th><th></th></tr></thead><tbody>
   {r.rows.map((x:any,i:number)=><tr key={x.id}><td>{i+1}</td><th>{x.item}</th><td>{money(x.unit_price)}</td><td>{x.qty}</td><td className={x.amount<0?"neg":"pos"}>{x.amount.toLocaleString("en-US")}</td><td><input type="checkbox" checked={x.checked==="○"} onChange={e=>post({id:x.id,checked:e.target.checked?"○":"",status:x.status})} aria-label="到貨正確"/></td><td>{x.status}</td><td><button onClick={()=>confirm("刪除這筆？")&&post({deleteId:x.id})}>刪</button></td></tr>)}</tbody></table></div>}</>;
}
function Settings({meta,access,onChange}:{meta:Meta;access:any;onChange:()=>void}){
 const [msg,setMsg]=useState("");const cats=[...new Set(meta.categories.map(c=>c.category))];
 const saveCat=async(c:any)=>{try{await api("/categories",{rows:[c]});onChange()}catch(e:any){setMsg(e.message)}};
 const [nc,setNc]=useState({category:"",item:"",kind:"支出"});
 return <>{msg&&<p className="admin-msg">{msg}</p>}
  <div className="admin-card"><h2>誰可以看記帳</h2>{access?.locked?<p>目前<strong>只限負責人帳號</strong>可看記帳（其他管理員、店員、原管理密碼都看不到）。</p>:<p>目前所有<strong>管理員</strong>都能看記帳，店員看不到。</p>}
   {access?.canLock?<button className="primary" onClick={()=>api("/access",{lock:!access.locked}).then(onChange).catch(e=>setMsg(e.message))}>{access.locked?"開放給所有管理員":"只限我本人查看"}</button>:<p className="admin-hint">請用個人管理員帳號登入後才能設定。</p>}</div>
  <div className="admin-card"><h2>會計項目（{meta.categories.length}）</h2><p className="admin-hint">停用的項目不會出現在新增選單，但舊紀錄與報表保留。</p>
   {cats.map(c=><div key={c} className="cat-group"><strong>{c}</strong> <small>{meta.categories.find(x=>x.category===c)?.kind}</small><div className="chips">{meta.categories.filter(x=>x.category===c).map(x=><label key={x.id} className={x.active?"chip":"chip off"}><input type="checkbox" checked={x.active} onChange={e=>saveCat({...x,active:e.target.checked})}/>{x.item||"（無細項）"}</label>)}</div></div>)}
   <div className="admin-filter"><input list="cat-list" placeholder="會計項目" value={nc.category} onChange={e=>setNc({...nc,category:e.target.value})} aria-label="新會計項目"/><datalist id="cat-list">{cats.map(c=><option key={c} value={c}/>)}</datalist><input placeholder="內容（細項，可空白）" value={nc.item} onChange={e=>setNc({...nc,item:e.target.value})} aria-label="新細項"/><select value={nc.kind} onChange={e=>setNc({...nc,kind:e.target.value})} aria-label="收支"><option>支出</option><option>收入</option></select>
    <button onClick={()=>nc.category&&saveCat({...nc,sort:meta.categories.length+1}).then(()=>setNc({category:"",item:"",kind:"支出"}))}>新增</button></div></div>
  <div className="admin-card"><h2>付款方式／銀行</h2>{[["pay","付款方式"],["bank","銀行名稱"],["bankType","郵局/銀行"]].map(([k,l])=><div key={k} className="cat-group"><strong>{l}</strong><div className="chips">{(meta.options[k]??[]).map(v=><span key={v} className="chip">{v} <button aria-label={`刪除${v}`} onClick={()=>api("/options",{rows:[{kind:k,value:v,delete:true}]}).then(onChange)}>×</button></span>)}</div><AddRow fields={["新增"+l]} onAdd={([v])=>api("/options",{rows:[{kind:k,value:v,sort:99}]}).then(onChange)}/></div>)}</div></>;
}

// ---------- 匯入 ----------
function Import({onDone}:{onDone:()=>void}){
 const [p,setP]=useState<Parsed|null>(null),[file,setFile]=useState(""),[log,setLog]=useState<string[]>([]),[busy,setBusy]=useState(false),[check,setCheck]=useState<any>(null);
 const add=(s:string)=>setLog(l=>[...l,s]);
 async function pick(f:File){setLog([]);setCheck(null);setFile(f.name);try{setP(parseLedgerWorkbook(await readSheets(f)))}catch(e:any){add("無法讀取："+e.message)}}
 async function run(){if(!p)return;setBusy(true);setLog([]);try{
  add(`會計項目：${(await api("/import",{kind:"categories",rows:p.categories})).saved} 筆`);
  add(`下拉選單：${(await api("/import",{kind:"options",rows:p.options})).saved} 筆`);
  add(`客戶廠商：${(await api("/import",{kind:"contacts",rows:p.contacts})).saved} 筆`);
  add(`員工：${(await api("/import",{kind:"employees",rows:p.employees})).saved} 人`);
  add(`員工薪資紀錄：${(await api("/import",{kind:"payroll",rows:p.payroll})).saved} 筆`);
  add(`每日營業額：${(await api("/import",{kind:"pos",rows:p.pos})).saved} 天`);
  const pp=await api("/import",{kind:"prepaid",account:p.prepaid.account,rows:p.prepaid.rows});add(`${p.prepaid.account}團購對帳：新增 ${pp.inserted}、已存在略過 ${pp.skipped}`);
  let ins=0,sk=0;const errs:string[]=[];for(let i=0;i<p.entries.length;i+=1000){const r=await api("/import",{kind:"entries",rows:p.entries.slice(i,i+1000)});ins+=r.inserted;sk+=r.skipped;errs.push(...r.errors);add(`收支紀錄：${Math.min(i+1000,p.entries.length)}／${p.entries.length}`)}
  add(`收支紀錄完成：新增 ${ins} 筆、已存在略過 ${sk} 筆${errs.length?`、錯誤 ${errs.length} 筆`:""}`);errs.slice(0,10).forEach(add);
  // 與試算表「整合月報總表」核對
  const yrs=[...new Set(Object.values(p.sheetMonthly).flatMap(m=>Object.keys(m).map(k=>k.slice(0,4))))];const diffs:string[]=[];let n=0;
  for(const y of yrs){const r=await api("/report/monthly?year="+y);for(const [c,ms] of Object.entries(p.sheetMonthly))for(const [ym,v] of Object.entries(ms)){const i=+ym.slice(5)-1;const mine=c==="營利"?r.profit[i]:(r.rows.find((x:any)=>x.category===c)?.months[i]??0);n++;if(Math.round(mine)!==Math.round(v))diffs.push(`${c} ${ym}：試算表 ${money(v)}／後台 ${money(mine)}`)}}
  setCheck({n,diffs});onDone();
 }catch(e:any){add("匯入中斷："+e.message+"（可再按一次，已匯入的不會重複）")}finally{setBusy(false)}}
 return <><div className="admin-card"><h2>匯入 Google 試算表</h2><p className="admin-hint">在 Google 試算表選「檔案 → 下載 → Microsoft Excel (.xlsx)」，再選這個檔案。只會讀取檔案，不會修改你的試算表。可以重複匯入：已匯入過的資料會自動略過，只新增試算表裡新的列。</p>
  <label className="file">選擇 xlsx<input type="file" accept=".xlsx" onChange={e=>e.target.files?.[0]&&pick(e.target.files[0])} aria-label="選擇試算表檔案"/></label></div>
  {p&&<div className="admin-card" data-testid="import-preview"><h2>{file}</h2><ul className="import-counts"><li>收支紀錄 {p.entries.length} 筆（{p.entries[0]?.date}～{p.entries.at(-1)?.date}）</li><li>會計項目 {p.categories.length}</li><li>客戶廠商 {p.contacts.length}</li><li>員工 {p.employees.length}</li><li>薪資紀錄 {p.payroll.length}</li><li>每日營業額 {p.pos.length} 天</li><li>{p.prepaid.account}團購對帳 {p.prepaid.rows.length} 筆</li></ul>
   {p.warnings.length>0&&<p className="admin-msg warn">{p.warnings.slice(0,5).join("；")}</p>}<button className="primary" disabled={busy} onClick={run}>{busy?"匯入中…":"開始匯入"}</button></div>}
  {log.length>0&&<div className="admin-card"><ul className="import-log">{log.map((l,i)=><li key={i}>{l}</li>)}</ul></div>}
  {check&&<div className={"admin-card "+(check.diffs.length?"warn":"ok")} data-testid="import-check"><h2>{check.diffs.length?`⚠️ 有 ${check.diffs.length} 格與試算表不同`:`✅ 與試算表「整合月報總表」${check.n} 格全部一致`}</h2>{check.diffs.slice(0,20).map((d:string)=><p key={d}>{d}</p>)}</div>}</>;
}
