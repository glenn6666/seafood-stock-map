import {lazy,Suspense,useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {loadApiOrigin,errorText,newKey} from "../lib/api-config";
import "./customer.css";
import "./comic.css";
import "./catalog.css";
import type {Coupon} from "./ShrimpGame";
import ShopMap,{LIVE} from "./ShopMap";
import {GROUPS,UNIT_BLURB,groupOf,inGroupUnits,type GroupId} from "./shop-groups";
type M={id:string;name:string;spec:string;unit:string;category:string;price:string;available:number;displayUnit:U|null};
type O={orderNo:string;status:string;customerName:string;total:number;subtotal?:number;discount?:number;createdAt:string;items:{name:string;spec:string;unit:string;qty:number;unitPrice:number}[]};
const STEPS=["待處理","備貨中","可取貨","已完成"];
const tokenFromHash=()=>location.hash.match(/^#\/o\/([A-Za-z0-9_-]{20,64})$/)?.[1]??null;
function useOrigin(){const [o,setO]=useState<string|null>(null),[e,setE]=useState("");useEffect(()=>{loadApiOrigin().then(setO).catch(x=>setE(x.message))},[]);return [o,e] as const}
function App(){
 const [token,setTokenState]=useState(tokenFromHash());
 useEffect(()=>{const f=()=>setTokenState(tokenFromHash());addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f)},[]);
 const [origin,err]=useOrigin();
 return <main className={"shop comic"+(token?"":" shop-home")}>{token&&<header className="comic-hero"><img src={import.meta.env.BASE_URL+"comic/comic-market.webp?v=3"} alt="" width={1080} height={720} decoding="async"/><div><h1>安星水產</h1><p>{token?"訂單查詢":"線上訂購・逛逛店裡挑海鮮"}</p></div></header>}{!token&&!origin&&<p className="hint">{err?"":"載入中…"}</p>}
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
/** 3D 逛店預設隱藏（程式保留）。加 ?3d=1 或測試用 ?e2e 才顯示入口。 */
const show3dWalk=()=>{try{const q=new URLSearchParams(location.search);return q.has("3d")||q.has("e2e")}catch{return false}};
function panelHeading(zone:string|null,group:GroupId,zoneNames:Record<string,string>,units:U[]){
 const u=zone&&zone!=="live"?units.find(x=>x.id===zone):undefined;
 if(u)return {title:`${u.area?`${u.area}｜`:""}${u.name}`,blurb:UNIT_BLURB[u.id]??"",zoneLabel:u.name};
 if(zone==="live"||group==="live")return {title:`06｜${zoneNames.live??"活鮮水產"}`,blurb:UNIT_BLURB.live,zoneLabel:zoneNames.live};
 if(group==="dry")return {title:"07｜乾貨醬料",blurb:"乾貨、醬料與南北貨。",zoneLabel:""};
 if(group==="chilled")return {title:"冷藏・冷凍",blurb:"冰箱與冰櫃裡的海鮮、肉品與火鍋料。",zoneLabel:""};
 return {title:"全部商品",blurb:"店裡現在開放訂購的海味，分類找或直接搜尋品名。",zoneLabel:""};
}
function Shop({origin}:{origin:string}){
 const [menu,setMenu]=useState<M[]|null>(null),[units,setUnits]=useState<U[]>([]),[cart,setCart]=useState<Record<string,number>>({}),[group,setGroup]=useState<GroupId>("all"),[query,setQuery]=useState(""),[f,setF]=useState({customerName:"",phone:"",note:""}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[checkout,setCheckout]=useState(false);
 const [tab,setTab]=useState<"browse"|"catalog">("catalog");
 const allow3d=useMemo(()=>show3dWalk(),[]);
 const auto3d=useMemo(()=>allow3d&&canWebGL()&&!reducedMotion(),[allow3d]);
 const [mode,setMode]=useState<"3d"|"list">(()=>{const pref=localStorage.getItem("shop-view");return allow3d&&canWebGL()&&!reducedMotion()&&pref!=="list"?"3d":"list"});
 const [coupon,setCouponState]=useState<Coupon|null>(loadCoupon),[game,setGame]=useState(false);
 const setCoupon=(c:Coupon|null)=>{setCouponState(c);if(c)localStorage.setItem(COUPON_KEY,JSON.stringify(c));else localStorage.removeItem(COUPON_KEY)};
 const [focus,setFocus]=useState(-1),[sel,setSel]=useState<M|null>(null),[pick,setPick]=useState(1),[toast,setToast]=useState("");
 const [zone,setZone]=useState<string|null>(null),listRef=useRef<HTMLDivElement>(null);
 const idem=useRef(newKey());
 const load=()=>fetch(origin+"/api/public/menu",{cache:"no-store",credentials:"omit"}).then(async r=>{if(!r.ok)throw new Error();const d=await r.json();setMenu(d.items);setUnits(d.units??[])}).catch(()=>setMsg("目前無法讀取商品，請稍後再試。"));
 useEffect(()=>{load()},[]);
 const lines=(menu??[]).filter(m=>cart[m.id]>0);
 const subtotal=lines.reduce((s,m)=>s+priceNum(m.price)*cart[m.id],0),count=lines.reduce((s,m)=>s+cart[m.id],0);
 const couponOk=!!coupon&&subtotal>=coupon.minTotal,discount=couponOk?coupon!.discount:0,total=subtotal-discount;
 const setQty=(m:M,n:number)=>setCart(c=>({...c,[m.id]:Math.max(0,Math.min(m.available,n))}));
 const sceneUnits=useMemo(()=>{const used=units.filter(u=>(menu??[]).some(m=>m.displayUnit?.id===u.id));return used.length?used:units},[units,menu]);
 const switchMode=(m:"3d"|"list")=>{setMode(m);localStorage.setItem("shop-view",m);setSel(null)};
 function choose(m:M){setSel(m);setPick(Math.max(1,Math.min(m.available,cart[m.id]||1)))}
 function addToCart(){if(!sel)return;setQty(sel,pick);setToast(`已加入「${sel.name}」× ${pick}`);setSel(null);setTimeout(()=>setToast(""),1800)}
 function addOne(m:M){if(!m.available)return;setQty(m,(cart[m.id]??0)+1);setToast(`已加入「${m.name}」`);setTimeout(()=>setToast(""),1800)}
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMsg("");
  try{const r=await fetch(origin+"/api/public/orders",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({...f,idempotencyKey:idem.current,...(couponOk?{couponCode:coupon!.code}:{}),items:lines.map(m=>({id:m.id,qty:cart[m.id]}))})});
   if(!r.ok){const t=await errorText(r,"送出失敗，請再試一次。");setMsg(t);if(/優惠券(已使用|已過期|不存在)/.test(t))setCoupon(null);if(r.status===409||r.status===400||r.status===404){idem.current=newKey();load()}return}
   const d=await r.json();if(couponOk)setCoupon(null);location.hash=`#/o/${d.lookupToken}`;
  }catch{setMsg("連線中斷，請再按一次送出（不會重複下單）。")}finally{setBusy(false)}
 }
 const zoneNames=Object.fromEntries(units.map(u=>[u.id,u.name])),zoneCounts:Record<string,number>={};
 for(const u of units)zoneCounts[u.id]=(menu??[]).filter(m=>m.displayUnit?.id===u.id).length;
 zoneNames.live="活鮮（三個魚缸）";zoneCounts.live=LIVE.reduce((s,id)=>s+(zoneCounts[id]??0),0);
 const inZone=(m:M)=>!zone||(zone==="live"?LIVE.includes(m.displayUnit?.id??""):m.displayUnit?.id===zone);
 function pickZone(id:string){
  if(id==="all"){setZone(null);setFocus(-1);setGroup("all");setCheckout(false);setTab("catalog");setTimeout(()=>listRef.current?.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"}),50);return}
  if(!menu?.length){setToast("目前沒有開放訂購的商品");setTimeout(()=>setToast(""),1800);return}
  if(!zoneCounts[id]){setToast(`「${zoneNames[id]??id}」目前沒有商品`);setTimeout(()=>setToast(""),1800);return}
  setCheckout(false);setSel(null);setTab("catalog");
  if(id==="live")setGroup("live");
  else{const u=units.find(x=>x.id===id);if(u)setGroup(groupOf({displayUnit:u}))}
  const i=id==="live"?sceneUnits.findIndex(u=>LIVE.includes(u.id)&&zoneCounts[u.id]>0):sceneUnits.findIndex(u=>u.id===id);
  if(mode==="3d"&&i>=0){setZone(id);setFocus(i)}else{setZone(id);if(mode!=="list")switchMode("list")}
  setTimeout(()=>listRef.current?.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"}),50);
 }
 const openCheckout=()=>{if(lines.length){setSel(null);setCheckout(true);setTab("catalog")}else{setToast("購物車是空的，先點店裡的櫃子挑商品");setTimeout(()=>setToast(""),1800)}};
 const map=<ShopMap onList={()=>pickZone("all")} names={zoneNames} counts={zoneCounts} active={zone} onZone={pickZone} onGame={()=>setGame(true)} onCounter={openCheckout} subtitle="點店面圖挑分類・右上釣蝦池玩遊戲"/>;
 const gameEl=game&&<Suspense fallback={null}><ShrimpGame origin={origin} onClose={()=>setGame(false)} onCoupon={c=>setCoupon(c)}/></Suspense>;
 const toastEl=toast&&<p className="toast" role="status">{toast}</p>;
 const q=query.trim();
 const groupRank=(g:ReturnType<typeof groupOf>)=>({live:0,chilled:1,dry:2}[g]??9);
 const unitIdx=(id?:string)=>{const i=units.findIndex(u=>u.id===id);return i<0?99:i};
 const shown=(menu??[]).filter(m=>(group==="all"||groupOf(m)===group)&&inZone(m)&&(!q||`${m.name}${m.spec}${m.category}`.includes(q)))
  .sort((a,b)=>{const rg=groupRank(groupOf(a))-groupRank(groupOf(b));if(rg)return rg;const ru=unitIdx(a.displayUnit?.id)-unitIdx(b.displayUnit?.id);if(ru)return ru;return a.name.localeCompare(b.name,"zh-Hant")});
 const siblingGroup:GroupId|null=group!=="all"?group:zone==="live"?"live":zone?groupOf({displayUnit:units.find(x=>x.id===zone)}):null;
 const subUnits=siblingGroup?units.filter(u=>inGroupUnits(siblingGroup,u)):[];
 const heading=panelHeading(zone,group,zoneNames,units);
 const liveOn=group==="live"||zone==="live"||LIVE.includes(zone??"");
 const dock=<nav className="shop-dock" aria-label="購物選單">
  <button type="button" className={tab==="browse"&&!checkout?"on":""} onClick={()=>{setCheckout(false);setTab("browse")}}><span aria-hidden>🏪</span>逛店</button>
  <button type="button" className={tab==="catalog"&&!checkout&&!liveOn?"on":""} onClick={()=>{setCheckout(false);setTab("catalog");setGroup("all");setZone(null);setFocus(-1)}}><span aria-hidden>🛍️</span>全部商品</button>
  <button type="button" className={tab==="catalog"&&!checkout&&liveOn?"on":""} onClick={()=>pickZone("live")}><span aria-hidden>🐟</span>活鮮</button>
  <button type="button" className="nav-game" onClick={()=>setGame(true)}><span aria-hidden>🦐</span>釣蝦</button>
  <button type="button" className={checkout?"on":""} onClick={openCheckout}><span aria-hidden>🛒</span>結帳{count>0&&<i className="dock-badge">{count}</i>}</button>
 </nav>;
 const sheet=sel&&<div className="sheet-backdrop" onClick={()=>setSel(null)}><div className="sheet" role="dialog" aria-label={sel.name} onClick={e=>e.stopPropagation()}>
   <div className="sheet-grab"/><span className="sheet-tag">{sel.displayUnit?unitIcon(sel.displayUnit)+" "+sel.displayUnit.name:""}・{sel.category}</span>
   <h2>{sel.name}</h2><p className="sheet-spec">{sel.spec}</p>
   <p className="sheet-price">${sel.price}<small> / {sel.unit}</small></p>
   <p className="sheet-avail">{sel.available>0?`可訂 ${sel.available} ${sel.unit}`:"已售完，請挑選其他商品"}</p>
   {sel.available>0&&<div className="sheet-row"><div className="stepper big"><button aria-label="減少" disabled={pick<=1} onClick={()=>setPick(pick-1)}>－</button><output>{pick}</output><button aria-label="增加" disabled={pick>=sel.available} onClick={()=>setPick(pick+1)}>＋</button></div><button className="primary grow" onClick={addToCart}>加入購物車・${priceNum(sel.price)*pick}</button></div>}
   <button className="sheet-close" onClick={()=>setSel(null)}>關閉</button></div></div>;
 const filters=<>
   <div ref={listRef}/>
   <div className={zone?"panel-title zone-filter":"panel-title"}>
    <h2>{heading.title}</h2>
    {heading.blurb&&<p className="panel-blurb">{heading.blurb}</p>}
    {zone&&<button type="button" className="clear-zone" onClick={()=>{setZone(null);if(group==="live")setGroup("live")}}>顯示全部</button>}
   </div>
   <div className="cats">{GROUPS.map(g=><button key={g.id} type="button" className={group===g.id?"active":""} onClick={()=>{setGroup(g.id);setCheckout(false);setTab("catalog");setZone(g.id==="live"?"live":null);setFocus(-1)}}>{g.label}</button>)}</div>
   <label className="shop-search"><span aria-hidden>🔍</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="找海味 搜尋品名" enterKeyHint="search" autoComplete="off"/></label>
   {subUnits.length>1&&<div className="unit-tabs" role="tablist" aria-label="櫃子">{subUnits.map(u=><button key={u.id} type="button" role="tab" aria-selected={zone===u.id} className={zone===u.id?"active":""} onClick={()=>pickZone(u.id)}>{u.name}</button>)}</div>}
   {coupon&&<button className="game-banner" type="button" onClick={()=>setGame(true)}><span>🦐</span><b>樂甜釣蝦場</b><small>{`已有優惠券：滿 ${coupon.minTotal} 折 ${coupon.discount}`}</small></button>}
 </>;
 const itemCard=(m:M)=><div key={m.id} className={"card item"+(m.available?"":" soldout")}>
   <div className="item-thumb" data-kind={m.displayUnit?.kind||(m.displayUnit?.type==="tank"?"cold":"fridge")} aria-hidden>{unitIcon(m.displayUnit??{type:"freezer"})}</div>
   <div className="item-main">
    {m.displayUnit&&<span className="item-area">{m.displayUnit.name}</span>}
    <strong onClick={()=>choose(m)}>{m.name}</strong>
    {m.spec?<p className="spec">{m.spec}</p>:null}
    <div className="item-foot">
     <div className="item-meta">
      <span className="avail">{m.available?`可訂 ${m.available} ${m.unit}`:"已售完"}</span>
      <b className="price">NT$ {priceNum(m.price).toLocaleString("en-US")}</b>
     </div>
     {cart[m.id]>0?<div className="stepper"><button aria-label="減少" onClick={()=>setQty(m,cart[m.id]-1)}>－</button><output>{cart[m.id]}</output><button aria-label="增加" onClick={()=>setQty(m,cart[m.id]+1)} disabled={cart[m.id]>=m.available}>＋</button></div>
      :<button type="button" className="item-add" aria-label="增加" disabled={!m.available} onClick={()=>addOne(m)}>＋加入</button>}
    </div>
   </div>
  </div>;
 const listBody=!menu?<p className="hint">{msg||"載入中…"}</p>
  :!menu.length?<><p className="hint">目前沒有開放訂購的商品，仍可先玩釣蝦遊戲拿優惠券。</p><button className="game-banner" onClick={()=>setGame(true)}><span>🦐</span><b>樂甜釣蝦場</b><small>抓蝦／螃蟹／龍蝦，過關贏滿 NT$1,000 折 NT$5</small></button></>
  :checkout?<form className="card form" onSubmit={submit}><h2>購物車</h2>
  <ul className="lines">{lines.map(m=><li key={m.id}><span>{m.name} <small>{m.spec}</small></span><span className="cart-qty"><button type="button" aria-label="減少" onClick={()=>setQty(m,cart[m.id]-1)}>－</button>{cart[m.id]}<button type="button" aria-label="增加" disabled={cart[m.id]>=m.available} onClick={()=>setQty(m,cart[m.id]+1)}>＋</button></span><span>${priceNum(m.price)*cart[m.id]}</span></li>)}</ul>
  {coupon&&<p className={"coupon-line"+(couponOk?" ok":"")}>🎟 釣蝦優惠券：{couponOk?`已套用，折 NT$${coupon.discount}`:`再買 NT$${coupon.minTotal-subtotal} 即可折 NT$${coupon.discount}`}</p>}
  {discount>0&&<p className="subtotal">小計 ${subtotal}・折抵 −${discount}</p>}<p className="total">合計 ${total}</p>
  {!lines.length&&<p className="hint">購物車是空的。</p>}
  <label>姓名<input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})} required maxLength={40} autoComplete="name"/></label>
  <label>聯絡電話<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required inputMode="tel" autoComplete="tel" pattern="[0-9+\-\s]{6,20}"/></label>
  <label>備註（選填）<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})} maxLength={300}/></label>
  {msg&&<p className="err" role="alert">{msg}</p>}
  <button className="primary" disabled={busy||!lines.length}>{busy?"送出中…":"送出訂單"}</button><button type="button" onClick={()=>setCheckout(false)}>繼續選購</button></form>
  :<>
   {allow3d&&<div className="view-toggle" role="group" aria-label="瀏覽方式">{auto3d&&<button className={mode==="3d"?"active":""} onClick={()=>switchMode("3d")}>🧊 3D 逛店</button>}<button className={mode==="list"?"active":""} onClick={()=>switchMode("list")}>☰ 列表</button></div>}
   {mode==="3d"?<section className="stage">
    <div className="unit-chips">{[{id:"all",name:"全部"},...sceneUnits].map((u,i)=><button key={u.id} className={focus===i-1?"active":""} onClick={()=>{setFocus(i-1);setZone(i>0?u.id:null)}}>{"type" in u?unitIcon(u)+" ":""}{u.name}</button>)}</div>
    <Suspense fallback={<div className="stage-loading">正在擺設店面…</div>}>
     <Scene3D items={menu} units={sceneUnits} focus={focus} selectedId={sel?.id??null} onSelect={choose} onFocus={setFocus} onError={()=>{setMode("list");setMsg("此裝置無法顯示 3D，已切換為列表。")}}/>
    </Suspense>
    <p className="stage-hint">{focus<0?"點冰箱或魚缸靠近看看，左右滑動切換":sceneUnits[focus]?.type==="tank"?`${sceneUnits[focus]?.name}：點游動的海鮮挑選`:noDoor(sceneUnits[focus])?`${sceneUnits[focus]?.name}：點商品挑選`:`${sceneUnits[focus]?.name}：點門打開，再點商品`}</p>
    {focus>=0&&<div className="stage-nav"><button aria-label="上一個" onClick={()=>setFocus(Math.max(-1,focus-1))}>‹</button><button onClick={()=>setFocus(-1)}>總覽</button><button aria-label="下一個" disabled={focus>=sceneUnits.length-1} onClick={()=>setFocus(Math.min(sceneUnits.length-1,focus+1))}>›</button></div>}
    {!coupon&&<button className="game-banner" onClick={()=>setGame(true)}><span>🦐</span><b>樂甜釣蝦場</b><small>抓蝦／螃蟹／龍蝦，過關贏滿 NT$1,000 折 NT$5</small></button>}
   </section>:<>
    <div className="menu">{shown.map(itemCard)}</div>
    {!shown.length&&<p className="hint">{q?`找不到「${q}」相關的商品，換個關鍵字或分類看看。`:"這個分類目前沒有開放訂購的商品。"}</p>}
    {msg&&<p className="err">{msg}</p>}
   </>}
  </>;
 return <div className="shop-shell">
  <div className={"shop-map-pane"+(tab==="browse"?" is-on":"")}>{map}</div>
  <section className={"shop-panel"+(tab==="catalog"||checkout?" is-on":"")} aria-label="商品列表">
   <header className="panel-hero"><span className="brand">ANXING OCEAN MARKET</span><p className="tagline">今天，帶點海味回家。</p></header>
   <div className="panel-body">
    {!checkout&&filters}
    {listBody}
   </div>
  </section>
  {dock}
  {toastEl}
  {sheet}
  {gameEl}
 </div>;
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
