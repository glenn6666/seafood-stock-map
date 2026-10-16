import {useEffect,useMemo,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import type {Me} from "../main";
type P={id:string;zone:string;name:string;spec:string;unit:string;category:string;price:string;cost?:string;quantity:number;onSale:boolean;dailyLimit:number;perOrderMax:number};
export default function Products({me}:{me:Me}){
 const admin=me.role==="admin";
 const [items,setItems]=useState<P[]>([]),[q,setQ]=useState(""),[onlySale,setOnlySale]=useState(false),[msg,setMsg]=useState(""),[edit,setEdit]=useState<Record<string,Partial<P>>>({});
 const load=()=>inventoryFetch("/api/products").then(async r=>r.ok?setItems((await r.json()).items):setMsg(await errorText(r)));
 useEffect(()=>{load()},[]);
 const shown=useMemo(()=>items.filter(i=>(!onlySale||i.onSale)&&(i.name+i.spec+i.category).includes(q.trim())),[items,q,onlySale]);
 async function save(p:P){
  const e=edit[p.id];if(!e)return;
  const r=await inventoryFetch(`/api/products/${encodeURIComponent(p.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});
  if(r.ok){setMsg(`已儲存「${p.name}」`);setEdit(x=>{const n={...x};delete n[p.id];return n});load()}else setMsg(await errorText(r));
 }
 const val=<K extends keyof P>(p:P,k:K)=>(edit[p.id]?.[k]??p[k]) as P[K];
 const set=(p:P,k:keyof P,v:unknown)=>setEdit(x=>({...x,[p.id]:{...x[p.id],[k]:v}}));
 return <main className="admin-page"><h1>商品販售設定</h1>
  <p className="admin-hint">只有「上架」的商品會出現在顧客訂購頁；新欄位預設皆未上架。每日限量、每筆上限填 0 代表不限。{!admin&&"店員僅能查看，不能修改售價或販售設定。"}只列出已在庫存地圖儲存過的商品。</p>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  <div className="admin-filter"><input placeholder="搜尋商品" value={q} onChange={e=>setQ(e.target.value)}/><label><input type="checkbox" checked={onlySale} onChange={e=>setOnlySale(e.target.checked)}/> 只看上架</label></div>
  <div className="admin-list">{shown.map(p=><div key={p.id} className="admin-card">
   <div className="row"><strong>{p.name}</strong><small>{p.spec}</small>{p.onSale&&<span className="tag ok">上架中</span>}</div>
   <small>{p.category}・庫存 {p.quantity} {p.unit}</small>
   <div className="grid">
    <label>售價<input value={val(p,"price")} disabled={!admin} onChange={e=>set(p,"price",e.target.value)} inputMode="numeric"/></label>
    {admin&&<label>成本<input value={val(p,"cost")??""} onChange={e=>set(p,"cost",e.target.value)} inputMode="numeric"/></label>}
    <label>每日限量<input type="number" min={0} value={val(p,"dailyLimit")} disabled={!admin} onChange={e=>set(p,"dailyLimit",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label>每筆上限<input type="number" min={0} value={val(p,"perOrderMax")} disabled={!admin} onChange={e=>set(p,"perOrderMax",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label className="check"><input type="checkbox" checked={val(p,"onSale")} disabled={!admin} onChange={e=>set(p,"onSale",e.target.checked)}/> 顧客端上架</label>
   </div>
   {admin&&edit[p.id]&&<div className="actions"><button className="primary" onClick={()=>save(p)}>儲存</button><button onClick={()=>setEdit(x=>{const n={...x};delete n[p.id];return n})}>取消</button></div>}
  </div>)}{!shown.length&&<p className="admin-hint">沒有符合的商品。</p>}</div></main>;
}
