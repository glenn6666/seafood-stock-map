import {storagePhotos,photoSections,normalizePhotoId} from '../lib/storage-photos';
type Env={DB:D1Database;INVENTORY_TOKEN:string;ALLOWED_ORIGIN:string};
const columns=['id','zone','name','spec','quantity','unit','minimum','batch','category','price','tracked','photo_id','position_note','fridge_id'];
async function sameSecret(a:string,b:string){
 const encode=new TextEncoder();
 const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',encode.encode(s))));
 const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const origin=request.headers.get('Origin');
 const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'});
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!env.ALLOWED_ORIGIN||!env.INVENTORY_TOKEN||env.INVENTORY_TOKEN.length<8||!env.DB)return reply({error:'後端設定尚未完成'},503);
 if(origin&&origin!==env.ALLOWED_ORIGIN)return reply({error:'不允許此網站來源'},403);
 if(origin===env.ALLOWED_ORIGIN)headers.set('Access-Control-Allow-Origin',origin);
 if(new URL(request.url).pathname!=='/api/inventory')return reply({error:'Not found'},404);
 if(request.method==='OPTIONS'){
  headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  return new Response(null,{status:204,headers});
 }
 const authorization=request.headers.get('Authorization')??'';
 if(authorization.length>1024||!await sameSecret(authorization,`Bearer ${env.INVENTORY_TOKEN}`))return reply({error:'未授權'},401);
 try{
  if(request.method==='GET'){
   const {results}=await env.DB.prepare('SELECT * FROM inventory ORDER BY zone,name').all();
   return reply({items:results.map((i:any)=>({id:i.id,zone:i.zone,name:i.name,spec:i.spec,quantity:i.quantity,unit:i.unit,minimum:i.minimum,batch:i.batch,category:i.category,price:i.price,tracked:!!i.tracked,photoId:normalizePhotoId(i.zone,i.photo_id),positionNote:i.position_note,fridgeId:i.fridge_id}))});
  }
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'需要 JSON 資料'},415);
  const body=await request.text();if(body.length>16000)return reply({error:'資料過大'},413);
  let i:any;try{i=JSON.parse(body)}catch{return reply({error:'JSON 格式不正確'},400)}
  if(!i||typeof i!=='object'||Array.isArray(i))return reply({error:'資料格式不正確'},400);
  for(const field of ['id','zone','name','spec','unit','batch','category','price'])if(typeof i[field]!=='string'||i[field].length>300)return reply({error:'欄位格式不正確'},400);
  if(!i.id||!i.name||!['01','02','03','04','05','06','07','08','09','unassigned','A','B','C','D','E'].includes(i.zone)||!Number.isSafeInteger(i.quantity)||i.quantity<0||!Number.isSafeInteger(i.minimum)||i.minimum<0||typeof i.tracked!=='boolean')return reply({error:'庫存格式不正確'},400);
  const photoId=normalizePhotoId(i.zone,i.photoId??''),fridgeId=i.fridgeId??'',note=i.positionNote??'';
  if(typeof photoId!=='string'||typeof fridgeId!=='string'||typeof note!=='string'||note.length>120||(photoId&&!storagePhotos.some(p=>p.zone===i.zone&&p.id===photoId))||(fridgeId&&!photoSections(photoId).some(f=>f.id===fridgeId)))return reply({error:'照片與區塊不符'},400);
  const values=[i.id,i.zone,i.name,i.spec,i.quantity,i.unit,i.minimum,i.batch,i.category,i.price,i.tracked?1:0,photoId,note,fridgeId];
  await env.DB.prepare(`INSERT INTO inventory (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.slice(1).map(c=>`${c}=excluded.${c}`).join(',')}`).bind(...values).run();
  return reply({item:{...i,photoId,fridgeId,positionNote:note}});
 }catch{return reply({error:'資料庫目前無法使用，請稍後再試'},503)}
}};
