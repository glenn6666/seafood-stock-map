import {storagePhotos,photoSections,normalizePhotoId} from "../web/src/lib/storage-photos";
import {catalogPrice} from "../web/src/lib/catalog";

type Env={DB:D1Database;INVENTORY_TOKEN:string;ALLOWED_ORIGIN:string};
type Role="admin"|"staff";
type Actor={kind:"user";id:string;role:Role;username:string}|{kind:"legacy";role:"admin"};

const columns=["id","zone","name","spec","quantity","unit","minimum","batch","category","price","tracked","photo_id","position_note","fridge_id"];
const ZONES=["01","02","03","04","05","06","07","08","09","unassigned","A","B","C","D","E"];
const STATUSES=["待處理","備貨中","可取貨","已完成","已取消"] as const;
const PBKDF2_ITER=100000; // Cloudflare Workers 上限
const SESSION_DAYS=7;

class HttpError extends Error{constructor(public status:number,message:string,public extra:Record<string,unknown>={}){super(message)}}
const enc=new TextEncoder();
const b64u=(buf:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const randomToken=(n=32)=>b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha256=async(s:string)=>b64u(await crypto.subtle.digest("SHA-256",enc.encode(s)));
const nowIso=()=>new Date().toISOString();
const taipeiDate=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
const toInt=(p:unknown)=>{const n=parseInt(String(p??"").replace(/[^\d]/g,""),10);return Number.isFinite(n)?n:0};

async function sameSecret(a:string,b:string){
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest("SHA-256",enc.encode(s))));
 const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
async function pbkdf2(password:string,salt:string,iter:number){
 const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 return b64u(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode(salt),iterations:iter},key,256));
}
function checkPassword(p:unknown):string{
 if(typeof p!=="string"||p.length<8||p.length>200)throw new HttpError(400,"密碼需為 8～200 個字元");return p;
}
function checkUsername(u:unknown):string{
 if(typeof u!=="string"||!/^[A-Za-z0-9_.-]{3,40}$/.test(u))throw new HttpError(400,"帳號需為 3～40 個英數字元（可含 _ . -）");return u.toLowerCase();
}
async function readJson(request:Request):Promise<any>{
 if(!request.headers.get("Content-Type")?.startsWith("application/json"))throw new HttpError(415,"需要 JSON 資料");
 const body=await request.text();if(body.length>32000)throw new HttpError(413,"資料過大");
 let v:any;try{v=JSON.parse(body)}catch{throw new HttpError(400,"JSON 格式不正確")}
 if(!v||typeof v!=="object"||Array.isArray(v))throw new HttpError(400,"資料格式不正確");return v;
}

// ---------- 身分驗證 ----------
async function legacyEnabled(env:Env){
 const r=await env.DB.prepare("SELECT value FROM settings WHERE key='legacy_token_enabled'").first<{value:string}>();
 return r?.value!=="0"; // 未設定＝啟用
}
async function userCount(env:Env){return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{n:number}>())?.n??0}
async function authenticate(request:Request,env:Env):Promise<Actor|null>{
 const h=request.headers.get("Authorization")??"";
 if(!h.startsWith("Bearer ")||h.length>1024)return null;
 const token=h.slice(7);
 const row=await env.DB.prepare(`SELECT u.id,u.role,u.username FROM sessions s JOIN users u ON u.id=s.user_id
  WHERE s.id=? AND s.revoked=0 AND s.expires_at>? AND u.active=1 AND s.token_version=u.token_version`).bind(await sha256(token),nowIso()).first<{id:string;role:Role;username:string}>();
 if(row)return {kind:"user",id:row.id,role:row.role,username:row.username};
 // 舊版共用管理密碼：管理員在「帳號」頁停用前都有效（管理員權限）
 if(await sameSecret(h,`Bearer ${env.INVENTORY_TOKEN}`)&&await legacyEnabled(env))return {kind:"legacy",role:"admin"};
 return null;
}
function requireRole(a:Actor|null,...roles:Role[]):Actor{
 if(!a)throw new HttpError(401,"未授權");
 if(!roles.includes(a.role))throw new HttpError(403,"沒有權限");return a;
}
async function createSession(env:Env,userId:string,tokenVersion:number){
 const token=randomToken();
 await env.DB.prepare("INSERT INTO sessions (id,user_id,token_version,created_at,expires_at) VALUES (?,?,?,?,?)")
  .bind(await sha256(token),userId,tokenVersion,nowIso(),new Date(Date.now()+SESSION_DAYS*864e5).toISOString()).run();
 return token;
}

// ---------- 庫存（沿用舊 API 契約） ----------
async function getInventory(env:Env){
 const {results}=await env.DB.prepare("SELECT * FROM inventory ORDER BY zone,name").all();
 return {items:results.map((i:any)=>({id:i.id,zone:i.zone,name:i.name,spec:i.spec,quantity:i.quantity,unit:i.unit,minimum:i.minimum,batch:i.batch,category:i.category,price:i.price,tracked:!!i.tracked,photoId:normalizePhotoId(i.zone,i.photo_id),positionNote:i.position_note,fridgeId:i.fridge_id}))};
}
async function postInventory(env:Env,actor:Actor,i:any){
 for(const f of ["id","zone","name","spec","unit","batch","category","price"])if(typeof i[f]!=="string"||i[f].length>300)throw new HttpError(400,"欄位格式不正確");
 if(!i.id||!i.name||!ZONES.includes(i.zone)||!Number.isSafeInteger(i.quantity)||i.quantity<0||!Number.isSafeInteger(i.minimum)||i.minimum<0||typeof i.tracked!=="boolean")throw new HttpError(400,"庫存格式不正確");
 const photoId=normalizePhotoId(i.zone,i.photoId??""),fridgeId=i.fridgeId??"",note=i.positionNote??"";
 if(typeof photoId!=="string"||typeof fridgeId!=="string"||typeof note!=="string"||note.length>120||(photoId&&!storagePhotos.some(p=>p.zone===i.zone&&p.id===photoId))||(fridgeId&&!photoSections(photoId).some(f=>f.id===fridgeId)))throw new HttpError(400,"照片與區塊不符");
 const existing=await env.DB.prepare("SELECT price,quantity FROM inventory WHERE id=?").bind(i.id).first<{price:string;quantity:number}>();
 if(existing&&actor.role==="staff"&&existing.price!==i.price)throw new HttpError(403,"店員不能修改售價");
 // 店員新增商品：不採用店員送來的售價，改用內建目錄售價（目錄外商品為空白，待管理員設定）
 if(!existing&&actor.role==="staff")i={...i,price:catalogPrice.get(i.id)??""};
 const values=[i.id,i.zone,i.name,i.spec,i.quantity,i.unit,i.minimum,i.batch,i.category,i.price,i.tracked?1:0,photoId,note,fridgeId];
 const expected=i.expectedQuantity;
 let sql=`INSERT INTO inventory (${columns.join(",")}) VALUES (${columns.map(()=>"?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${columns.slice(1).map(c=>`${c}=excluded.${c}`).join(",")}`;
 const binds:unknown[]=[...values];
 if(existing&&Number.isSafeInteger(expected)){sql+=" WHERE inventory.quantity=?";binds.push(expected)}
 const r=await env.DB.prepare(sql).bind(...binds).run();
 if(existing&&Number.isSafeInteger(expected)&&r.meta.changes===0){
  const latest=(await getInventory(env)).items.find(x=>x.id===i.id);
  throw new HttpError(409,"庫存已被其他裝置或訂單更動",{conflict:true,latest});
 }
 const {expectedQuantity:_x,...item}=i;
 return {item:{...item,photoId,fridgeId,positionNote:note}};
}

// ---------- 商品販售設定 ----------
async function listProducts(env:Env,actor:Actor){
 const {results}=await env.DB.prepare("SELECT id,zone,name,spec,unit,category,price,cost,quantity,on_sale,daily_limit,per_order_max FROM inventory ORDER BY zone,name").all<any>();
 return {items:results.map(r=>({id:r.id,zone:r.zone,name:r.name,spec:r.spec,unit:r.unit,category:r.category,price:r.price,quantity:r.quantity,onSale:!!r.on_sale,dailyLimit:r.daily_limit,perOrderMax:r.per_order_max,...(actor.role==="admin"?{cost:r.cost}:{})}))};
}
async function updateProduct(env:Env,id:string,b:any){
 const sets:string[]=[],binds:unknown[]=[];
 if(b.price!==undefined){if(typeof b.price!=="string"||b.price.length>30)throw new HttpError(400,"售價格式不正確");sets.push("price=?");binds.push(b.price)}
 if(b.cost!==undefined){if(typeof b.cost!=="string"||b.cost.length>30)throw new HttpError(400,"成本格式不正確");sets.push("cost=?");binds.push(b.cost)}
 if(b.onSale!==undefined){if(typeof b.onSale!=="boolean")throw new HttpError(400,"上架設定不正確");sets.push("on_sale=?");binds.push(b.onSale?1:0)}
 for(const [k,c] of [["dailyLimit","daily_limit"],["perOrderMax","per_order_max"]] as const)if(b[k]!==undefined){if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>100000)throw new HttpError(400,"限量需為 0 以上整數");sets.push(`${c}=?`);binds.push(b[k])}
 if(!sets.length)throw new HttpError(400,"沒有要更新的欄位");
 const r=await env.DB.prepare(`UPDATE inventory SET ${sets.join(",")} WHERE id=?`).bind(...binds,id).run();
 if(!r.meta.changes)throw new HttpError(404,"找不到商品（請先在庫存地圖儲存過一次）");
 return {ok:true};
}

async function bulkOnSale(env:Env,b:any){
 if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>1000||b.ids.some((x:unknown)=>typeof x!=="string"||x.length>300)||typeof b.onSale!=="boolean")throw new HttpError(400,"請選擇商品");
 const ids=[...new Set(b.ids as string[])];let changed=0;
 for(let k=0;k<ids.length;k+=90){const part=ids.slice(k,k+90);
  const r=await env.DB.prepare(`UPDATE inventory SET on_sale=? WHERE id IN (${part.map(()=>"?").join(",")})`).bind(b.onSale?1:0,...part).run();changed+=r.meta.changes}
 return {ok:true,changed};
}

// ---------- 顧客端頻率限制（固定時間窗，IP 只存雜湊） ----------
const LIMITS={order:{max:5,windowSec:600,msg:"送出次數太頻繁，請 10 分鐘後再試。"},lookup:{max:60,windowSec:600,msg:"查詢次數太頻繁，請稍後再試。"}} as const;
async function rateLimit(env:Env,request:Request,bucket:keyof typeof LIMITS){
 const L=LIMITS[bucket],ip=request.headers.get("CF-Connecting-IP")??"unknown";
 const keyHash=await sha256(`rl|${env.INVENTORY_TOKEN}|${ip}`);
 const now=Math.floor(Date.now()/1000),win=now-now%L.windowSec;
 const r=await env.DB.prepare("INSERT INTO rate_limits (bucket,key_hash,window_start,count) VALUES (?,?,?,1) ON CONFLICT(bucket,key_hash,window_start) DO UPDATE SET count=count+1 RETURNING count").bind(bucket,keyHash,win).first<{count:number}>();
 if(Math.random()<0.02)await env.DB.prepare("DELETE FROM rate_limits WHERE window_start<?").bind(now-86400).run(); // 只清除一天前的計數紀錄
 if((r?.count??0)>L.max)throw new HttpError(429,L.msg);
}

// ---------- 訂單 ----------
type OrderLine={id:string;qty:number};
function parseLines(raw:unknown):OrderLine[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>50)throw new HttpError(400,"請選擇商品");
 const m=new Map<string,number>();
 for(const l of raw){if(!l||typeof l.id!=="string"||l.id.length>300||!Number.isSafeInteger(l.qty)||l.qty<=0||l.qty>10000)throw new HttpError(400,"商品數量不正確");m.set(l.id,(m.get(l.id)??0)+l.qty)}
 return [...m].map(([id,qty])=>({id,qty}));
}
async function findOrderByKey(env:Env,key:string){return env.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(key).first<any>()}
async function orderDetail(env:Env,o:any,{internal}:{internal:boolean}){
 const {results}=await env.DB.prepare("SELECT item_id,name,spec,unit,qty,unit_price FROM order_items WHERE order_id=? ORDER BY name").bind(o.id).all<any>();
 const base={orderNo:o.order_no,status:o.status,customerName:o.customer_name,total:o.total,createdAt:o.created_at,updatedAt:o.updated_at,items:results.map(r=>({...(internal?{id:r.item_id}:{}),name:r.name,spec:r.spec,unit:r.unit,qty:r.qty,unitPrice:r.unit_price}))};
 return internal?{...base,id:o.id,phone:o.phone,note:o.note,source:o.source,createdBy:o.created_by,lookupToken:o.lookup_token}:base;
}
async function createOrder(env:Env,b:any,source:"admin"|"customer",createdBy:string){
 const key=b.idempotencyKey;
 if(typeof key!=="string"||!/^[A-Za-z0-9_-]{16,80}$/.test(key))throw new HttpError(400,"缺少送出識別碼");
 const scopedKey=`${source}:${key}`;
 const prior=await findOrderByKey(env,scopedKey);if(prior)return {order:prior,duplicate:true};
 const name=typeof b.customerName==="string"?b.customerName.trim():"",phone=typeof b.phone==="string"?b.phone.trim():"",note=typeof b.note==="string"?b.note.trim():"";
 if(!name||name.length>40)throw new HttpError(400,"請填寫姓名（40 字內）");
 if(source==="customer"&&!/^[0-9+\-\s]{6,20}$/.test(phone))throw new HttpError(400,"請填寫正確的聯絡電話");
 if(phone.length>20||note.length>300)throw new HttpError(400,"電話或備註過長");
 const lines=parseLines(b.items);
 const ph=lines.map(()=>"?").join(",");
 const {results:prods}=await env.DB.prepare(`SELECT id,name,spec,unit,price,quantity,on_sale,daily_limit,per_order_max FROM inventory WHERE id IN (${ph})`).bind(...lines.map(l=>l.id)).all<any>();
 const byId=new Map(prods.map(p=>[p.id,p]));
 const saleDate=taipeiDate();
 for(const l of lines){
  const p=byId.get(l.id);
  if(!p||(source==="customer"&&!p.on_sale))throw new HttpError(400,"有商品目前無法訂購");
  if(source==="customer"&&p.per_order_max>0&&l.qty>p.per_order_max)throw new HttpError(409,`「${p.name}」每筆最多 ${p.per_order_max} ${p.unit}`);
  if(p.quantity<l.qty)throw new HttpError(409,`「${p.name}」庫存不足`);
 }
 const id=crypto.randomUUID(),orderNo=`${saleDate.replace(/-/g,"")}-${randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g,"X").slice(0,5)}`,ts=nowIso();
 const total=lines.reduce((s,l)=>s+toInt(byId.get(l.id).price)*l.qty,0);
 const guard=(cond:string,...bind:unknown[])=>env.DB.prepare(`INSERT OR REPLACE INTO _guard (id,ok) VALUES (1, CASE WHEN ${cond} THEN 1 ELSE 0 END)`).bind(...bind);
 const stmts:D1PreparedStatement[]=[
  env.DB.prepare("INSERT INTO orders (id,order_no,idempotency_key,lookup_token,source,customer_name,phone,note,status,total,sale_date,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'待處理',?,?,?,?,?)")
   .bind(id,orderNo,scopedKey,randomToken(24),source,name,phone,note,total,saleDate,createdBy,ts,ts),
 ];
 for(const l of lines){
  const p=byId.get(l.id);
  stmts.push(
   env.DB.prepare(`UPDATE inventory SET quantity=quantity-?, tracked=1 WHERE id=? AND quantity>=?${source==="customer"?" AND on_sale=1":""}`).bind(l.qty,l.id,l.qty),
   guard("changes()=1"),
   env.DB.prepare("INSERT INTO daily_sales (item_id,sale_date,qty) VALUES (?,?,?) ON CONFLICT(item_id,sale_date) DO UPDATE SET qty=qty+excluded.qty").bind(l.id,saleDate,l.qty),
   guard("(SELECT daily_limit FROM inventory WHERE id=?)=0 OR (SELECT qty FROM daily_sales WHERE item_id=? AND sale_date=?)<=(SELECT daily_limit FROM inventory WHERE id=?)",l.id,l.id,saleDate,l.id),
   env.DB.prepare("INSERT INTO order_items (order_id,item_id,name,spec,unit,qty,unit_price) VALUES (?,?,?,?,?,?,?)").bind(id,l.id,p.name,p.spec,p.unit,l.qty,toInt(p.price)),
  );
 }
 try{await env.DB.batch(stmts)}
 catch(e){
  const again=await findOrderByKey(env,scopedKey);if(again)return {order:again,duplicate:true};
  // 交易已整批回滾：判斷是庫存或每日限量不足
  const {results:now}=await env.DB.prepare(`SELECT i.id,i.name,i.quantity,i.daily_limit,COALESCE(d.qty,0) AS sold FROM inventory i LEFT JOIN daily_sales d ON d.item_id=i.id AND d.sale_date=? WHERE i.id IN (${ph})`).bind(saleDate,...lines.map(l=>l.id)).all<any>();
  for(const l of lines){const n=now.find(x=>x.id===l.id);if(!n)continue;
   if(n.quantity<l.qty)throw new HttpError(409,`「${n.name}」庫存不足`);
   if(n.daily_limit>0&&n.sold+l.qty>n.daily_limit)throw new HttpError(409,`「${n.name}」已達今日限量`);}
  console.error("order batch failed",e);throw new HttpError(409,"訂單未成立，請重新確認數量後再送出");
 }
 return {order:(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>()),duplicate:false};
}
async function cancelOrder(env:Env,id:string){
 const o=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<any>();
 if(!o)throw new HttpError(404,"找不到訂單");
 if(o.status==="已取消")return {alreadyCancelled:true};
 if(o.status==="已完成")throw new HttpError(409,"已完成的訂單不能取消");
 const ts=nowIso();
 try{await env.DB.batch([
  env.DB.prepare("UPDATE orders SET status='已取消',restocked=1,updated_at=? WHERE id=? AND restocked=0 AND status NOT IN ('已取消','已完成')").bind(ts,id),
  env.DB.prepare("INSERT OR REPLACE INTO _guard (id,ok) VALUES (1, CASE WHEN changes()=1 THEN 1 ELSE 0 END)"),
  env.DB.prepare("UPDATE inventory SET quantity=quantity+(SELECT qty FROM order_items WHERE order_id=? AND item_id=inventory.id) WHERE id IN (SELECT item_id FROM order_items WHERE order_id=?)").bind(id,id),
  env.DB.prepare("UPDATE daily_sales SET qty=MAX(0,qty-(SELECT qty FROM order_items WHERE order_id=? AND item_id=daily_sales.item_id)) WHERE sale_date=? AND item_id IN (SELECT item_id FROM order_items WHERE order_id=?)").bind(id,o.sale_date,id),
 ])}catch{
  const n=await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(id).first<any>();
  if(n?.status==="已取消")return {alreadyCancelled:true};throw new HttpError(409,"取消失敗，請重新整理");
 }
 return {alreadyCancelled:false};
}
async function setStatus(env:Env,id:string,status:string){
 if(!STATUSES.includes(status as any)||status==="已取消")throw new HttpError(400,"狀態不正確");
 const r=await env.DB.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=? AND status NOT IN ('已取消')").bind(status,nowIso(),id).run();
 if(!r.meta.changes)throw new HttpError(409,"訂單不存在或已取消");return {ok:true};
}

// ---------- 帳號 ----------
async function listUsers(env:Env){
 const {results}=await env.DB.prepare("SELECT id,username,display_name,role,active,created_at FROM users ORDER BY created_at").all<any>();
 return {users:results.map(u=>({id:u.id,username:u.username,displayName:u.display_name,role:u.role,active:!!u.active,createdAt:u.created_at}))};
}
async function insertUser(env:Env,b:any,onlyIfEmpty:boolean){
 const username=checkUsername(b.username),password=checkPassword(b.password),role:Role=onlyIfEmpty?"admin":(b.role==="admin"?"admin":"staff");
 const displayName=typeof b.displayName==="string"?b.displayName.slice(0,40):"";
 const salt=randomToken(16),hash=await pbkdf2(password,salt,PBKDF2_ITER),id=crypto.randomUUID();
 const sql=`INSERT INTO users (id,username,display_name,role,pw_hash,pw_salt,pw_iter,created_at) SELECT ?,?,?,?,?,?,?,?${onlyIfEmpty?" WHERE NOT EXISTS (SELECT 1 FROM users)":""}`;
 let r;try{r=await env.DB.prepare(sql).bind(id,username,displayName,role,hash,salt,PBKDF2_ITER,nowIso()).run()}catch{throw new HttpError(409,"帳號已存在")}
 if(!r.meta.changes)throw new HttpError(409,"已經有管理員，請改用帳號登入");
 return {id,username,role};
}
async function updateUser(env:Env,actor:Actor,id:string,b:any){
 const u=await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first<any>();if(!u)throw new HttpError(404,"找不到帳號");
 const sets:string[]=[],binds:unknown[]=[];let revoke=false;
 if(b.displayName!==undefined){sets.push("display_name=?");binds.push(String(b.displayName).slice(0,40))}
 if(b.role!==undefined){if(!["admin","staff"].includes(b.role))throw new HttpError(400,"角色不正確");sets.push("role=?");binds.push(b.role);revoke=true}
 if(b.active!==undefined){if(typeof b.active!=="boolean")throw new HttpError(400,"格式不正確");sets.push("active=?");binds.push(b.active?1:0);if(!b.active)revoke=true}
 if(b.password!==undefined){const p=checkPassword(b.password),salt=randomToken(16);sets.push("pw_hash=?,pw_salt=?,pw_iter=?");binds.push(await pbkdf2(p,salt,PBKDF2_ITER),salt,PBKDF2_ITER);revoke=true}
 if(!sets.length)throw new HttpError(400,"沒有要更新的欄位");
 const demoting=u.role==="admin"&&u.active&&((b.role&&b.role!=="admin")||b.active===false);
 if(demoting){const n=(await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").first<{n:number}>())!.n;if(n<=1)throw new HttpError(409,"至少需保留一位啟用中的管理員")}
 if(revoke)sets.push("token_version=token_version+1");
 await env.DB.batch([
  env.DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...binds,id),
  ...(revoke?[env.DB.prepare("UPDATE sessions SET revoked=1 WHERE user_id=?").bind(id)]:[]),
 ]);
 return {ok:true,selfRevoked:revoke&&actor.kind==="user"&&actor.id===id};
}

// ---------- 路由 ----------
async function route(request:Request,env:Env,url:URL):Promise<unknown>{
 const p=url.pathname,m=request.method;
 // 顧客端（免登入）：只回傳可售商品的名稱／規格／售價／可訂數量
 if(p==="/api/public/menu"&&m==="GET"){
  const d=taipeiDate();
  const {results}=await env.DB.prepare("SELECT i.id,i.name,i.spec,i.unit,i.category,i.price,i.quantity,i.daily_limit,i.per_order_max,COALESCE(s.qty,0) AS sold FROM inventory i LEFT JOIN daily_sales s ON s.item_id=i.id AND s.sale_date=? WHERE i.on_sale=1 ORDER BY i.category,i.name").bind(d).all<any>();
  return {items:results.map(r=>{let a=Math.max(0,r.quantity);if(r.daily_limit>0)a=Math.min(a,Math.max(0,r.daily_limit-r.sold));if(r.per_order_max>0)a=Math.min(a,r.per_order_max);return {id:r.id,name:r.name,spec:r.spec,unit:r.unit,category:r.category,price:r.price,available:a}})};
 }
 if(p==="/api/public/orders"&&m==="POST"){
  await rateLimit(env,request,"order");
  const {order}=await createOrder(env,await readJson(request),"customer","顧客");
  return {orderNo:order.order_no,lookupToken:order.lookup_token,status:order.status};
 }
 const lk=p.match(/^\/api\/public\/orders\/([A-Za-z0-9_-]{20,64})$/);
 if(lk&&m==="GET"){
  await rateLimit(env,request,"lookup");
  const o=await env.DB.prepare("SELECT * FROM orders WHERE lookup_token=?").bind(lk[1]).first<any>();
  if(!o)throw new HttpError(404,"查無此訂單");return {order:await orderDetail(env,o,{internal:false})};
 }
 // 登入／首位管理員
 if(p==="/api/auth/login"&&m==="POST"){
  const b=await readJson(request);
  const u=typeof b.username==="string"?await env.DB.prepare("SELECT * FROM users WHERE username=?").bind(b.username.toLowerCase()).first<any>():null;
  const pw=typeof b.password==="string"?b.password.slice(0,200):"";
  const ok=u?await sameSecret(await pbkdf2(pw,u.pw_salt,u.pw_iter),u.pw_hash):(await pbkdf2(pw,"x",PBKDF2_ITER),false);
  if(!u||!ok||!u.active)throw new HttpError(401,"帳號或密碼不正確");
  return {token:await createSession(env,u.id,u.token_version),user:{username:u.username,role:u.role,displayName:u.display_name}};
 }
 if(p==="/api/auth/status"&&m==="GET")return {needsBootstrap:await userCount(env)===0};
 const actor=await authenticate(request,env);
 if(p==="/api/auth/bootstrap"&&m==="POST"){
  if(actor?.kind!=="legacy")throw new HttpError(403,"只有在尚未建立帳號時，才能用原管理密碼建立第一位管理員");
  const u=await insertUser(env,await readJson(request),true);
  return {user:u};
 }
 if(p==="/api/auth/logout"&&m==="POST"){
  const h=request.headers.get("Authorization")??"";if(h.startsWith("Bearer "))await env.DB.prepare("UPDATE sessions SET revoked=1 WHERE id=?").bind(await sha256(h.slice(7))).run();return {ok:true};
 }
 if(p==="/api/me"&&m==="GET"){const a=requireRole(actor,"admin","staff");return {role:a.role,legacy:a.kind==="legacy",username:a.kind==="user"?a.username:null,needsBootstrap:a.kind==="legacy"&&await userCount(env)===0}}
 if(p==="/api/settings/legacy-token"){
  const a=requireRole(actor,"admin");
  if(m==="GET")return {enabled:await legacyEnabled(env)};
  if(m==="POST"){const b=await readJson(request);if(typeof b.enabled!=="boolean")throw new HttpError(400,"格式不正確");
   if(b.enabled&&a.kind!=="user")throw new HttpError(403,"請以管理員帳號重新啟用");
   if(!b.enabled&&await userCount(env)===0)throw new HttpError(409,"請先建立第一位管理員，再停用原管理密碼");
   await env.DB.prepare("INSERT INTO settings (key,value,updated_at,updated_by) VALUES ('legacy_token_enabled',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(b.enabled?"1":"0",nowIso(),a.kind==="user"?a.username:"管理密碼").run();
   return {enabled:b.enabled};}
 }
 if(p==="/api/inventory"){
  const a=requireRole(actor,"admin","staff");
  if(m==="GET")return getInventory(env);
  if(m==="POST")return postInventory(env,a,await readJson(request));
 }
 if(p==="/api/products"&&m==="GET")return listProducts(env,requireRole(actor,"admin","staff"));
 if(p==="/api/products/bulk-on-sale"&&m==="POST"){requireRole(actor,"admin");return bulkOnSale(env,await readJson(request))}
 const pm=p.match(/^\/api\/products\/(.{1,300})$/);
 if(pm&&m==="PATCH"){requireRole(actor,"admin");return updateProduct(env,decodeURIComponent(pm[1]),await readJson(request))}
 if(p==="/api/orders"&&m==="GET"){
  requireRole(actor,"admin","staff");
  const st=url.searchParams.get("status");
  const q=st&&STATUSES.includes(st as any)?env.DB.prepare("SELECT * FROM orders WHERE status=? ORDER BY created_at DESC LIMIT 200").bind(st):env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");
  const {results}=await q.all<any>();
  return {orders:await Promise.all(results.map(o=>orderDetail(env,o,{internal:true})))};
 }
 if(p==="/api/orders"&&m==="POST"){
  const a=requireRole(actor,"admin","staff");
  const {order,duplicate}=await createOrder(env,await readJson(request),"admin",a.kind==="user"?a.username:"管理密碼");
  return {order:await orderDetail(env,order,{internal:true}),duplicate};
 }
 const om=p.match(/^\/api\/orders\/([0-9a-f-]{36})\/(cancel|status)$/);
 if(om&&m==="POST"){
  requireRole(actor,"admin","staff");
  if(om[2]==="cancel")return cancelOrder(env,om[1]);
  return setStatus(env,om[1],(await readJson(request)).status);
 }
 if(p==="/api/users"&&m==="GET"){requireRole(actor,"admin");return listUsers(env)}
 if(p==="/api/users"&&m==="POST"){const a=requireRole(actor,"admin");if(a.kind==="legacy"&&await userCount(env)===0)throw new HttpError(403,"請先建立第一位管理員");return {user:await insertUser(env,await readJson(request),false)}}
 const um=p.match(/^\/api\/users\/([0-9a-f-]{36})$/);
 if(um&&m==="PATCH"){const a=requireRole(actor,"admin");return updateUser(env,a,um[1],await readJson(request))}
 throw new HttpError(404,"Not found");
}

export default {async fetch(request:Request,env:Env):Promise<Response>{
 const origin=request.headers.get("Origin");
 const headers=new Headers({"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"});
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!env.ALLOWED_ORIGIN||!env.INVENTORY_TOKEN||env.INVENTORY_TOKEN.length<8||!env.DB)return reply({error:"後端設定尚未完成"},503);
 if(origin&&origin!==env.ALLOWED_ORIGIN)return reply({error:"不允許此網站來源"},403);
 if(origin===env.ALLOWED_ORIGIN)headers.set("Access-Control-Allow-Origin",origin);
 const url=new URL(request.url);
 if(!url.pathname.startsWith("/api/"))return reply({error:"Not found"},404);
 if(request.method==="OPTIONS"){
  headers.set("Access-Control-Allow-Methods","GET, POST, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  headers.set("Access-Control-Max-Age","600");
  return new Response(null,{status:204,headers});
 }
 try{return reply(await route(request,env,url))}
 catch(e){if(e instanceof HttpError)return reply({error:e.message,...e.extra},e.status);console.error(e);return reply({error:"資料庫目前無法使用，請稍後再試"},503)}
}};
