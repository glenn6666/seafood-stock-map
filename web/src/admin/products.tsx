import {useEffect,useMemo,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import type {Me} from "../main";
type P={id:string;zone:string;name:string;spec:string;unit:string;category:string;price:string;cost?:string;costNum?:number|null;costUnparsed?:boolean;quantity:number;onSale:boolean;dailyLimit:number;perOrderMax:number;displayZone:string;displayUnitId:string|null};
type DU={id:string;name:string;type:"freezer"|"tank";sort:number;active:boolean;kind?:string;area?:string};
export default function Products({me}:{me:Me}){
 const admin=me.role==="admin";
 const [items,setItems]=useState<P[]>([]),[q,setQ]=useState(""),[onlySale,setOnlySale]=useState(false),[msg,setMsg]=useState(""),[edit,setEdit]=useState<Record<string,Partial<P>>>({}),[sel,setSel]=useState<Set<string>>(new Set());
 const [units,setUnits]=useState<DU[]>([]);
 const load=()=>inventoryFetch("/api/products").then(async r=>{if(!r.ok)return setMsg(await errorText(r));const d=await r.json();setItems(d.items);setUnits(d.units??[])});
 const unitName=(id:string|null)=>units.find(u=>u.id===id)?.name??"未分配";
 async function patchUnit(u:DU,body:object){const r=await inventoryFetch(`/api/display-units/${u.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});setMsg(r.ok?`已更新展示櫃「${u.name}」`:await errorText(r));load()}
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
  <details className="admin-card"><summary><strong>顧客端 3D 展示櫃</strong>（只影響訂購頁的展示分組，與實際儲位無關，顧客看不到實際儲位）</summary>
   <div className="admin-list">{units.map(u=><div key={u.id} className="row unit-row"><span>{u.area?u.area+"｜":""}{({fridge:"🧊 冷藏櫃",case:"🐟 展示櫃",dry:"🌰 乾貨區",cold:"❄️ 低溫缸",shrimp:"🦐 泰國蝦缸",ambient:"🐠 常溫缸"} as Record<string,string>)[u.kind??""]??(u.type==="tank"?"🐟 魚缸":"🧊 冷凍冰箱")}</span>
    {admin?<><input defaultValue={u.name} aria-label={`${u.id} 名稱`} onBlur={e=>e.target.value.trim()&&e.target.value!==u.name&&patchUnit(u,{name:e.target.value})}/><label className="check"><input type="checkbox" checked={u.active} onChange={e=>patchUnit(u,{active:e.target.checked})}/> 顯示</label></>:<strong>{u.name}{u.active?"":"（停用）"}</strong>}
   </div>)}</div>
   <p className="admin-hint">「自動」：分類含「活」→魚缸；肉品→肉品冷凍櫃；海鮮→海鮮冷凍櫃；其他→火鍋料・熟食冷凍櫃。</p></details>
  <div className="admin-filter"><input placeholder="搜尋商品" value={q} onChange={e=>setQ(e.target.value)}/><label><input type="checkbox" checked={onlySale} onChange={e=>setOnlySale(e.target.checked)}/> 只看上架</label></div>
  {admin&&items.some(p=>p.costUnparsed)&&<p className="admin-msg warn" role="status">有 {items.filter(p=>p.costUnparsed).length} 項商品的舊成本無法自動轉成數字（例如含單位或區間），記帳匯出時不會計入成本，請逐項重新輸入。</p>}
  {admin&&<div className="bulk-bar"><label className="select"><input type="checkbox" checked={allShown} onChange={()=>setSel(s=>{const n=new Set(s);shown.forEach(p=>allShown?n.delete(p.id):n.add(p.id));return n})}/> 全選目前列表</label><span>已選 {sel.size} 項</span><button className="primary" disabled={!sel.size} onClick={()=>bulk(true)}>全部上架</button><button disabled={!sel.size} onClick={()=>bulk(false)}>全部下架</button>{sel.size>0&&<button onClick={()=>setSel(new Set())}>清除選取</button>}</div>}
  <div className="admin-list">{shown.map(p=><div key={p.id} className="admin-card">
   <div className="row">{admin&&<label className="select"><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggle(p.id)} aria-label={`選取 ${p.name}`}/></label>}<strong>{p.name}</strong><small>{p.spec}</small>{p.onSale&&<span className="tag ok">上架中</span>}{admin&&p.costUnparsed&&<span className="tag warn">成本待確認</span>}</div>
   <small>{p.category}・庫存 {p.quantity} {p.unit}・展示：{unitName(p.displayUnitId)}{p.displayZone?"":"（自動）"}{!admin&&p.onSale?`・每日限量 ${p.dailyLimit||"不限"}・每筆上限 ${p.perOrderMax||"不限"}`:""}</small>
   {admin&&<div className="grid">
    <label>售價<input value={val(p,"price")} disabled={!admin} onChange={e=>set(p,"price",e.target.value)} inputMode="numeric"/></label>
    {admin&&<label>成本（每{p.unit||"單位"}，整數）<input type="number" min={0} step={1} value={val(p,"costNum")??""} onChange={e=>set(p,"costNum",e.target.value===""?null:Math.max(0,Math.floor(Number(e.target.value))||0))}/>{p.costUnparsed&&<small className="tag warn" data-testid="cost-unparsed">舊成本「{p.cost}」無法判讀，請重新輸入</small>}</label>}
    <label>每日限量<input type="number" min={0} value={val(p,"dailyLimit")} disabled={!admin} onChange={e=>set(p,"dailyLimit",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label>每筆上限<input type="number" min={0} value={val(p,"perOrderMax")} disabled={!admin} onChange={e=>set(p,"perOrderMax",Math.max(0,parseInt(e.target.value)||0))}/></label>
    <label className="check"><input type="checkbox" checked={val(p,"onSale")} disabled={!admin} onChange={e=>set(p,"onSale",e.target.checked)}/> 顧客端上架</label>
    <label>顧客端展示櫃<select value={val(p,"displayZone")} onChange={e=>set(p,"displayZone",e.target.value)}><option value="">自動（依分類）</option>{units.map(u=><option key={u.id} value={u.id}>{u.type==="tank"?"🐟":"🧊"} {u.name}{u.active?"":"（停用）"}</option>)}</select></label>
   </div>}
   {admin&&edit[p.id]&&<div className="actions"><button className="primary" onClick={()=>save(p)}>儲存</button><button onClick={()=>setEdit(x=>{const n={...x};delete n[p.id];return n})}>取消</button></div>}
  </div>)}{!shown.length&&<p className="admin-hint">沒有符合的商品。</p>}</div></main>;
}
