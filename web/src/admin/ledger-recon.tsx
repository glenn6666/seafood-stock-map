// 付款拆分（店內支出＋團購對帳）、單據照片、收銀機代支、對帳月結單
import {useEffect,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import {parseCashoutRows,sheetsFromXlsx} from "../lib/ledger-shared";

const today=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const money=(n:number)=>(n<0?"-":"")+Math.abs(Math.round(n)).toLocaleString("en-US");
const r2=(x:number)=>Math.round(x*100)/100;
async function api(path:string,body?:unknown){const r=await inventoryFetch("/api/ledger"+path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error(await errorText(r));return r.json()}
const csvCell=(v:unknown)=>{const t=String(v??"");return /[,\n"]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
function downloadCsv(name:string,rows:unknown[][]){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
export const accLabel=(a:{account:string;label?:string})=>a.label?`${a.label}（${a.account}）`:a.account;
type Cat={category:string;item:string;kind:string;active:boolean};
type Line={type:"store"|"partner";category?:string;item?:string;account?:string;amount:string};

async function uploadReceipt(pid:string,f:File){const r=await inventoryFetch(`/api/ledger/payments/${pid}/receipts`,{method:"POST",headers:{"Content-Type":f.type||"image/jpeg"},body:f});if(!r.ok)throw new Error(await errorText(r))}
function Receipt({id}:{id:string}){const [u,setU]=useState("");useEffect(()=>{let url="";inventoryFetch("/api/ledger/receipts/"+id).then(r=>r.ok?r.blob():null).then(b=>{if(b){url=URL.createObjectURL(b);setU(url)}});return()=>{if(url)URL.revokeObjectURL(url)}},[id]);
 return u?<a href={u} target="_blank" rel="noreferrer"><img className="receipt-thumb" src={u} alt="單據照片"/></a>:<span className="receipt-thumb">…</span>}

/** 登記一筆付款並拆分 */
export function PaymentForm({cats,accounts:allAcc,prefill,onSaved,onCancel}:{cats:Cat[];accounts:any[];prefill?:{date:string;total:number;vendor?:string;cashoutId?:string;note?:string};onSaved:()=>void;onCancel?:()=>void}){
 const accounts=allAcc.filter((a:any)=>!a.archived);const expense=[...new Set(cats.filter(c=>c.kind==="支出"&&c.active).map(c=>c.category))];
 const [f,setF]=useState({date:prefill?.date??today(),vendor:prefill?.vendor??"",total:prefill?String(prefill.total):"",payMethod:prefill?.cashoutId?"收銀機代支":"現金",note:prefill?.note??""});
 const [lines,setLines]=useState<Line[]>([{type:"store",category:expense.includes("進貨支出")?"進貨支出":expense[0]??"",amount:prefill?String(prefill.total):""}]);
 const [files,setFiles]=useState<File[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const total=parseFloat(f.total)||0,sum=r2(lines.reduce((s,l)=>s+(parseFloat(l.amount)||0),0)),diff=r2(total-sum);
 const set=(i:number,p:Partial<Line>)=>setLines(ls=>ls.map((l,j)=>j===i?{...l,...p}:l));
 const add=(type:Line["type"])=>setLines(ls=>[...ls,type==="store"?{type,category:"進貨支出",amount:diff>0?String(diff):""}:{type,account:accounts[0]?.account??"蟹老大",amount:diff>0?String(diff):""}]);
 async function save(){setBusy(true);setMsg("");try{const r=await api("/payments",{...f,total,cashoutId:prefill?.cashoutId,lines:lines.map(l=>({...l,amount:parseFloat(l.amount)||0}))});
  for(const x of files)await uploadReceipt(r.id,x);onSaved()}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 return <div className="admin-card pay-form" data-testid="payment-form"><h2>登記付款{prefill?.cashoutId?"（收銀機代支）":""}</h2>
  <div className="grid"><label>日期<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label>
   <label>廠商（看單據）<input value={f.vendor} onChange={e=>setF({...f,vendor:e.target.value})} placeholder="例：金賀家" aria-label="廠商"/></label>
   <label>付款總額<input inputMode="decimal" value={f.total} onChange={e=>{setF({...f,total:e.target.value});if(lines.length===1)set(0,{amount:e.target.value})}} aria-label="付款總額"/></label>
   <label>付款方式<select value={f.payMethod} onChange={e=>setF({...f,payMethod:e.target.value})}>{["收銀機代支","現金","匯款","刷卡","支票"].map(x=><option key={x}>{x}</option>)}</select></label></div>
  <h3>拆分</h3>
  {lines.map((l,i)=><div key={i} className={"split-line "+l.type}>
   {l.type==="store"?<><span className="tag">店內</span><select value={l.category} onChange={e=>set(i,{category:e.target.value})} aria-label="會計項目">{expense.map(c=><option key={c}>{c}</option>)}</select></>
    :<><span className="tag partner">團購</span><select value={l.account} onChange={e=>set(i,{account:e.target.value})} aria-label="對帳對象">{accounts.map(a=><option key={a.account} value={a.account}>{accLabel(a)}</option>)}</select></>}
   <input placeholder={l.type==="store"?"內容（可空白）":"品項（例：泰國蝦 2 箱）"} value={l.item??""} onChange={e=>set(i,{item:e.target.value})} aria-label="內容"/>
   <input className="amt" inputMode="decimal" placeholder="金額" value={l.amount} onChange={e=>set(i,{amount:e.target.value})} aria-label="拆分金額"/>
   {lines.length>1&&<button onClick={()=>setLines(ls=>ls.filter((_,j)=>j!==i))} aria-label="移除這行">×</button>}</div>)}
  <div className="actions"><button onClick={()=>add("store")}>＋店內支出</button><button onClick={()=>add("partner")}>＋團購對帳</button></div>
  <p className={diff===0&&total>0?"admin-hint ok":"admin-msg warn"} data-testid="split-diff">{total<=0?"請輸入付款總額":diff===0?"✅ 拆分合計等於付款總額":`拆分合計 ${money(sum)}，還差 ${money(diff)}`}</p>
  <p className="admin-hint">店內的部分記入收支紀錄（算成本）；團購的部分記入對帳，表示對方欠我們（正數），不算店內支出。</p>
  <label className="file">單據照片<input type="file" accept="image/*" capture="environment" multiple onChange={e=>setFiles([...(e.target.files??[])])} aria-label="單據照片"/></label>{files.length>0&&<small>已選 {files.length} 張</small>}
  <label>備註<input value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label>
  {msg&&<p className="admin-msg">{msg}</p>}
  <div className="actions"><button className="primary" disabled={busy||diff!==0||total<=0} onClick={save}>{busy?"儲存中…":"儲存"}</button>{onCancel&&<button onClick={onCancel}>取消</button>}</div></div>;
}

export function Payments({cats}:{cats:Cat[]}){
 const [ym,setYm]=useState(today().slice(0,7)),[r,setR]=useState<any>(null),[acc,setAcc]=useState<any[]>([]),[open,setOpen]=useState(false);
 const load=()=>{api("/payments?ym="+ym).then(setR);api("/accounts").then(x=>setAcc(x.rows))};useEffect(load,[ym]);
 return <><div className="admin-filter"><label>月份<input type="month" value={ym} onChange={e=>setYm(e.target.value)}/></label><button className="primary" onClick={()=>setOpen(true)}>＋登記付款</button></div>
  {open&&<PaymentForm cats={cats} accounts={acc} onSaved={()=>{setOpen(false);load()}} onCancel={()=>setOpen(false)}/>}
  {r&&!r.rows.length&&<p className="admin-hint">這個月還沒有登記付款。</p>}
  {r?.rows.map((p:any)=><div key={p.id} className="admin-card pay-card"><div className="pay-head"><strong>{p.date.slice(5)} {p.vendor||"（未填廠商）"}</strong><span>NT${money(p.total)}</span><small>{p.payMethod}{p.cashout?`・收銀代支 ${p.cashout.biz_date.slice(5)}`:""}</small></div>
   <ul className="pay-lines">{p.lines.map((l:any,i:number)=><li key={i}><span className={"tag"+(l.type==="partner"?" partner":"")}>{l.type==="store"?"店內":"團購"}</span>{l.type==="store"?l.category:accLabel(acc.find(a=>a.account===l.account)??{account:l.account})} {l.item}<b>{money(l.amount)}</b></li>)}</ul>
   <div className="receipts">{p.receipts.map((x:any)=><Receipt key={x.id} id={x.id}/>)}<label className="file small">＋照片<input type="file" accept="image/*" capture="environment" onChange={async e=>{const f=e.target.files?.[0];if(f){try{await uploadReceipt(p.id,f);load()}catch(x:any){alert(x.message)}}}}/></label></div>
   <button onClick={()=>confirm("刪除這筆付款？（拆分的收支與對帳也會一起刪除）")&&api(`/payments/${p.id}/delete`,{}).then(load)}>刪除</button></div>)}</>;
}

async function readSheets(file:File){const X=await import("xlsx");const buf=await file.arrayBuffer();if(/\.xls$/i.test(file.name))X.set_cptable(await import("xlsx/dist/cpexcel.full.mjs"));
 const wb=/\.csv$/i.test(file.name)?X.read(new TextDecoder().decode(buf),{type:"string",cellDates:true}):X.read(buf,{cellDates:true});return sheetsFromXlsx(X,wb)}

export function Cashout({cats}:{cats:Cat[]}){
 const [ym,setYm]=useState(today().slice(0,7)),[r,setR]=useState<any>(null),[acc,setAcc]=useState<any[]>([]),[msg,setMsg]=useState(""),[pick,setPick]=useState<any>(null);
 const load=()=>{api("/cashout?ym="+ym).then(setR);api("/accounts").then(x=>setAcc(x.rows))};useEffect(load,[ym]);
 async function upload(f:File){setMsg("");try{const sh=await readSheets(f);const rows=Object.values(sh).flatMap(x=>parseCashoutRows(x).rows);if(!rows.length)throw new Error("找不到代支資料（需要「帳日、型態、項目、金額」欄）");
  const res=await api("/import",{kind:"cashout",rows});setMsg(`代支 ${rows.length} 筆：新增 ${res.inserted}、已匯入過 ${res.skipped}`);setYm(rows[0].date.slice(0,7));load()}catch(e:any){setMsg(e.message)}}
 return <><div className="admin-filter"><label>月份<input type="month" value={ym} onChange={e=>setYm(e.target.value)}/></label><label className="file">上傳收銀機代支（xls／xlsx／csv）<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])} aria-label="上傳收銀機代支"/></label></div>
  {msg&&<p className="admin-msg">{msg}</p>}
  {r&&<p className="admin-hint" data-testid="cashout-summary">本月代支 {r.rows.length} 筆、NT${money(r.total)}；已對應單據 {r.matched} 筆，<strong>未對應 {r.rows.length-r.matched} 筆</strong>。</p>}
  {pick&&<PaymentForm cats={cats} accounts={acc} prefill={{date:pick.date,total:pick.amount,cashoutId:pick.id,note:`收銀代支 ${pick.time} ${pick.item} ${pick.staff}`.trim()}} onSaved={()=>{setPick(null);load()}} onCancel={()=>setPick(null)}/>}
  {r&&<div className="export-table"><table className="ledger-table num"><thead><tr><th>日期</th><th>時間</th><th>項目</th><th>經辦</th><th>金額</th><th>狀態</th></tr></thead><tbody>
   {r.rows.map((x:any)=><tr key={x.id}><td>{x.date.slice(5)}</td><td>{x.time}</td><th>{x.item}</th><td>{x.staff}</td><td>{money(x.amount)}</td><td>{x.paymentId?<span className="tag ok">已對應 {x.vendor}</span>:<button onClick={()=>setPick(x)}>登記</button>}</td></tr>)}</tbody></table></div>}</>;
}

/** 對帳月結單：正負同對方試算表（負數＝我們欠對方） */
export function Statement({account}:{account:string}){
 const [ym,setYm]=useState(today().slice(0,7)),[s,setS]=useState<any>(null);
 useEffect(()=>{api(`/statement?account=${encodeURIComponent(account)}&ym=${ym}`).then(setS).catch(()=>setS(null))},[account,ym]);
 if(!s)return null;const name=s.label?`${s.label}（${s.account}）`:s.account;
 const exp=()=>downloadCsv(`對帳單_${s.label||s.account}_${ym}.csv`,[["對帳單",name,ym],["說明","正數＝對方欠我們；負數＝我們欠對方（與對方試算表「安星對帳」相同）"],["期初餘額","","","",s.opening],["日期","品項","單價","數量","金額","狀態"],...s.rows.map((r:any)=>[r.date,r.item,r.unitPrice,r.qty,r.amount,r.status]),["本月對方欠我們","","","",s.theyOwe],["本月我們欠對方","","","",s.weOwe],["期末餘額","","","",s.closing,s.meaning]]);
 return <div className="admin-card" data-testid="statement"><h2>月結對帳單：{name}</h2>
  <div className="admin-filter"><label>月份<input type="month" value={ym} onChange={e=>setYm(e.target.value)}/></label><button onClick={exp}>匯出 CSV</button></div>
  <ul className="stmt"><li>期初餘額 <b>{money(s.opening)}</b>{s.undatedCount>0&&<small>（含沒有日期的舊資料 {s.undatedCount} 筆）</small>}</li><li>本月對方欠我們 <b className="pos">+{money(s.theyOwe)}</b></li><li>本月我們欠對方 <b className="neg">{money(s.weOwe)}</b></li>
   <li>期末餘額 <b className={s.closing<0?"neg":"pos"}>{money(s.closing)}</b>（{s.meaning}）</li></ul>
  {s.rows.length>0&&<div className="export-table"><table className="ledger-table num"><thead><tr><th>日期</th><th>品項</th><th>金額</th><th>狀態</th></tr></thead><tbody>{s.rows.map((r:any)=><tr key={r.id}><td>{r.date.slice(5)}</td><th>{r.item}</th><td className={r.amount<0?"neg":"pos"}>{money(r.amount)}</td><td>{r.status}</td></tr>)}</tbody></table></div>}</div>;
}
