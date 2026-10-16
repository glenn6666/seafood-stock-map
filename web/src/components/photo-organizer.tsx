"use client";
import {useState} from "react";
import {Input} from "@/components/ui/input";
import {NativeSelect,NativeSelectOption} from "@/components/ui/native-select";
import {storagePhotos,photoSections,type Item} from "@/lib/storage-photos";
import {locations} from "@/components/storage-map";

const locationOf=(id:string)=>locations.some(z=>z.id===id)?id:"unassigned";
type Props={zone:string;items:Item[];disabled:boolean;error:string;update:(item:Item,changes:Partial<Item>)=>Promise<boolean>};
export default function PhotoOrganizer({zone,items,disabled,error,update}:Props){
 const photos=storagePhotos.filter(p=>p.zone===zone);
 const [photo,setPhoto]=useState(photos[0]?.id??"all"),[category,setCategory]=useState("全部"),[search,setSearch]=useState(""),[adding,setAdding]=useState(false),[notice,setNotice]=useState("");
 const [fridge,setFridge]=useState("all");
 const selected=photos.find(p=>p.id===photo);
 const zoneItems=items.filter(i=>locationOf(i.zone)===zone);
 const sections=photoSections(selected?.id??"");
 const kind=selected?.id==="photo-6"||selected?.id==="photo-7"?"區塊":"冰箱";
 const isFridgePhoto=sections.length>0;
 const chosenFridge=sections.find(f=>f.id===fridge);
 const photoItems=zoneItems.filter(i=>photo==="all"||(photo==="none"?!i.photoId:i.photoId===photo));
 const scoped=photoItems.filter(i=>!isFridgePhoto||fridge==="all"||(fridge==="none"?!i.fridgeId:i.fridgeId===fridge));
 const categories=Array.from(new Set(items.map(i=>i.category)));
 const visible=scoped.filter(i=>category==="全部"||i.category===category);
 const candidates=items.filter(i=>(!selected||i.photoId!==selected.id||(isFridgePhoto&&i.fridgeId!==fridge))&&i.name.toLowerCase().includes(search.toLowerCase()));
 async function assign(item:Item){
  if(!selected||(isFridgePhoto&&!chosenFridge))return;
  const ok=await update(item,{zone,photoId:selected.id,positionNote:"",fridgeId:isFridgePhoto?fridge:""});
  if(ok){setNotice(item.name+" 已分配至"+(chosenFridge?.label??selected.label));setCategory("全部")}
 }
 function choose(id:string){setFridge("all");setPhoto(id);setCategory("全部");setAdding(false);setNotice("")}
 return <div className="organizer-scroll">
 {error&&<p className="save-error" role="alert">{error}</p>}
 {photos.length>0?<section className="photo-workspace">
  <div className="photo-choices" aria-label="儲位照片">{photos.map(p=><button key={p.id} aria-pressed={photo===p.id} onClick={()=>choose(p.id)}><img src={p.src} alt=""/><span>{p.label}</span><small>{zoneItems.filter(i=>i.photoId===p.id).length} 個品項</small></button>)}</div>
  <div className="photo-scope"><button className={photo==="all"?"active":""} onClick={()=>choose("all")}>本儲位全部 · {zoneItems.length}</button><button className={photo==="none"?"active":""} onClick={()=>choose("none")}>未指定照片 · {zoneItems.filter(i=>!i.photoId).length}</button></div>
  {selected&&<><figure className="storage-photo">{isFridgePhoto?<div className="fridge-image"><img src={selected.src} alt={selected.label+"："+sections.map(f=>f.label).join("、")}/>{sections.map(f=>{const stock=zoneItems.filter(i=>i.photoId===selected.id&&i.fridgeId===f.id),low=stock.filter(i=>i.tracked&&i.minimum>0&&i.quantity<=i.minimum).length;return <button key={f.id} className={"fridge-hotspot "+(fridge===f.id?"selected ":"")+(low?"low":"")} style={{left:f.left+"%",width:f.width+"%",top:f.top+"%",height:f.height+"%"}} aria-label={f.label+"，"+stock.length+" 個品項"+(low?"，"+low+" 項待補貨":"")} aria-pressed={fridge===f.id} onClick={()=>{setFridge(f.id);setCategory("全部");setAdding(false);setNotice("")}}><span>{f.label}<small>{stock.length} 項{low?" · "+low+" 項待補貨":""}</small></span></button>})}</div>:<img src={selected.src} alt={selected.label}/>}<figcaption>{chosenFridge?.label??selected.label}<a href={selected.src} target="_blank" rel="noreferrer">查看原圖 ↗</a></figcaption></figure>
  {isFridgePhoto&&<><p className="fridge-hint">點選照片中的{kind}，即可整理商品與庫存。</p><div className="photo-scope">{[{id:"all",label:"全部"+kind},{id:"none",label:"未指定"+kind},...sections].map(f=><button key={f.id} className={fridge===f.id?"active":""} aria-pressed={fridge===f.id} onClick={()=>{setFridge(f.id);setCategory("全部");setAdding(false);setNotice("")}}>{f.label}</button>)}</div></>}<button className="organizer-action" disabled={isFridgePhoto&&!chosenFridge} aria-expanded={adding} onClick={()=>setAdding(!adding)}>{adding?"收起商品選擇":isFridgePhoto?(chosenFridge?"＋ 分配商品到"+chosenFridge.label:"請先點選一個"+kind):"＋ 分配商品到這張照片"}</button>
  {adding&&<div className="assign-products"><label htmlFor="assign-search">搜尋商品</label><Input id="assign-search" placeholder="輸入商品名稱" value={search} onChange={e=>setSearch(e.target.value)}/><p>選擇商品後，會移至此儲位與照片，保留原庫存數量。</p><div className="assign-results">{candidates.map(i=><div key={i.id}><span><strong>{i.name}</strong><small>{i.category} · {locationOf(i.zone)==="unassigned"?"待分配":"儲位 "+i.zone}{i.photoId?" · "+storagePhotos.find(p=>p.id===i.photoId)?.label:""}</small></span><button disabled={disabled} onClick={()=>assign(i)}>{chosenFridge?"移至此"+kind:"移至此照片"}</button></div>)}{!candidates.length&&<p>沒有符合的商品。</p>}</div></div>}</>}
 </section>:zone!=="unassigned"&&<p className="empty-alert">此儲位尚未提供照片，仍可整理商品與盤點庫存。</p>}
 <p role="status" className="organizer-notice">{notice}</p>
 <div className="category-tabs">{["全部",...Array.from(new Set(scoped.map(i=>i.category)))].map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 <div className="sheet-summary"><span>{selected?(chosenFridge?.label??(isFridgePhoto&&fridge==="none"?"未指定"+kind:selected.label)):photo==="none"?"未指定照片":"商品清單"} · {visible.length} 項</span><span className="danger-text">{scoped.filter(i=>i.tracked&&i.minimum>0&&i.quantity<=i.minimum).length} 項待補貨</span></div>
 <div className="inventory-list">{!visible.length&&<p className="empty-alert">{selected?(isFridgePhoto?(chosenFridge?"此"+kind+"尚無商品，請使用上方分配商品按鈕。":"請點選"+kind+"以分配商品；既有商品可在未指定"+kind+"中整理。"):"尚未分配商品，請使用上方「分配商品到這張照片」。"):"目前沒有商品。"}</p>}
 {visible.map(item=><ProductCard key={[item.id,item.photoId,item.fridgeId].join(":")} item={item} categories={categories} disabled={disabled} update={update}/>)}</div>
 </div>
}

function ProductCard({item:i,categories,disabled,update}:{item:Item;categories:string[];disabled:boolean;update:Props["update"]}){
 const [position,setPosition]=useState(i.positionNote??""),[saved,setSaved]=useState("");
 const low=i.tracked&&i.minimum>0&&i.quantity<=i.minimum;
 const photos=storagePhotos.filter(p=>p.zone===i.zone);
 return <article className={"inventory-row "+(low?"low":"")}>
 <div className="item-main"><div><strong>{i.name}</strong>{!i.tracked&&<span className="pending-tag">待盤點</span>}{low&&<span className="low-tag">庫存不足</span>}</div><small>{i.spec} · 售價 {i.price==="貼標"?"貼標":"$"+i.price}</small></div>
 <label className="storage-picker">商品分類<NativeSelect aria-label={i.name+"的分類"} value={i.category} disabled={disabled} onChange={e=>update(i,{category:e.target.value})}>{Array.from(new Set([...categories,"未分類"])).map(c=><NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}</NativeSelect></label>
 <label className="storage-picker">存放位置<NativeSelect aria-label={i.name+"的存放位置"} value={locationOf(i.zone)} disabled={disabled} onChange={e=>update(i,{zone:e.target.value,photoId:"",positionNote:"",fridgeId:""})}><NativeSelectOption value="unassigned">待分配</NativeSelectOption>{locations.map(z=><NativeSelectOption key={z.id} value={z.id}>{z.name}</NativeSelectOption>)}</NativeSelect></label>
 {photos.length>0&&<label className="storage-picker">所屬照片<NativeSelect aria-label={i.name+"的照片"} value={i.photoId??""} disabled={disabled} onChange={e=>{setPosition("");update(i,{photoId:e.target.value,positionNote:"",fridgeId:""})}}><NativeSelectOption value="">未指定照片</NativeSelectOption>{photos.map(p=><NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>)}</NativeSelect></label>}
 {photoSections(i.photoId??"").length>0&&<label className="storage-picker">所屬區域<NativeSelect aria-label={i.name+"的區域"} value={i.fridgeId??""} disabled={disabled} onChange={e=>update(i,{fridgeId:e.target.value,positionNote:""})}><NativeSelectOption value="">未指定區域</NativeSelectOption>{photoSections(i.photoId??"").map(f=><NativeSelectOption key={f.id} value={f.id}>{f.label}</NativeSelectOption>)}</NativeSelect></label>}
 {i.photoId&&<form className="position-form" onSubmit={async e=>{e.preventDefault();if(await update(i,{positionNote:position.trim()}))setSaved("位置已儲存")}}><label htmlFor={"position-"+i.id}>照片內位置</label><div><Input id={"position-"+i.id} maxLength={120} placeholder="例如：上層左側、第 2 格" value={position} onChange={e=>{setPosition(e.target.value);setSaved("")}}/><button disabled={disabled} type="submit">儲存位置</button></div><small role="status">{saved}</small></form>}
 <div className="counter-grid">{([{field:"quantity",label:"現有數量"},{field:"minimum",label:"安全庫存"}] as const).map(({field,label})=><div className="count-block" key={field}><small>{label}</small><div className="counter-line"><span className="qty">{field==="quantity"&&!i.tracked?"—":i[field]}</span><span>{i.unit}</span><div className="stepper"><button disabled={disabled} aria-label={"減少 "+i.name+" "+label} onClick={()=>update(i,{[field]:Math.max(0,i[field]-1)})}>−</button><button disabled={disabled} aria-label={"增加 "+i.name+" "+label} onClick={()=>update(i,{[field]:i[field]+1})}>＋</button></div></div></div>)}</div>
 </article>
}
