import {HttpError,requireRole,nowIso,type Env,type Actor} from './index';
import {defaultCatalog,type Catalog} from '../web/src/lib/dine-catalog';
const KEY='dine_catalog_v1';
export async function getCatalog(env:Env,admin=false){
 const row=await env.DB.prepare('SELECT value,updated_at FROM settings WHERE key=?').bind(KEY).first<{value:string;updated_at:string}>();
 const data=row?JSON.parse(row.value):{draft:defaultCatalog(),published:defaultCatalog()};
 return admin?{...data,revision:row?.updated_at??''}:{catalog:data.published};
}
function validate(v:any):asserts v is Catalog{
 if(!v||v.version!==1||!Array.isArray(v.pages)||v.pages.length!==2)throw new HttpError(400,'需要兩頁菜單');
 const str=(s:any,n:number)=>typeof s==='string'&&s.length<=n;
 const color=(s:any)=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
 const url=(s:any)=>str(s,1000)&&(/^\/seafood-stock-map\/[a-zA-Z0-9/_%.\-]+$/.test(s)||/^\/api\/public\/dine-photos\/[0-9a-f-]{36}$/.test(s)||/^https:\/\/[^\s]+$/.test(s));
 for(const p of v.pages){
  if(!str(p.id,60)||!str(p.title,100)||!url(p.original)||!['original','layers'].includes(p.mode)||!color(p.background)||!Array.isArray(p.layers)||p.layers.length>200)throw new HttpError(400,'菜單頁格式不正確');
  const ids=new Set();
  for(const l of p.layers){
   if(!str(l.id,80)||ids.has(l.id)||!['text','image','rect'].includes(l.type))throw new HttpError(400,'圖層格式不正確');ids.add(l.id);
   for(const k of ['x','y','width','height','rotation','opacity'])if(typeof l[k]!=='number'||!Number.isFinite(l[k])||Math.abs(l[k])>10000)throw new HttpError(400,'圖層尺寸不正確');
   if(l.width<=0||l.height<=0||l.opacity<0||l.opacity>1||typeof l.hidden!=='boolean')throw new HttpError(400,'圖層尺寸不正確');
   if(l.type==='text'&&(!str(l.text,1000)||!color(l.color)||!['serif','sans-serif'].includes(l.fontFamily)||!Number.isFinite(l.fontSize)||l.fontSize<6||l.fontSize>180||typeof l.bold!=='boolean'))throw new HttpError(400,'文字格式不正確');
   if(l.type==='rect'&&!color(l.color))throw new HttpError(400,'色彩格式不正確');
   if(l.type==='image'){
    if(!url(l.src))throw new HttpError(400,'圖片網址不正確');
    if(l.crop&&(!Array.isArray(l.crop)||l.crop.length!==4||l.crop.some((n:any)=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000)||l.crop[2]<=0||l.crop[3]<=0||!Number.isFinite(l.imageWidth)||!Number.isFinite(l.imageHeight)||l.imageWidth<=0||l.imageHeight<=0))throw new HttpError(400,'圖片裁切不正確');
   }
  }
 }
}
export async function catalogAdmin(request:Request,env:Env,actor:Actor|null){
 const a=requireRole(actor,'admin','staff');
 if(request.method==='GET')return getCatalog(env,true);
 if(request.method!=='PUT')throw new HttpError(405,'Method not allowed');
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'需要 JSON');
 const raw=await request.text();if(raw.length>200000)throw new HttpError(413,'菜單資料過大');
 let b;try{b=JSON.parse(raw)}catch{throw new HttpError(400,'格式不正確')}
 if(!b||typeof b!=='object')throw new HttpError(400,'格式不正確');
 validate(b.catalog);if(typeof b.revision!=='string'||!['draft','publish'].includes(b.action))throw new HttpError(400,'缺少版本資訊');
 const current=await getCatalog(env,true);
 if(current.revision!==b.revision)throw new HttpError(409,'其他人已修改菜單，請重新載入後再編輯');
 const value=JSON.stringify({draft:b.catalog,published:b.action==='publish'?b.catalog:current.published});
 const ts=new Date(Math.max(Date.now(),Date.parse(current.revision||'1970-01-01')+1)).toISOString(),who=a.kind==='user'?a.username:'管理密碼';
 const r=b.revision
  ?await env.DB.prepare('UPDATE settings SET value=?,updated_at=?,updated_by=? WHERE key=? AND updated_at=?').bind(value,ts,who,KEY,b.revision).run()
  :await env.DB.prepare('INSERT OR IGNORE INTO settings (key,value,updated_at,updated_by) VALUES (?,?,?,?)').bind(KEY,value,ts,who).run();
 if(!r.meta.changes)throw new HttpError(409,'版本衝突，請重新載入');
 return {ok:true,revision:ts};
}
