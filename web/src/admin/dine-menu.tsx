import {useEffect,useState} from "react";
import {inventoryFetch} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import type {Me} from "../main";
type Item={id:string;category:string;name:string;description:string;price:number|null;priceNote:string;unit:string;badges:string[];imageUrl:string;market:boolean;active:boolean;sort:number};
type Cat={id:string;label:string};
export default function DineMenu({me}:{me:Me}){
 const admin=me.role==="admin";
 const [items,setItems]=useState<Item[]>([]),[cats,setCats]=useState<Cat[]>([]),[msg,setMsg]=useState(""),[edit,setEdit]=useState<Record<string,{imageUrl?:string;active?:boolean;price?:number|null}>>({}),[q,setQ]=useState("");
 const load=()=>inventoryFetch("/api/dine-menu").then(async r=>{if(!r.ok)return setMsg(await errorText(r));const d=await r.json();setItems(d.items);setCats(d.categories??[])});
 useEffect(()=>{load()},[]);
 const shown=items.filter(i=>(i.name+i.category).includes(q.trim()));
 const val=(i:Item)=>edit[i.id]??{};
 async function save(i:Item){
  const e=val(i);const r=await inventoryFetch(`/api/dine-menu/${i.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});
  if(r.ok){setMsg(`已儲存「${i.name}」`);setEdit(x=>{const n={...x};delete n[i.id];return n});load()}else setMsg(await errorText(r));
 }
 const catLabel=(id:string)=>cats.find(c=>c.id===id)?.label??id;
 return <main className="admin-page"><h1>餐點菜單</h1>
  <p className="admin-hint">這裡是「線上點餐」頁的菜單。照片可填網站路徑（例如 /seafood-stock-map/dine/xxx.webp）或 https 網址；沒有照片的品項在顧客端會顯示分類底圖，不會用假圖。時價品項顧客可以加入購物車，但不計入合計。{!admin&&"店員僅能查看；照片與上架由管理員管理。"}</p>
  {msg&&<p className="admin-msg" role="status">{msg}</p>}
  <div className="admin-filter"><input placeholder="搜尋餐點" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <div className="admin-list">{shown.map(i=><div key={i.id} className="admin-card">
   <div className="row"><strong>{i.name}</strong><small>{catLabel(i.category)}</small>{(val(i).active??i.active)?<span className="tag ok">上架中</span>:<span className="tag">已下架</span>}{i.market&&<span className="tag">時價</span>}</div>
   <small>{i.description||i.priceNote||"無說明"}・{i.market?"時價":`$${i.price}`} / {i.unit}</small>
   {i.imageUrl&&<div style={{marginTop:8}}><img src={i.imageUrl} alt="" width={72} height={72} style={{objectFit:"cover",borderRadius:8,background:"#eee"}}/></div>}
   {admin&&<div className="grid">
    <label>照片網址<input value={val(i).imageUrl??i.imageUrl} onChange={e=>setEdit(x=>({...x,[i.id]:{...x[i.id],imageUrl:e.target.value}}))} placeholder="/seafood-stock-map/dine/… 或 https://…"/></label>
    <label className="check"><input type="checkbox" checked={val(i).active??i.active} onChange={e=>setEdit(x=>({...x,[i.id]:{...x[i.id],active:e.target.checked}}))}/> 顧客端上架</label>
   </div>}
   {admin&&edit[i.id]&&<div className="actions"><button className="primary" onClick={()=>save(i)}>儲存</button><button onClick={()=>setEdit(x=>{const n={...x};delete n[i.id];return n})}>取消</button></div>}
  </div>)}{!shown.length&&<p className="admin-hint">沒有符合的餐點。</p>}</div>
 </main>;
}
