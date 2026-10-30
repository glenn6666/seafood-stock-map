import {useEffect,useMemo,useRef,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText,newKey,STATUSES} from "../lib/api-config";
import type {Me} from "../main";
type Line={id?:string;name:string;spec:string;unit:string;qty:number;unitPrice:number};
type O={id:string;orderNo:string;status:string;customerName:string;phone:string;note:string;source:string;createdBy:string;total:number;subtotal?:number;discount?:number;createdAt:string;lookupToken:string;items:Line[]};
type P={id:string;name:string;spec:string;unit:string;price:string;quantity:number};
const J={"Content-Type":"application/json"};
const NEXT:Record<string,string>={"待處理":"備貨中","備貨中":"可取貨","可取貨":"已完成"};
const fmt=(s:string)=>new Date(s).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
export const lookupUrl=(t:string)=>`${location.origin}${import.meta.env.BASE_URL}order.html#/o/${t}`;
export default function Orders({me:_me}:{me:Me}){
 const [orders,setOrders]=useState<O[]>([]),[filter,setFilter]=useState("進行中"),[msg,setMsg]=useState(""),[creating,setCreating]=useState(false);
 const load=()=>inventoryFetch("/api/orders").then(async r=>r.ok?setOrders((await r.json()).orders):setMsg(await errorText(r)));
 useEffect(()=>{load()},[]);
 const shown=orders.filter(o=>filter==="全部"||(filter==="進行中"?!["已完成","已取消"].includes(o.status):o.status===filter));
 async function act(o:O,path:string,body?:object,ok="已更新"){
  const r=await inventoryFetch(`/api/orders/${o.id}/${path}`,{method:"POST",headers:J,body:JSON.stringify(body??{})});setMsg(r.ok?ok:await errorText(r));load();
 }
 return <main className="admin-page"><h1>訂單管理</h1>{msg&&<p className="admin-msg" role="status">{msg}</p>}
  <div className="admin-filter">{["進行中",...STATUSES,"全部"].map(s=><button key={s} className={filter===s?"active":""} onClick={()=>setFilter(s)}>{s}</button>)}<button className="primary" onClick={()=>setCreating(c=>!c)}>{creating?"收起":"＋ 建立訂單"}</button><button onClick={load}>重新整理</button></div>
  {creating&&<CreateOrder onDone={(m)=>{setMsg(m);setCreating(false);load()}}/>}
  <div className="admin-list">{shown.map(o=><div key={o.id} className="admin-card">
   <div className="row"><strong>{o.orderNo}</strong><span className={"tag status-"+o.status}>{o.status}</span><small>{o.source==="customer"?"顧客下單":"後台建立"}・{fmt(o.createdAt)}</small></div>
   <div>{o.customerName}{o.phone&&<> ・ <a href={`tel:${o.phone}`}>{o.phone}</a></>}</div>
   <ul className="order-lines">{o.items.map((l,i)=><li key={i}>{l.name} {l.spec} × {l.qty} {l.unit}<span>${l.unitPrice*l.qty}</span></li>)}</ul>
   {(o.discount??0)>0&&<div className="row"><small>小計 ${o.subtotal}・<span className="tag">🎟 釣蝦優惠券 −${o.discount}</span></small></div>}<div className="row"><strong>合計 ${o.total}</strong>{o.note&&<small>備註：{o.note}</small>}</div>
   <div className="actions">
    {NEXT[o.status]&&<button className="primary" onClick={()=>act(o,"status",{status:NEXT[o.status]})}>改為「{NEXT[o.status]}」</button>}
    {!["已完成","已取消"].includes(o.status)&&<button className="danger" onClick={()=>confirm(`取消訂單 ${o.orderNo}？商品數量會補回庫存。`)&&act(o,"cancel",{},"已取消，庫存已補回")}>取消訂單</button>}
    <button onClick={()=>{navigator.clipboard?.writeText(lookupUrl(o.lookupToken));setMsg("已複製顧客查詢連結")}}>複製查詢連結</button>
   </div></div>)}{!shown.length&&<p className="admin-hint">目前沒有訂單。</p>}</div></main>;
}
function CreateOrder({onDone}:{onDone:(m:string)=>void}){
 const [products,setProducts]=useState<P[]>([]),[q,setQ]=useState(""),[cart,setCart]=useState<Record<string,number>>({}),[f,setF]=useState({customerName:"",phone:"",note:""}),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
 const idem=useRef(newKey());
 useEffect(()=>{inventoryFetch("/api/products").then(async r=>r.ok&&setProducts((await r.json()).items))},[]);
 const list=useMemo(()=>products.filter(p=>p.quantity>0&&(p.name+p.spec).includes(q.trim())).slice(0,40),[products,q]);
 const lines=Object.entries(cart).filter(([,n])=>n>0);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!lines.length)return setErr("請選擇商品");setBusy(true);setErr("");
  try{const r=await inventoryFetch("/api/orders",{method:"POST",headers:J,body:JSON.stringify({...f,idempotencyKey:idem.current,items:lines.map(([id,qty])=>({id,qty}))})});
   if(!r.ok){setErr(await errorText(r));if(r.status!==409)return;idem.current=newKey();return}
   const d=await r.json();onDone(d.duplicate?`訂單 ${d.order.orderNo} 已建立（重複送出未重複扣庫存）`:`已建立訂單 ${d.order.orderNo}，庫存已扣除`);
  }catch{setErr("連線中斷，請再按一次送出（不會重複扣庫存）")}finally{setBusy(false)}
 }
 return <form className="admin-card admin-form" onSubmit={submit}><h2>建立訂單</h2>
  <input placeholder="顧客姓名" value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})} required/>
  <input placeholder="電話" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} inputMode="tel"/>
  <input placeholder="備註" value={f.note} onChange={e=>setF({...f,note:e.target.value})}/>
  <input placeholder="搜尋商品" value={q} onChange={e=>setQ(e.target.value)}/>
  <div className="pick-list">{list.map(p=><div key={p.id}><span>{p.name} <small>{p.spec}・剩 {p.quantity}・${p.price}</small></span>
   <input type="number" min={0} max={p.quantity} value={cart[p.id]??0} onChange={e=>setCart(c=>({...c,[p.id]:Math.min(p.quantity,Math.max(0,parseInt(e.target.value)||0))}))} aria-label={`${p.name} 數量`}/></div>)}</div>
  {err&&<p role="alert" className="admin-error">{err}</p>}
  <button className="primary" disabled={busy}>{busy?"送出中…":`送出訂單（${lines.length} 項）`}</button></form>;
}
