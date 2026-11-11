// 線上點餐（店內現做料理、預約自取）。不扣庫存、不套用釣蝦優惠券。
import {HttpError,requireRole,nowIso,type Env,type Actor} from "./index";
import {DINE_CATEGORIES,DINE_ID_RE,MARKET_LABEL,isValidImageUrl,pickupError} from "../web/src/lib/dine-menu";

type Line={id:string;qty:number};
function parseLines(raw:unknown):Line[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>50)throw new HttpError(400,"請選擇餐點");
 const m=new Map<string,number>();
 for(const l of raw){
  if(!l||typeof l.id!=="string"||!DINE_ID_RE.test(l.id)||l.id.length>80)throw new HttpError(400,"餐點不正確");
  if(!Number.isSafeInteger(l.qty)||l.qty<=0||l.qty>20)throw new HttpError(400,"數量需為 1～20");
  m.set(l.id,(m.get(l.id)??0)+l.qty);
 }
 const lines=[...m].map(([id,qty])=>({id,qty}));
 if(lines.reduce((s,l)=>s+l.qty,0)>50)throw new HttpError(400,"單筆最多 50 份");
 return lines;
}
const randomToken=(n=32)=>{
 const b=crypto.getRandomValues(new Uint8Array(n));
 return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const rowPublic=(r:any)=>({
 id:r.id,category:r.category,name:r.name,description:r.description??"",
 price:r.price===null||r.price===undefined?null:r.price,
 priceNote:r.price_note??"",unit:r.unit||"份",
 badges:String(r.badges??"").split(",").filter(Boolean),
 imageUrl:r.image_url??"",market:r.price===null||r.price===undefined,
 sort:r.sort,active:!!r.active,
});

export async function publicDineMenu(env:Env){
 const {results}=await env.DB.prepare("SELECT * FROM dine_menu WHERE active=1 ORDER BY sort,name").all<any>();
 return {store:{name:"安星水產",branch:"泰山旗艦店",hoursText:"週二至五 13:00–21:00、週六日 12:00–21:00，每週一公休",address:"新北市泰山區文程路23號1樓（全聯隔壁）",phone:"02-29097057",phoneNote:"預約取餐專線"},
  categories:DINE_CATEGORIES,items:results.map(rowPublic)};
}

export async function createDineOrder(env:Env,b:any){
 const key=b.idempotencyKey;
 if(typeof key!=="string"||!/^[A-Za-z0-9_-]{16,80}$/.test(key))throw new HttpError(400,"缺少送出識別碼");
 const scopedKey=`dine:${key}`;
 const prior=await env.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(scopedKey).first<any>();
 if(prior)return {order:prior,duplicate:true};
 const name=typeof b.customerName==="string"?b.customerName.trim():"",phone=typeof b.phone==="string"?b.phone.trim():"",note=typeof b.note==="string"?b.note.trim():"";
 if(!name||name.length>40)throw new HttpError(400,"請填寫姓名（40 字內）");
 if(!/^[0-9+\-\s]{6,20}$/.test(phone))throw new HttpError(400,"請填寫正確的聯絡電話");
 if(phone.length>20||note.length>300)throw new HttpError(400,"電話或備註過長");
 if(b.couponCode)throw new HttpError(400,"餐點訂單不能使用購物優惠券");
 const pickup=typeof b.pickupAt==="string"?b.pickupAt.trim():"";
 const pe=pickupError(pickup);if(pe)throw new HttpError(400,pe);
 const lines=parseLines(b.items);
 const ph=lines.map(()=>"?").join(",");
 const {results:rows}=await env.DB.prepare(`SELECT * FROM dine_menu WHERE id IN (${ph})`).bind(...lines.map(l=>l.id)).all<any>();
 const byId=new Map(rows.map(r=>[r.id,r]));
 for(const l of lines){
  const p=byId.get(l.id);
  if(!p||!p.active)throw new HttpError(400,`「${p?.name??l.id}」目前無法點餐`);
 }
 const saleDate=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
 const id=crypto.randomUUID(),orderNo=`${saleDate.replace(/-/g,"")}-${randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g,"X").slice(0,5)}`,ts=nowIso();
 const subtotal=lines.reduce((s,l)=>{const p=byId.get(l.id);return s+(p.price??0)*l.qty},0);
 const stmts=[
  env.DB.prepare("INSERT INTO orders (id,order_no,idempotency_key,lookup_token,source,customer_name,phone,note,status,total,subtotal,discount,coupon_hash,sale_date,created_by,created_at,updated_at,channel,pickup_at) VALUES (?,?,?,?,?,?,?,?,'待處理',?,?,?,?,?,?,?,?,?,?)")
   .bind(id,orderNo,scopedKey,randomToken(24),"customer",name,phone,note,subtotal,subtotal,0,"",saleDate,"顧客",ts,ts,"dine",pickup),
 ];
 for(const l of lines){
  const p=byId.get(l.id);
  const spec=[p.description,p.price==null?MARKET_LABEL:p.price_note].filter(Boolean).join("・");
  stmts.push(env.DB.prepare("INSERT INTO order_items (order_id,item_id,name,spec,unit,qty,unit_price,unit_cost) VALUES (?,?,?,?,?,?,?,?)")
   .bind(id,l.id,p.name,spec.slice(0,200),p.unit||"份",l.qty,p.price??0,null));
 }
 try{await env.DB.batch(stmts)}
 catch(e){
  const again=await env.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(scopedKey).first<any>();
  if(again)return {order:again,duplicate:true};
  console.error("dine order batch failed",e);throw new HttpError(409,"訂單未成立，請再送出一次");
 }
 return {order:(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>()),duplicate:false};
}

export async function listDineMenu(env:Env){
 const {results}=await env.DB.prepare("SELECT * FROM dine_menu ORDER BY sort,name").all<any>();
 return {items:results.map(rowPublic),categories:DINE_CATEGORIES};
}
export async function patchDineItem(env:Env,id:string,b:any){
 if(!DINE_ID_RE.test(id))throw new HttpError(400,"品項不正確");
 const sets:string[]=[],binds:unknown[]=[];
 if(b.imageUrl!==undefined){
  if(typeof b.imageUrl!=="string"||!isValidImageUrl(b.imageUrl.trim()))throw new HttpError(400,"照片網址不正確（請用網站路徑或 https 網址）");
  sets.push("image_url=?");binds.push(b.imageUrl.trim());
 }
 if(b.active!==undefined){if(typeof b.active!=="boolean")throw new HttpError(400,"上架設定不正確");sets.push("active=?");binds.push(b.active?1:0)}
 if(b.price!==undefined){
  if(b.price!==null&&(!Number.isSafeInteger(b.price)||b.price<0||b.price>100000))throw new HttpError(400,"售價需為 0 以上整數，時價請留空");
  sets.push("price=?");binds.push(b.price);
 }
 if(b.description!==undefined){if(typeof b.description!=="string"||b.description.length>200)throw new HttpError(400,"說明過長");sets.push("description=?");binds.push(b.description)}
 if(b.priceNote!==undefined){if(typeof b.priceNote!=="string"||b.priceNote.length>80)throw new HttpError(400,"價格說明過長");sets.push("price_note=?");binds.push(b.priceNote)}
 if(!sets.length)throw new HttpError(400,"沒有要更新的欄位");
 const r=await env.DB.prepare(`UPDATE dine_menu SET ${sets.join(",")} WHERE id=?`).bind(...binds,id).run();
 if(!r.meta.changes)throw new HttpError(404,"找不到此餐點");
 return {ok:true};
}

export async function dineAdminRoute(request:Request,env:Env,url:URL,actor:Actor|null){
 const p=url.pathname,m=request.method;
 if(p==="/api/dine-menu"&&m==="GET"){requireRole(actor,"admin","staff");return listDineMenu(env)}
 const im=p.match(/^\/api\/dine-menu\/(dine-[A-Za-z0-9-]+)$/);
 if(im&&m==="PATCH"){requireRole(actor,"admin");return patchDineItem(env,im[1],await request.json())}
 throw new HttpError(404,"Not found");
}
