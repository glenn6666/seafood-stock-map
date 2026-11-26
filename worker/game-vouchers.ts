import {HttpError,sha256,nowIso,type Env,type Actor} from './index';
import {COUPON_SCORE_MIN,GAME_RULE_VERSION,endOfTaipeiDay} from '../web/src/lib/game-rules';
import {drawGamePrize} from './game-prizes';
const day=(date=new Date())=>new Date(date.getTime()+8*3600e3).toISOString().slice(0,10);
const validToken=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{20,64}$/.test(value);
function publicVoucher(row:any){return {id:row.id,voucherNo:row.voucher_no,groupNickname:row.group_nickname,prizeType:row.prize_type??'coupon',status:row.expires_at<=nowIso()&&row.status!=='redeemed'?'expired':row.status,claimDay:row.claim_day,expiresAt:row.expires_at}}
export async function claimGameVoucher(env:Env,b:any){
 if(!b||typeof b!=='object'||Array.isArray(b))throw new HttpError(400,'領券資料不正確');
 const issuedAt=new Date(),claimDay=day(issuedAt);
 if(!validToken(b.gameId)||!validToken(b.playerId)||!validToken(b.claimToken))throw new HttpError(400,'領券資料不正確，請重新整理後再試');
 const nickname=typeof b.groupNickname==='string'?b.groupNickname.normalize('NFKC').replace(/\s+/gu,' ').trim():'';
 if(!nickname||[...nickname].length>40||/[<>\u0000-\u001f\u007f]/.test(nickname))throw new HttpError(400,'請填寫 LINE 群組暱稱（40 字內）');
 if(b.joined!==true)throw new HttpError(400,'請先加入 LINE 社群再領券');
 const gameHash=await sha256(b.gameId),playerHash=await sha256('player|'+b.playerId),tokenHash=await sha256(b.claimToken);
 const g=await env.DB.prepare('SELECT * FROM game_sessions WHERE id_hash=?').bind(gameHash).first<any>();
 if(!g||g.player_hash!==playerHash||!g.finished||g.final_score<COUPON_SCORE_MIN||g.rule_version!==GAME_RULE_VERSION)throw new HttpError(400,'尚未取得領券資格，請先完成遊戲並達到 1500 分（含）');
 if(!g.finished_at||day(new Date(g.finished_at))!==claimDay)throw new HttpError(409,'這局領券資格已過期，請今天再挑戰');
 const prior=await env.DB.prepare('SELECT * FROM game_vouchers WHERE token_hash=?').bind(tokenHash).first<any>();
 if(prior){if(prior.game_hash!==gameHash||prior.player_hash!==playerHash)throw new HttpError(409,'領券識別碼已使用，請重新整理');return {voucher:publicVoucher(prior)}}
 if(b.drawVersion!==1)throw new HttpError(409,'扭蛋玩法已更新，請重新整理頁面後再試');
 const id=crypto.randomUUID(),ts=issuedAt.toISOString(),nicknameKey=await sha256(nickname.toLocaleLowerCase('zh-TW'));
 const voucherNo='AX-'+claimDay.replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
 const r=await env.DB.prepare("INSERT OR IGNORE INTO game_vouchers(id,token_hash,game_hash,player_hash,nickname_key,group_nickname,claim_day,voucher_no,status,created_at,expires_at,prize_type) VALUES(?,?,?,?,?,?,?,?,'approved',?,?,?)").bind(id,tokenHash,gameHash,playerHash,nicknameKey,nickname,claimDay,voucherNo,ts,endOfTaipeiDay(issuedAt),drawGamePrize()).run();
 if(!r.meta.changes){const again=await env.DB.prepare('SELECT * FROM game_vouchers WHERE token_hash=? AND game_hash=? AND player_hash=?').bind(tokenHash,gameHash,playerHash).first<any>();if(again)return {voucher:publicVoucher(again)};throw new HttpError(409,'這個群組暱稱今天已扭蛋，請查看獎項紀錄')}
 return {voucher:publicVoucher(await env.DB.prepare('SELECT * FROM game_vouchers WHERE id=?').bind(id).first())};
}
export async function gameVoucherStatus(env:Env,b:any){
 if(!b||typeof b!=='object')throw new HttpError(400,'領券識別資料不正確');
 if(!validToken(b.claimToken))throw new HttpError(400,'領券識別資料不正確');
 const row=await env.DB.prepare('SELECT * FROM game_vouchers WHERE token_hash=?').bind(await sha256(b.claimToken)).first<any>();
 if(!row)throw new HttpError(404,'找不到領券紀錄');return {voucher:publicVoucher(row)};
}
export async function gameVoucherAdmin(env:Env,actor:Actor,url:URL,method:string,b:any={}){
 if(url.pathname==='/api/game-vouchers'&&method==='GET'){
  const date=url.searchParams.get('date')??day();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new HttpError(400,'日期格式不正確');
  const q=(url.searchParams.get('q')??'').trim().slice(0,80);
  const {results}=await env.DB.prepare("SELECT * FROM game_vouchers WHERE claim_day=? AND (?='' OR instr(lower(group_nickname),lower(?))>0 OR instr(lower(voucher_no),lower(?))>0) ORDER BY created_at DESC LIMIT 200").bind(date,q,q,q).all<any>();
  return {date,vouchers:results.map(r=>({...publicVoucher(r),approvedBy:r.approved_by,approvedAt:r.approved_at,redeemedBy:r.redeemed_by,redeemedAt:r.redeemed_at}))};
 }
 const match=url.pathname.match(/^\/api\/game-vouchers\/([0-9a-f-]{36})\/(approve|reject|redeem)$/);
 if(!match||method!=='POST')throw new HttpError(404,'找不到操作');
 const [,id,action]=match,row=await env.DB.prepare('SELECT * FROM game_vouchers WHERE id=?').bind(id).first<any>();
 if(!row)throw new HttpError(404,'找不到領券紀錄');
 if(row.expires_at<=nowIso())throw new HttpError(409,'這張券已過期，不能發券或核銷');
 const operator=actor.kind==='user'?actor.username:'管理密碼',ts=nowIso();let r:D1Result;
 if(action==='approve'){
  if(b.groupMemberConfirmed!==true)throw new HttpError(400,'請先在 LINE 社群核對暱稱及入群資格，再勾選確認');
  r=await env.DB.prepare("UPDATE game_vouchers SET status='approved',approved_by=?,approved_at=? WHERE id=? AND status='pending' AND expires_at>?").bind(operator,ts,id,ts).run();
 }else if(action==='reject')r=await env.DB.prepare("UPDATE game_vouchers SET status='rejected',approved_by=?,approved_at=? WHERE id=? AND status='pending' AND expires_at>?").bind(operator,ts,id,ts).run();
 else{
  if(row.prize_type==='gift'){if(b.groupMemberConfirmed!==true||b.giftDeliveryConfirmed!==true)throw new HttpError(400,'請先核對 LINE 社群會員資格、日期與暱稱，並確認交付神秘小禮')}else if(b.storePurchaseConfirmed!==true)throw new HttpError(400,'請先確認店內商品滿 NT$1,000，且未包含團購折抵');
  r=await env.DB.prepare("UPDATE game_vouchers SET status='redeemed',redeemed_by=?,redeemed_at=? WHERE id=? AND status='approved' AND expires_at>?").bind(operator,ts,id,ts).run();
 }
 if(!r.meta.changes)throw new HttpError(409,'狀態已變更，請重新整理；每張券只能核銷一次');
 return {voucher:publicVoucher(await env.DB.prepare('SELECT * FROM game_vouchers WHERE id=?').bind(id).first())};
}
