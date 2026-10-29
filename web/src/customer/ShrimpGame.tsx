// 夜市釣蝦場（免費遊玩）：先選目標（蝦／螃蟹／龍蝦）與工具（釣竿／網子／夾子／蝦籠），
// 按住水面放下工具、停在獵物身上一會兒抓住，按著「慢慢」拖到水桶上方放開即入桶；拖太快或獵物掙扎會掉回水裡。
// 達標 → 伺服器發「滿 NT$1,000 折 NT$5」優惠券。開局與結算都經過 Worker；前端不產生優惠碼。
import {useEffect,useRef,useState} from "react";
import {errorText} from "../lib/api-config";
export type Coupon={code:string;discount:number;minTotal:number;expiresAt:string};
type TargetId="shrimp"|"crab"|"lobster";type ToolId="rod"|"net"|"tongs"|"cage";
type Obj={id:number;x:number;y:number;vx:number;vy:number;boot:boolean;hide:number;turn:number};
export const TARGETS:Record<TargetId,{name:string;icon:string;goal:number;seconds:number;speed:number;struggle:number;desc:string}>={
 shrimp:{name:"蝦",icon:"🦐",goal:4,seconds:40,speed:16,struggle:.10,desc:"游得快、到處亂竄，提起時很會彈"},
 crab:{name:"螃蟹",icon:"🦀",goal:3,seconds:40,speed:9,struggle:.05,desc:"沿池底橫著走、會停下來，比較穩"},
 lobster:{name:"龍蝦",icon:"🦞",goal:2,seconds:45,speed:6,struggle:.16,desc:"躲在石頭後偶爾出來，又重又會甩尾"},
};
// r=抓取半徑(%)、catchMs=停留多久抓住、carry=安全拖曳速度(%/秒)、lag=跟手延遲、fit=對各目標的適合度（越高越好抓、越不易掉）
export const TOOLS:Record<ToolId,{name:string;icon:string;r:number;catchMs:number;carry:number;lag:number;fit:Record<TargetId,number>;desc:string}>={
 rod:{name:"釣竿",icon:"🎣",r:5,catchMs:650,carry:60,lag:.10,fit:{shrimp:1.5,crab:.7,lobster:.6},desc:"勾子小要瞄準，釣蝦最穩"},
 net:{name:"網子",icon:"🥅",r:11,catchMs:350,carry:38,lag:.28,fit:{shrimp:1.3,crab:1.2,lobster:.5},desc:"範圍大好撈，但水阻大、拖慢；龍蝦會撐破網"},
 tongs:{name:"夾子",icon:"🥢",r:4,catchMs:150,carry:70,lag:.06,fit:{shrimp:.6,crab:1.5,lobster:1.2},desc:"一夾就住，要夾準；蝦子太滑，螃蟹最合適"},
 cage:{name:"蝦籠",icon:"🧺",r:9,catchMs:1500,carry:32,lag:.20,fit:{shrimp:.8,crab:1.0,lobster:1.6},desc:"會吸引附近獵物鑽進來，要耐心等；抓龍蝦最好用"},
};
const stars=(f:number)=>f>=1.4?"★★★":f>=1?"★★☆":f>=.7?"★☆☆":"☆☆☆";
const BUCKET={x:50,y:9,r:11};
export default function ShrimpGame({origin,onClose,onCoupon}:{origin:string;onClose:()=>void;onCoupon:(c:Coupon)=>void}){
 const [phase,setPhase]=useState<"intro"|"play"|"sending"|"done">("intro"),[msg,setMsg]=useState(""),[target,setTarget]=useState<TargetId>("shrimp"),[tool,setTool]=useState<ToolId>("rod");
 const [,force]=useState(0),[won,setWon]=useState<Coupon|null>(null),[flash,setFlash]=useState("");
 const reduce=typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
 const st=useRef({gameId:"",goal:4,end:0,caught:0,objs:[] as Obj[],last:0,raf:0,over:false,
  ptr:{x:50,y:50},tx:50,ty:50,down:false,hold:null as null|{id:number;since:number},carry:null as null|Obj,risk:0,speed:0,left:40});
 const T=TARGETS[target],K=TOOLS[tool];
 const spawn=(id:number,boot=false):Obj=>{
  const y=boot?70:target==="shrimp"?35+Math.random()*50:target==="crab"?84+Math.random()*8:88;
  const sp=(boot?6:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6);
  return {id,x:5+Math.random()*90,y,vx:(Math.random()<.5?-1:1)*sp,vy:0,boot,hide:target==="lobster"&&!boot?1+Math.random()*3:0,turn:1+Math.random()*2};
 };
 async function start(){
  setMsg("");
  try{const r=await fetch(origin+"/api/public/game/start",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({target,tool})});if(!r.ok){setMsg(await errorText(r,"目前無法開始遊戲"));return}
   const d=await r.json();const s=st.current,n=target==="lobster"?4:6;
   Object.assign(s,{gameId:d.gameId,goal:d.target??T.goal,end:performance.now()+(d.seconds??T.seconds)*1000,caught:0,objs:[...Array.from({length:n},(_,i)=>spawn(i)),spawn(90,true)],last:performance.now(),over:false,down:false,hold:null,carry:null,risk:0,speed:0,tx:50,ty:40,ptr:{x:50,y:40}});
   setPhase("play");s.raf=requestAnimationFrame(tick);
  }catch{setMsg("連線中斷，請再試一次")}
 }
 function tick(now:number){
  const s=st.current;if(s.over)return;
  const dt=Math.min(.05,(now-s.last)/1000);s.last=now;
  // 工具跟手（有延遲，網子水阻最大）
  const k=1-Math.pow(K.lag,dt*10),ox=s.tx,oy=s.ty;s.tx+=(s.ptr.x-s.tx)*k;s.ty+=(s.ptr.y-s.ty)*k;
  const v=Math.hypot(s.tx-ox,s.ty-oy)/Math.max(dt,1e-3);s.speed=s.speed*.8+v*.2;
  for(const o of s.objs){
   if(o===s.carry)continue;
   if(o.hide>0){o.hide-=dt;continue}
   o.turn-=dt;if(o.turn<=0){o.turn=1+Math.random()*2.5;
    if(target==="crab"&&!o.boot&&Math.random()<.4){o.vx=0}else o.vx=(Math.random()<.5?-1:1)*(o.boot?6:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6);
    if(target==="lobster"&&!o.boot&&Math.random()<.35)o.hide=1.5+Math.random()*2;
    if(target==="shrimp"&&!o.boot)o.vy=(Math.random()-.5)*12;}
   // 蝦籠會吸引附近獵物
   if(tool==="cage"&&s.down&&!s.carry&&!o.boot){const dx=s.tx-o.x,dy=s.ty-o.y,d=Math.hypot(dx,dy);if(d<28&&d>1){o.x+=dx/d*6*dt;o.y+=dy/d*6*dt}}
   o.x+=o.vx*dt;o.y+=o.vy*dt;
   if(o.x<3||o.x>97){o.vx*=-1;o.x=Math.max(3,Math.min(97,o.x))}
   const lo=target==="shrimp"||o.boot?32:80,hi=94;if(o.y<lo||o.y>hi){o.vy*=-1;o.y=Math.max(lo,Math.min(hi,o.y))}
  }
  if(s.down&&!s.carry){
   const near=s.objs.filter(o=>o.hide<=0&&Math.hypot(o.x-s.tx,o.y-s.ty)<K.r).sort((a,b)=>Math.hypot(a.x-s.tx,a.y-s.ty)-Math.hypot(b.x-s.tx,b.y-s.ty))[0];
   if(!near)s.hold=null;
   else if(!s.hold||s.hold.id!==near.id)s.hold={id:near.id,since:now};
   else if(now-s.hold.since>=(near.boot?200:K.catchMs/K.fit[target])){
    s.hold=null;
    if(near.boot){s.end-=3000;setFlash("撈到破鞋！扣 3 秒");Object.assign(near,spawn(near.id,true))}
    else{s.carry=near;s.risk=0;setFlash(`抓到${T.name}了！慢慢拖到水桶`)}
   }
  }
  if(s.carry){
   const c=s.carry;c.x=s.tx;c.y=s.ty+3;
   const safe=K.carry*K.fit[target];
   s.risk+=(Math.max(0,s.speed/safe-1)*2.2+T.struggle/K.fit[target])*dt;
   if(s.risk>=1){c.y=Math.max(c.y,target==="shrimp"?50:85);c.vy=0;s.carry=null;setFlash(s.speed>safe?"拖太快，掉回水裡了！":`${T.name}一掙扎，跑掉了！`)}
  }
  s.left=Math.max(0,(s.end-now)/1000);force(x=>x+1);
  if(s.left<=0||s.caught>=s.goal){finish();return}
  s.raf=requestAnimationFrame(tick);
 }
 function release(){
  const s=st.current;s.down=false;s.hold=null;
  if(!s.carry)return;
  const c=s.carry;s.carry=null;
  if(Math.hypot(s.tx-BUCKET.x,s.ty-BUCKET.y)<BUCKET.r+4){s.caught++;setFlash(`入桶！${s.caught}/${s.goal}`);const i=s.objs.indexOf(c);s.objs[i]=spawn(c.id+100)}
  else{c.y=target==="shrimp"?50:86;setFlash("還沒到水桶就放開了")}
 }
 async function finish(){
  const s=st.current;if(s.over)return;s.over=true;cancelAnimationFrame(s.raf);setPhase("sending");
  try{const r=await fetch(origin+"/api/public/game/finish",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({gameId:s.gameId,caught:s.caught})});
   if(!r.ok){setMsg(await errorText(r,"結算失敗"));setPhase("done");return}
   const d=await r.json();if(d.won){setWon(d.coupon);onCoupon(d.coupon)}setPhase("done");
  }catch{setMsg("連線中斷，這局無法結算");setPhase("done")}
 }
 useEffect(()=>{const s=st.current;return()=>{s.over=true;cancelAnimationFrame(s.raf)}},[]);
 useEffect(()=>{if(!flash)return;const t=setTimeout(()=>setFlash(""),1300);return()=>clearTimeout(t)},[flash]);
 // 鍵盤：方向鍵移動，空白鍵按住＝放下工具，放開＝提起
 useEffect(()=>{if(phase!=="play")return;const s=st.current;
  const kd=(e:KeyboardEvent)=>{const m:Record<string,[number,number]>={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]};
   if(m[e.code]){e.preventDefault();s.ptr={x:Math.max(0,Math.min(100,s.ptr.x+m[e.code][0])),y:Math.max(0,Math.min(100,s.ptr.y+m[e.code][1]))}}
   else if(e.code==="Space"){e.preventDefault();s.down=true}};
  const ku=(e:KeyboardEvent)=>{if(e.code==="Space"){e.preventDefault();release()}};
  addEventListener("keydown",kd);addEventListener("keyup",ku);return()=>{removeEventListener("keydown",kd);removeEventListener("keyup",ku)}},[phase]);
 const pond=useRef<HTMLDivElement>(null);
 const at=(e:React.PointerEvent)=>{const r=pond.current!.getBoundingClientRect();st.current.ptr={x:Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))}};
 const s=st.current,holdPct=s.hold?Math.min(1,(performance.now()-s.hold.since)/(K.catchMs/K.fit[target])):0;
 return <div className="sheet-backdrop" onClick={phase==="play"?undefined:onClose}><div className={"sheet game"+(reduce?" reduce":"")} role="dialog" aria-label="夜市釣蝦場" onClick={e=>e.stopPropagation()}>
  <div className="sheet-grab"/><h2>🎏 夜市釣蝦場</h2>
  {phase==="intro"&&<>
   <p className="game-step">① 選要抓什麼</p>
   <div className="pick-row" role="radiogroup" aria-label="目標">{(Object.keys(TARGETS) as TargetId[]).map(id=><button key={id} role="radio" aria-checked={target===id} className={"pick"+(target===id?" on":"")} onClick={()=>setTarget(id)}><span className="pick-icon">{TARGETS[id].icon}</span><b>{TARGETS[id].name}</b><small>{TARGETS[id].seconds} 秒抓 {TARGETS[id].goal} 隻</small></button>)}</div>
   <p className="pick-desc">{T.desc}</p>
   <p className="game-step">② 選工具 <small>（★ 越多越適合抓{T.name}）</small></p>
   <div className="pick-row tools" role="radiogroup" aria-label="工具">{(Object.keys(TOOLS) as ToolId[]).map(id=><button key={id} role="radio" aria-checked={tool===id} className={"pick"+(tool===id?" on":"")} onClick={()=>setTool(id)}><span className="pick-icon">{TOOLS[id].icon}</span><b>{TOOLS[id].name}</b><small className="stars">{stars(TOOLS[id].fit[target])}</small></button>)}</div>
   <p className="pick-desc">{K.desc}</p>
   <p className="game-rule"><b>玩法：</b>按住水面放下{K.name}，停在{T.name}身上直到圈圈填滿就抓住；按著<b>慢慢</b>拖到上方水桶再放開。拖太快或{T.name}掙扎會掉回水裡；撈到破鞋扣 3 秒。</p>
   <p className="game-prize">過關獎勵：<b>滿 NT$1,000 折 NT$5</b> 優惠券（每筆訂單限用一張、不累加、24 小時內有效）。免費遊玩，不用先購買。</p>
   {msg&&<p className="err">{msg}</p>}<button className="primary grow" onClick={start}>開始抓{T.name}</button><button className="sheet-close" onClick={onClose}>先不要</button></>}
  {phase!=="intro"&&<>
   <div className="game-stats"><span>⏱ {s.left.toFixed(1)} 秒</span><span>{K.icon} {K.name}</span><span>{T.icon} {s.caught} / {s.goal}</span></div>
   <div className={"pond t-"+target} ref={pond} aria-label={`池塘：按住放下${K.name}，拖到水桶放開`}
    onPointerDown={e=>{if(phase!=="play")return;(e.target as HTMLElement).setPointerCapture?.(e.pointerId);at(e);st.current.down=true}}
    onPointerMove={e=>{if(phase==="play")at(e)}} onPointerUp={()=>phase==="play"&&release()} onPointerCancel={()=>phase==="play"&&release()}>
    <span className={"bucket"+(s.carry&&Math.hypot(s.tx-BUCKET.x,s.ty-BUCKET.y)<BUCKET.r+4?" ready":"")} style={{left:BUCKET.x+"%",top:BUCKET.y+"%"}}>🪣</span>
    {target!=="shrimp"&&<><span className="rock" style={{left:"18%"}}>🪨</span><span className="rock" style={{left:"62%"}}>🪨</span></>}
    {s.objs.map(o=><span key={o.id} className={"pond-obj"+(o.boot?" boot":"")+(o.hide>0?" hidden":"")+(o===s.carry?" carried":"")} style={{left:o.x+"%",top:o.y+"%",transform:`translate(-50%,-50%) scaleX(${o.vx>0?-1:1})`}}>{o.boot?"🥾":T.icon}</span>)}
    {tool==="rod"&&<span className="line" style={{left:s.tx+"%",height:s.ty+"%"}}/>}
    <span className={"tool-cursor"+(s.down?" down":"")} style={{left:s.tx+"%",top:s.ty+"%",width:K.r*2+"%"}}><span className="ring" style={{background:`conic-gradient(#ffd877 ${holdPct*360}deg,transparent 0)`}}/><span className="ti">{K.icon}</span></span>
    {s.carry&&<span className="risk" aria-label="掉落風險"><i style={{width:Math.min(100,s.risk*100)+"%"}}/></span>}
    {flash&&<span className="pond-flash" role="status">{flash}</span>}
   </div>
   {phase==="play"&&<p className="hint">按住放下{K.name} → 圈滿抓住 → 慢慢拖到 🪣 放開（鍵盤：方向鍵移動、按住空白鍵）</p>}
   {phase==="sending"&&<p className="hint">結算中…</p>}
   {phase==="done"&&<>{won?<div className="coupon-card"><b>恭喜過關！</b><span>滿 NT${won.minTotal.toLocaleString()} 折 NT${won.discount}</span><small>已存到購物車，結帳時自動套用・{new Date(won.expiresAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})} 前有效</small></div>:!msg&&<p className="game-rule">這局抓到 {s.caught} 隻{T.name}，差一點！換個工具再挑戰吧。</p>}
    {msg&&<p className="err">{msg}</p>}
    <button className="primary grow" onClick={()=>{setPhase("intro");setWon(null);setMsg("")}}>再玩一次</button><button className="sheet-close" onClick={onClose}>回到商店</button></>}
  </>}
 </div></div>;
}
