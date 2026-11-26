import {useEffect,useRef,useState} from 'react';
import {errorText} from '../lib/api-config';
import {LINE_GROUP_URL,GACHA_RULE,prizeName,prizeRule,isGift,voucherStatus,type GameVoucher} from '../lib/game-vouchers';
import {endOfTaipeiDay} from '../lib/game-rules';
import {useTaipeiDay} from '../lib/use-taipei-day';
type Eligibility={gameId:string;playerId:string;expiresAt:string};
type Receipt={token:string;voucher:GameVoucher};
function read<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)??'null')}catch{return null}}
function save(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* The current session still works without storage. */}}
export default function GameVoucherWallet({origin,gameId,playerId,eligible=false}:{origin:string;gameId?:string;playerId?:string;eligible?:boolean}){
 const [entry,setEntry]=useState<Eligibility|null>(()=>read('game-voucher-eligibility'));
 const [receipt,setReceipt]=useState<Receipt|null>(()=>read('game-voucher-receipt'));
 const [drawing,setDrawing]=useState(false);
 const [nickname,setNickname]=useState(()=>read<string>('game-group-nickname')??''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const today=useTaipeiDay();
 const attempt=useRef<{gameId:string;token:string}|null>(read('game-voucher-attempt'));
 useEffect(()=>{if(eligible&&gameId&&playerId){const value={gameId,playerId,expiresAt:endOfTaipeiDay()};setEntry(value);save('game-voucher-eligibility',value)}},[eligible,gameId,playerId]);
 async function refresh(){if(!receipt)return;try{const r=await fetch(origin+'/api/public/game/vouchers/status',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({claimToken:receipt.token})});if(!r.ok)throw Error(await errorText(r));const value={token:receipt.token,voucher:(await r.json()).voucher};setReceipt(value);save('game-voucher-receipt',value);setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'暫時無法讀取，請稍後再試')}}
 useEffect(()=>{if(!receipt)return;refresh();if(!['pending','approved'].includes(receipt.voucher.status))return;const update=()=>{if(!document.hidden)refresh()};const timer=setInterval(update,10000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}},[origin,receipt?.token,receipt?.voucher.status,today]);
 const canClaim=!!entry&&Date.parse(entry.expiresAt)>Date.now();
 const current=receipt&&receipt.voucher.claimDay===today&&Date.parse(receipt.voucher.expiresAt)>Date.now()&&!['rejected','expired'].includes(receipt.voucher.status);
 async function claim(e:React.FormEvent){
  e.preventDefault();if(!entry)return;setBusy(true);setDrawing(true);setMessage('');
  if(attempt.current?.gameId!==entry.gameId){attempt.current={gameId:entry.gameId,token:crypto.randomUUID()};save('game-voucher-attempt',attempt.current)}
  try{const r=await fetch(origin+'/api/public/game/vouchers/claim',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({...entry,claimToken:attempt.current!.token,groupNickname:nickname,joined:true,drawVersion:1})});if(!r.ok)throw Error(await errorText(r));const value={token:attempt.current!.token,voucher:(await r.json()).voucher};setReceipt(value);save('game-voucher-receipt',value);save('game-group-nickname',nickname.trim());setMessage('扭蛋完成！請到門市出示獎項，由員工確認今天日期與群組暱稱後核銷。')}catch(e){setMessage(e instanceof Error?e.message:'送出失敗，請再試一次')}finally{setBusy(false);setDrawing(false)}
 }
 if(!receipt&&!canClaim&&!eligible)return null;
 return <details className="game-voucher-wallet" open={eligible||undefined}><summary>🎁 我的每日扭蛋獎項{current?' · '+voucherStatus[receipt!.voucher.status]:''}</summary><div>
  {drawing&&<div className="gacha-drawing" role="status"><span aria-hidden>🎰</span><b>扭蛋中…</b></div>}
  {current?<section className={'coupon-card voucher-'+receipt!.voucher.status}>
   <b>{isGift(receipt!.voucher)?"🎁 神秘小禮":"🎟 折價券"} · {receipt!.voucher.status==="approved"?"今天可兌換":voucherStatus[receipt!.voucher.status]}</b><strong className="voucher-date">有效日期：{receipt!.voucher.claimDay.replaceAll("-","/")}（今天有效）</strong><span className="gacha-prize-title">{prizeName(receipt!.voucher)}</span>
   <strong className="voucher-nickname">群組暱稱：{receipt!.voucher.groupNickname}</strong><code>{receipt!.voucher.voucherNo}</code>
   <small>{prizeRule(receipt!.voucher)}</small>
   {receipt!.voucher.status==='pending'?<p>尚不能使用。請向門市出示 LINE 社群會員畫面；店員核對暱稱後才會發券。</p>:receipt!.voucher.status==='approved'?<p>到店出示此畫面，請店員核對日期、暱稱與兌換條件後在後台核銷。每天限扭一次，每個獎項限兌換一次。</p>:<p>這個獎項已兌換。</p>}
   <button type="button" className="sheet-close btn-outline" onClick={refresh}>更新使用狀態</button>
  </section>:canClaim?<form onSubmit={claim}>
   <strong className="voucher-date">今天日期：{today.replaceAll("-","/")}</strong><p>{GACHA_RULE}</p><p>已取得今天的扭蛋資格！加入 LINE 社群後，填寫群組暱稱即可扭蛋。</p>
   <div className={"gacha-machine"+(busy?" is-drawing":"")} aria-hidden><div className="gacha-globe"><i/><i/><i/><i/><i/></div><div className="gacha-base"><span>✦</span><b/></div></div>
   <a className="voucher-join" href={LINE_GROUP_URL} target="_blank" rel="noopener noreferrer">加入安星水產 LINE 社群 ↗</a>
   <label>LINE 群組暱稱<input required value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={40} placeholder="請與 LINE 社群顯示的暱稱相同" autoComplete="off"/></label>
   <p className="voucher-note">同一暱稱每天成功限扭一次；網路重試不會更換獎項。神秘小禮免消費，但需入群並由店員核對會員資格，兩種獎項都限當天到店核銷。暱稱不會公開在排行榜。</p>
   <button type="submit" className="primary grow btn-teal" disabled={busy}>{busy?'扭蛋中…':'已加入 LINE，立即扭蛋'}</button>
  </form>:<p>{receipt?.voucher.status==='rejected'?'核對未通過，請確認社群暱稱後再挑戰。':'獎項紀錄已過期，今天再挑戰 1500 分（含）以上即可扭蛋。'}</p>}
  {message&&<p role="status" className="voucher-message">{message}</p>}
 </div></details>;
}
