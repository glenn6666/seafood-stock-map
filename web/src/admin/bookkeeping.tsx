import {useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
type Day={date:string;orders:number;pending:number;subtotal:number;discount:number;couponOrders:number;total:number;cost:number;costEstimatedLines:number;costMissingLines:number;missingNames:string[]};
type Res={from:string;to:string;columns:string[];days:Day[];rows:string[][];alreadyExportedDays:string[];previousExports:{from:string;to:string;days:string[];by:string;at:string}[]};
const ymd=(d:Date)=>new Date(d.getTime()+8*3600e3).toISOString().slice(0,10);
const firstOfMonth=()=>ymd(new Date()).slice(0,8)+"01";
const tsvCell=(v:string)=>/[\t\n"]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
const csvCell=(v:string)=>/[,\n"]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
const money=(n:number)=>"NT$"+n.toLocaleString("en-US");
export default function Bookkeeping(){
 const [from,setFrom]=useState(firstOfMonth()),[to,setTo]=useState(ymd(new Date())),[res,setRes]=useState<Res|null>(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 async function load(keepMsg=false){setBusy(true);if(!keepMsg)setMsg("");try{const r=await inventoryFetch(`/api/export/bookkeeping?from=${from}&to=${to}`);if(!r.ok){setRes(null);setMsg(await errorText(r));return}setRes(await r.json())}finally{setBusy(false)}}
 async function mark(){if(!res)return;await inventoryFetch("/api/export/bookkeeping/mark",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:res.from,to:res.to,days:res.days.map(d=>d.date)})});}
 const confirmDup=()=>!res?.alreadyExportedDays.length||confirm(`以下日期之前已匯出過：${res.alreadyExportedDays.join("、")}\n重複貼上會讓收入重複計算。仍要繼續？`);
 async function copy(){if(!res||!confirmDup())return;const t=res.rows.map(r=>r.map(tsvCell).join("\t")).join("\n");
  try{await navigator.clipboard.writeText(t);setMsg(`已複製 ${res.rows.length} 列。請到「每日收支紀錄」最後一列的「項次」欄貼上。`)}catch{setMsg("瀏覽器不允許複製，請改用下載。");return}
  await mark();load(true)}
 async function download(){if(!res||!confirmDup())return;const t="\ufeff"+[res.columns,...res.rows].map(r=>r.map(csvCell).join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv;charset=utf-8"}));a.download=`記帳匯出_${res.from}_${res.to}.csv`;a.click();URL.revokeObjectURL(a.href);
  setMsg("已下載 CSV。");await mark();load(true)}
 const sum=(k:keyof Day)=>res?res.days.reduce((s,d)=>s+(d[k] as number),0):0;
 const show=[1,2,4,5,6,7,8,15];
 return <main className="admin-page"><h1>記帳匯出</h1>
  <p className="admin-hint">把網站訂單整理成 Google 試算表「每日收支紀錄」的欄位格式：每天一列「網站收入」（已扣優惠券的實收）、一列「進貨支出 網站訂單成本」（下單當時成本）。已取消的訂單不計。公式欄位（小計、總計、年月等）留空，由試算表自動計算。此頁不會修改試算表。</p>
  <div className="admin-filter"><label>從 <input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="開始日期"/></label><label>到 <input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="結束日期"/></label><button className="primary" onClick={()=>load()} disabled={busy}>{busy?"讀取中…":"產生預覽"}</button></div>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  {res&&<>
   {res.alreadyExportedDays.length>0&&<p className="admin-msg warn" role="alert" data-testid="dup-warning">⚠️ 這些日期之前已匯出過：{res.alreadyExportedDays.join("、")}。請確認試算表沒有重複的列再貼上。</p>}
   {res.days.some(d=>d.costMissingLines)&&<p className="admin-msg warn">有商品缺少成本，未計入網站訂單成本：{[...new Set(res.days.flatMap(d=>d.missingNames))].join("、")}。請到「商品販售」補上成本。</p>}
   <div className="admin-card"><strong>區間合計</strong> 訂單 {sum("orders")} 筆・原價 {money(sum("subtotal"))}・優惠券折 {money(sum("discount"))}・實收 {money(sum("total"))}・成本 {money(sum("cost"))}・毛利 {money(sum("total")-sum("cost"))}</div>
   {res.rows.length?<><div className="actions"><button className="primary" onClick={copy}>複製（貼到試算表）</button><button onClick={download}>下載 CSV</button></div>
    <div className="export-table"><table><thead><tr>{show.map(i=><th key={i}>{res.columns[i].trim()}</th>)}</tr></thead>
     <tbody>{res.rows.map((r,k)=><tr key={k} className={res.alreadyExportedDays.includes(`${r[2].slice(0,4)}-${r[2].slice(4,6)}-${r[2].slice(6)}`)?"dup":""}>{show.map(i=><td key={i}>{r[i]}</td>)}</tr>)}</tbody></table></div>
    <p className="admin-hint">預覽只顯示有填的欄位；複製／下載的內容包含全部 {res.columns.length} 欄，順序與「每日收支紀錄」相同（從「項次」開始）。</p></>
   :<p className="admin-hint">這段期間沒有未取消的網站訂單。</p>}
   {res.previousExports.length>0&&<details className="admin-card"><summary>此區間的匯出紀錄（{res.previousExports.length}）</summary><ul>{res.previousExports.map((p,k)=><li key={k}>{p.from}～{p.to}・{p.by}・{new Date(p.at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})}</li>)}</ul></details>}
  </>}
 </main>;
}
