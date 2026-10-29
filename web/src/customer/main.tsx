import {lazy,Suspense,useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {loadApiOrigin,errorText,newKey} from "../lib/api-config";
import "./customer.css";
import "./comic.css";
import type {Coupon} from "./ShrimpGame";
type M={id:string;name:string;spec:string;unit:string;category:string;price:string;available:number;displayUnit:U|null};
type O={orderNo:string;status:string;customerName:string;total:number;subtotal?:number;discount?:number;createdAt:string;items:{name:string;spec:string;unit:string;qty:number;unitPrice:number}[]};
const STEPS=["待處理","備貨中","可取貨","已完成"];
const tokenFromHash=()=>location.hash.match(/^#\/o\/([A-Za-z0-9_-]{20,64})$/)?.[1]??null;
function useOrigin(){const [o,setO]=useState<string|null>(null),[e,setE]=useState("");useEffect(()=>{loadApiOrigin().then(setO).catch(x=>setE(x.message))},[]);return [o,e] as const}
function App(){
 const [token,setTokenState]=useState(tokenFromHash());
 useEffect(()=>{const f=()=>setTokenState(tokenFromHash());addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f)},[]);
 const [origin,err]=useOrigin();
 return <main className="shop comic"><header className="comic-hero"><img src={import.meta.env.BASE_URL+"comic/comic-market.webp"} alt="" width={1080} height={720} decoding="async"/><div><h1>安星水產</h1><p>{token?"訂單查詢":"線上訂購・逛逛店裡挑海鮮"}</p></div></header>
  {err&&<p className="err" role="alert">{err}</p>}{origin&&(token?<Lookup origin={origin} token={token}/>:<Shop origin={origin}/>)}</main>;
}
type U={id:string;name:string;type:"freezer"|"tank";kind?:string;area?:string};
const ShrimpGame=lazy(()=>import("./ShrimpGame"));
const KIND_ICON:Record<string,string>={fridge:"🧊",case:"🐟",dry:"🌰",cold:"❄️",shrimp:"🦐",ambient:"🐠"};
export const unitIcon=(u:{type:string;kind?:string})=>KIND_ICON[u.kind??""]??(u.type==="tank"?"🐟":"🧊");
const noDoor=(u?:{type:string;kind?:string}|null)=>!!u&&u.type==="freezer"&&(u.kind==="case"||u.kind==="dry");
const COUPON_KEY="shrimp-coupon";
const loadCoupon=():Coupon|null=>{try{const c=JSON.parse(localStorage.getItem(COUPON_KEY)??"null");return c&&new Date(c.expiresAt)>new Date()?c:null}catch{return null}};
const Scene3D=lazy(()=>import("./Scene3D"));
const canWebGL=()=>{try{const c=document.createElement("canvas");return !!(c.getContext("webgl2")||c.getContext("webgl"))}catch{return false}};
const reducedMotion=()=>matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const priceNum=(p:string)=>parseInt(p.replace(/[^\d]/g,""))||0;
function Shop({origin}:{origin:string}){
 const [menu,setMenu]=useState<M[]|null>(null),[units,setUnits]=useState<U[]>([]),[cart,setCart]=useState<Record<string,number>>({}),[cat,setCat]=useState("全部"),[f,setF]=useState({customerName:"",phone:"",note:""}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[checkout,setCheckout]=useState(false);
 const auto3d=useMemo(()=>canWebGL()&&!reducedMotion(),[]);
 const [mode,setMode]=useState<"3d"|"list">(()=>{const pref=localStorage.getItem("shop-view");return auto3d&&pref!=="list"?"3d":"list"});
 const [coupon,setCouponState]=useState<Coupon|null>(loadCoupon),[game,setGame]=useState(false);
 const setCoupon=(c:Coupon|null)=>{setCouponState(c);if(c)localStorage.setItem(COUPON_KEY,JSON.stringify(c));else localStorage.removeItem(COUPON_KEY)};
 const [focus,setFocus]=useState(-1),[sel,setSel]=useState<M|null>(null),[pick,setPick]=useState(1),[toast,setToast]=useState("");
 const idem=useRef(newKey());
 const load=()=>fetch(origin+"/api/public/menu",{cache:"no-store",credentials:"omit"}).then(async r=>{if(!r.ok)throw new Error();const d=await r.json();setMenu(d.items);setUnits(d.units??[])}).catch(()=>setMsg("目前無法讀取商品，請稍後再試。"));
 useEffect(()=>{load()},[]);
 const cats=useMemo(()=>["全部",...new Set((menu??[]).map(m=>m.category))],[menu]);
 const lines=(menu??[]).filter(m=>cart[m.id]>0);
 const subtotal=lines.reduce((s,m)=>s+priceNum(m.price)*cart[m.id],0),count=lines.reduce((s,m)=>s+cart[m.id],0);
 const couponOk=!!coupon&&subtotal>=coupon.minTotal,discount=couponOk?coupon!.discount:0,total=subtotal-discount;
 const setQty=(m:M,n:number)=>setCart(c=>({...c,[m.id]:Math.max(0,Math.min(m.available,n))}));
 const sceneUnits=useMemo(()=>{const used=units.filter(u=>(menu??[]).some(m=>m.displayUnit?.id===u.id));return used.length?used:units},[units,menu]);
 const switchMode=(m:"3d"|"list")=>{setMode(m);localStorage.setItem("shop-view",m);setSel(null)};
 function choose(m:M){setSel(m);setPick(Math.max(1,Math.min(m.available,cart[m.id]||1)))}
 function addToCart(){if(!sel)return;setQty(sel,pick);setToast(`已加入「${sel.name}」× ${pick}`);setSel(null);setTimeout(()=>setToast(""),1800)}
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMsg("");
  try{const r=await fetch(origin+"/api/public/orders",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({...f,idempotencyKey:idem.current,...(couponOk?{couponCode:coupon!.code}:{}),items:lines.map(m=>({id:m.id,qty:cart[m.id]}))})});
   if(!r.ok){const t=await errorText(r,"送出失敗，請再試一次。");setMsg(t);if(/優惠券(已使用|已過期|不存在)/.test(t))setCoupon(null);if(r.status===409||r.status===400||r.status===404){idem.current=newKey();load()}return}
   const d=await r.json();if(couponOk)setCoupon(null);location.hash=`#/o/${d.lookupToken}`;
  }catch{setMsg("連線中斷，請再按一次送出（不會重複下單）。")}finally{setBusy(false)}
 }
 if(!menu)return <p className="hint">{msg||"載入中…"}</p>;
 if(!menu.length)return <p className="hint">目前沒有開放訂購的商品。</p>;
 if(checkout)return <form className="card form" onSubmit={submit}><h2>購物車</h2>
  <ul className="lines">{lines.map(m=><li key={m.id}><span>{m.name} <small>{m.spec}</small></span><span className="cart-qty"><button type="button" aria-label="減少" onClick={()=>setQty(m,cart[m.id]-1)}>－</button>{cart[m.id]}<button type="button" aria-label="增加" disabled={cart[m.id]>=m.available} onClick={()=>setQty(m,cart[m.id]+1)}>＋</button></span><span>${priceNum(m.price)*cart[m.id]}</span></li>)}</ul>
  {coupon&&<p className={"coupon-line"+(couponOk?" ok":"")}>🎟 釣蝦優惠券：{couponOk?`已套用，折 NT$${coupon.discount}`:`再買 NT$${coupon.minTotal-subtotal} 即可折 NT$${coupon.discount}`}</p>}
  {discount>0&&<p className="subtotal">小計 ${subtotal}・折抵 −${discount}</p>}<p className="total">合計 ${total}</p>
  {!lines.length&&<p className="hint">購物車是空的。</p>}
  <label>姓名<input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})} required maxLength={40} autoComplete="name"/></label>
  <label>聯絡電話<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required inputMode="tel" autoComplete="tel" pattern="[0-9+\-\s]{6,20}"/></label>
  <label>備註（選填）<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})} maxLength={300}/></label>
  {msg&&<p className="err" role="alert">{msg}</p>}
  <button className="primary" disabled={busy||!lines.length}>{busy?"送出中…":"送出訂單"}</button><button type="button" onClick={()=>setCheckout(false)}>繼續選購</button></form>;
 const unitName=focus>=0?sceneUnits[focus]?.name:null,unitType=focus>=0?sceneUnits[focus]?.type:null;
 return <>
  <button className="game-banner" onClick={()=>setGame(true)}><span>🦐</span><b>安星釣蝦場</b><small>{coupon?`已有優惠券：滿 ${coupon.minTotal} 折 ${coupon.discount}`:"抓蝦／螃蟹／龍蝦，過關贏滿 NT$1,000 折 NT$5"}</small></button>
  <div className="view-toggle" role="group" aria-label="瀏覽方式">{auto3d&&<button className={mode==="3d"?"active":""} onClick={()=>switchMode("3d")}>🧊 3D 逛店</button>}<button className={mode==="list"?"active":""} onClick={()=>switchMode("list")}>☰ 列表</button></div>
  {mode==="3d"?<section className="stage">
   <div className="unit-chips">{[{id:"all",name:"全部"},...sceneUnits].map((u,i)=><button key={u.id} className={focus===i-1?"active":""} onClick={()=>setFocus(i-1)}>{"type" in u?unitIcon(u)+" ":""}{u.name}</button>)}</div>
   <Suspense fallback={<div className="stage-loading">正在擺設店面…</div>}>
    <Scene3D items={menu} units={sceneUnits} focus={focus} selectedId={sel?.id??null} onSelect={choose} onFocus={setFocus} onError={()=>{setMode("list");setMsg("此裝置無法顯示 3D，已切換為列表。")}}/>
   </Suspense>
   <p className="stage-hint">{focus<0?"點冰箱或魚缸靠近看看，左右滑動切換":unitType==="tank"?`${unitName}：點游動的海鮮挑選`:noDoor(sceneUnits[focus])?`${unitName}：點商品挑選`:`${unitName}：點門打開，再點商品`}</p>
   {focus>=0&&<div className="stage-nav"><button aria-label="上一個" onClick={()=>setFocus(Math.max(-1,focus-1))}>‹</button><button onClick={()=>setFocus(-1)}>總覽</button><button aria-label="下一個" disabled={focus>=sceneUnits.length-1} onClick={()=>setFocus(Math.min(sceneUnits.length-1,focus+1))}>›</button></div>}
  </section>:<>
   <div className="cats">{cats.map(c=><button key={c} className={cat===c?"active":""} onClick={()=>setCat(c)}>{c}</button>)}</div>
   <div className="menu">{menu.filter(m=>cat==="全部"||m.category===cat).map(m=><div key={m.id} className={"card item"+(m.available?"":" soldout")}>
    <div><strong>{m.name}</strong><small>{m.spec}</small><b>${m.price}</b><small>{m.available?`可訂 ${m.available} ${m.unit}`:"已售完"}</small></div>
    <div className="stepper"><button aria-label="減少" onClick={()=>setQty(m,(cart[m.id]??0)-1)} disabled={!cart[m.id]}>－</button><output>{cart[m.id]??0}</output><button aria-label="增加" onClick={()=>setQty(m,(cart[m.id]??0)+1)} disabled={(cart[m.id]??0)>=m.available}>＋</button></div>
   </div>)}</div></>}
  {msg&&<p className="err">{msg}</p>}
  {toast&&<p className="toast" role="status">{toast}</p>}
  {sel&&<div className="sheet-backdrop" onClick={()=>setSel(null)}><div className="sheet" role="dialog" aria-label={sel.name} onClick={e=>e.stopPropagation()}>
   <div className="sheet-grab"/><span className="sheet-tag">{sel.displayUnit?unitIcon(sel.displayUnit)+" "+sel.displayUnit.name:""}・{sel.category}</span>
   <h2>{sel.name}</h2><p className="sheet-spec">{sel.spec}</p>
   <p className="sheet-price">${sel.price}<small> / {sel.unit}</small></p>
   <p className="sheet-avail">{sel.available>0?`可訂 ${sel.available} ${sel.unit}`:"已售完，請挑選其他商品"}</p>
   {sel.available>0&&<div className="sheet-row"><div className="stepper big"><button aria-label="減少" disabled={pick<=1} onClick={()=>setPick(pick-1)}>－</button><output>{pick}</output><button aria-label="增加" disabled={pick>=sel.available} onClick={()=>setPick(pick+1)}>＋</button></div><button className="primary grow" onClick={addToCart}>加入購物車・${priceNum(sel.price)*pick}</button></div>}
   <button className="sheet-close" onClick={()=>setSel(null)}>關閉</button></div></div>}
  {game&&<Suspense fallback={null}><ShrimpGame origin={origin} onClose={()=>setGame(false)} onCoupon={c=>setCoupon(c)}/></Suspense>}
  {lines.length>0&&<div className="cartbar"><span>🛒 {count} 件・${total}{discount>0?"（已折 5）":""}</span><button className="primary" onClick={()=>{setSel(null);setCheckout(true)}}>查看購物車</button></div>}
 </>;
}
function Lookup({origin,token}:{origin:string;token:string}){
 const [o,setO]=useState<O|null>(null),[msg,setMsg]=useState("");
 const load=()=>fetch(`${origin}/api/public/orders/${token}`,{cache:"no-store",credentials:"omit"}).then(async r=>{if(r.status===404)return setMsg("查無此訂單，請確認連結是否完整。");if(r.status===429)return setMsg((await r.json()).error);if(!r.ok)throw new Error();setO((await r.json()).order)}).catch(()=>setMsg("目前無法查詢，請稍後再試。"));
 useEffect(()=>{load()},[token]);
 if(!o)return <p className="hint">{msg||"查詢中…"}</p>;
 const idx=STEPS.indexOf(o.status);
 return <section className="card"><h2>訂單 {o.orderNo}</h2><p>{o.customerName} 您好，目前狀態：<strong className="status">{o.status}</strong></p>
  {o.status!=="已取消"&&<ol className="steps">{STEPS.map((s,i)=><li key={s} className={i<=idx?"done":""}>{s}</li>)}</ol>}
  <ul className="lines">{o.items.map((l,i)=><li key={i}>{l.name} {l.spec} × {l.qty} {l.unit}<span>${l.unitPrice*l.qty}</span></li>)}</ul>{(o.discount??0)>0&&<p className="subtotal">小計 ${o.subtotal}・釣蝦優惠券 −${o.discount}</p>}<p className="total">合計 ${o.total}</p>
  <p className="hint">請收藏或複製此頁網址，之後可隨時查詢訂單狀態。此連結僅供本人使用，請勿分享。</p>
  <button onClick={()=>{navigator.clipboard?.writeText(location.href)}}>複製查詢連結</button><button onClick={load}>重新整理狀態</button>
  <button onClick={()=>{location.hash=""}}>繼續訂購</button></section>;
}
createRoot(document.getElementById("root")!).render(<App/>);
