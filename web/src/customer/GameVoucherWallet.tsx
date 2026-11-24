import {useEffect,useRef,useState} from 'react';
import {errorText} from '../lib/api-config';
import {LINE_GROUP_URL,VOUCHER_RULE,voucherStatus,type GameVoucher} from '../lib/game-vouchers';
import {endOfTaipeiDay} from '../lib/game-rules';
type Eligibility={gameId:string;playerId:string;expiresAt:string};
type Receipt={token:string;voucher:GameVoucher};
function read<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)??'null')}catch{return null}}
function save(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* The current session still works without storage. */}}
export default function GameVoucherWallet({origin,gameId,playerId,eligible=false}:{origin:string;gameId?:string;playerId?:string;eligible?:boolean}){
 const [entry,setEntry]=useState<Eligibility|null>(()=>read('game-voucher-eligibility'));
 const [receipt,setReceipt]=useState<Receipt|null>(()=>read('game-voucher-receipt'));
 const [nickname,setNickname]=useState(()=>read<string>('game-group-nickname')??''),[joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const attempt=useRef<{gameId:string;token:string}|null>(read('game-voucher-attempt'));
 useEffect(()=>{if(eligible&&gameId&&playerId){const value={gameId,playerId,expiresAt:endOfTaipeiDay()};setEntry(value);save('game-voucher-eligibility',value)}},[eligible,gameId,playerId]);
 async function refresh(){if(!receipt)return;try{const r=await fetch(origin+'/api/public/game/vouchers/status',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({claimToken:receipt.token})});if(!r.ok)throw Error(await errorText(r));const value={token:receipt.token,voucher:(await r.json()).voucher};setReceipt(value);save('game-voucher-receipt',value);setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'暫時無法讀取，請稍後再試')}}
 useEffect(()=>{if(!receipt)return;refresh();if(receipt.voucher.status!=='pending')return;const timer=setInterval(refresh,15000);return()=>clearInterval(timer)},[origin,receipt?.token,receipt?.voucher.status]);
 const canClaim=!!entry&&Date.parse(entry.expiresAt)>Date.now();
 const current=receipt&&Date.parse(receipt.voucher.expiresAt)>Date.now()&&!['rejected','expired'].includes(receipt.voucher.status);
 async function claim(e:React.FormEvent){
  e.preventDefault();if(!entry)return;setBusy(true);setMessage('');
  if(attempt.current?.gameId!==entry.gameId){attempt.current={gameId:entry.gameId,token:crypto.randomUUID()};save('game-voucher-attempt',attempt.current)}
  try{const r=await fetch(origin+'/api/public/game/vouchers/claim',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({...entry,claimToken:attempt.current!.token,groupNickname:nickname,joined})});if(!r.ok)throw Error(await errorText(r));const value={token:attempt.current!.token,voucher:(await r.json()).voucher};setReceipt(value);save('game-voucher-receipt',value);save('game-group-nickname',nickname.trim());setMessage('已送出，請到門市出示此畫面並核對 LINE 社群暱稱。')}catch(e){setMessage(e instanceof Error?e.message:'送出失敗，請再試一次')}finally{setBusy(false)}
 }
 if(!receipt&&!canClaim&&!eligible)return null;
 return <details className="game-voucher-wallet" open={eligible||undefined}><summary>🎟 我的遊戲優惠券{current?' · '+voucherStatus[receipt!.voucher.status]:''}</summary><div>
  {current?<section className={'coupon-card voucher-'+receipt!.voucher.status}>
   <b>{voucherStatus[receipt!.voucher.status]}</b><span>今天有效 · 店內商品滿 NT$1,000 折 NT$5</span>
   <strong className="voucher-nickname">群組暱稱：{receipt!.voucher.groupNickname}</strong><code>{receipt!.voucher.voucherNo}</code>
   <small>{VOUCHER_RULE}</small>
   {receipt!.voucher.status==='pending'?<p>尚不能使用。請向門市出示 LINE 社群會員畫面；店員核對暱稱後才會發券。</p>:receipt!.voucher.status==='approved'?<p>到店出示此券，由店員確認消費條件後核銷。每天限領一次，每券限用一次。</p>:<p>這張券已使用。</p>}
   <button type="button" className="sheet-close btn-outline" onClick={refresh}>更新核對狀態</button>
  </section>:canClaim?<form onSubmit={claim}>
   <p>已取得領券資格。先加入 LINE 社群，填寫群組暱稱，門市核對後才會發券。</p>
   <a className="voucher-join" href={LINE_GROUP_URL} target="_blank" rel="noopener noreferrer">加入安星水產 LINE 社群 ↗</a>
   <label>LINE 群組暱稱<input required value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={40} placeholder="請與 LINE 社群顯示的暱稱相同" autoComplete="off"/></label>
   <label className="voucher-check"><input type="checkbox" checked={joined} onChange={e=>setJoined(e.target.checked)} required/>我已加入社群，願由門市核對入群資格</label>
   <p className="voucher-note">每天同一暱稱及裝置各限申請一次。此暱稱只供門市核對，不會公開在排行榜。</p>
   <button type="submit" className="primary grow btn-teal" disabled={busy}>{busy?'送出中…':'送出群組暱稱，請門市核對'}</button>
  </form>:<p>{receipt?.voucher.status==='rejected'?'核對未通過，請確認社群暱稱後再挑戰。':'領券紀錄已過期，今天再挑戰 6 隻以上就有機會領券。'}</p>}
  {message&&<p role="status" className="voucher-message">{message}</p>}
 </div></details>;
}
