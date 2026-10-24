// 釣蝦小遊戲（免費遊玩）：35 秒內釣到 4 隻蝦 → 伺服器發「滿 NT$1,000 折 NT$5」優惠券（每單一張、不累加、24 小時內有效）。
// 開局與結算都經過 Worker；前端不產生優惠碼。
import {useEffect,useRef,useState} from "react";
import {errorText} from "../lib/api-config";
export type Coupon={code:string;discount:number;minTotal:number;expiresAt:string};
type Obj={id:number;x:number;y:number;v:number;boot:boolean;caught?:boolean};
const W=100,SINK_MS=500,COOLDOWN_MS=700,HIT=7;
export default function ShrimpGame({origin,onClose,onCoupon}:{origin:string;onClose:()=>void;onCoupon:(c:Coupon)=>void}){
 const [phase,setPhase]=useState<"intro"|"play"|"sending"|"done">("intro"),[msg,setMsg]=useState(""),[left,setLeft]=useState(35),[caught,setCaught]=useState(0),[hookX,setHookX]=useState(50),[sinking,setSinking]=useState(false),[objs,setObjs]=useState<Obj[]>([]),[won,setWon]=useState<Coupon|null>(null),[flash,setFlash]=useState("");
 const st=useRef({gameId:"",end:0,caught:0,objs:[] as Obj[],last:0,raf:0,busyUntil:0,hookX:50,over:false});
 const spawn=(id:number,boot=false):Obj=>({id,x:Math.random()*W,y:boot?78:30+Math.random()*50,v:(Math.random()<.5?-1:1)*(8+Math.random()*14),boot});
 async function start(){
  setMsg("");
  try{const r=await fetch(origin+"/api/public/game/start",{method:"POST",credentials:"omit"});if(!r.ok){setMsg(await errorText(r,"目前無法開始遊戲"));return}
   const d=await r.json();const s=st.current;
   Object.assign(s,{gameId:d.gameId,end:performance.now()+d.seconds*1000,caught:0,objs:[...Array.from({length:6},(_,i)=>spawn(i)),spawn(90,true),spawn(91,true)],last:performance.now(),busyUntil:0,over:false});
   setCaught(0);setPhase("play");s.raf=requestAnimationFrame(tick);
  }catch{setMsg("連線中斷，請再試一次")}
 }
 function tick(now:number){
  const s=st.current;if(s.over)return;
  const dt=Math.min(.05,(now-s.last)/1000);s.last=now;
  for(const o of s.objs){if(o.caught)continue;o.x+=o.v*dt;if(o.x<2||o.x>W-2){o.v*=-1;o.x=Math.max(2,Math.min(W-2,o.x))}}
  const remain=Math.max(0,(s.end-now)/1000);setLeft(remain);setObjs(s.objs.map(o=>({...o})));
  if(remain<=0||s.caught>=4){finish();return}
  s.raf=requestAnimationFrame(tick);
 }
 function cast(){
  const s=st.current,now=performance.now();if(phase!=="play"||now<s.busyUntil)return;
  s.busyUntil=now+SINK_MS+COOLDOWN_MS;setSinking(true);
  setTimeout(()=>{
   setSinking(false);if(s.over)return;
   const hit=s.objs.filter(o=>!o.caught&&Math.abs(o.x-s.hookX)<HIT).sort((a,b)=>Math.abs(a.x-s.hookX)-Math.abs(b.x-s.hookX))[0];
   if(!hit){setFlash("沒釣到，再預判一下！");return}
   if(hit.boot){s.end-=3000;setFlash("釣到靴子！扣 3 秒");hit.x=Math.random()*W;return}
   s.caught++;setCaught(s.caught);setFlash(`釣到了！${s.caught}/4`);
   const i=s.objs.indexOf(hit);s.objs[i]=spawn(hit.id+100);
  },SINK_MS);
 }
 async function finish(){
  const s=st.current;if(s.over)return;s.over=true;cancelAnimationFrame(s.raf);setPhase("sending");
  try{const r=await fetch(origin+"/api/public/game/finish",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",body:JSON.stringify({gameId:s.gameId,caught:s.caught})});
   if(!r.ok){setMsg(await errorText(r,"結算失敗"));setPhase("done");return}
   const d=await r.json();if(d.won){setWon(d.coupon);onCoupon(d.coupon)}setPhase("done");
  }catch{setMsg("連線中斷，這局無法結算");setPhase("done")}
 }
 useEffect(()=>{const s=st.current;return()=>{s.over=true;cancelAnimationFrame(s.raf)}},[]);
 useEffect(()=>{st.current.hookX=hookX},[hookX]);
 useEffect(()=>{if(!flash)return;const t=setTimeout(()=>setFlash(""),1100);return()=>clearTimeout(t)},[flash]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(phase!=="play")return;if(e.code==="ArrowLeft")setHookX(x=>Math.max(0,x-4));else if(e.code==="ArrowRight")setHookX(x=>Math.min(W,x+4));else if(e.code==="Space"){e.preventDefault();cast()}};addEventListener("keydown",k);return()=>removeEventListener("keydown",k)},[phase]);
 const pond=useRef<HTMLDivElement>(null);
 const drag=(e:React.PointerEvent)=>{if(phase!=="play"||!pond.current||(e.type==="pointermove"&&!e.buttons))return;const r=pond.current.getBoundingClientRect();setHookX(Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W)))};
 return <div className="sheet-backdrop" onClick={phase==="play"?undefined:onClose}><div className="sheet game" role="dialog" aria-label="釣蝦小遊戲" onClick={e=>e.stopPropagation()}>
  <div className="sheet-grab"/><h2>🦐 小朋友釣蝦場</h2>
  {phase==="intro"&&<><p className="game-rule">35 秒內釣到 <b>4 隻蝦</b>就贏！拖曳或用滑桿移動魚鉤，預判蝦子游過來時按「下鉤」。魚鉤下沉約 0.5 秒；釣到靴子會扣 3 秒。</p>
   <p className="game-prize">獲勝獎勵：<b>滿 NT$1,000 折 NT$5</b> 優惠券（每筆訂單限用一張、不累加、24 小時內有效）。免費遊玩，不用先購買。</p>
   {msg&&<p className="err">{msg}</p>}<button className="primary grow" onClick={start}>開始釣蝦</button><button className="sheet-close" onClick={onClose}>先不要</button></>}
  {phase!=="intro"&&<>
   <div className="game-stats"><span>⏱ {left.toFixed(1)} 秒</span><span>🦐 {caught} / 4</span></div>
   <div className="pond" ref={pond} onPointerDown={drag} onPointerMove={drag}>
    {objs.filter(o=>!o.caught).map(o=><span key={o.id} className={"pond-obj"+(o.boot?" boot":"")} style={{left:o.x+"%",top:o.y+"%",transform:`translate(-50%,-50%) scaleX(${o.v>0?-1:1})`}}>{o.boot?"🥾":"🦐"}</span>)}
    <span className="line" style={{left:hookX+"%",height:sinking?"86%":"18%"}}/><span className="hook" style={{left:hookX+"%",top:sinking?"86%":"18%"}}>🪝</span>
    {flash&&<span className="pond-flash">{flash}</span>}
   </div>
   {phase==="play"&&<><input className="hook-range" type="range" min={0} max={W} value={hookX} onChange={e=>setHookX(+e.target.value)} aria-label="魚鉤位置"/>
    <button className="primary grow" onClick={cast} disabled={sinking}>{sinking?"下沉中…":"下鉤！"}</button></>}
   {phase==="sending"&&<p className="hint">結算中…</p>}
   {phase==="done"&&<>{won?<div className="coupon-card"><b>恭喜過關！</b><span>滿 NT${won.minTotal.toLocaleString()} 折 NT${won.discount}</span><small>已存到購物車，結帳時自動套用・{new Date(won.expiresAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})} 前有效</small></div>:!msg&&<p className="game-rule">這局釣到 {caught} 隻，差一點！再挑戰一次吧。</p>}
    {msg&&<p className="err">{msg}</p>}
    <button className="primary grow" onClick={()=>{setPhase("intro");setLeft(35);setWon(null);setMsg("")}}>再玩一次</button><button className="sheet-close" onClick={onClose}>回到商店</button></>}
  </>}
 </div></div>;
}
