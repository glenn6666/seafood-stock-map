import {useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {loadApiOrigin,errorText,newKey} from "../lib/api-config";
import "./customer.css";
type M={id:string;name:string;spec:string;unit:string;category:string;price:string;available:number};
type O={orderNo:string;status:string;customerName:string;total:number;createdAt:string;items:{name:string;spec:string;unit:string;qty:number;unitPrice:number}[]};
const STEPS=["待處理","備貨中","可取貨","已完成"];
const tokenFromHash=()=>location.hash.match(/^#\/o\/([A-Za-z0-9_-]{20,64})$/)?.[1]??null;
function useOrigin(){const [o,setO]=useState<string|null>(null),[e,setE]=useState("");useEffect(()=>{loadApiOrigin().then(setO).catch(x=>setE(x.message))},[]);return [o,e] as const}
function App(){
 const [token,setTokenState]=useState(tokenFromHash());
 useEffect(()=>{const f=()=>setTokenState(tokenFromHash());addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f)},[]);
 const [origin,err]=useOrigin();
 return <main className="shop"><header><h1>安星水產</h1><p>{token?"訂單查詢":"線上訂購"}</p></header>
  {err&&<p className="err" role="alert">{err}</p>}{origin&&(token?<Lookup origin={origin} token={token}/>:<Shop origin={origin}/>)}</main>;
}
function Shop({origin}:{origin:string}){
 const [menu,setMenu]=useState<M[]|null>(null),[cart,setCart]=useState<Record<string,number>>({}),[cat,setCat]=useState("全部"),[f,setF]=useState({customerName:"",phone:"",note:""}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[checkout,setCheckout]=useState(false);
 const idem=useRef(newKey());
 const load=()=>fetch(origin+"/api/public/menu",{cache:"no-store",credentials:"omit"}).then(async r=>{if(!r.ok)throw new Error();setMenu((await r.json()).items)}).catch(()=>setMsg("目前無法讀取商品，請稍後再試。"));
 useEffect(()=>{load()},[]);
 const cats=useMemo(()=>["全部",...new Set((menu??[]).map(m=>m.category))],[menu]);
 const lines=(menu??[]).filter(m=>cart[m.id]>0);
 const total=lines.reduce((s,m)=>s+(parseInt(m.price.replace(/[^\d]/g,""))||0)*cart[m.id],0);
 const setQty=(m:M,n:number)=>setCart(c=>({...c,[m.id]:Math.max(0,Math.min(m.available,n))}));
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMsg("");
  try{const r=await fetch(origin+"/api/public/orders",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({...f,idempotencyKey:idem.current,items:lines.map(m=>({id:m.id,qty:cart[m.id]}))})});
   if(!r.ok){setMsg(await errorText(r,"送出失敗，請再試一次。"));if(r.status===409||r.status===400){idem.current=newKey();load()}return}
   const d=await r.json();location.hash=`#/o/${d.lookupToken}`;
  }catch{setMsg("連線中斷，請再按一次送出（不會重複下單）。")}finally{setBusy(false)}
 }
 if(!menu)return <p className="hint">{msg||"載入中…"}</p>;
 if(!menu.length)return <p className="hint">目前沒有開放訂購的商品。</p>;
 if(checkout)return <form className="card form" onSubmit={submit}><h2>確認訂單</h2>
  <ul className="lines">{lines.map(m=><li key={m.id}>{m.name} {m.spec} × {cart[m.id]}<span>${(parseInt(m.price)||0)*cart[m.id]}</span></li>)}</ul><p className="total">合計 ${total}</p>
  <label>姓名<input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})} required maxLength={40} autoComplete="name"/></label>
  <label>聯絡電話<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required inputMode="tel" autoComplete="tel" pattern="[0-9+\-\s]{6,20}"/></label>
  <label>備註（選填）<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})} maxLength={300}/></label>
  {msg&&<p className="err" role="alert">{msg}</p>}
  <button className="primary" disabled={busy}>{busy?"送出中…":"送出訂單"}</button><button type="button" onClick={()=>setCheckout(false)}>返回修改</button></form>;
 return <>
  <div className="cats">{cats.map(c=><button key={c} className={cat===c?"active":""} onClick={()=>setCat(c)}>{c}</button>)}</div>
  {msg&&<p className="err">{msg}</p>}
  <div className="menu">{menu.filter(m=>cat==="全部"||m.category===cat).map(m=><div key={m.id} className={"card item"+(m.available?"":" soldout")}>
   <div><strong>{m.name}</strong><small>{m.spec}</small><b>${m.price}</b><small>{m.available?`可訂 ${m.available} ${m.unit}`:"已售完"}</small></div>
   <div className="stepper"><button aria-label="減少" onClick={()=>setQty(m,(cart[m.id]??0)-1)} disabled={!cart[m.id]}>－</button><output>{cart[m.id]??0}</output><button aria-label="增加" onClick={()=>setQty(m,(cart[m.id]??0)+1)} disabled={(cart[m.id]??0)>=m.available}>＋</button></div>
  </div>)}</div>
  {lines.length>0&&<div className="cartbar"><span>{lines.length} 項・${total}</span><button className="primary" onClick={()=>setCheckout(true)}>下一步</button></div>}
 </>;
}
function Lookup({origin,token}:{origin:string;token:string}){
 const [o,setO]=useState<O|null>(null),[msg,setMsg]=useState("");
 const load=()=>fetch(`${origin}/api/public/orders/${token}`,{cache:"no-store",credentials:"omit"}).then(async r=>{if(r.status===404)return setMsg("查無此訂單，請確認連結是否完整。");if(!r.ok)throw new Error();setO((await r.json()).order)}).catch(()=>setMsg("目前無法查詢，請稍後再試。"));
 useEffect(()=>{load()},[token]);
 if(!o)return <p className="hint">{msg||"查詢中…"}</p>;
 const idx=STEPS.indexOf(o.status);
 return <section className="card"><h2>訂單 {o.orderNo}</h2><p>{o.customerName} 您好，目前狀態：<strong className="status">{o.status}</strong></p>
  {o.status!=="已取消"&&<ol className="steps">{STEPS.map((s,i)=><li key={s} className={i<=idx?"done":""}>{s}</li>)}</ol>}
  <ul className="lines">{o.items.map((l,i)=><li key={i}>{l.name} {l.spec} × {l.qty} {l.unit}<span>${l.unitPrice*l.qty}</span></li>)}</ul><p className="total">合計 ${o.total}</p>
  <p className="hint">請收藏或複製此頁網址，之後可隨時查詢訂單狀態。此連結僅供本人使用，請勿分享。</p>
  <button onClick={()=>{navigator.clipboard?.writeText(location.href)}}>複製查詢連結</button><button onClick={load}>重新整理狀態</button>
  <button onClick={()=>{location.hash=""}}>繼續訂購</button></section>;
}
createRoot(document.getElementById("root")!).render(<App/>);
