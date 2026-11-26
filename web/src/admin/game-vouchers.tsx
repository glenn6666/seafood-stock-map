import {useEffect,useState} from 'react';
import {inventoryFetch} from '../lib/pages-api';
import {errorText} from '../lib/api-config';
import {LINE_GROUP_URL,VOUCHER_RULE,voucherStatus,type GameVoucher} from '../lib/game-vouchers';
type Row=GameVoucher&{approvedBy:string;approvedAt:string;redeemedBy:string;redeemedAt:string};
export default function GameVouchers(){
 const today=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
 const [query,setQuery]=useState('');
 const [date,setDate]=useState(today),[rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState(''),[checks,setChecks]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState('');
 async function load(){try{const r=await inventoryFetch('/api/game-vouchers?date='+date+'&q='+encodeURIComponent(query));if(!r.ok)throw Error(await errorText(r));setRows((await r.json()).vouchers)}catch(e){setMessage(e instanceof Error?e.message:'讀取失敗')}}
 useEffect(()=>{load()},[date]);
 async function act(row:Row,action:string){setBusy(row.id);setMessage('');try{const r=await inventoryFetch('/api/game-vouchers/'+row.id+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupMemberConfirmed:checks[row.id]===true,storePurchaseConfirmed:checks[row.id]===true})});if(!r.ok)throw Error(await errorText(r));setChecks(v=>({...v,[row.id]:false}));setMessage(action==='approve'?'已核對入群資格並發券':action==='redeem'?'已核銷，此券不能再使用':'已標記核對未通過');await load()}catch(e){setMessage(e instanceof Error?e.message:'操作失敗')}finally{setBusy('')}}
 return <main className="admin-page"><h1>遊戲優惠券核對</h1><p className="admin-hint">{VOUCHER_RULE} 同一群組暱稱每天成功限領一次。員工直接查看顧客券面日期與暱稱，確認消費條件後，務必按「折 NT$5 並核銷」；顧客券面會同步顯示已使用。</p>
  <div className="admin-filter"><label>日期 <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><input aria-label="券號或群組暱稱" placeholder="券號或群組暱稱" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load()}}/><button onClick={load}>查詢／重新整理</button><a href={LINE_GROUP_URL} target="_blank" rel="noopener noreferrer">開啟 LINE 社群 ↗</a></div>
  {message&&<p className="admin-msg" role="status">{message}</p>}
  <div className="admin-list">{rows.map(row=><section key={row.id} className="admin-card"><div className="row"><strong>{row.groupNickname}</strong><span className="tag">{voucherStatus[row.status]}</span><code>{row.voucherNo}</code></div>
   <p>有效日期：{row.claimDay} · 當日 23:59 止</p>
   {row.status==='pending'&&<><label className="voucher-admin-check"><input type="checkbox" checked={!!checks[row.id]} onChange={e=>setChecks(v=>({...v,[row.id]:e.target.checked}))}/>已在 LINE 社群確認這個暱稱確實是成員</label><div className="admin-filter"><button disabled={!checks[row.id]||busy===row.id} onClick={()=>act(row,'approve')}>核對完成，發券</button><button disabled={busy===row.id} onClick={()=>act(row,'reject')}>核對未通過</button></div></>}
   {row.status==='approved'&&<><label className="voucher-admin-check"><input type="checkbox" checked={!!checks[row.id]} onChange={e=>setChecks(v=>({...v,[row.id]:e.target.checked}))}/>已核對券面暱稱與日期、店內滿 NT$1,000，且未包含團購金額</label><button disabled={!checks[row.id]||busy===row.id} onClick={()=>act(row,'redeem')}>折 NT$5 並核銷</button></>}
   {row.approvedBy&&<small>核對人：{row.approvedBy} {row.approvedAt}</small>}{row.redeemedBy&&<small>　核銷人：{row.redeemedBy} {row.redeemedAt}</small>}
  </section>)}</div>{!rows.length&&<p>此日期尚無領券申請。</p>}
 </main>;
}
