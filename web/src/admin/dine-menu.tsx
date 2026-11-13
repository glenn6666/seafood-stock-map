import {useEffect,useMemo,useRef,useState} from "react";
import {inventoryFetch,getApiOrigin} from "../lib/pages-api";
import {errorText} from "../lib/api-config";
import {dineImageSrc} from "../lib/dine-photos";
import type {Me} from "../main";
import "./dine-menu.css";

type Item={id:string;category:string;name:string;description:string;price:number|null;priceNote:string;unit:string;badges:string[];imageUrl:string;market:boolean;active:boolean;sort:number;deleted:boolean;updatedAt:string;updatedBy:string};
type Cat={id:string;label:string};
type Form={name:string;category:string;description:string;market:boolean;price:string;priceNote:string;unit:string;hot:boolean;best:boolean;imageUrl:string;sort:string;active:boolean};
type Log={id:number;itemId:string;itemName:string;action:string;changes:Record<string,[unknown,unknown]>;actor:string;createdAt:string};

const FIELD_LABEL:Record<string,string>={name:"品名",category:"分類",description:"說明",priceNote:"價格說明",unit:"單位",price:"售價",badges:"標籤",imageUrl:"照片",sort:"排序",active:"上架",deleted:"刪除"};
const ACTION_LABEL:Record<string,string>={create:"新增",update:"修改",delete:"刪除",restore:"還原"};
const fmtTime=(iso:string)=>{if(!iso)return "";const t=new Date(new Date(iso).getTime()+8*3600e3).toISOString();return `${+t.slice(5,7)}/${+t.slice(8,10)} ${t.slice(11,16)}`};
const priceText=(i:{price:number|null;market:boolean})=>i.market?"時價":`$${i.price}`;

/** 餐點照片在瀏覽器先處理：置中裁成正方形 800×800，優先 WebP（iPhone 不支援時改 JPEG），≤300KB 才上傳。 */
export async function compressDinePhoto(f:File|Blob):Promise<Blob>{
 const bmp=await createImageBitmap(f).catch(()=>{throw new Error("無法讀取這張照片，請改用 JPG／PNG")});
 const side=Math.min(bmp.width,bmp.height),sx=(bmp.width-side)/2,sy=(bmp.height-side)/2;
 for(const [edge,q] of [[800,.82],[800,.72],[800,.62],[700,.55],[600,.5]] as const){
  const out=Math.min(edge,side);
  const c=document.createElement("canvas");c.width=out;c.height=out;
  const g=c.getContext("2d")!;g.fillStyle="#fff";g.fillRect(0,0,out,out);g.drawImage(bmp,sx,sy,side,side,0,0,out,out);
  let b=await new Promise<Blob|null>(r=>c.toBlob(r,"image/webp",q));
  if(!b||b.type!=="image/webp")b=await new Promise<Blob|null>(r=>c.toBlob(r,"image/jpeg",q));
  if(b&&b.size<=300*1024)return b;
 }
 throw new Error("照片太大，請換一張");
}
async function uploadDinePhoto(f:File):Promise<string>{
 const b=await compressDinePhoto(f);
 const r=await inventoryFetch("/api/dine-menu/photos",{method:"POST",headers:{"Content-Type":b.type},body:b});
 if(!r.ok)throw new Error(await errorText(r,"照片上傳失敗"));
 return (await r.json()).imageUrl;
}

const toForm=(i:Item|null,cat:string):Form=>i?{name:i.name,category:i.category,description:i.description,market:i.market,price:i.market?"":String(i.price??""),priceNote:i.priceNote,unit:i.unit||"份",hot:i.badges.includes("hot"),best:i.badges.includes("best"),imageUrl:i.imageUrl,sort:String(i.sort),active:i.active}
 :{name:"",category:cat,description:"",market:false,price:"",priceNote:"",unit:"份",hot:false,best:false,imageUrl:"",sort:"",active:true};

function Thumb({id,url,name}:{id:string;url:string;name:string}){
 const src=dineImageSrc(id,url,getApiOrigin());const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className="dm-thumb" src={src} alt={name} loading="lazy" onError={()=>setBad(true)}/>:<span className="dm-thumb dm-ph">無照片</span>;
}

export default function DineMenu(_props:{me:Me}){
 const [items,setItems]=useState<Item[]>([]),[cats,setCats]=useState<Cat[]>([]),[err,setErr]=useState(""),[toast,setToast]=useState("");
 const [q,setQ]=useState(""),[fcat,setFcat]=useState("");
 const [editing,setEditing]=useState<Item|"new"|null>(null);
 const [logs,setLogs]=useState<Log[]|null>(null);
 const toastTimer=useRef(0);
 const flash=(t:string)=>{setToast(t);clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(""),3500)};
 const load=()=>inventoryFetch("/api/dine-menu").then(async r=>{if(!r.ok)return setErr(await errorText(r));const d=await r.json();setItems(d.items);setCats(d.categories??[]);setErr("")}).catch(e=>setErr(e.message));
 useEffect(()=>{load()},[]);
 const loadLogs=()=>inventoryFetch("/api/dine-menu/log").then(r=>r.ok?r.json():{rows:[]}).then(d=>setLogs(d.rows));
 const catLabel=(id:string)=>cats.find(c=>c.id===id)?.label??id;
 const shown=useMemo(()=>items.filter(i=>!i.deleted&&(!fcat||i.category===fcat)&&(i.name+i.description).includes(q.trim())),[items,q,fcat]);
 const trash=items.filter(i=>i.deleted);
 const groups=cats.map(c=>({c,list:shown.filter(i=>i.category===c.id)})).filter(g=>g.list.length);

 async function patch(i:Item,body:Record<string,unknown>,done:string){
  const r=await inventoryFetch(`/api/dine-menu/${i.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,expectedUpdatedAt:i.updatedAt})});
  if(!r.ok){const t=await errorText(r);setErr(t);if(r.status===409)load();return false}
  setErr("");flash(done);await load();if(logs)loadLogs();return true;
 }
 return <main className="admin-page dm">
  <h1>餐點菜單</h1>
  <p className="admin-hint">這裡改的內容會直接出現在「線上點餐」頁（不用重新發布）。店員和管理員都可以修改；每次修改都會留下紀錄。</p>
  <div className="dm-top">
   <button className="primary dm-add" onClick={()=>setEditing("new")}>＋ 新增餐點</button>
   <input placeholder="搜尋餐點" value={q} onChange={e=>setQ(e.target.value)} aria-label="搜尋餐點"/>
   <select value={fcat} onChange={e=>setFcat(e.target.value)} aria-label="分類篩選"><option value="">全部分類</option>{cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
  </div>
  {err&&<p className="admin-msg warn" role="alert">{err}</p>}
  {groups.map(({c,list})=><section key={c.id} className="dm-group"><h2>{c.label}<small>（{list.length}）</small></h2>
   {list.map(i=><div key={i.id} className={"dm-row"+(i.active?"":" off")} data-testid="dine-row">
    <Thumb id={i.id} url={i.imageUrl} name={i.name}/>
    <div className="dm-info"><strong>{i.name}</strong>
     <span className="dm-price">{priceText(i)}<small> / {i.unit}</small></span>
     <span className="dm-tags">{i.active?<span className="tag ok">上架中</span>:<span className="tag">已下架</span>}{i.badges.includes("hot")&&<span className="tag warn">人氣</span>}{i.badges.includes("best")&&<span className="tag warn">推薦</span>}</span>
    </div>
    <div className="dm-btns">
     <button className="primary" onClick={()=>setEditing(i)}>編輯</button>
     <button onClick={()=>patch(i,{active:!i.active},`「${i.name}」已${i.active?"下架":"上架"}`)}>{i.active?"下架":"上架"}</button>
    </div>
   </div>)}
  </section>)}
  {!groups.length&&!err&&<p className="admin-hint">{items.length?"沒有符合的餐點。":"載入中…"}</p>}
  {trash.length>0&&<details className="admin-card dm-trash"><summary>已刪除的餐點（{trash.length}）— 可還原</summary>
   {trash.map(i=><div key={i.id} className="dm-row off"><Thumb id={i.id} url={i.imageUrl} name={i.name}/><div className="dm-info"><strong>{i.name}</strong><small>{catLabel(i.category)}・{i.updatedBy} {fmtTime(i.updatedAt)} 刪除</small></div>
    <div className="dm-btns"><button onClick={()=>patch(i,{deleted:false},`已還原「${i.name}」（目前為下架，要賣請按上架）`)}>還原</button></div></div>)}
  </details>}
  <details className="admin-card dm-log" onToggle={e=>{if((e.target as HTMLDetailsElement).open)loadLogs()}}><summary>修改紀錄（最近 50 筆）</summary>
   {logs===null?<p className="admin-hint">載入中…</p>:!logs.length?<p className="admin-hint">還沒有修改紀錄。</p>:
    <ul>{logs.map(l=><li key={l.id}><b>{fmtTime(l.createdAt)}</b>　{l.actor} {ACTION_LABEL[l.action]??l.action}「{l.itemName}」
     <small>{changeText(l,catLabel)}</small></li>)}</ul>}
  </details>
  {editing&&<Editor item={editing==="new"?null:editing} cats={cats} defaultCat={fcat||cats[0]?.id||"porridge"}
   onClose={()=>setEditing(null)}
   onSaved={async(t)=>{setEditing(null);flash(t);await load();if(logs)loadLogs()}}/>}
  {toast&&<div className="dm-toast" role="status">✓ {toast}</div>}
 </main>;
}
function changeText(l:Log,catLabel:(s:string)=>string){
 const create=l.action==="create";
 return Object.entries(l.changes).filter(([k,[,b]])=>k!=="deleted"&&!(create&&(k==="sort"||b===""||b===undefined)))
  .map(([k,[a,b]])=>k==="imageUrl"?(b?(a?"換了照片":"加上照片"):"移除照片")
   :`${FIELD_LABEL[k]??k}：${create?"":show(k,a,catLabel)+" → "}${show(k,b,catLabel)}`).join("；");
}
function show(k:string,v:unknown,catLabel:(s:string)=>string){
 if(v===null||v===undefined||v==="")return k==="price"?"時價":"（空白）";
 if(k==="active")return v?"上架":"下架";if(k==="deleted")return v?"是":"否";
 if(k==="category")return catLabel(String(v));if(k==="imageUrl")return "新照片";
 if(k==="badges")return String(v).split(",").map(b=>b==="hot"?"人氣":b==="best"?"推薦":b).join("、");
 return String(v);
}

function Editor({item,cats,defaultCat,onClose,onSaved}:{item:Item|null;cats:Cat[];defaultCat:string;onClose:()=>void;onSaved:(msg:string)=>void}){
 const [f,setF]=useState<Form>(()=>toForm(item,defaultCat));
 const [busy,setBusy]=useState(""),[err,setErr]=useState(""),[localPreview,setLocalPreview]=useState("");
 const dlg=useRef<HTMLDialogElement>(null);const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{dlg.current?.showModal();const prev=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=prev}},[]);
 useEffect(()=>()=>{if(localPreview)URL.revokeObjectURL(localPreview)},[localPreview]);
 const set=<K extends keyof Form>(k:K,v:Form[K])=>setF(x=>({...x,[k]:v}));
 async function pick(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value="";if(!file)return;
  setBusy("photo");setErr("");
  try{const url=await uploadDinePhoto(file);setLocalPreview(URL.createObjectURL(file));set("imageUrl",url)}
  catch(x){setErr(x instanceof Error?x.message:"照片上傳失敗")}finally{setBusy("")}
 }
 function body(){
  const price=f.market?null:Number(f.price);
  if(!f.name.trim())throw new Error("請填寫品名");
  if(!f.market&&(f.price.trim()===""||!Number.isInteger(price)||price!<0))throw new Error("請填寫售價（整數），或勾選「時價」");
  const sort=f.sort.trim()===""?undefined:Number(f.sort);
  if(sort!==undefined&&(!Number.isInteger(sort)||sort<0))throw new Error("排序需為 0 以上整數");
  return {name:f.name.trim(),category:f.category,description:f.description.trim(),price,priceNote:f.priceNote.trim(),unit:f.unit.trim()||"份",
   badges:[...(f.hot?["hot"]:[]),...(f.best?["best"]:[])],imageUrl:f.imageUrl,active:f.active,...(sort!==undefined?{sort}:{})};
 }
 async function save(){
  let b;try{b=body()}catch(x){setErr((x as Error).message);return}
  setBusy("save");setErr("");
  const r=item?await inventoryFetch(`/api/dine-menu/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...b,expectedUpdatedAt:item.updatedAt})})
   :await inventoryFetch("/api/dine-menu",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});
  setBusy("");
  if(!r.ok){setErr(await errorText(r));return}
  onSaved(item?`已儲存「${b.name}」，顧客端已更新`:`已新增「${b.name}」${b.active?"，顧客端已可點餐":"（目前下架）"}`);
 }
 async function del(){
  if(!item||!confirm(`確定要刪除「${item.name}」？\n顧客端會立刻看不到；之後可在「已刪除的餐點」還原。`))return;
  setBusy("del");
  const r=await inventoryFetch(`/api/dine-menu/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({deleted:true,expectedUpdatedAt:item.updatedAt})});
  setBusy("");if(!r.ok){setErr(await errorText(r));return}
  onSaved(`已刪除「${item.name}」`);
 }
 const preview=localPreview||dineImageSrc(item?.id??"",f.imageUrl,getApiOrigin());
 return <dialog ref={dlg} className="dm-dialog" onCancel={e=>{e.preventDefault();onClose()}} aria-label={item?"編輯餐點":"新增餐點"}>
  <header><button type="button" className="dm-x" onClick={onClose} aria-label="關閉">×</button><h2>{item?"編輯餐點":"新增餐點"}</h2></header>
  <div className="dm-form">
   <div className="dm-photo">
    {preview?<img src={preview} alt="餐點照片"/>:<span className="dm-ph">還沒有照片</span>}
    <div className="dm-photo-btns">
     <button type="button" className="primary" disabled={busy==="photo"} onClick={()=>fileRef.current?.click()}>{busy==="photo"?"上傳中…":preview?"換照片":"拍照／選照片"}</button>
     {f.imageUrl&&<button type="button" onClick={()=>{set("imageUrl","");setLocalPreview("")}}>移除照片</button>}
     <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} aria-label="餐點照片"/>
    </div>
    <small>照片會自動裁成正方形並壓縮。換好後記得按下方「儲存」。</small>
   </div>
   <label>品名<input value={f.name} maxLength={40} onChange={e=>set("name",e.target.value)} aria-label="品名"/></label>
   <label>分類<select value={f.category} onChange={e=>set("category",e.target.value)} aria-label="分類">{cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <div className="dm-two">
    <label>售價（元）<input inputMode="numeric" value={f.market?"":f.price} disabled={f.market} placeholder={f.market?"時價":"例如 299"} onChange={e=>set("price",e.target.value.replace(/[^\d]/g,""))} aria-label="售價"/></label>
    <label>單位<input value={f.unit} maxLength={6} onChange={e=>set("unit",e.target.value)} aria-label="單位"/></label>
   </div>
   <label className="dm-check"><input type="checkbox" checked={f.market} onChange={e=>set("market",e.target.checked)}/> 時價（顧客可點，金額由店家確認後報價）</label>
   {f.market&&<label>價格說明<input value={f.priceNote} maxLength={80} placeholder="例如：當日蛤蜊價＋80元" onChange={e=>set("priceNote",e.target.value)} aria-label="價格說明"/></label>}
   <label>說明<textarea rows={3} value={f.description} maxLength={200} onChange={e=>set("description",e.target.value)} aria-label="說明"/></label>
   <div className="dm-two">
    <label className="dm-check"><input type="checkbox" checked={f.hot} onChange={e=>set("hot",e.target.checked)}/> 人氣</label>
    <label className="dm-check"><input type="checkbox" checked={f.best} onChange={e=>set("best",e.target.checked)}/> 推薦</label>
   </div>
   <label>排序（數字小的排前面）<input inputMode="numeric" value={f.sort} placeholder="留空＝排在分類最後" onChange={e=>set("sort",e.target.value.replace(/[^\d]/g,""))} aria-label="排序"/></label>
   <label className="dm-check dm-switch"><input type="checkbox" checked={f.active} onChange={e=>set("active",e.target.checked)}/> 顧客端上架（可以點餐）</label>
   {item?.updatedAt&&<p className="admin-hint">上次修改：{item.updatedBy||"—"} {fmtTime(item.updatedAt)}</p>}
   {item&&<button type="button" className="danger dm-del" onClick={del} disabled={!!busy}>刪除這道餐點</button>}
  </div>
  <footer>
   {err&&<p className="admin-error" role="alert">{err}</p>}
   <div><button type="button" onClick={onClose}>取消</button><button type="button" className="primary" onClick={save} disabled={!!busy}>{busy==="save"?"儲存中…":"儲存"}</button></div>
  </footer>
 </dialog>;
}
