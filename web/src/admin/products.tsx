import {useEffect,useMemo,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import type {Me} from "../main";
type P={id:string;zone:string;name:string;spec:string;unit:string;category:string;price:string;cost?:string;quantity:number;onSale:boolean;dailyLimit:number;perOrderMax:number};
export default function Products({me}:{me:Me}){
 const admin=me.role==="admin";
 const [items,setItems]=useState<P[]>([]),[q,setQ]=useState(""),[onlySale,setOnlySale]=useState(false),[msg,setMsg]=useState(""),[edit,setEdit]=useState<Record<string,Partial<P>>>({}),[sel,setSel]=useState<Set<string>>(new Set());
 const load=()=>inventoryFetch("/api/products").then(async r=>r.ok?setItems((await r.json()).items):setMsg(await errorText(r)));
 useEffect(()=>{load()},[]);
 const shown=useMemo(()=>items.filter(i=>(!onlySale||i.onSale)&&(i.name+i.spec+i.category).includes(q.trim())),[items,q,onlySale]);
 async function save(p:P){
  const e=edit[p.id];if(!e)return;
  const r=await inventoryFetch(`/api/products/${encodeURIComponent(p.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});
  if(r.ok){setMsg(`已儲存「${p.name}」`);setEdit(x=>{const n={...x};delete n[p.id];return n});load()}else setMsg(await errorText(r));
 }
 async function bulk(onSale:boolean){
  const ids=[...sel];if(!ids.length)return;
  if(!confirm(`將選取的 ${ids.length} 項商品全部${onSale?"上架（顧客訂購頁可見）":"下架"}？`))return;
  const r=await inventoryFetch("/api/products/bulk-on-sale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids,onSale})});
  if(r.ok){setMsg(`已${onSale?"上架":"下架"} ${(await r.json()).changed} 項`);setSel(new Set());load()}else setMsg(await errorText(r));
 }
 const toggle=(id:string)=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n});
 const allShown=shown.length>0&&shown.every(p=>sel.has(p.id));
 const val=<K extends keyof P>(p:P,k:K)=>(edit[p.id]?.[k]??p[k]) as P[K];
 const set=(p:P,k:keyof P,v:unknown)=>setEdit(x=>({...x,[p.id]:{...x[p.id],[k]:v}}));
 return <main className="admin-page"><h1>商品販售設定</h1>
  <p className="admin-hint">只有「上架」的商品會出現在顧客訂購頁；新欄位預設皆未上架。每日限量、每筆上限填 0 代表不限。{!admin&&"店員僅能查看庫存與販售狀態；售價、成本與上架設定由管理員管理。"}只列出已在庫存地圖儲存過的商品。</p>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  <div className="admin-filter"><input placeholder="搜尋商品" value={q} onChange={e=>setQ(e.target.value)}/><label><input type="checkbox" checked={onlySale} onChange={e=>setOnlySale(e.target.checked)}/> 只看上架</label></div>
  {admin&&<div className="bulk-bar"><label className="select"><input type="checkbox" checked={allShown} onChange={()=>setSel(s=>{const n=new Set(s);shown.forEach(p=>allShown?n.delete(p.id):n.add(p.id));return n})}/> 全選目前列表</label><span>已選 {sel.size} 項</span><button className="primary" disabled={!sel.size} onClick={()=>bulk(true)}>全部上架</button><button disabled={!sel.size} onClick={()=>bulk(false)}>全部下架</button>{sel.size>0&&<button onClick={()=>setSel(new Set())}>清除選取</button>}</div>}
  <div className="admin-list">{shown.map(p=><div key={p.id} className="admin-card">
   <div className="row">{admin&&<label className="select"><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggle(p.id)} aria-label={`選取 ${p.name}`}/></label>}<strong>{p.name}</strong><small>{p.spec}</small>{p.onSale&&<span className="tag ok">上架中</span>}</div>
   <small>{p.category}・庫存 {p.quantity} {p.unit}{!admin&&p.onSale?`・每日限量 ${p.dailyLimit||"不限"}・每筆上限 ${p.perOrderMax||"不限"}`:""}</small>
   {admin&&<div className="grid">
    <label>售價<input value={val(p,"price")} disabled={!admin} onChange={e=>set(p,"price",e.target.value)} inputMode="numeric"/></label>
    {admin&&<label>成本<input value={val(p,"cost")??""} onChange={e=>set(p,"cost",e.target.value)} inputMode="numeric"/></label>}
    <label>每日限量<input type="number" min={0} value={val(p,"dailyLimit")} disabled={!admin} onChange={e=>set(p,"dailyLimit",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label>每筆上限<input type="number" min={0} value={val(p,"perOrderMax")} disabled={!admin} onChange={e=>set(p,"perOrderMax",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label className="check"><input type="checkbox" checked={val(p,"onSale")} disabled={!admin} onChange={e=>set(p,"onSale",e.target.checked)}/> 顧客端上架</label>
   </div>}
   {admin&&edit[p.id]&&<div className="actions"><button className="primary" onClick={()=>save(p)}>儲存</button><button onClick={()=>setEdit(x=>{const n={...x};delete n[p.id];return n})}>取消</button></div>}
  </div>)}{!shown.length&&<p className="admin-hint">沒有符合的商品。</p>}</div></main>;
}
