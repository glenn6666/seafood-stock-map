// 樂甜釣蝦場（免費遊玩，俯視池塘）：先選目標（蝦／螃蟹／龍蝦）與工具（釣竿／網子／夾子／蝦籠），
// 按住水面放下工具、停在獵物身上一會兒抓住，按著「慢慢」拖到水桶上方放開即入桶；拖太快或獵物掙扎會掉回水裡。
// 達標 → 伺服器發「滿 NT$1,000 折 NT$5」優惠券。開局與結算都經過 Worker；前端不產生優惠碼。
import {useEffect,useRef,useState} from "react";
import {errorText} from "../lib/api-config";
export type Coupon={code:string;discount:number;minTotal:number;expiresAt:string};
type TargetId="shrimp"|"crab"|"lobster";type ToolId="rod"|"net"|"tongs"|"cage";
type Obj={id:number;x:number;y:number;vx:number;vy:number;boot:boolean;hide:number;turn:number;a:number;rock:number};
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
// 圖片可替換：放 web/public/comic/game/<name>.webp 就會自動使用，找不到就用表情符號
/** 手指到工作端的距離（px）：手機約 90–120 */
export const gripPx=(h:number)=>Math.round(Math.max(90,Math.min(120,h*.3)));
export const SPRITES=["shrimp","crab","lobster","rod","net","tongs","cage","bucket","boot"] as const;
type SpriteName=typeof SPRITES[number];
const spriteOk:Partial<Record<SpriteName,boolean>>={};
const spriteSrc=(n:SpriteName)=>`${import.meta.env.BASE_URL}comic/game/${n}.webp`;
function useSprites(){
 const [,bump]=useState(0);
 useEffect(()=>{let live=true;for(const n of SPRITES){if(n in spriteOk)continue;const im=new Image();im.onload=()=>{spriteOk[n]=true;live&&bump(x=>x+1)};im.onerror=()=>{spriteOk[n]=false};im.src=spriteSrc(n)}return()=>{live=false}},[]);
}
function Sprite({name,emoji,className=""}:{name:SpriteName;emoji:string;className?:string}){
 return spriteOk[name]?<img className={"spr "+className} src={spriteSrc(name)} alt="" draggable={false} data-sprite={name}/>:<span className={className} data-sprite={name}>{emoji}</span>;
}
const LIVES=3;
const stars=(f:number)=>f>=1.4?"★★★":f>=1?"★★☆":f>=.7?"★☆☆":"☆☆☆";
// 俯視：水桶放在池中央的木台上；龍蝦躲在四塊石頭下
const BUCKET={x:50,y:50,r:10};
const ROCKS=[{x:18,y:22},{x:82,y:24},{x:20,y:80},{x:80,y:78}];
// 素材面向：蝦（俯視圖）與龍蝦頭朝上、螃蟹橫著走；依移動方向旋轉
const FACE:Record<string,number>={shrimp:-90,lobster:-90,crab:0};
const clampXY=(o:{x:number;y:number})=>{
 o.x=Math.max(5,Math.min(95,o.x));o.y=Math.max(5,Math.min(95,o.y));
 const dx=o.x-BUCKET.x,dy=o.y-BUCKET.y,d=Math.hypot(dx,dy),m=BUCKET.r+5;   // 不讓獵物鑽到水桶底下
 if(d<m){if(d<.1){o.x=BUCKET.x+m}else{o.x=BUCKET.x+dx/d*m;o.y=BUCKET.y+dy/d*m}}
};
export default function ShrimpGame({origin,onClose,onCoupon}:{origin:string;onClose:()=>void;onCoupon:(c:Coupon)=>void}){
 const [phase,setPhase]=useState<"intro"|"play"|"sending"|"done">("intro"),[msg,setMsg]=useState(""),[target,setTarget]=useState<TargetId>("shrimp"),[tool,setTool]=useState<ToolId>("rod");
 const [,force]=useState(0),[won,setWon]=useState<Coupon|null>(null),[flash,setFlash]=useState("");
 useSprites();
 const reduce=typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
 const st=useRef({gameId:"",goal:4,end:0,caught:0,objs:[] as Obj[],last:0,raf:0,over:false,
  ptr:{x:50,y:50},grip:null as null|{x:number;y:number},tx:50,ty:50,down:false,hold:null as null|{id:number;since:number},carry:null as null|Obj,risk:0,speed:0,left:40,lives:LIVES,ripples:[] as {x:number;y:number;t:number}[]});
 const T=TARGETS[target],K=TOOLS[tool];
 const spawn=(id:number,boot=false):Obj=>{
  const sp=(boot?4:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6),a=Math.random()*Math.PI*2,rock=Math.floor(Math.random()*ROCKS.length);
  const lob=target==="lobster"&&!boot,o={id,x:lob?ROCKS[rock].x:5+Math.random()*90,y:lob?ROCKS[rock].y:5+Math.random()*90,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,boot,hide:lob?1+Math.random()*3:0,turn:1+Math.random()*2,a:a*180/Math.PI,rock};
  clampXY(o);return o;
 };
 async function start(){
  setMsg("");
  try{const r=await fetch(origin+"/api/public/game/start",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({target,tool})});if(!r.ok){setMsg(await errorText(r,"目前無法開始遊戲"));return}
   const d=await r.json();const s=st.current,n=target==="lobster"?4:6;
   Object.assign(s,{gameId:d.gameId,goal:d.target??T.goal,end:performance.now()+(d.seconds??T.seconds)*1000,caught:0,objs:[...Array.from({length:n},(_,i)=>spawn(i)),spawn(90,true)],last:performance.now(),over:false,down:false,hold:null,carry:null,risk:0,speed:0,lives:LIVES,ripples:[],tx:30,ty:30,ptr:{x:30,y:30},grip:null});
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
   if(o.hide>0){o.hide-=dt;const r=ROCKS[o.rock];o.x+=(r.x-o.x)*Math.min(1,dt*4);o.y+=(r.y-o.y)*Math.min(1,dt*4);continue}
   o.turn-=dt;if(o.turn<=0){o.turn=(target==="shrimp"?.6:1)+Math.random()*2;
    // 俯視：任意方向游動／爬行；蝦會突然彈射轉向，螃蟹會停頓，龍蝦會躲回最近的石頭
    const a=Math.random()*Math.PI*2,sp=(o.boot?4:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6)*(target==="shrimp"&&!o.boot&&Math.random()<.3?2:1);
    if(target==="crab"&&!o.boot&&Math.random()<.4){o.vx=0;o.vy=0}else{o.vx=Math.cos(a)*sp;o.vy=Math.sin(a)*sp}
    if(target==="lobster"&&!o.boot&&Math.random()<.35){o.rock=ROCKS.map((r,i)=>[Math.hypot(r.x-o.x,r.y-o.y),i]).sort((p,q)=>p[0]-q[0])[0][1];o.hide=1.5+Math.random()*2}}
   // 蝦籠會吸引附近獵物
   if(tool==="cage"&&s.down&&!s.carry&&!o.boot){const dx=s.tx-o.x,dy=s.ty-o.y,d=Math.hypot(dx,dy);if(d<28&&d>1){o.x+=dx/d*6*dt;o.y+=dy/d*6*dt}}
   o.x+=o.vx*dt;o.y+=o.vy*dt;
   if(o.x<5||o.x>95)o.vx*=-1;if(o.y<5||o.y>95)o.vy*=-1;clampXY(o);
   if(Math.hypot(o.vx,o.vy)>1)o.a=Math.atan2(o.vy,o.vx)*180/Math.PI;
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
   const c=s.carry;c.x=s.tx;c.y=s.ty;
   const safe=K.carry*K.fit[target];
   s.risk+=(Math.max(0,s.speed/safe-1)*2.2+T.struggle/K.fit[target])*dt;
   if(s.risk>=1){clampXY(c);c.turn=0;s.carry=null;s.ripples.push({x:c.x,y:c.y,t:now});s.lives--;
    setFlash((s.speed>safe?"拖太快，掉回水裡了！":`${T.name}一掙扎，跑掉了！`)+(s.lives>0?` 剩 ${s.lives} 次機會`:" 機會用完了"))}
  }
  s.ripples=s.ripples.filter(r=>now-r.t<900);s.left=Math.max(0,(s.end-now)/1000);force(x=>x+1);
  if(s.left<=0||s.caught>=s.goal||s.lives<=0){finish();return}
  s.raf=requestAnimationFrame(tick);
 }
 function release(){
  const s=st.current;s.down=false;s.hold=null;
  if(!s.carry)return;
  const c=s.carry;s.carry=null;
  if(Math.hypot(s.tx-BUCKET.x,s.ty-BUCKET.y)<BUCKET.r+4){s.caught++;setFlash(`入桶！${s.caught}/${s.goal}`);const i=s.objs.indexOf(c);s.objs[i]=spawn(c.id+100)}
  else{clampXY(c);setFlash("還沒到水桶就放開了")}
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
 // 握把在手指、工作端（勾子/網/夾/籠）在手指上方 GRIP px，避免手指擋住；命中判定用工作端
 const at=(e:React.PointerEvent)=>{const r=pond.current!.getBoundingClientRect(),off=gripPx(r.height),q=st.current;
  q.grip={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};
  q.ptr={x:Math.max(0,Math.min(100,q.grip.x)),y:Math.max(0,Math.min(100,(e.clientY-off-r.top)/r.height*100))}};
 const s=st.current,holdPct=s.hold?Math.min(1,(performance.now()-s.hold.since)/(K.catchMs/K.fit[target])):0;
 return <div className="sheet-backdrop" onClick={phase==="play"?undefined:onClose}><div className={"sheet game"+(reduce?" reduce":"")} role="dialog" aria-label="樂甜釣蝦場" onClick={e=>e.stopPropagation()}>
  <div className="sheet-grab"/><h2>🦐 樂甜釣蝦場</h2>
  {phase==="intro"&&<>
   <p className="game-step">① 選要抓什麼</p>
   <div className="pick-row" role="radiogroup" aria-label="目標">{(Object.keys(TARGETS) as TargetId[]).map(id=><button key={id} role="radio" aria-checked={target===id} className={"pick"+(target===id?" on":"")} onClick={()=>setTarget(id)}><Sprite className="pick-icon" name={id} emoji={TARGETS[id].icon}/><b>{TARGETS[id].name}</b><small>{TARGETS[id].seconds} 秒抓 {TARGETS[id].goal} 隻</small></button>)}</div>
   <p className="pick-desc">{T.desc}</p>
   <p className="game-step">② 選工具 <small>（★ 越多越適合抓{T.name}）</small></p>
   <div className="pick-row tools" role="radiogroup" aria-label="工具">{(Object.keys(TOOLS) as ToolId[]).map(id=><button key={id} role="radio" aria-checked={tool===id} className={"pick"+(tool===id?" on":"")} onClick={()=>setTool(id)}><Sprite className="pick-icon" name={id} emoji={TOOLS[id].icon}/><b>{TOOLS[id].name}</b><small className="stars">{stars(TOOLS[id].fit[target])}</small></button>)}</div>
   <p className="pick-desc">{K.desc}</p>
   <p className="game-rule"><b>玩法：</b>共 3 次機會（{"❤️".repeat(3)}），被跑掉 3 次就結束。手指按住的是{K.name}<b>握把（尾端）</b>，{K.name}前端在手指上方，不會被手指擋住；按住水面放下{K.name}，停在{T.name}身上直到圈圈填滿就抓住；按著<b>慢慢</b>拖到池中央的水桶再放開。拖太快或{T.name}掙扎會掉回水裡；撈到破鞋扣 3 秒。</p>
   <p className="game-prize">過關獎勵：<b>滿 NT$1,000 折 NT$5</b> 優惠券（每筆訂單限用一張、不累加、24 小時內有效）。免費遊玩，不用先購買。</p>
   {msg&&<p className="err">{msg}</p>}<button className="primary grow" onClick={start}>開始抓{T.name}</button><button className="sheet-close" onClick={onClose}>先不要</button></>}
  {phase!=="intro"&&<>
   <div className="game-stats"><span>⏱ {s.left.toFixed(1)} 秒</span><span className="lives" aria-label={`剩 ${s.lives} 次機會`}>{"❤️".repeat(Math.max(0,s.lives))}{"🤍".repeat(LIVES-Math.max(0,s.lives))}</span><span className="caught">{T.icon} {s.caught} / {s.goal}</span></div>
   <div className={"pond t-"+target} ref={pond} aria-label={`池塘：按住放下${K.name}，拖到水桶放開`}
    onPointerDown={e=>{if(phase!=="play")return;(e.target as HTMLElement).setPointerCapture?.(e.pointerId);at(e);const q=st.current;q.down=true;q.ripples.push({x:q.ptr.x,y:q.ptr.y,t:performance.now()})}}
    onPointerMove={e=>{if(phase==="play")at(e)}} onPointerUp={()=>{if(phase==="play"){st.current.grip=null;release()}}} onPointerCancel={()=>{if(phase==="play"){st.current.grip=null;release()}}}>
    <span className={"bucket"+(s.carry&&Math.hypot(s.tx-BUCKET.x,s.ty-BUCKET.y)<BUCKET.r+4?" ready":"")} style={{left:BUCKET.x+"%",top:BUCKET.y+"%"}}><Sprite name="bucket" emoji="🪣"/></span>
    {!reduce&&s.ripples.map(r=><span key={r.t} className="ripple" style={{left:r.x+"%",top:r.y+"%"}}/>)}
    {s.objs.map(o=>{const rot=o.boot?o.a/6:target==="crab"?((o.a+90)%180+180)%180-90:o.a-FACE[target];
     return <span key={o.id} className={"pond-obj"+(o.boot?" boot":"")+(o.hide>0?" hidden":"")+(o===s.carry?" carried":"")} style={{left:o.x+"%",top:o.y+"%",transform:`translate(-50%,-50%) rotate(${rot}deg)`}}>{o.boot?<Sprite name="boot" emoji="🥾"/>:<Sprite name={target} emoji={T.icon}/>}</span>})}
    {target==="lobster"&&ROCKS.map((r,i)=><span key={i} className="rock" style={{left:r.x+"%",top:r.y+"%"}}>🪨</span>)}
    {s.grip&&s.down&&<><span className="grip-shaft" style={{left:s.grip.x+"%",top:s.grip.y+"%",height:Math.hypot((s.tx-s.grip.x)*(pond.current?.clientWidth??0)/100,(s.ty-s.grip.y)*(pond.current?.clientHeight??0)/100)+"px",transform:`rotate(${Math.atan2(-(s.tx-s.grip.x)*(pond.current?.clientWidth??0)/100,(s.ty-s.grip.y)*(pond.current?.clientHeight??0)/100)*180/Math.PI+180}deg)`}}/><span className="grip" data-x={s.grip.x.toFixed(1)} data-y={s.grip.y.toFixed(1)} style={{left:s.grip.x+"%",top:s.grip.y+"%"}}/></>}
    <span className={"tool-cursor t-"+tool+(s.down?" down":"")} data-x={s.tx.toFixed(1)} data-y={s.ty.toFixed(1)} style={{left:s.tx+"%",top:s.ty+"%",width:K.r*2+"%"}}><span className="ring" style={{background:`conic-gradient(#ffd877 ${holdPct*360}deg,transparent 0)`}}/><Sprite className="ti" name={tool} emoji={K.icon}/></span>
    {s.carry&&<span className="risk" aria-label="掉落風險"><i style={{width:Math.min(100,s.risk*100)+"%"}}/></span>}
    {flash&&<span className="pond-flash" role="status">{flash}</span>}
   </div>
   {phase==="play"&&<p className="hint">手指握尾端、看上方{K.name}前端 · 按住放下{K.name} → 圈滿抓住 → 慢慢拖到 🪣 放開（鍵盤：方向鍵移動、按住空白鍵）</p>}
   {phase==="play"&&<button className="sheet-close" onClick={finish}>提前結束這局</button>}
   {phase==="sending"&&<p className="hint">結算中…</p>}
   {phase==="done"&&<>{won?<div className="coupon-card"><b>恭喜過關！</b><span>滿 NT${won.minTotal.toLocaleString()} 折 NT${won.discount}</span><small>已存到購物車，結帳時自動套用・{new Date(won.expiresAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})} 前有效</small></div>:!msg&&<p className="game-rule">{s.lives<=0?"3 次機會用完了！":""}這局抓到 {s.caught} 隻{T.name}，差一點！換個工具再挑戰吧。</p>}
    {msg&&<p className="err">{msg}</p>}
    <button className="primary grow" onClick={()=>{setPhase("intro");setWon(null);setMsg("")}}>再玩一次</button><button className="sheet-close" onClick={onClose}>回到商店</button></>}
  </>}
 </div></div>;
}
