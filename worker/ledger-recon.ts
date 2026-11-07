// 支出拆分（店內＋團購對帳）、對帳月結單、單據照片（R2）、收銀機代支
import {HttpError,nowIso,sha256,type Env,type Actor} from "./index";
const DATE=/^\d{4}-\d{2}-\d{2}$/,YM=/^\d{4}-\d{2}$/;
const str=(v:unknown,max=500)=>{const t=v===null||v===undefined?"":String(v).trim();if(t.length>max)throw new HttpError(400,"文字過長");return t};
const n=(v:unknown)=>{if(v===""||v===null||v===undefined)return 0;const x=typeof v==="number"?v:parseFloat(String(v).replace(/,/g,""));if(!Number.isFinite(x)||Math.abs(x)>1e10)throw new HttpError(400,"金額不正確");return x};
const r2=(x:number)=>Math.round(x*100)/100;
const IMG=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
const MAX_IMG=8*1024*1024;

export type ReconCtx={request:Request;env:Env;url:URL;a:Actor;who:string;readBig:(r:Request)=>Promise<any>;
 hashEntry:(e:any)=>Promise<string>;cleanEntry:(b:any,rec:string)=>any;ENTRY_SQL:string;entryBind:(id:string,e:any,source:string,webKey:string|null,hash:string)=>unknown[]};

async function labels(env:Env){const {results}=await env.DB.prepare("SELECT account,label FROM ledger_accounts").all<any>();return Object.fromEntries(results.map(r=>[r.account,r.label]))}
const dirOf=(amount:number,d:string)=>d==="we_owe"||d==="they_owe"?d:amount<0?"we_owe":"they_owe";

/** 一次付款拆成多行：store＝店內支出（記入收支紀錄），partner＝團購對帳（正數＝對方欠我們） */
async function savePayment(c:ReconCtx,b:any){
 const date=str(b.date,10);if(!DATE.test(date))throw new HttpError(400,"日期不正確");
 const total=r2(n(b.total));if(total<=0)throw new HttpError(400,"請輸入付款總額");
 const lines=Array.isArray(b.lines)?b.lines:[];if(!lines.length||lines.length>30)throw new HttpError(400,"請至少拆成一行");
 let sum=0;for(const l of lines){const amt=r2(n(l.amount));if(amt<=0)throw new HttpError(400,"每一行金額需大於 0");sum+=amt;if(l.type==="partner"){if(!str(l.account,40))throw new HttpError(400,"請選擇對帳對象")}else if(l.type!=="store")throw new HttpError(400,"行的類型不正確");else if(!str(l.category,40))throw new HttpError(400,"請選擇會計項目")}
 if(Math.abs(r2(sum)-total)>0.005)throw new HttpError(400,`拆分合計 ${r2(sum)} 與付款總額 ${total} 不同`);
 const cash=b.cashoutId?await c.env.DB.prepare("SELECT * FROM ledger_pos_cashout WHERE id=?").bind(str(b.cashoutId,40)).first<any>():null;
 if(b.cashoutId&&!cash)throw new HttpError(404,"找不到這筆收銀機代支");if(cash?.payment_id)throw new HttpError(409,"這筆收銀機代支已經對應過了");
 const pid=crypto.randomUUID(),t=nowIso(),vendor=str(b.vendor,80),pay=str(b.payMethod,20)||(cash?"收銀機代支":""),note=str(b.note,500);
 const st:D1PreparedStatement[]=[c.env.DB.prepare("INSERT INTO ledger_payments (id,pay_date,vendor,total,pay_method,note,recorder,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(pid,date,vendor,total,pay,note,c.who,t,t)];
 for(const l of lines){const amt=r2(n(l.amount));
  if(l.type==="store"){const e=c.cleanEntry({date,kind:"支出",category:l.category,item:l.item,note:[vendor,str(l.note,200)].filter(Boolean).join(" "),qty:1,unitPrice:amt,party:vendor,payMethod:pay},c.who);
   const id=crypto.randomUUID();st.push(c.env.DB.prepare(c.ENTRY_SQL).bind(...c.entryBind(id,e,"payment",null,await c.hashEntry(e))));st.push(c.env.DB.prepare("UPDATE ledger_entries SET payment_id=? WHERE id=?").bind(pid,id))}
  else{const ac=str(l.account,40),item=str(l.item,200)||`代支 ${vendor}`.trim();
   st.push(c.env.DB.prepare("INSERT INTO ledger_prepaid (id,account,seq,item,unit_price,qty,amount,checked,status,hash,created_at,entry_date,direction,payment_id) VALUES (?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM ledger_prepaid WHERE account=?),?,?,1,?,'','已付款',?,?,?,'they_owe',?)")
    .bind(crypto.randomUUID(),ac,ac,item,amt,amt,(await sha256(`${pid}|${item}|${amt}`)).slice(0,22),t,date,pid))}}
 if(cash)st.push(c.env.DB.prepare("UPDATE ledger_pos_cashout SET payment_id=? WHERE id=? AND payment_id IS NULL").bind(pid,cash.id));
 await c.env.DB.batch(st);return {id:pid};
}
async function listPayments(env:Env,ym:string){
 if(!YM.test(ym))throw new HttpError(400,"年月不正確");
 const {results:pays}=await env.DB.prepare("SELECT * FROM ledger_payments WHERE deleted=0 AND pay_date LIKE ? ORDER BY pay_date DESC,created_at DESC").bind(ym+"-%").all<any>();
 if(!pays.length)return {rows:[]};const ids=pays.map(p=>p.id),qs=ids.map(()=>"?").join(",");
 const st=(await env.DB.prepare(`SELECT id,payment_id,category,item,amount FROM ledger_entries WHERE deleted=0 AND payment_id IN (${qs})`).bind(...ids).all<any>()).results;
 const pp=(await env.DB.prepare(`SELECT id,payment_id,account,item,amount FROM ledger_prepaid WHERE deleted=0 AND payment_id IN (${qs})`).bind(...ids).all<any>()).results;
 const rc=(await env.DB.prepare(`SELECT id,payment_id,mime,size FROM ledger_receipts WHERE deleted=0 AND payment_id IN (${qs})`).bind(...ids).all<any>()).results;
 const cs=(await env.DB.prepare(`SELECT id,payment_id,biz_date,item,amount FROM ledger_pos_cashout WHERE payment_id IN (${qs})`).bind(...ids).all<any>()).results;
 return {rows:pays.map(p=>({id:p.id,date:p.pay_date,vendor:p.vendor,total:p.total,payMethod:p.pay_method,note:p.note,recorder:p.recorder,
  lines:[...st.filter(x=>x.payment_id===p.id).map(x=>({type:"store",category:x.category,item:x.item,amount:x.amount})),...pp.filter(x=>x.payment_id===p.id).map(x=>({type:"partner",account:x.account,item:x.item,amount:x.amount}))],
  receipts:rc.filter(x=>x.payment_id===p.id).map(x=>({id:x.id,mime:x.mime,size:x.size})),cashout:cs.find(x=>x.payment_id===p.id)??null}))};
}
async function deletePayment(env:Env,id:string){
 const r=await env.DB.prepare("UPDATE ledger_payments SET deleted=1,updated_at=? WHERE id=? AND deleted=0").bind(nowIso(),id).run();if(!r.meta.changes)throw new HttpError(404,"找不到這筆付款");
 await env.DB.batch([env.DB.prepare("UPDATE ledger_entries SET deleted=1,updated_at=? WHERE payment_id=?").bind(nowIso(),id),env.DB.prepare("UPDATE ledger_prepaid SET deleted=1 WHERE payment_id=?").bind(id),
  env.DB.prepare("UPDATE ledger_pos_cashout SET payment_id=NULL WHERE payment_id=?").bind(id),env.DB.prepare("UPDATE ledger_receipts SET deleted=1 WHERE payment_id=?").bind(id)]);return {ok:true};
}
/** 對帳月結單：期初（含沒有日期的舊資料）＋本月明細＋期末；正負與對方試算表「安星對帳」相同（負數＝我們欠對方） */
async function statement(env:Env,account:string,ym:string){
 if(!YM.test(ym))throw new HttpError(400,"年月不正確");const from=ym+"-01";
 const open=await env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS s,COUNT(*) AS c FROM ledger_prepaid WHERE deleted=0 AND account=? AND (entry_date='' OR entry_date<?)").bind(account,from).first<any>();
 const {results}=await env.DB.prepare("SELECT id,entry_date,item,unit_price,qty,amount,status,direction,payment_id FROM ledger_prepaid WHERE deleted=0 AND account=? AND entry_date LIKE ? ORDER BY entry_date,seq").bind(account,ym+"-%").all<any>();
 const rows=results.map(r=>({id:r.id,date:r.entry_date,item:r.item,unitPrice:r.unit_price,qty:r.qty,amount:r.amount,status:r.status,direction:dirOf(r.amount,r.direction),paymentId:r.payment_id}));
 const theyOwe=r2(rows.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0)),weOwe=r2(rows.filter(r=>r.amount<0).reduce((s,r)=>s+r.amount,0));
 const opening=r2(open.s),closing=r2(opening+theyOwe+weOwe);
 return {account,label:(await labels(env))[account]??"",ym,opening,undatedCount:open.c,rows,theyOwe,weOwe,closing,meaning:closing<0?"我們欠對方":closing>0?"對方欠我們":"兩清"};
}
async function importCashout(env:Env,rows:any[]){
 if(!Array.isArray(rows)||rows.length>3000)throw new HttpError(400,"資料筆數不正確");
 const occ=new Map<string,number>(),st:D1PreparedStatement[]=[];let inserted=0,skipped=0;
 for(const r of rows){const d=str(r.date,10);if(!DATE.test(d))continue;const tm=str(r.time,10),amt=r2(Math.abs(n(r.amount)));if(!amt)continue;
  const base=`${d}|${tm}|${str(r.item,80)}|${amt}|${str(r.staff,40)}`;const k=(occ.get(base)??0)+1;occ.set(base,k);const h=(await sha256(`${base}|${k}`)).slice(0,24);
  st.push(env.DB.prepare("INSERT OR IGNORE INTO ledger_pos_cashout (id,biz_date,biz_time,type,item,staff,amount,hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),d,tm,str(r.type,20),str(r.item,80),str(r.staff,40),amt,h,nowIso()))}
 for(let i=0;i<st.length;i+=80){const res=await env.DB.batch(st.slice(i,i+80));for(const x of res)(x.meta.changes?inserted++:skipped++)}
 return {inserted,skipped};
}

export async function reconRoute(c:ReconCtx):Promise<unknown|undefined>{
 const {request,env,url}=c,p=url.pathname.slice("/api/ledger".length),m=request.method,q=url.searchParams;
 if(p==="/accounts"&&m==="GET"){const {results}=await env.DB.prepare("SELECT account,SUM(amount) AS bal,COUNT(*) AS c FROM ledger_prepaid WHERE deleted=0 GROUP BY account").all<any>();const lb=await labels(env);
  const names=[...new Set([...Object.keys(lb),...results.map(r=>r.account)])];return {rows:names.map(a=>{const r=results.find(x=>x.account===a);return {account:a,label:lb[a]??"",balance:r2(r?.bal??0),count:r?.c??0}})}}
 if(p==="/accounts"&&m==="POST"){const b=await c.readBig(request);const ac=str(b.account,40);if(!ac)throw new HttpError(400,"請指定對帳對象");await env.DB.prepare("INSERT INTO ledger_accounts (account,label) VALUES (?,?) ON CONFLICT(account) DO UPDATE SET label=excluded.label").bind(ac,str(b.label,40)).run();return {ok:true}}
 if(p==="/payments"&&m==="GET")return listPayments(env,q.get("ym")??"");
 if(p==="/payments"&&m==="POST")return savePayment(c,await c.readBig(request));
 const pm=p.match(/^\/payments\/([0-9a-f-]{36})(\/delete|\/receipts)?$/);
 if(pm&&pm[2]==="/delete"&&m==="POST")return deletePayment(env,pm[1]);
 if(pm&&pm[2]==="/receipts"&&m==="POST"){
  if(!env.RECEIPTS)throw new HttpError(503,"單據照片空間尚未設定");
  const type=(request.headers.get("Content-Type")??"").split(";")[0].trim().toLowerCase();if(!IMG.has(type))throw new HttpError(415,"只接受 JPG／PNG／WEBP／HEIC 照片");
  const len=+(request.headers.get("Content-Length")??0);if(len>MAX_IMG)throw new HttpError(413,"照片不可超過 8MB");
  if(!await env.DB.prepare("SELECT 1 FROM ledger_payments WHERE id=? AND deleted=0").bind(pm[1]).first())throw new HttpError(404,"找不到這筆付款");
  const buf=await request.arrayBuffer();if(!buf.byteLength||buf.byteLength>MAX_IMG)throw new HttpError(413,"照片不可超過 8MB");
  const id=crypto.randomUUID(),key=`receipts/${pm[1]}/${id}`;await env.RECEIPTS.put(key,buf,{httpMetadata:{contentType:type}});
  await env.DB.prepare("INSERT INTO ledger_receipts (id,payment_id,r2_key,mime,size,created_at) VALUES (?,?,?,?,?,?)").bind(id,pm[1],key,type,buf.byteLength,nowIso()).run();return {id}}
 const rm=p.match(/^\/receipts\/([0-9a-f-]{36})(\/delete)?$/);
 if(rm&&!rm[2]&&m==="GET"){if(!env.RECEIPTS)throw new HttpError(503,"單據照片空間尚未設定");const r=await env.DB.prepare("SELECT * FROM ledger_receipts WHERE id=? AND deleted=0").bind(rm[1]).first<any>();if(!r)throw new HttpError(404,"找不到照片");
  const o=await env.RECEIPTS.get(r.r2_key);if(!o)throw new HttpError(404,"找不到照片");return new Response(o.body,{headers:{"Content-Type":r.mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})}
 if(rm&&rm[2]&&m==="POST"){await env.DB.prepare("UPDATE ledger_receipts SET deleted=1 WHERE id=?").bind(rm[1]).run();return {ok:true}}
 if(p==="/statement"&&m==="GET"){const ac=str(q.get("account")??"",40);if(!ac)throw new HttpError(400,"請指定對帳對象");return statement(env,ac,q.get("ym")??"")}
 if(p==="/cashout"&&m==="GET"){const ym=q.get("ym")??"";if(!YM.test(ym))throw new HttpError(400,"年月不正確");
  const {results}=await env.DB.prepare("SELECT c.*,p.vendor FROM ledger_pos_cashout c LEFT JOIN ledger_payments p ON p.id=c.payment_id AND p.deleted=0 WHERE c.biz_date LIKE ? ORDER BY c.biz_date,c.biz_time").bind(ym+"-%").all<any>();
  const rows=results.map(r=>({id:r.id,date:r.biz_date,time:r.biz_time,type:r.type,item:r.item,staff:r.staff,amount:r.amount,paymentId:r.vendor===null?null:r.payment_id,vendor:r.vendor??""}));
  return {rows,total:r2(rows.reduce((s,r)=>s+r.amount,0)),matched:rows.filter(r=>r.paymentId).length}}
 if(p==="/import"&&m==="POST"){const b=await c.readBig(request.clone());if(b.kind==="cashout")return importCashout(env,b.rows)}
 if(p==="/prepaid/date"&&m==="POST"){const b=await c.readBig(request);const d=str(b.date,10);if(d&&!DATE.test(d))throw new HttpError(400,"日期不正確");
  const dir=str(b.direction,10);if(dir&&dir!=="we_owe"&&dir!=="they_owe")throw new HttpError(400,"方向不正確");
  await env.DB.prepare("UPDATE ledger_prepaid SET entry_date=?,direction=? WHERE id=? AND deleted=0").bind(d,dir,str(b.id,40)).run();return {ok:true}}
 return undefined;
}
