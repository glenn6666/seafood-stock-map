// 團購對帳（安星水產中港店）：摘要卡、未到貨待確認、依月份／日期分組的歷史紀錄
import {useEffect,useMemo,useState} from "react";
import {ArrowDownLeft,ArrowUpRight,CalendarClock,ChevronDown,CircleCheck,History,PackageX,Plus,Scale,Search,Trash2,Truck} from "lucide-react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import {Statement,accLabel} from "./ledger-recon";
import "./ledger-prepaid.css";

async function api(path:string,body?:unknown){const r=await inventoryFetch("/api/ledger"+path,body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error(await errorText(r));return r.json()}
const fmt=(n:number,d=0)=>Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:d,minimumFractionDigits:0});
const signed=(n:number)=>(n>0?"+":n<0?"−":"")+fmt(n,2);
const qtyTxt=(q:number)=>Number.isInteger(q)?String(q):String(Math.round(q*100)/100);
const WD="日一二三四五六";
const dayLabel=(d:string)=>d?`${+d.slice(5,7)}/${+d.slice(8,10)}（${WD[new Date(d+"T00:00:00Z").getUTCDay()]}）`:"沒有日期";
const monthLabel=(m:string)=>m?`${m.slice(0,4)} 年 ${+m.slice(5,7)} 月`:"沒有日期（舊資料）";
/** created_at 是 UTC，換成台北時間 */
const taipei=(iso:string)=>{const t=new Date(new Date(iso).getTime()+8*3600e3).toISOString();return `${+t.slice(5,7)}/${+t.slice(8,10)} ${t.slice(11,16)}`};
export const PENDING="未到貨";

type Row={id:string;account:string;seq:number;item:string;unit_price:number;qty:number;amount:number;checked:string;status:string;entry_date:string;created_at:string;direction:string;payment_id:string|null};
type Dir=""|"plus"|"minus";

/** 誰欠誰（正數＝對方欠我們；負數＝我們欠對方，與對方試算表「安星對帳」相同） */
export function owes(balance:number,name:string){
 if(Math.abs(balance)<0.005)return {who:"兩清",cls:"even",text:`與${name}兩清`};
 return balance<0?{who:"我們欠對方",cls:"we",text:`我們欠${name}`}:{who:"對方欠我們",cls:"they",text:`${name}欠我們`};
}
function Amount({n}:{n:number}){return <b className={"pp-amt "+(n<0?"minus":n>0?"plus":"")}>{signed(n)}</b>}
function Meta({x}:{x:Row}){return <small className="pp-meta">{x.qty!==1||x.unit_price!==x.amount?`${qtyTxt(x.qty)} × ${fmt(x.unit_price,2)}`:""}</small>}

export default function Prepaid(){
 const [acc,setAcc]=useState("蟹老大"),[accs,setAccs]=useState<any[]>([]),[r,setR]=useState<any>(null),[msg,setMsg]=useState("");
 const [f,setF]=useState({item:"",unitPrice:"",qty:"1",status:"",date:""}),[adding,setAdding]=useState(false);
 const [q,setQ]=useState(""),[st,setSt]=useState(""),[dir,setDir]=useState<Dir>(""),[open,setOpen]=useState<Set<string>>(new Set()),[pq,setPq]=useState("");
 const load=()=>api("/prepaid?account="+encodeURIComponent(acc)).then(x=>{setR(x);setMsg("")}).catch(e=>setMsg(e.message));
 useEffect(()=>{load()},[acc]);useEffect(()=>{api("/accounts").then(x=>setAccs(x.rows)).catch(()=>{})},[]);
 const post=async(b:any)=>{try{await api("/prepaid",{account:acc,...b});await load()}catch(e:any){setMsg(e.message)}};
 const rows:Row[]=r?.rows??[];
 const name=r?.label||accLabel(accs.find(a=>a.account===acc)??{account:acc});
 const archived=!!accs.find(a=>a.account===acc)?.archived;

 const sum=useMemo(()=>{
  const pend=rows.filter(x=>x.status===PENDING);const pendAmt=pend.reduce((s,x)=>s+x.amount,0);
  const lastDate=rows.reduce((m,x)=>x.entry_date>m?x.entry_date:m,""),lastSync=rows.reduce((m,x)=>x.created_at>m?x.created_at:m,"");
  const statuses=[...rows.reduce((m,x)=>m.set(x.status||"（無狀態）",(m.get(x.status||"（無狀態）")??0)+1),new Map<string,number>())].sort((a,b)=>b[1]-a[1]);
  return {pend,pendAmt,pendChecked:pend.filter(x=>x.checked==="○").length,lastDate,lastSync,statuses};
 },[rows]);
 const short=name.replace(/（.*?）/g,""),balance:number=r?.balance??0,ow=owes(balance,short),exPend=balance-sum.pendAmt,owEx=owes(exPend,short);

 // 未到貨：依日期分組（新到舊）；已勾「到貨正確」的排在後面
 const pendGroups=useMemo(()=>{const k=pq.trim();const g=new Map<string,Row[]>();
  for(const x of sum.pend)if(!k||x.item.includes(k)){const a=g.get(x.entry_date)??[];a.push(x);g.set(x.entry_date,a)}
  return [...g].sort((a,b)=>b[0].localeCompare(a[0])).map(([d,xs])=>({d,xs:xs.sort((a,b)=>(a.checked==="○"?1:0)-(b.checked==="○"?1:0)||a.seq-b.seq),amt:xs.reduce((s,x)=>s+x.amount,0)}))},[sum.pend,pq]);

 // 歷史：月份→日期；月底餘額以日期順序累計
 const filtering=!!(q.trim()||st||dir);
 const months=useMemo(()=>{
  const asc=[...rows].sort((a,b)=>(a.entry_date||"").localeCompare(b.entry_date||"")||a.seq-b.seq);let run=0;const end=new Map<string,number>();
  for(const x of asc){run+=x.amount;end.set(x.entry_date.slice(0,7),run)}
  const k=q.trim();const hit=(x:Row)=>(!k||x.item.includes(k)||x.status.includes(k)||String(Math.abs(x.amount)).includes(k.replace(/[,−+-]/g,"")))&&(!st||(x.status||"（無狀態）")===st)&&(!dir||(dir==="plus"?x.amount>0:x.amount<0));
  const g=new Map<string,Row[]>();for(const x of asc)if(hit(x)){const m=x.entry_date.slice(0,7);const a=g.get(m)??[];a.push(x);g.set(m,a)}
  return [...g].sort((a,b)=>b[0].localeCompare(a[0])).map(([m,xs])=>{const days=new Map<string,Row[]>();for(const x of [...xs].reverse()){const a=days.get(x.entry_date)??[];a.push(x);days.set(x.entry_date,a)}
   return {m,count:xs.length,plus:xs.filter(x=>x.amount>0).reduce((s,x)=>s+x.amount,0),minus:xs.filter(x=>x.amount<0).reduce((s,x)=>s+x.amount,0),pend:xs.filter(x=>x.status===PENDING).length,end:end.get(m)??0,days:[...days]}})},[rows,q,st,dir]);
 const matchCount=months.reduce((s,m)=>s+m.count,0);
 const isOpen=(m:string)=>filtering||open.has(m);
 const toggle=(m:string)=>setOpen(o=>{const n=new Set(o);n.has(m)?n.delete(m):n.add(m);return n});

 return <div className="pp">
  <div className="pp-top">
   <div><h2 className="pp-title"><Scale size={22}/>團購對帳</h2>
    <label className="pp-acc">對帳對象 <select value={acc} onChange={e=>setAcc(e.target.value)} aria-label="對帳對象">{(accs.length?accs:[{account:acc,label:r?.label}]).map((a:any)=><option key={a.account} value={a.account}>{accLabel(a)}</option>)}</select></label></div>
   {r&&archived&&<div className="pp-name"><span className="pp-badge">舊版封存（只供查詢）</span></div>}
  </div>
  {msg&&<p className="admin-msg warn" role="alert">{msg}</p>}
  {!r?<p>讀取中…</p>:<>
  <div className="pp-kpis">
   <div className={"pp-kpi bal "+ow.cls}><span className="pp-ic"><Scale size={20}/></span><div><span className="pp-l">目前餘額</span>
    <span className="pp-who" data-testid="prepaid-owes">{ow.text}</span>
    <span className="pp-v" data-testid="prepaid-balance">NT${fmt(balance,2)}</span>
    <small className="pp-s">試算表上的餘額：{balance.toLocaleString("en-US",{maximumFractionDigits:2})}（負數＝我們欠對方）</small>
    {sum.pend.length>0&&<small className="pp-s">未到貨先不算的話：{owEx.text}{owEx.cls!=="even"&&<> NT${fmt(exPend)}</>}</small>}</div></div>
   <div className={"pp-kpi pend"+(sum.pend.length?"":" none")}><span className="pp-ic"><PackageX size={20}/></span><div><span className="pp-l">未到貨</span>
    <span className="pp-v" data-testid="pending-count">{sum.pend.length} 筆</span><span className="pp-who">共 NT${fmt(sum.pendAmt)}</span>
    {sum.pendChecked>0&&<small className="pp-s">其中 {sum.pendChecked} 筆已勾「到貨正確」</small>}</div></div>
   <div className="pp-kpi upd"><span className="pp-ic"><CalendarClock size={20}/></span><div><span className="pp-l">最後更新</span>
    <span className="pp-v">{sum.lastDate?dayLabel(sum.lastDate):"—"}</span><span className="pp-who">最新一筆的日期</span>
    {sum.lastSync&&<small className="pp-s">最後同步 {taipei(sum.lastSync)}（台北）・共 {rows.length.toLocaleString()} 筆</small>}</div></div>
  </div>
  <p className="pp-legend"><span className="plus"><ArrowUpRight size={14}/>＋ 對方欠我們</span>（我們代付、對方取貨、我們匯款）<span className="minus"><ArrowDownLeft size={14}/>− 我們欠對方</span>（我們收到或訂的貨）。正負跟對方試算表「安星對帳」一樣。</p>

  <section className="pp-card pp-pending" data-testid="pending">
   <h3 className="pp-h"><Truck size={18}/>未到貨待確認<span className="pp-count">{sum.pend.length} 筆・NT${fmt(sum.pendAmt)}</span></h3>
   {sum.pend.length===0?<p className="pp-empty"><CircleCheck size={16}/>目前沒有未到貨的商品。</p>:<>
    <p className="admin-hint">到貨並點過數量後，勾「到貨正確」做記號。勾選只是我們自己的確認，不會改金額，狀態還是以對方試算表為準。</p>
    {sum.pend.length>8&&<div className="pp-search"><Search size={16}/><input placeholder="搜尋未到貨品項" value={pq} onChange={e=>setPq(e.target.value)} aria-label="搜尋未到貨品項"/></div>}
    {pendGroups.map((g,i)=><details key={g.d} className="pp-day" open={i<5||!!pq.trim()}><summary><ChevronDown size={16} className="pp-chev"/><span className="pp-date">{dayLabel(g.d)}</span><span className="pp-sum">{g.xs.length} 筆 <Amount n={g.amt}/></span></summary>
     <ul className="pp-list">{g.xs.map(x=><li key={x.id} className={x.checked==="○"?"done":""}><label className="pp-check"><input type="checkbox" checked={x.checked==="○"} onChange={e=>post({id:x.id,checked:e.target.checked?"○":"",status:x.status})} aria-label={`到貨正確：${x.item}`}/></label>
      <div className="pp-item"><span>{x.item||"（沒有品項）"}</span><small className="pp-meta">數量 {qtyTxt(x.qty)}{x.unit_price!==x.amount?`・單價 ${fmt(x.unit_price,2)}`:""}</small></div><Amount n={x.amount}/></li>)}</ul></details>)}
    {pendGroups.length===0&&<p className="pp-empty">找不到「{pq}」。</p>}</>}
  </section>

  <Statement account={acc}/>

  <section className="pp-card" data-testid="history">
   <h3 className="pp-h"><History size={18}/>歷史紀錄<span className="pp-count">{filtering?`找到 ${matchCount.toLocaleString()} 筆`:`${months.length} 個月`}</span></h3>
   <div className="pp-filters">
    <div className="pp-search"><Search size={16}/><input placeholder="搜尋品項、狀態或金額" value={q} onChange={e=>setQ(e.target.value)} aria-label="搜尋對帳紀錄"/></div>
    <select value={st} onChange={e=>setSt(e.target.value)} aria-label="狀態篩選"><option value="">全部狀態</option>{sum.statuses.map(([s,c])=><option key={s} value={s}>{s}（{c}）</option>)}</select>
    <div className="pp-seg" role="group" aria-label="正負篩選">{([["","全部"],["plus","＋ 對方欠我們"],["minus","− 我們欠對方"]] as [Dir,string][]).map(([k,l])=><button key={k} className={dir===k?"on":""} onClick={()=>setDir(k)}>{l}</button>)}</div>
    {filtering&&<button className="pp-clear" onClick={()=>{setQ("");setSt("");setDir("")}}>清除篩選</button>}
   </div>
   {months.map(g=><div key={g.m} className={"pp-month"+(isOpen(g.m)?" open":"")}>
    <button className="pp-mh" onClick={()=>toggle(g.m)} aria-expanded={isOpen(g.m)} disabled={filtering}><ChevronDown size={16} className="pp-chev"/><span className="pp-date">{monthLabel(g.m)}</span><span className="pp-mc">{g.count} 筆{g.pend>0&&<em>未到貨 {g.pend}</em>}</span>
     <span className="pp-mt">{g.plus>0&&<span className="plus">+{fmt(g.plus)}</span>}{g.minus<0&&<span className="minus">−{fmt(g.minus)}</span>}{!filtering&&<span className="pp-end">月底餘額 {signed(g.end)}</span>}</span></button>
    {isOpen(g.m)&&<div className="pp-mb">{g.days.map(([d,xs])=><div key={d} className="pp-dg"><div className="pp-dh">{dayLabel(d)}<span>{xs.length} 筆</span></div>
     <ul className="pp-list">{xs.map(x=><li key={x.id}><div className="pp-item"><span>{x.item||"（沒有品項）"}</span><span className="pp-tags">{x.status&&<span className={"pp-st"+(x.status===PENDING?" pend":"")}>{x.status}</span>}{x.checked==="○"&&<span className="pp-st ok">到貨正確</span>}<Meta x={x}/></span></div>
      <Amount n={x.amount}/><span className="pp-act"><label title="到貨正確"><input type="checkbox" checked={x.checked==="○"} onChange={e=>post({id:x.id,checked:e.target.checked?"○":"",status:x.status})} aria-label="到貨正確"/></label><button className="pp-del" onClick={()=>confirm(`刪除「${x.item}」這筆？`)&&post({deleteId:x.id})} aria-label="刪除這筆"><Trash2 size={15}/></button></span></li>)}</ul></div>)}</div>}
   </div>)}
   {months.length===0&&<p className="pp-empty">沒有符合的紀錄。</p>}
  </section>

  <section className="pp-card">
   <button className="pp-addh" onClick={()=>setAdding(a=>!a)} aria-expanded={adding}><Plus size={16}/>手動新增一筆<ChevronDown size={16} className={"pp-chev"+(adding?" up":"")}/></button>
   {adding&&<div className="pp-add"><input placeholder="品項" value={f.item} onChange={e=>setF({...f,item:e.target.value})} aria-label="品項"/><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} aria-label="日期"/>
    <input placeholder="單價（我們欠對方填負數）" inputMode="decimal" value={f.unitPrice} onChange={e=>setF({...f,unitPrice:e.target.value})} aria-label="單價"/><input placeholder="數量" inputMode="decimal" value={f.qty} onChange={e=>setF({...f,qty:e.target.value})} aria-label="數量"/>
    <select value={f.status} onChange={e=>setF({...f,status:e.target.value})} aria-label="狀態"><option value="">狀態</option><option>已匯款</option><option>已入庫</option><option>未到貨</option></select>
    <button className="primary" onClick={()=>f.item&&post(f).then(()=>setF({item:"",unitPrice:"",qty:"1",status:"",date:""}))}>新增</button></div>}
  </section></>}
 </div>;
}
