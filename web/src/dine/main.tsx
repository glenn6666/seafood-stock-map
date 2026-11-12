import {useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {loadApiOrigin,errorText,newKey} from "../lib/api-config";
import {DINE_CATEGORIES,DINE_STORE,MARKET_LABEL,formatPickup,pickupError,taipeiParts,type DineCategoryId} from "../lib/dine-menu";
import "./dine.css";

type Item={id:string;category:DineCategoryId;name:string;description:string;price:number|null;priceNote:string;unit:string;badges:string[];imageUrl:string;market:boolean};
type Cat={id:DineCategoryId;label:string;note:string};
const MENU_GROUPS=[
 {id:"bowls",label:"粥品・湯品",categories:["porridge","soup"]},
 {id:"grilled",label:"烤魚・烤肉",categories:["fish","grill","meat"]},
 {id:"cooked",label:"海鮮料理",categories:["steam","stir","blanch","thai"]},
 {id:"fresh",label:"生魚片・活鮮",categories:["sashimi","live"]},
] as const;
type MenuGroupId=typeof MENU_GROUPS[number]["id"];
const STEPS=["待處理","備貨中","可取貨","已完成"] as const;
const STEP_LABEL:Record<string,string>={"待處理":"已接單","備貨中":"製作中","可取貨":"可取餐","已完成":"已完成","已取消":"已取消"};
const tokenFromHash=()=>location.hash.match(/^#\/o\/([A-Za-z0-9_-]{20,64})$/)?.[1]??null;
const BASE=import.meta.env.BASE_URL;
const logo=BASE+"dine/logo.webp";

function FoodImage({item}:{item:Item}){
 const [failed,setFailed]=useState(false);
 return item.imageUrl&&!failed?<img className="thumb" src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<div className="thumb ph"><span>安星水產</span><small>餐點照片準備中</small></div>;
}

function useOrigin(){
 const [o,setO]=useState<string|null>(null),[e,setE]=useState("");
 useEffect(()=>{loadApiOrigin().then(setO).catch(x=>setE(x instanceof Error?x.message:"無法連線"))},[]);
 return [o,e] as const;
}

function nextSlots(){
 const out:{value:string;label:string}[]=[];
 const now=new Date();
 const today=taipeiParts(now).date;
 const [y,mo,d0]=today.split("-").map(Number);
 for(let d=0;d<14;d++){
  const midnight=new Date(Date.UTC(y,mo-1,d0+d,-8,0));
  const p=taipeiParts(midnight);
  if(p.dow===1)continue;
  const open=p.dow===0||p.dow===6?12:13;
  for(let m=open*60;m<=21*60;m+=15){
   const value=`${p.date}T${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
   if(pickupError(value,now))continue;
   out.push({value,label:`${+p.date.slice(5,7)}/${+p.date.slice(8,10)} ${value.slice(11)}`});
   if(out.length>=48)return out;
  }
 }
 return out;
}

function App(){
 const [token,setToken]=useState(tokenFromHash());
 useEffect(()=>{const f=()=>setToken(tokenFromHash());addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f)},[]);
 const [origin,err]=useOrigin();
 return <main className="dine">
  <header className="dine-hero">
   <div className="dine-hero-top">
    <img className="dine-logo" src={logo} alt="安星水產"/>
    <div><h1 className="visually-hidden">{DINE_STORE.name}</h1><p className="branch">{DINE_STORE.branch}</p></div>
   </div>
   <p className="tag">{token?"訂單查詢":"線上點餐・預約自取"}</p>
   <details className="store-details"><summary>營業時間與門市資訊</summary><div className="dine-info">
    <div>營業時間　{DINE_STORE.hoursWeekday}</div>
    <div>　　　　　{DINE_STORE.hoursWeekend}，{DINE_STORE.closed}</div>
    <div>地址　{DINE_STORE.address}</div>
    <div>電話　<a href={`tel:${DINE_STORE.phone}`}>{DINE_STORE.phone}</a>（{DINE_STORE.phoneNote}）</div>
   </div></details>
   <a className="shop-link" href={BASE+"order.html"}>海鮮購物（帶回家）→</a>
  </header>
  {err&&<p className="err" role="alert" style={{padding:"12px 16px"}}>{err}</p>}
  {origin&&(token?<Lookup origin={origin} token={token}/>:<Menu origin={origin}/>)}
  {!origin&&!err&&<p className="hint" style={{padding:"12px 16px"}}>載入中…</p>}
 </main>;
}

function Menu({origin}:{origin:string}){
 const [items,setItems]=useState<Item[]|null>(null),[cats,setCats]=useState<Cat[]>([...DINE_CATEGORIES]);
 const [cart,setCart]=useState<Record<string,number>>({});
 const [cat,setCat]=useState<MenuGroupId|"all">("all");
 const [q,setQ]=useState("");const [tab,setTab]=useState<"menu"|"cart">("menu");
 const [f,setF]=useState({customerName:"",phone:"",note:"",pickupAt:""});
 const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);const [toast,setToast]=useState("");
 const idem=useRef(newKey());
 const slots=useMemo(()=>nextSlots(),[tab]);
 const [detail,setDetail]=useState<Item|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(detail){dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}}else dialog.current?.close()},[detail]);
 const changeTab=(next:"menu"|"cart")=>{setTab(next);window.scrollTo({top:0,behavior:"instant"})};
 useEffect(()=>{
  fetch(origin+"/api/public/dine-menu",{cache:"no-store",credentials:"omit"}).then(async r=>{
   if(!r.ok)throw new Error();
   const d=await r.json();
   setItems(d.items);if(d.categories?.length)setCats(d.categories);
  }).catch(()=>setMsg("目前無法讀取菜單，請稍後再試。"));
 },[origin]);
 const setQty=(id:string,n:number)=>setCart(c=>{const v=Math.max(0,Math.min(20,n));const n2={...c};if(v)n2[id]=v;else delete n2[id];return n2});
 const add=(it:Item)=>{setQty(it.id,(cart[it.id]??0)+1);setToast(`已加入「${it.name}」`);setTimeout(()=>setToast(""),1600)};
 const lines=(items??[]).filter(i=>(cart[i.id]??0)>0);
 const count=lines.reduce((s,i)=>s+cart[i.id],0);
 const priced=lines.reduce((s,i)=>s+(i.price??0)*cart[i.id],0);
 const hasMarket=lines.some(i=>i.market);
 const query=q.trim();
 const groupFor=(i:Item)=>MENU_GROUPS.find(g=>(g.categories as readonly string[]).includes(i.category))?.id??"cooked";
 const shown=(items??[]).filter(i=>(cat==="all"||groupFor(i)===cat)&&(!query||`${i.name}${i.description}${i.priceNote}`.includes(query)));
 const byCat=MENU_GROUPS.map(c=>({...c,items:shown.filter(i=>groupFor(i)===c.id)})).filter(c=>c.items.length);
 const itemNote=(it:Item)=>[...new Set([it.description,it.priceNote,cats.find(c=>c.id===it.category)?.note].filter(Boolean))].join("・");
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMsg("");
  const pe=pickupError(f.pickupAt);if(pe){setMsg(pe);setBusy(false);return}
  try{
   const r=await fetch(origin+"/api/public/orders",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({channel:"dine",idempotencyKey:idem.current,customerName:f.customerName,phone:f.phone,note:f.note,pickupAt:f.pickupAt,items:lines.map(i=>({id:i.id,qty:cart[i.id]}))})});
   if(!r.ok){setMsg(await errorText(r,"送出失敗，請再試一次。"));if(r.status===409||r.status===400)idem.current=newKey();return}
   const d=await r.json();location.hash=`#/o/${d.lookupToken}`;
  }catch{setMsg("連線中斷，請再按一次送出（不會重複下單）。")}
  finally{setBusy(false)}
 }
 const card=(it:Item)=><article key={it.id} className="card">
  <button type="button" className="photo-button" onClick={()=>setDetail(it)} aria-label={`查看${it.name}大圖與介紹`}><FoodImage item={it}/><span className="photo-hint">查看餐點 ↗</span></button>
  <div className="item-main">
   {(it.badges.includes("hot")||it.badges.includes("best"))&&<div className="badges">{it.badges.includes("hot")&&<span className="badge hot">🔥 熱門</span>}{it.badges.includes("best")&&<span className="badge best">BEST CHOICE</span>}</div>}
   <strong>{it.name}</strong>
   {itemNote(it)&&<p className="spec">{itemNote(it)}</p>}
   <div className="item-foot">
    {it.market?<span className="price market">{MARKET_LABEL}</span>:<span className="price">NT$ {it.price!.toLocaleString("en-US")}</span>}
    {cart[it.id]>0?<div className="stepper"><button type="button" aria-label={`減少${it.name}`} onClick={()=>setQty(it.id,cart[it.id]-1)}>－</button><output>{cart[it.id]}</output><button type="button" aria-label={`增加${it.name}`} disabled={cart[it.id]>=20} onClick={()=>setQty(it.id,cart[it.id]+1)}>＋</button></div>
     :<button type="button" className="item-add" onClick={()=>add(it)}>＋加入</button>}
   </div>
  </div>
 </article>;
 return <>
  <div className="dine-body">
   {tab==="menu"?<>
    <div className="cats" role="group" aria-label="分類">
     <button type="button" aria-pressed={cat==="all"} className={cat==="all"?"on":""} onClick={()=>setCat("all")}>全部</button>
     {MENU_GROUPS.map(c=><button key={c.id} type="button" aria-pressed={cat===c.id} className={cat===c.id?"on":""} onClick={()=>setCat(c.id)}>{c.label}</button>)}
    </div>
    <label className="search"><span aria-hidden>🔍</span><input type="search" aria-label="搜尋餐點" value={q} onChange={e=>setQ(e.target.value)} placeholder="搜尋餐點" enterKeyHint="search" autoComplete="off"/></label>
    {!items&&<p className="hint">{msg||"載入中…"}</p>}
    {items&&!byCat.length&&<p className="hint">{query?`找不到「${query}」相關的餐點。`:"這個分類目前沒有餐點。"}</p>}
    {byCat.map(c=><section key={c.id} className="cat-block">
     <h2>{c.label}<small className="category-count">{c.items.length} 道料理</small></h2>
     <div className="menu">{c.items.map(card)}</div>
    </section>)}
    {msg&&items&&<p className="err" role="alert">{msg}</p>}
   </>:
   <form className="cart" onSubmit={submit}>
    <h2>購物車・預約自取</h2>
    {!lines.length&&<p className="hint">還沒有點餐，先回菜單挑喜歡的料理。</p>}
    <ul className="lines">{lines.map(i=><li key={i.id}><span className="line-title"><FoodImage item={i}/><span>{i.name}{i.market&&<small>　時價</small>}<button type="button" className="remove-item" onClick={()=>setQty(i.id,0)}>移除</button></span></span><span className="cart-qty"><button type="button" aria-label={`減少${i.name}`} onClick={()=>setQty(i.id,cart[i.id]-1)}>－</button>{cart[i.id]}<button type="button" aria-label={`增加${i.name}`} disabled={cart[i.id]>=20} onClick={()=>setQty(i.id,cart[i.id]+1)}>＋</button></span><span>{i.market?"時價":`$${(i.price??0)*cart[i.id]}`}</span></li>)}</ul>
    {hasMarket&&<p className="market-note">時價品項不計入合計，店家確認後會另外報價。</p>}
    <p className="total">合計 NT$ {priced.toLocaleString("en-US")}{hasMarket&&"＋時價"}</p>
    <label>取餐時間
     <select required value={f.pickupAt} onChange={e=>setF({...f,pickupAt:e.target.value})}>
      <option value="">請選擇（營業時間內）</option>
      {slots.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
     </select>
    </label>
    <p className="hint">{DINE_STORE.hoursText}</p>
    <label>姓名<input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})} required maxLength={40} autoComplete="name"/></label>
    <label>聯絡電話<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required inputMode="tel" autoComplete="tel" pattern="[0-9+\-\s]{6,20}"/></label>
    <label>備註（選填，例如辣度、忌口）<textarea value={f.note} onChange={e=>setF({...f,note:e.target.value})} maxLength={300}/></label>
    {msg&&<p className="err" role="alert">{msg}</p>}
    <div className="actions"><button className="primary" disabled={busy||!lines.length}>{busy?"送出中…":"送出點餐"}</button><button type="button" className="ghost" onClick={()=>changeTab("menu")}>繼續點餐</button></div>
   </form>}
  </div>
  <nav className="dock" aria-label="點餐選單">
   <button type="button" className={tab==="menu"?"on":""} onClick={()=>changeTab("menu")}><span aria-hidden>🍽️</span>菜單</button>
   <button type="button" className={tab==="cart"?"on":""} onClick={()=>changeTab("cart")}><span>查看餐點・結帳 {count>0&&`（${count}）`}</span><strong>NT$ {priced.toLocaleString("en-US")}{hasMarket&&"＋時價"}</strong></button>
  </nav>
  <dialog ref={dialog} className="food-dialog" onCancel={()=>setDetail(null)} onClose={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setDetail(null)}}>
   {detail&&<><button type="button" className="dialog-close" onClick={()=>setDetail(null)} aria-label="關閉餐點介紹">×</button><FoodImage item={detail}/><div className="dialog-body"><p className="eyebrow">安星水產・現點料理</p><h2>{detail.name}</h2><p className="spec">{itemNote(detail)}</p><p className="price">{detail.market?MARKET_LABEL:`NT$ ${(detail.price??0).toLocaleString("en-US")}`}</p><button type="button" className="primary" disabled={(cart[detail.id]??0)>=20} onClick={()=>add(detail)}>{(cart[detail.id]??0)>=20?"已達單品上限":"＋ 加入餐點"}{(cart[detail.id]??0)>0&&`（已選 ${cart[detail.id]} 份）`}</button></div></>}
  </dialog>
  {toast&&<p className="toast" role="status">{toast}</p>}
 </>;
}

function Lookup({origin,token}:{origin:string;token:string}){
 const [o,setO]=useState<any>(null),[msg,setMsg]=useState("");
 const load=()=>fetch(`${origin}/api/public/orders/${token}`,{cache:"no-store",credentials:"omit"}).then(async r=>{
  if(r.status===404)return setMsg("查無此訂單，請確認連結是否完整。");
  if(r.status===429)return setMsg((await r.json()).error);
  if(!r.ok)throw new Error();setO((await r.json()).order);
 }).catch(()=>setMsg("目前無法查詢，請稍後再試。"));
 useEffect(()=>{load()},[token]);
 if(!o)return <div className="dine-body"><p className="hint">{msg||"查詢中…"}</p></div>;
 const idx=STEPS.indexOf(o.status);
 const hasMarket=(o.items??[]).some((l:any)=>l.market||l.unitPrice===0);
 return <div className="dine-body"><section className="cart">
  <h2>訂單 {o.orderNo}</h2>
  <p>{o.customerName} 您好，目前狀態：<strong className="status">{STEP_LABEL[o.status]??o.status}</strong></p>
  {o.pickupAt&&<p>取餐時間：<strong>{formatPickup(o.pickupAt)}</strong></p>}
  {o.status!=="已取消"&&<ol className="steps">{STEPS.map((s,i)=><li key={s} className={i<=idx?"done":""}>{STEP_LABEL[s]}</li>)}</ol>}
  <ul className="lines">{o.items.map((l:any,i:number)=><li key={i}><span>{l.name}{l.spec?`　${l.spec}`:""} × {l.qty} {l.unit}</span><span/><span>{l.market||l.unitPrice===0?"時價":`$${l.unitPrice*l.qty}`}</span></li>)}</ul>
  {hasMarket&&<p className="market-note">{MARKET_LABEL}，時價品項不計入合計。</p>}
  <p className="total">合計 ${o.total}{hasMarket?"＋時價":""}</p>
  <p className="hint">請收藏或複製此頁網址，之後可隨時查詢訂單狀態。此連結僅供本人使用，請勿分享。</p>
  <div className="actions">
   <button type="button" className="ghost" onClick={()=>navigator.clipboard?.writeText(location.href)}>複製查詢連結</button>
   <button type="button" className="ghost" onClick={load}>重新整理狀態</button>
   <button type="button" className="primary" onClick={()=>{location.hash=""}}>繼續點餐</button>
  </div>
 </section></div>;
}

createRoot(document.getElementById("root")!).render(<App/>);
