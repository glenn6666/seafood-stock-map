// 樂甜釣蝦場（免費遊玩，俯視池塘）：先選目標（蝦／螃蟹／龍蝦）與工具（釣竿／網子），
// 按住水面放下工具、停在獵物身上一會兒抓住，按著「慢慢」拖到碗／水桶上方放開即入桶；拖太快或獵物掙扎會掉回水裡。
// 達標後填 LINE 社群暱稱，由門市核對發券；開局與結算都經過 Worker。
// 三種海鮮共用 cute-art SVG：選角、主視覺、池塘與結果維持同一套插畫。
// 網子大範圍、快速抓取，最多兩隻；釣竿小範圍、需精準停留，一次一隻。
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {errorText} from "../lib/api-config";
import {CuteArt} from "./cute-art";
import GameLeaderboard from './GameLeaderboard';
import GameVoucherWallet from './GameVoucherWallet';
import {LINE_GROUP_URL} from '../lib/game-vouchers';
import {COUPON_RULE} from '../lib/coupon-policy';
import {GAME_SECONDS,COUPON_CATCH_MIN,TOOL_FIT,TOOL_BEHAVIOR,pointsPerCatch,toolBlocksThreat} from '../lib/game-rules';
import "./game-cute.css";
export type Coupon={code:string;discount:number;minTotal:number;expiresAt:string;scope?:string;restrictions?:string};
type TargetId="shrimp"|"crab"|"lobster";type ToolId="rod"|"net";
type Obj={id:number;x:number;y:number;vx:number;vy:number;boot:boolean;hide:number;turn:number;a:number;rock:number;linger:number;dash:number;weed:number;actionIn:number;attack:number;jump:number};
export const TARGETS:Record<TargetId,{name:string;icon:string;seconds:number;speed:number;struggle:number;desc:string}>={
 shrimp:{name:"蝦",icon:"🦐",seconds:GAME_SECONDS,speed:10,struggle:.05,desc:"會躲進水草、偶爾爆衝；網子能一次撈兩隻"},
 crab:{name:"螃蟹",icon:"🦀",seconds:GAME_SECONDS,speed:9,struggle:.05,desc:"沿池底橫著走，靠近時會張開鉗子攻擊"},
 lobster:{name:"龍蝦",icon:"🦞",seconds:GAME_SECONDS,speed:6,struggle:.16,desc:"躲在石頭後偶爾出來，遇到工具會甩尾跳走"},
};
// r=抓取半徑(%)、catchMs=停留多久抓住、carry=安全拖曳速度(%/秒)、lag=跟手延遲、fit=對各目標的適合度（越高越好抓、越不易掉）
export const TOOLS:Record<ToolId,{name:string;icon:string;r:number;catchMs:number;carry:number;lag:number;fit:Record<TargetId,number>;desc:string}>={
 rod:{name:"釣竿",icon:"🎣",...TOOL_BEHAVIOR.rod,fit:TOOL_FIT.rod,desc:"進階挑戰：小鉤要精準對準、停久一點；一次一隻，慢慢提回桶中"},
 net:{name:"網子",icon:"🥅",...TOOL_BEHAVIOR.net,fit:TOOL_FIT.net,desc:"新手推薦：大範圍、快速抓取，可一次撈兩隻；搬運更穩，能擋鉗擊、留住龍蝦"},
};
const ART_BASE=import.meta.env.BASE_URL+"comic/game-v2/";
const POND_BG_TALL=`url(${JSON.stringify(ART_BASE+"pond-bg-tall.webp")})`;
const POND_BG_WIDE=`url(${JSON.stringify(ART_BASE+"pond-bg-wide.webp")})`;
const pondGeom=(el:HTMLElement|null)=>{
 const w=Math.max(1,el?.clientWidth??1),h=Math.max(1,el?.clientHeight??1),m=Math.min(w,h);
 const d=(ax:number,ay:number,bx:number,by:number)=>Math.hypot((ax-bx)/100*w,(ay-by)/100*h);
 return {w,h,m,d,bowlR:.13*m,dropR:.19*m};
};
/** 手指到工作端的距離（px）：手機約 90–120 */
export const gripPx=(h:number)=>Math.round(Math.max(90,Math.min(120,h*.3)));
export const SPRITES=["shrimp","crab","lobster","rod","net","bucket","boot"] as const;
type SpriteName=typeof SPRITES[number];
function V2Img({src,sprite,className=""}:{src:string;sprite:string;className?:string}){
 const [ok,setOk]=useState(true);
 if(!ok)return <CuteArt className={"spr cute "+className} name={sprite}/>;
 return <img className={"spr spr-img "+className} src={src} alt="" draggable={false} data-sprite={sprite} onError={()=>setOk(false)}/>;
}
function Sprite({name,className="",frame=1,caught=false,kind}:{name:SpriteName;emoji?:string;className?:string;frame?:number;caught?:boolean;kind?:TargetId}){
 if(name==="shrimp"||name==="crab"||name==="lobster")return <CuteArt className={"spr cute sea-friend "+(caught?"is-caught ":"")+"swim-"+frame+" "+className} name={name}/>;
 if(name==="boot")return <V2Img className={className} sprite="boot" src={ART_BASE+"boot.webp"}/>;
 if(name==="rod")return <V2Img className={className} sprite="rod" src={ART_BASE+"rod-small.webp"}/>;
 if(name==="bucket"&&kind==="shrimp")return <V2Img className={className} sprite="bucket" src={ART_BASE+"bowl.webp"}/>;
 return <CuteArt className={"spr cute "+className} name={name}/>;
}
function WeedSpr({kind,className=""}:{kind:1|2|3;className?:string}){
 return <V2Img className={className} sprite={"seaweed-"+kind} src={ART_BASE+`seaweed-${kind}.webp`}/>;
}

const GAME_FONT="https://fonts.googleapis.com/css2?family=Chiron+GoRound+TC:wght@500;700;900&family=Fredoka:wght@600;700&display=swap";
const stars=(f:number)=>f>=1.2?"★★★":f>=1?"★★☆":f>=.7?"★☆☆":"☆☆☆";
// 俯視：碗在池中央。座標仍是 0–100%，但距離／速度／命中改依實際像素計算，避免長方形池塘把圓變成橢圓。
const BUCKET={x:50,y:50};
const ROCKS=[{x:20,y:18},{x:80,y:20},{x:22,y:82},{x:78,y:80}];
// 俯視水草簇：可放在池裡各處，避開中央碗；r 是遮擋半徑（最短邊比例）
const WEEDS: {x:number;y:number;kind:1|2|3;r:number}[]=[
 {x:20,y:22,kind:3,r:.13},{x:80,y:24,kind:2,r:.10},{x:18,y:62,kind:1,r:.16},{x:82,y:68,kind:1,r:.16},{x:50,y:84,kind:2,r:.10},
];
const FACE:Record<string,number>={shrimp:-90,lobster:-90,crab:0};
const clamp01=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const clampXY=(o:{x:number;y:number},g?:{w:number;h:number;m:number;bowlR:number})=>{
 const w=g?.w??0,h=g?.h??0,m=g?.m??0;
 if(w<2||h<2||m<2)return; // 池塘還沒排版時不要夾，否則 pad 會把座標推到角落
 const spr=Math.min(150,Math.max(100,.24*m))/2;
 const pad=Math.max(spr+m*.05,m*.08);
 const x0=pad/w*100,x1=100-pad/w*100,y0=pad/h*100,y1=100-pad/h*100;
 o.x=clamp01(o.x,x0,x1);o.y=clamp01(o.y,y0,y1);
 const dx=(o.x-BUCKET.x)/100*w,dy=(o.y-BUCKET.y)/100*h,d=Math.hypot(dx,dy),keep=(g?.bowlR??.13*m)+spr*.35;
 if(d<keep&&d>.1){o.x=BUCKET.x+dx/d*keep/w*100;o.y=BUCKET.y+dy/d*keep/h*100}
 else if(d<=.1){o.x=BUCKET.x+keep/w*100}
};
const nearWeed=(o:{x:number;y:number},g:ReturnType<typeof pondGeom>)=>{
 let best=WEEDS[0],bd=Infinity;
 for(const w of WEEDS){const d=g.d(w.x,w.y,o.x,o.y);if(d<bd){bd=d;best=w}}
 return {w:best,d:bd,i:WEEDS.indexOf(best)};
};
// 躲在水草裡（linger）或大部分被葉子擋住時釣不到
const behindWeed=(o:Obj,g:ReturnType<typeof pondGeom>)=>{
 if(o.boot)return false;
 if(o.linger>0)return true;
 const {w,d}=nearWeed(o,g);return d<w.r*g.m*.62;
};
export default function ShrimpGame({origin,onClose}:{origin:string;onClose:()=>void}){
 const [phase,setPhase]=useState<"intro"|"play"|"sending"|"done">("intro"),[msg,setMsg]=useState(""),[target,setTarget]=useState<TargetId>("shrimp"),[tool,setTool]=useState<ToolId>("net");
 const [,force]=useState(0),[flash,setFlash]=useState("");
 const [nickname,setNickname]=useState(()=>{try{return localStorage.getItem('shrimp-nickname')??''}catch{return ''}});
 const [playerId]=useState(()=>{try{const saved=localStorage.getItem('shrimp-player-id');if(saved&&/^[A-Za-z0-9_-]{20,64}$/.test(saved))return saved;const id=crypto.randomUUID();localStorage.setItem('shrimp-player-id',id);return id}catch{return crypto.randomUUID()}});
 const [passed,setPassed]=useState(false),[boardRefresh,setBoardRefresh]=useState(0);
 const [finalScore,setFinalScore]=useState<number|null>(null);
 const unitPoints=pointsPerCatch(target,tool);
 const reduce=typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
 const pond=useRef<HTMLDivElement>(null);
 const st=useRef({gameId:"",end:0,caught:0,objs:[] as Obj[],last:0,raf:0,over:false,
  ptr:{x:50,y:50},grip:null as null|{x:number;y:number},tx:50,ty:50,down:false,hold:null as null|{id:number;since:number},carry:null as null|Obj,carry2:null as null|Obj,risk:0,speed:0,left:GAME_SECONDS,dashIn:3,ripples:[] as {x:number;y:number;t:number}[]});
 const T=TARGETS[target],K=TOOLS[tool];
 const gNow=()=>pondGeom(pond.current);
 const spawn=(id:number,boot=false):Obj=>{
  const g=gNow(),sp=(boot?4:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6),a=Math.random()*Math.PI*2,rock=Math.floor(Math.random()*ROCKS.length);
  const lob=target==="lobster"&&!boot,o={id,x:lob?ROCKS[rock].x:20+Math.random()*60,y:lob?ROCKS[rock].y:20+Math.random()*60,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,boot,hide:lob?1+Math.random()*3:0,turn:1+Math.random()*2,a:a*180/Math.PI,rock,linger:0,dash:0,weed:0,actionIn:2+Math.random()*3,attack:0,jump:0};
  clampXY(o,g);return o;
 };
 const dropPair=(s:typeof st.current,g:ReturnType<typeof pondGeom>,now:number,reason:string)=>{
  const items=[s.carry,s.carry2].filter((x):x is Obj=>!!x);
  for(const c of items){clampXY(c,g);c.turn=0;c.dash=0;c.linger=0}
  if(items[0])s.ripples.push({x:items[0].x,y:items[0].y,t:now});
  s.carry=null;s.carry2=null;s.risk=0;
  setFlash(reason+" 再試一次！");
 };
 async function start(){
  setMsg("");setPassed(false);setFinalScore(null);
  try{localStorage.setItem('shrimp-nickname',nickname.trim())}catch{/* Optional preference. */}
  try{const r=await fetch(origin+"/api/public/game/start",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({target,tool,nickname:nickname.trim(),playerId})});if(!r.ok){setMsg(await errorText(r,"目前無法開始遊戲"));return}
   const d=await r.json();const s=st.current,n=target==="shrimp"?8:target==="lobster"?4:6;
   Object.assign(s,{gameId:d.gameId,end:performance.now()+(d.seconds??T.seconds)*1000,caught:0,objs:[...Array.from({length:n},(_,i)=>spawn(i)),spawn(90,true)],last:performance.now(),over:false,down:false,hold:null,carry:null,carry2:null,risk:0,speed:0,left:GAME_SECONDS,dashIn:2+Math.random()*2,ripples:[],tx:30,ty:30,ptr:{x:30,y:30},grip:null});
   setPhase("play");s.raf=requestAnimationFrame(tick);
  }catch{setMsg("連線中斷，請再試一次")}
 }
 function tick(now:number){
  const s=st.current;if(s.over)return;
  const dt=Math.min(.05,(now-s.last)/1000);s.last=now;
  const g=gNow(),hitR=K.r/100*g.m,sx=g.m/g.w,sy=g.m/g.h;
  // 工具跟手（有延遲，網子水阻最大）；速度用像素，長方形池也不會橫向變快
  const k=1-Math.pow(K.lag,dt*10),ox=s.tx,oy=s.ty;s.tx+=(s.ptr.x-s.tx)*k;s.ty+=(s.ptr.y-s.ty)*k;
  const vPx=g.d(s.tx,s.ty,ox,oy)/Math.max(dt,1e-3);s.speed=s.speed*.8+vPx*.2;
  const freezeId=s.down&&s.hold&&!s.carry?s.hold.id:-1;
  for(const o of s.objs){
   if(!o.boot){
    o.actionIn=Math.max(0,o.actionIn-dt);
    if(target==='crab'){
     if(o.attack>0){
      o.attack=Math.max(0,o.attack-dt);
      if(o.attack===0&&s.down&&g.d(o.x,o.y,s.tx,s.ty)<.14*g.m){
       if(toolBlocksThreat(target,tool))setFlash(K.name+'擋住了螃蟹鉗擊！');
       else{if(o===s.carry||o===s.carry2)dropPair(s,g,now,'螃蟹鉗擊，工具鬆開了！');s.hold=null;s.down=false;setFlash('螃蟹鉗擊！先閃開，再按住工具')}
      }
     }else if(o.actionIn<=0&&s.down&&g.d(o.x,o.y,s.tx,s.ty)<.19*g.m){o.attack=.65;o.actionIn=3+Math.random()*2;setFlash('小心！螃蟹準備鉗擊')}
    }
    if(target==='lobster'){
     if(o.jump>0){o.jump=Math.max(0,o.jump-dt);if(o.jump===0)s.ripples.push({x:o.x,y:o.y,t:now})}
     const protectedCatch=(o===s.carry||o===s.carry2)&&toolBlocksThreat(target,tool);
     if(o.jump<=0&&o.actionIn<=0&&!protectedCatch&&((s.down&&g.d(o.x,o.y,s.tx,s.ty)<.22*g.m)||Math.random()<dt*.5)){
      if(o===s.carry||o===s.carry2)dropPair(s,g,now,'龍蝦甩尾跳走了！');
      if(s.hold?.id===o.id)s.hold=null;
      const angle=Math.atan2((o.y-s.ty)/sy,(o.x-s.tx)/sx)+(Math.random()-.5)*.6;
      o.jump=.6;o.dash=.6;o.hide=0;o.actionIn=3+Math.random()*2;o.vx=Math.cos(angle)*T.speed*6;o.vy=Math.sin(angle)*T.speed*6;
      setFlash('龍蝦跳走了！落水後再抓，網子能留住牠')
     }
    }
   }
   if(o===s.carry||o===s.carry2)continue;
   if(o.id===freezeId&&o.jump<=0){o.vx=0;o.vy=0;continue} // 跳躍中的龍蝦不會被工具凍住。
   if(o.hide>0){o.hide-=dt;const r=ROCKS[o.rock];o.x+=(r.x-o.x)*Math.min(1,dt*4);o.y+=(r.y-o.y)*Math.min(1,dt*4);continue}
   if(target==="shrimp"&&o.linger>0){o.linger-=dt;const w=WEEDS[o.weed]??nearWeed(o,g).w;o.x+=(w.x-o.x)*Math.min(1,dt*3);o.y+=(w.y-o.y)*Math.min(1,dt*3);continue}
   if(o.dash>0){o.dash-=dt;if(o.dash<=0){const sp=(o.boot?4:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6),ang=Math.atan2(o.vy,o.vx);o.vx=Math.cos(ang)*sp;o.vy=Math.sin(ang)*sp}}
   else{o.turn-=dt;if(o.turn<=0){o.turn=(target==="shrimp"?.8:1)+Math.random()*2;
    // 俯視：任意方向游動／爬行；螃蟹會停頓，龍蝦會躲回最近的石頭；蝦靠近水草時偶爾躲進去
    // vx/vy 單位：最短邊的 %／秒，換算成 x%/y% 時乘 m/w、m/h，像素速度各向相同
    const a=Math.random()*Math.PI*2,sp=(o.boot?4:T.speed)*(reduce?.6:1)*(.7+Math.random()*.6);
    if(target==="crab"&&!o.boot&&Math.random()<.4){o.vx=0;o.vy=0}else{o.vx=Math.cos(a)*sp;o.vy=Math.sin(a)*sp}
    if(target==="lobster"&&!o.boot&&Math.random()<.35){o.rock=ROCKS.map((r,i)=>[g.d(r.x,r.y,o.x,o.y),i]).sort((p,q)=>p[0]-q[0])[0][1];o.hide=1.5+Math.random()*2}
    if(target==="shrimp"&&!o.boot&&Math.random()<.28){const nw=nearWeed(o,g);if(nw.d<nw.w.r*g.m*1.15){o.weed=nw.i;o.linger=.8+Math.random()*1.2;o.vx=0;o.vy=0}}}}
   const bx=o.x,by=o.y;
   o.x+=o.vx*dt*sx;o.y+=o.vy*dt*sy;
   clampXY(o,g);
   if((o.x-bx)*o.vx<0)o.vx*=-1;if((o.y-by)*o.vy<0)o.vy*=-1;
   if(Math.hypot(o.vx,o.vy)>1)o.a=Math.atan2(o.vy,o.vx)*180/Math.PI;
  }
  if(target==="shrimp"&&!reduce){
   s.dashIn-=dt;
   if(s.dashIn<=0){
    s.dashIn=2.4+Math.random()*2.8;
    const cand=s.objs.filter(o=>!o.boot);
    const o=cand[Math.floor(Math.random()*cand.length)];
    if(o){
     const hooked=o===s.carry||o===s.carry2||(s.down&&!!s.hold&&!s.carry&&s.hold.id===o.id);
     if(hooked){
      if(Math.random()<.15){
       if(o===s.carry||o===s.carry2)dropPair(s,g,now,"蝦子爆衝跑掉了！");
       else{
        s.hold=null;
        const ang=Math.random()*Math.PI*2,sp=T.speed*3;
        o.vx=Math.cos(ang)*sp;o.vy=Math.sin(ang)*sp;o.dash=.5;o.linger=0;
        setFlash("蝦子爆衝跑掉了！");
       }
      }
     }else if(o.hide<=0&&o.linger<=0){
      const ang=Math.random()*Math.PI*2,sp=T.speed*3;
      o.vx=Math.cos(ang)*sp;o.vy=Math.sin(ang)*sp;o.dash=.5;
     }
    }
   }
  }
  if(s.down&&!s.carry){
   const near=s.objs.filter(o=>o.hide<=0&&o.jump<=0&&!behindWeed(o,g)&&g.d(o.x,o.y,s.tx,s.ty)<hitR).sort((a,b)=>g.d(a.x,a.y,s.tx,s.ty)-g.d(b.x,b.y,s.tx,s.ty))[0];
   if(!near)s.hold=null;
   else if(!s.hold||s.hold.id!==near.id)s.hold={id:near.id,since:now};
   else if(now-s.hold.since>=(near.boot?200:K.catchMs/K.fit[target])){
    s.hold=null;
    if(near.boot){setFlash("撈到破鞋！不計分，再試一次");Object.assign(near,spawn(near.id,true))}
    else{
     s.carry=near;s.carry2=null;s.risk=0;near.linger=0;near.dash=0;
     // 網子可同時撈兩隻，只收附近的獵物。
     if(tool==="net"){
      const others=s.objs.filter(o=>o!==near&&!o.boot&&o.hide<=0&&o.jump<=0&&!behindWeed(o,g));
      others.sort((a,b)=>g.d(a.x,a.y,near.x,near.y)-g.d(b.x,b.y,near.x,near.y));
      const close=others.find(o=>g.d(o.x,o.y,near.x,near.y)<hitR*1.2);
      const extra=close??null;
      if(extra){extra.linger=0;extra.dash=0;s.carry2=extra;setFlash("一次 2 隻！")}
     }
     if(!s.carry2)setFlash(`抓到${T.name}了！慢慢拖到${target==="shrimp"?"碗":"水桶"}`);
    }
   }
  }
  if(s.carry){
   const c=s.carry;c.x=s.tx;c.y=s.ty;
   if(s.carry2){s.carry2.x=s.tx+7*(g.m/g.w);s.carry2.y=s.ty-5*(g.m/g.h)}
   const safe=K.carry/100*g.m*K.fit[target];
   s.risk+=(Math.max(0,s.speed/safe-1)*2.2+T.struggle/K.fit[target])*dt;
   if(s.risk>=1)dropPair(s,g,now,s.speed>safe?"拖太快，掉回水裡了！":`${T.name}一掙扎，跑掉了！`);
  }
  s.ripples=s.ripples.filter(r=>now-r.t<900);s.left=Math.max(0,(s.end-now)/1000);force(x=>x+1);
  if(s.left<=0){finish();return}
  s.raf=requestAnimationFrame(tick);
 }
 function release(){
  const s=st.current;s.down=false;s.hold=null;
  if(s.over)return;
  if(performance.now()>=s.end){finish();return}
  if(!s.carry)return;
  const c=s.carry,c2=s.carry2;s.carry=null;s.carry2=null;const g=gNow();
  if(g.d(s.tx,s.ty,BUCKET.x,BUCKET.y)<g.dropR){
   const n=c2?2:1;s.caught+=n;
   setFlash(c2?`一次 2 隻！共 ${s.caught} 隻`:`入桶！共 ${s.caught} 隻`);
   const i=s.objs.indexOf(c);if(i>=0)s.objs[i]=spawn(c.id+100);
   if(c2){const j=s.objs.indexOf(c2);if(j>=0)s.objs[j]=spawn(c2.id+100)}
  }else{clampXY(c,g);if(c2)clampXY(c2,g);setFlash("還沒到"+(target==="shrimp"?"碗":"水桶")+"就放開了")}
 }
 async function finish(){
  const s=st.current;if(s.over)return;s.over=true;cancelAnimationFrame(s.raf);setPhase("sending");
  try{const r=await fetch(origin+"/api/public/game/finish",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({gameId:s.gameId,caught:s.caught})});
   if(!r.ok){setMsg(await errorText(r,"結算失敗"));setPhase("done");return}
   const d=await r.json();setFinalScore(d.score);setPassed(!!d.won);setBoardRefresh(n=>n+1);setPhase("done");
  }catch{setMsg("連線中斷，這局無法結算");setPhase("done")}
 }
 useEffect(()=>{const s=st.current;return()=>{s.over=true;cancelAnimationFrame(s.raf)}},[]);
 // 圓體字型只在打開遊戲時載入，不影響其他頁面
 useEffect(()=>{if(document.getElementById("game-cute-font"))return;const l=document.createElement("link");l.id="game-cute-font";l.rel="stylesheet";l.href=GAME_FONT;document.head.appendChild(l)},[]);
 // 開局時池塘才掛上 DOM，依實際長寬再夾一次，避免全部擠在角落
 useLayoutEffect(()=>{if(phase!=="play")return;const el=pond.current,s=st.current;if(!el||el.clientWidth<2)return;const g=gNow();
  for(const o of s.objs){if(o.x<0||o.x>100||o.y<0||o.y>100){o.x=20+Math.random()*60;o.y=20+Math.random()*60}clampXY(o,g)}},[phase]);
 useEffect(()=>{if(!flash)return;const t=setTimeout(()=>setFlash(""),1300);return()=>clearTimeout(t)},[flash]);
 // 鍵盤：方向鍵移動，空白鍵按住＝放下工具，放開＝提起
 useEffect(()=>{if(phase!=="play")return;const s=st.current;
  const kd=(e:KeyboardEvent)=>{const step:Record<string,[number,number]>={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,-3],ArrowDown:[0,3]};
   if(step[e.code]){e.preventDefault();const g=gNow();s.ptr={x:Math.max(0,Math.min(100,s.ptr.x+step[e.code][0]*(g.m/g.w))),y:Math.max(0,Math.min(100,s.ptr.y+step[e.code][1]*(g.m/g.h)))}}
   else if(e.code==="Space"){e.preventDefault();s.down=true}};
  const ku=(e:KeyboardEvent)=>{if(e.code==="Space"){e.preventDefault();release()}};
  addEventListener("keydown",kd);addEventListener("keyup",ku);return()=>{removeEventListener("keydown",kd);removeEventListener("keyup",ku)}},[phase]);
 // 握把在手指、工作端（鉤子/網子）在手指上方 GRIP px，避免手指擋住；命中判定用工作端
 const at=(e:React.PointerEvent)=>{const r=pond.current!.getBoundingClientRect(),off=gripPx(r.height),q=st.current;
  q.grip={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};
  q.ptr={x:Math.max(0,Math.min(100,q.grip.x)),y:Math.max(0,Math.min(100,(e.clientY-off-r.top)/r.height*100))}};
 const s=st.current,holdPct=s.hold?Math.min(1,(performance.now()-s.hold.since)/(K.catchMs/K.fit[target])):0;
 const left=Math.max(0,COUPON_CATCH_MIN-s.caught),timeLow=phase==="play"&&s.left<=10;
 const swimFrame=reduce?1:(Math.floor(performance.now()/220)%2)+1;
 const vessel=target==="shrimp"?"碗":"水桶";
 return <div className="sheet-backdrop game-backdrop" onClick={phase==="play"?undefined:onClose}><div className={"sheet game cute"+(reduce?" reduce":"")+" ph-"+phase} role="dialog" aria-label="樂甜釣蝦場" onClick={e=>e.stopPropagation()}>
  <div className="game-top">
   {phase==="play"||phase==="sending"?<span className="icon-btn ghost" aria-hidden/>:<button type="button" className="icon-btn" aria-label="關閉遊戲" onClick={onClose}>×</button>}
   {phase!=="intro"&&<h2><Sprite name="shrimp" className="title-ico"/>樂甜釣蝦場</h2>}
   <span className="mode-badge"><i/>免費玩・贏折價券</span>
  </div>
  {phase==="intro"&&<div className="game-body">
   <section className="game-hero">
    <span className="eyebrow">ANXING · CATCH &amp; PLAY</span>
    <small className="hero-brand">安星水產</small>
    <h2 className="wordmark" aria-label="樂甜釣蝦場">{"樂甜釣蝦場".split("").map((c,i)=><b key={i} aria-hidden>{c}</b>)}</h2>
    <p className="hero-sub">選好工具，把海鮮好朋友撈進水桶！</p>
    <div className="hero-art" aria-hidden><CuteArt name="crab" className="m m-crab"/><Sprite name="bucket" kind="shrimp" className="m m-bucket"/><Sprite name="shrimp" className="m m-shrimp"/><CuteArt name="lobster" className="m m-lobster"/><i className="spark s1">✦</i><i className="spark s2">✧</i><i className="spark s3">✦</i><span className="bubble-tag">一起來玩！</span></div>
    <div className="hero-facts"><div><b>{T.seconds}<small>秒</small></b><span>限時挑戰</span></div><div><b>∞</b><span>不限捕獲數</span></div><div><b>0<small>元</small></b><span>免費遊玩</span></div></div>
   </section>
   <GameVoucherWallet origin={origin}/><GameLeaderboard origin={origin} target={target} refresh={boardRefresh}/>
   <p className="game-step"><i>1</i>選要抓什麼</p>
   <div className="pick-row" role="radiogroup" aria-label="目標">{(Object.keys(TARGETS) as TargetId[]).map(id=><button key={id} type="button" role="radio" aria-checked={target===id} className={"pick"+(target===id?" on":"")} onClick={()=>setTarget(id)}><Sprite className="pick-icon" name={id} emoji={TARGETS[id].icon}/><b>{TARGETS[id].name}</b><small>每隻 {pointsPerCatch(id,tool)} 分</small></button>)}</div>
   <p className="pick-desc">{T.desc}</p>
   <p className="game-step"><i>2</i>選工具 <small>網子簡單・釣竿進階，釣竿積分更高</small></p>
   <div className="pick-row tools" role="radiogroup" aria-label="工具">{(Object.keys(TOOLS) as ToolId[]).map(id=><button key={id} type="button" role="radio" aria-checked={tool===id} className={"pick"+(tool===id?" on":"")} onClick={()=>setTool(id)}><Sprite className="pick-icon" name={id} emoji={TOOLS[id].icon}/><b>{TOOLS[id].name}</b><small className="tool-level">{id==="net"?"簡單・新手推薦":"較難・精準挑戰"}</small><small className="stars">{stars(TOOLS[id].fit[target])}</small><small className="tool-points">每隻 {pointsPerCatch(target,id)} 分</small></button>)}</div>
   <p className="pick-desc">{K.desc}</p><p className="pick-desc">每局固定 30 秒，不限捕獲數。{K.name}抓{T.name}每隻 {unitPoints} 分。</p>
   <div className="rule-card"><b className="rule-title">怎麼玩</b>
    <ol className="rule-steps">
     <li><i>1</i><span>手指按住的是{K.name}<b>握把（尾端）</b>，{K.name}前端在手指上方，不會被手指擋住。</span></li>
     <li><i>2</i><span>按住水面放下{K.name}，停在{T.name}身上直到<b>圈圈填滿</b>就抓住。</span></li>
     <li><i>3</i><span>按著<b>慢慢</b>拖到池中央的{vessel}再放開，就入桶囉！</span></li>
    </ol>
    <div className="rule-chips"><span className="chip ok">固定 30 秒・不限次數</span><span className="chip ok">網子可撈 2 隻・釣竿一次 1 隻</span><span className="chip warn">拖太快、掙扎會掉回水裡</span><span className="chip warn">{target==="crab"?"螃蟹會鉗擊，網子可抵擋":target==="lobster"?"龍蝦會跳走，撈進網子可留住":"蝦子會躲水草、偶爾爆衝"}</span><span className="chip warn">撈到破鞋不計分</span></div>
   </div>
   <p className="game-prize"><span className="ticket" aria-hidden>🎟️</span><span>抓到 6 隻以上獎勵：<b>店內商品滿 NT$1,000 折 NT$5</b> 優惠券<small><b>{COUPON_RULE}</b><br/>加入 LINE 社群、填寫群組暱稱，門市核對後才發券。每天限領一次。</small></span></p><a className="voucher-join" href={LINE_GROUP_URL} target="_blank" rel="noopener noreferrer">加入安星水產 LINE 社群 ↗</a>
   <label className="game-nickname">排行榜暱稱（選填）<input value={nickname} onChange={e=>setNickname([...e.target.value].slice(0,12).join(''))} maxLength={24} placeholder="例如：小蝦高手" autoComplete="off"/><small>限 12 字；填寫後，積分與暱稱會公開上榜。留空只玩遊戲、不公開成績，請勿填姓名或電話。</small></label>
   {msg&&<p className="err">{msg}</p>}
   <button type="button" className="primary grow btn-gold" onClick={start}>開始抓{T.name} <span aria-hidden>▶</span></button>
   <button type="button" className="sheet-close text-btn" onClick={onClose}>先不要</button>
  </div>}
  {phase!=="intro"&&<div className="game-body play">
   <div className="game-stats">
    <div className="hud-cell"><small>抓到</small><span className="caught"><Sprite className="hud-ico" name={target} emoji={T.icon}/> {s.caught} 隻</span></div>
    <div className={"hud-cell hud-time"+(timeLow?" low":"")}><small>剩餘時間</small><strong><b>{Math.ceil(s.left)}</b><small>s</small></strong></div>
    <div className="hud-cell"><small>積分</small><strong>{s.caught*unitPoints}</strong></div>
   </div>
   <div className="goal-bar"><div><b>{K.name} · 每隻 {unitPoints} 分</b><span>{left>0?`再抓 ${left} 隻可領券`:"已達領券門檻，繼續衝高分！"}</span></div><div className="goal-track" aria-hidden><i style={{width:Math.min(100,s.caught/COUPON_CATCH_MIN*100)+"%"}}/></div></div>
   <div className="pond-wrap">
   <div className={"pond t-"+target} ref={pond} aria-label={`池塘：按住放下${K.name}，拖到${vessel}放開`} style={{["--pond-bg-tall" as never]:POND_BG_TALL,["--pond-bg-wide" as never]:POND_BG_WIDE} as React.CSSProperties}
    onPointerDown={e=>{if(phase!=="play")return;(e.target as HTMLElement).setPointerCapture?.(e.pointerId);at(e);const q=st.current;q.down=true;q.ripples.push({x:q.ptr.x,y:q.ptr.y,t:performance.now()})}}
    onPointerMove={e=>{if(phase==="play")at(e)}} onPointerUp={()=>{if(phase==="play"){st.current.grip=null;release()}}} onPointerCancel={()=>{if(phase==="play"){st.current.grip=null;release()}}}>
    <span className={"bucket"+(s.carry&&gNow().d(s.tx,s.ty,BUCKET.x,BUCKET.y)<gNow().dropR?" ready":"")} style={{left:BUCKET.x+"%",top:BUCKET.y+"%"}}><Sprite name="bucket" kind={target} className="bucket-vessel"/>{s.caught>0&&<span className={"bucket-contents contents-"+target} data-count={s.caught} role="img" aria-label={`桶裡有 ${s.caught} 隻${T.name}`}>{Array.from({length:s.caught},(_,i)=><span className={'bucket-catch slot-'+(i%4)} style={{marginLeft:((Math.floor(i/4)%3)-1)*4+'%',marginTop:(Math.floor(i/4)%3)*3+'%'}} key={i}><CuteArt name={target} className="bucket-catch-art"/></span>)}<b className="bucket-count">{s.caught} 隻</b></span>}</span>
    {!reduce&&s.ripples.map(r=><span key={r.t} className="ripple" style={{left:r.x+"%",top:r.y+"%"}}/>)}
    {s.objs.map(o=>{const rot=o.boot?o.a/6:target==="crab"?((o.a+90)%180+180)%180-90:o.a-FACE[target];
     const frozen=freezeNow(s,o);
     const carrying=o===s.carry||o===s.carry2;
     return <span key={o.id} className={"pond-obj"+(o.boot?" boot":"")+(o.hide>0?" hidden":"")+(carrying?" carried":"")+(frozen?" frozen":"")+(o.dash>0?" dashing":"")+(o.attack>0?" attacking":"")+(o.jump>0?" jumping":"")} style={{left:o.x+"%",top:o.y+"%",transform:`translate(-50%,-50%) rotate(${rot}deg)`}}>{o.boot?<Sprite name="boot" emoji="🥾"/>:<Sprite name={target} emoji={T.icon} frame={((swimFrame+o.id)%2)+1} caught={carrying}/>}</span>})}
    {target==="shrimp"&&WEEDS.map((w,i)=><span key={"w"+i} className={"weed k-"+w.kind} style={{left:w.x+"%",top:w.y+"%"}}><WeedSpr kind={w.kind}/></span>)}
    {target==="lobster"&&ROCKS.map((r,i)=><span key={i} className="rock" style={{left:r.x+"%",top:r.y+"%"}}><CuteArt name="rock" className="spr cute"/></span>)}
    {tool!=="rod"&&s.grip&&s.down&&<><span className="grip-shaft" style={{left:s.grip.x+"%",top:s.grip.y+"%",height:Math.hypot((s.tx-s.grip.x)*(pond.current?.clientWidth??0)/100,(s.ty-s.grip.y)*(pond.current?.clientHeight??0)/100)+"px",transform:`rotate(${Math.atan2(-(s.tx-s.grip.x)*(pond.current?.clientWidth??0)/100,(s.ty-s.grip.y)*(pond.current?.clientHeight??0)/100)*180/Math.PI+180}deg)`}}/><span className="grip" data-x={s.grip.x.toFixed(1)} data-y={s.grip.y.toFixed(1)} style={{left:s.grip.x+"%",top:s.grip.y+"%"}}/></>}
    {tool!=="rod"&&<span className={"tool-cursor t-"+tool+(s.down?" down":"")} data-x={s.tx.toFixed(1)} data-y={s.ty.toFixed(1)} style={{left:s.tx+"%",top:s.ty+"%",width:Math.max(28,K.r/100*gNow().m*2)+"px"}}><span className="ring" style={{background:`conic-gradient(#ffd35a ${holdPct*360}deg,transparent 0)`}}/><Sprite className="ti" name={tool} emoji={K.icon}/></span>}
    {s.carry&&<span className="risk" aria-label="掉落風險"><i style={{width:Math.min(100,s.risk*100)+"%"}}/></span>}
    {flash&&<span className="pond-flash" role="status">{flash}</span>}
   </div>
   {phase==="play"&&tool==="rod"&&<div className="rod-overlay" aria-hidden>
    <span className={"tool-cursor t-rod"+(s.down?" down":"")} data-x={s.tx.toFixed(1)} data-y={s.ty.toFixed(1)} style={{left:s.tx+"%",top:s.ty+"%",width:Math.max(28,K.r/100*gNow().m*2)+"px"}}><span className="ring" style={{background:`conic-gradient(#ffd35a ${holdPct*360}deg,transparent 0)`}}/><Sprite className="ti" name="rod" emoji={K.icon}/></span>
   </div>}
   </div>
   {phase==="play"&&<button type="button" className="sheet-close text-btn early-end" onClick={onClose}>放棄這局並返回</button>}
  </div>}
  {phase==="sending"&&<div className="game-result"><div className="result-card"><span className="result-spark" aria-hidden>✦</span><p className="hint">結算中…</p></div></div>}
  {phase==="done"&&<div className="game-result"><div className="result-card" role="status">
   <span className="result-spark" aria-hidden>✦</span>
   <p className="result-kicker">30 秒挑戰完成</p>
   <h3>{(finalScore??s.caught*unitPoints).toLocaleString()} 分</h3>
   <div className="result-score"><Sprite name={target} className="result-ico" caught/><b>{s.caught}</b><small>隻{T.name} · {K.name}</small></div>
   {passed?<GameVoucherWallet origin={origin} gameId={s.gameId} playerId={playerId} eligible/>:!msg&&<p className="game-rule">這局抓到 {s.caught} 隻{T.name}；抓到 6 隻以上，加入 LINE 社群並由門市核對暱稱後可領券，每天一次。</p>}
   {s.caught>0&&nickname.trim()&&!msg&&<p className="game-rule">已記錄本局積分，每個分類保留你的最高分。</p>}
   <GameLeaderboard origin={origin} target={target} refresh={boardRefresh}/>
   {msg&&<p className="err">{msg}</p>}
   <button type="button" className="primary grow btn-teal" onClick={()=>{setPhase("intro");setMsg("")}}>再玩一次</button>
   <button type="button" className="sheet-close btn-outline" onClick={onClose}>回到商店</button>
  </div></div>}
 </div></div>;
}
function freezeNow(s:{down:boolean;hold:null|{id:number};carry:null|Obj},o:Obj){
 return !!(s.down&&s.hold&&!s.carry&&s.hold.id===o.id);
}
