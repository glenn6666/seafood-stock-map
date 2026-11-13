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
 const {results}=await env.DB.prepare("SELECT * FROM dine_menu WHERE active=1 AND deleted=0 ORDER BY sort,name").all<any>();
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
  if(!p||!p.active||p.deleted)throw new HttpError(400,`「${p?.name??l.id}」目前無法點餐`);
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

const actorName=(a:Actor)=>a.kind==="user"?a.username:"管理密碼";
const CAT_IDS=new Set<string>(DINE_CATEGORIES.map(c=>c.id));
const BADGES=new Set(["hot","best"]);
const rowAdmin=(r:any)=>({...rowPublic(r),deleted:!!r.deleted,updatedAt:r.updated_at??"",updatedBy:r.updated_by??""});
const text=(v:unknown,max:number,label:string,required=false)=>{
 if(typeof v!=="string")throw new HttpError(400,`${label}格式不正確`);
 const t=v.trim();if(required&&!t)throw new HttpError(400,`請填寫${label}`);
 if(t.length>max)throw new HttpError(400,`${label}最多 ${max} 字`);
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t))throw new HttpError(400,`${label}含有不允許的字元`);
 return t;
};
/** 驗證並轉成資料庫欄位；只處理有給的欄位。 */
function parseFields(b:any,creating:boolean){
 const f:Record<string,unknown>={};
 if(b.name!==undefined||creating)f.name=text(b.name??"",40,"品名",true);
 if(b.category!==undefined||creating){if(typeof b.category!=="string"||!CAT_IDS.has(b.category))throw new HttpError(400,"分類不正確");f.category=b.category}
 if(b.description!==undefined)f.description=text(b.description,200,"說明");
 if(b.priceNote!==undefined)f.price_note=text(b.priceNote,80,"價格說明");
 if(b.unit!==undefined){const u=text(b.unit,6,"單位");f.unit=u||"份"}
 if(b.price!==undefined||creating){
  const v=b.price===undefined?null:b.price;
  if(v!==null&&(!Number.isSafeInteger(v)||v<0||v>100000))throw new HttpError(400,"售價需為 0～100000 的整數，時價請留空");
  f.price=v;
 }
 if(b.badges!==undefined){
  if(!Array.isArray(b.badges)||b.badges.some((x:unknown)=>typeof x!=="string"||!BADGES.has(x)))throw new HttpError(400,"標籤不正確");
  f.badges=[...new Set(b.badges as string[])].join(",");
 }
 if(b.imageUrl!==undefined){
  if(typeof b.imageUrl!=="string"||!isValidImageUrl(b.imageUrl.trim()))throw new HttpError(400,"照片網址不正確（請上傳照片，或用網站路徑／https 網址）");
  f.image_url=b.imageUrl.trim();
 }
 if(b.sort!==undefined){if(!Number.isSafeInteger(b.sort)||b.sort<0||b.sort>100000)throw new HttpError(400,"排序需為 0～100000 的整數");f.sort=b.sort}
 if(b.active!==undefined){if(typeof b.active!=="boolean")throw new HttpError(400,"上架設定不正確");f.active=b.active?1:0}
 return f;
}
const LOG_KEYS:Record<string,string>={name:"name",category:"category",description:"description",price_note:"priceNote",unit:"unit",price:"price",badges:"badges",image_url:"imageUrl",sort:"sort",active:"active",deleted:"deleted"};
const logStmt=(env:Env,id:string,name:string,action:string,changes:Record<string,unknown>,who:string,ts:string)=>
 env.DB.prepare("INSERT INTO dine_menu_log (item_id,item_name,action,changes,actor,created_at) VALUES (?,?,?,?,?,?)").bind(id,name,action,JSON.stringify(changes).slice(0,4000),who,ts);

export async function listDineMenu(env:Env){
 const {results}=await env.DB.prepare("SELECT * FROM dine_menu ORDER BY deleted,sort,name").all<any>();
 return {items:results.map(rowAdmin),categories:DINE_CATEGORIES};
}
export async function createDineItem(env:Env,actor:Actor,b:any){
 const f=parseFields(b,true);
 const id=`dine-${f.category}-${crypto.randomUUID().slice(0,8)}`;
 if(f.sort===undefined){
  const mx=await env.DB.prepare("SELECT MAX(sort) AS s FROM dine_menu WHERE category=?").bind(f.category).first<{s:number|null}>();
  f.sort=(mx?.s??0)+1;
 }
 const ts=nowIso(),who=actorName(actor);
 const row={id,category:f.category,name:f.name,description:f.description??"",price:f.price,price_note:f.price_note??"",unit:f.unit??"份",badges:f.badges??"",image_url:f.image_url??"",sort:f.sort,active:f.active??1,deleted:0,updated_at:ts,updated_by:who};
 const cols=Object.keys(row);
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO dine_menu (${cols.join(",")}) VALUES (${cols.map(()=>"?").join(",")})`).bind(...Object.values(row)),
  logStmt(env,id,String(f.name),"create",Object.fromEntries(Object.entries(f).map(([k,v])=>[LOG_KEYS[k]??k,[null,v]])),who,ts),
 ]);
 return {item:rowAdmin(row)};
}
export async function patchDineItem(env:Env,actor:Actor,id:string,b:any){
 if(!DINE_ID_RE.test(id)||id.length>80)throw new HttpError(400,"品項不正確");
 const f=parseFields(b,false);
 if(b.deleted!==undefined){if(typeof b.deleted!=="boolean")throw new HttpError(400,"刪除設定不正確");f.deleted=b.deleted?1:0;if(b.deleted)f.active=0}
 if(!Object.keys(f).length)throw new HttpError(400,"沒有要更新的欄位");
 const cur=await env.DB.prepare("SELECT * FROM dine_menu WHERE id=?").bind(id).first<any>();
 if(!cur)throw new HttpError(404,"找不到此餐點");
 // 兩人同時編輯：帶 expectedUpdatedAt 時，若別人已先存檔就退回，避免覆蓋。
 if(b.expectedUpdatedAt!==undefined&&b.expectedUpdatedAt!==(cur.updated_at??""))
  throw new HttpError(409,"這道餐點剛被其他人修改過，請重新整理後再改",{latest:rowAdmin(cur)});
 const changes:Record<string,[unknown,unknown]>={};
 for(const [k,v] of Object.entries(f))if(cur[k]!==v)changes[LOG_KEYS[k]??k]=[cur[k],v];
 if(!Object.keys(changes).length)return {item:rowAdmin(cur),unchanged:true};
 const ts=nowIso(),who=actorName(actor);
 const keys=Object.keys(f);
 const action=f.deleted===1&&!cur.deleted?"delete":f.deleted===0&&cur.deleted?"restore":"update";
 const [,r]=await env.DB.batch([
  env.DB.prepare("INSERT INTO dine_menu_log (item_id,item_name,action,changes,actor,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM dine_menu WHERE id=? AND updated_at=?)")
   .bind(id,String(f.name??cur.name),action,JSON.stringify(changes).slice(0,4000),who,ts,id,cur.updated_at??""),
  env.DB.prepare(`UPDATE dine_menu SET ${keys.map(k=>k+"=?").join(",")},updated_at=?,updated_by=? WHERE id=? AND updated_at=?`).bind(...keys.map(k=>f[k]),ts,who,id,cur.updated_at??""),
 ]);
 if(!r.meta.changes)throw new HttpError(409,"這道餐點剛被其他人修改過，請重新整理後再改");
 return {item:rowAdmin(await env.DB.prepare("SELECT * FROM dine_menu WHERE id=?").bind(id).first<any>())};
}

// ---------- 餐點照片（存 D1） ----------
const PHOTO_TYPES=new Set(["image/webp","image/jpeg"]);
export const DINE_PHOTO_MAX=300*1024;
const DINE_PHOTO_TOTAL_MAX=500*1024*1024; // 全部餐點照片上限 500MB（D1 總容量 5GB）
export async function uploadDinePhoto(request:Request,env:Env,actor:Actor){
 const type=(request.headers.get("Content-Type")??"").split(";")[0].trim().toLowerCase();
 if(!PHOTO_TYPES.has(type))throw new HttpError(415,"請用網頁上傳照片（會自動壓縮）");
 const len=+(request.headers.get("Content-Length")??0);if(len>DINE_PHOTO_MAX)throw new HttpError(413,"照片壓縮後仍超過 300KB，請換一張");
 const buf=await request.arrayBuffer();
 if(!buf.byteLength||buf.byteLength>DINE_PHOTO_MAX)throw new HttpError(413,"照片壓縮後仍超過 300KB，請換一張");
 const u=new Uint8Array(buf);
 const isJpeg=u[0]===0xff&&u[1]===0xd8&&u[2]===0xff;
 const isWebp=String.fromCharCode(...u.slice(0,4))==="RIFF"&&String.fromCharCode(...u.slice(8,12))==="WEBP";
 if(!(type==="image/jpeg"?isJpeg:isWebp))throw new HttpError(415,"照片格式不正確");
 const tot=await env.DB.prepare("SELECT COALESCE(SUM(size),0) AS n FROM dine_photos").first<{n:number}>();
 if((tot?.n??0)+buf.byteLength>DINE_PHOTO_TOTAL_MAX)throw new HttpError(507,"餐點照片空間已滿，請聯絡管理員");
 const id=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO dine_photos (id,mime,size,data,created_at,created_by) VALUES (?,?,?,?,?,?)").bind(id,type,buf.byteLength,buf,nowIso(),actorName(actor)).run();
 return {id,imageUrl:`/api/public/dine-photos/${id}`};
}
/** 顧客端公開讀取（免登入、唯讀）。照片 id 不會變，可長期快取。 */
export async function publicDinePhoto(env:Env,id:string){
 const r=await env.DB.prepare("SELECT mime,data FROM dine_photos WHERE id=?").bind(id).first<any>();
 if(!r)throw new HttpError(404,"找不到照片");
 return new Response(new Uint8Array(r.data as ArrayBuffer|number[]),{headers:{"Content-Type":r.mime,"Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Cross-Origin-Resource-Policy":"cross-origin"}});
}

export async function dineMenuLog(env:Env,url:URL){
 const item=url.searchParams.get("item")??"";
 if(item&&!DINE_ID_RE.test(item))throw new HttpError(400,"品項不正確");
 const q=item?env.DB.prepare("SELECT * FROM dine_menu_log WHERE item_id=? ORDER BY id DESC LIMIT 50").bind(item):env.DB.prepare("SELECT * FROM dine_menu_log ORDER BY id DESC LIMIT 50");
 const {results}=await q.all<any>();
 return {rows:results.map(r=>{let c={};try{c=JSON.parse(r.changes)}catch{}return {id:r.id,itemId:r.item_id,itemName:r.item_name,action:r.action,changes:c,actor:r.actor,createdAt:r.created_at}})};
}

export async function dineAdminRoute(request:Request,env:Env,url:URL,actor:Actor|null,readJson:(r:Request)=>Promise<any>){
 const p=url.pathname,m=request.method;
 // 菜單管理：店員與管理員都可以（需登入）
 const a=requireRole(actor,"admin","staff");
 if(p==="/api/dine-menu"&&m==="GET")return listDineMenu(env);
 if(p==="/api/dine-menu"&&m==="POST")return createDineItem(env,a,await readJson(request));
 if(p==="/api/dine-menu/photos"&&m==="POST")return uploadDinePhoto(request,env,a);
 if(p==="/api/dine-menu/log"&&m==="GET")return dineMenuLog(env,url);
 const im=p.match(/^\/api\/dine-menu\/(dine-[a-z0-9-]+)$/);
 if(im&&m==="PATCH")return patchDineItem(env,a,im[1],await readJson(request));
 throw new HttpError(404,"Not found");
}
