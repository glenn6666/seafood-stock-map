
import {inventoryFetch} from "@/lib/pages-api";
import {useEffect,useMemo,useRef,useState} from "react";
import {AlertTriangle,Bell,Box,ChevronRight,Fish,Minus,PackageCheck,Plus,Snowflake,Warehouse} from "lucide-react";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from "@/components/ui/sheet";

import StorageMap,{locations} from "@/components/storage-map";
import PhotoOrganizer from "@/components/photo-organizer";
import type {Item} from "@/lib/storage-photos";
import {catalog} from "@/lib/catalog";
import ConflictDialog,{type Conflict} from "@/components/conflict-dialog";
const zones=[...locations.map(z=>({...z,temp:"",note:z.note})),{id:"unassigned",name:"待分配商品",note:"保留原商品與盤點資料，請指定實際儲位",temp:""}];
const locationOf=(id:string)=>locations.some(z=>z.id===id)?id:"unassigned";

export default function Home(){
 const[items,setItems]=useState<Item[]>(catalog),[selectedZone,setSelectedZone]=useState<string|null>(null),[alertsOpen,setAlertsOpen]=useState(false),[syncing,setSyncing]=useState(false),[activeCategory,setActiveCategory]=useState("全部");
 useEffect(()=>{inventoryFetch("/api/inventory").then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<{items:Item[];unavailable?:boolean}>}).then(d=>{if(d?.unavailable)throw new Error();setLoaded(true);if(d?.items?.length){const saved=new Map<string,Item>(d.items.map((i:Item)=>[i.id,i]));setItems(catalog.map(i=>saved.has(i.id)?{...i,...saved.get(i.id)}:i))}}).catch(()=>setError("無法讀取已儲存資料，請重新整理後再操作。"))},[]);
 const lowItems=useMemo(()=>items.filter(i=>i.tracked&&i.minimum>0&&i.quantity<=i.minimum),[items]);
 const zoneAll=selectedZone?items.filter(i=>locationOf(i.zone)===selectedZone):[];
 const categories=["全部",...Array.from(new Set(zoneAll.map(i=>i.category)))];
 const zoneItems=activeCategory==="全部"?zoneAll:zoneAll.filter(i=>i.category===activeCategory);
 const selected=zones.find(z=>z.id===selectedZone),trackedCount=items.filter(i=>i.tracked).length;
 const [error,setError]=useState(""),[loaded,setLoaded]=useState(false);
 const saving=useRef(false),itemsRef=useRef(items);itemsRef.current=items;
 const [conflict,setConflict]=useState<Conflict|null>(null);
 async function fetchMerged(){const r=await inventoryFetch("/api/inventory");if(!r.ok)throw new Error();const d=await r.json() as {items:Item[]};const saved=new Map<string,Item>(d.items.map(i=>[i.id,i]));return catalog.map(i=>saved.has(i.id)?{...i,...saved.get(i.id)}:i)}
 async function update(item:Item,changes:Partial<Item>){
  if(saving.current)return false;
  const next={...item,...changes,tracked:changes.quantity!==undefined?true:item.tracked};
  saving.current=true;setSyncing(true);setError("");
  try{const res=await inventoryFetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...next,expectedQuantity:item.quantity})});if(res.status===409){
   // 版本衝突：不覆蓋。取回最新數量，列出變動項目，讓使用者確認後再存。
   const before=itemsRef.current,merged=await fetchMerged(),old=new Map(before.map(i=>[i.id,i]));
   const diffs=merged.filter(i=>old.has(i.id)&&old.get(i.id)!.quantity!==i.quantity).map(i=>({id:i.id,name:i.name,spec:i.spec,unit:i.unit,old:old.get(i.id)!.quantity,now:i.quantity}));
   setItems(merged);setConflict({item,changes,latest:merged.find(i=>i.id===item.id)??item,diffs});
   setError("庫存已被其他裝置或訂單更動，已載入最新數量，請確認後再儲存。");return false}if(!res.ok)throw new Error();setItems(c=>c.map(r=>r.id===item.id?next:r));return true}
  catch{setError("儲存失敗，資料尚未更動，請再試一次。");return false}
  finally{saving.current=false;setSyncing(false)}
 }

 function openZone(id:string){setSelectedZone(locationOf(id));setActiveCategory("全部")}
 useEffect(()=>{const mc=(document as Document&{modelContext?:{registerTool?:(tool:unknown,options?:unknown)=>void}}).modelContext;if(!mc?.registerTool)return;const lifecycle=new AbortController();mc.registerTool({name:"list_low_stock",title:"查看低庫存",description:"列出已盤點且低於安全庫存量的商品",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({items:lowItems.map(({name,quantity,unit,minimum,zone,price})=>({name,quantity,unit,minimum,zone,price}))})},{signal:lifecycle.signal});return()=>lifecycle.abort()},[lowItems]);
 return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><Fish size={24}/></span><div><strong>鮮庫</strong><span>安星水產庫存地圖</span></div></div><div className="top-actions"><span className="sync-state"><i className={syncing?"pulse":"dot"}/>{syncing?"儲存中":error?"請檢查資料":loaded?"資料已載入":"讀取中"}</span><button className="alert-button" onClick={()=>setAlertsOpen(true)} aria-label={`低庫存通知，共 ${lowItems.length} 筆`}><Bell size={20}/><b>{lowItems.length}</b></button><div className="avatar">安</div></div></header>
 {error&&<p className="save-error" role="alert">{error}</p>}<section className="workspace"><div className="map-column"><div className="section-heading"><div><p>安星水產店內現貨區</p><h1>點選儲位，查看庫存</h1></div><div className="legend"><span><i className="safe"/>已盤點</span><span><i className="warning"/>需要補貨</span></div></div><StorageMap items={items} onOpen={openZone}/><button className="unassigned-button" onClick={()=>openZone("unassigned")}>待分配商品 · {items.filter(i=>locationOf(i.zone)==="unassigned").length} 項　→</button><p className="map-caption">原 A～E 分類不代表實際櫃位；商品數量保留，儲位請自行確認分配。</p></div>
 <aside className="side-panel"><div className="side-title"><div><p>補貨提醒</p><h2>{lowItems.length} 項需要處理</h2></div><button onClick={()=>setAlertsOpen(true)}>查看全部</button></div>{lowItems.length?<div className="alert-list">{lowItems.slice(0,4).map(i=><button key={i.id} className="alert-card" onClick={()=>openZone(i.zone)}><span className="mini-zone">{i.zone}</span><span><strong>{i.name}</strong><small>剩 {i.quantity} 件 · 安全量 {i.minimum}</small></span><ChevronRight size={18}/></button>)}</div>:<div className="empty-alert">完成盤點並設定安全量後，低庫存商品會顯示在這裡。</div>}<div className="summary-card"><span><Box size={22}/></span><div><small>現貨品項</small><strong>{items.length}</strong></div><div><small>已盤點</small><strong>{trackedCount}</strong></div></div><p className="updated">商品資料參考：安星水產店內現貨區</p></aside></section>
 <Sheet open={!!selectedZone} onOpenChange={o=>!o&&setSelectedZone(null)}><SheetContent className="inventory-sheet photo-sheet"><SheetHeader className="sheet-head"><div className="sheet-badge">{selectedZone}</div><div><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>照片分類與庫存整理 · {selected?.note}</SheetDescription></div></SheetHeader>{selectedZone&&<PhotoOrganizer key={selectedZone} zone={selectedZone} items={items} disabled={syncing||!loaded} error={error} update={update}/>}</SheetContent></Sheet>
 <Sheet open={alertsOpen} onOpenChange={setAlertsOpen}><SheetContent className="inventory-sheet sm:max-w-[480px]"><SheetHeader className="sheet-head"><div className="sheet-badge alert"><Bell size={20}/></div><div><SheetTitle>低庫存通知</SheetTitle><SheetDescription>已盤點商品低於安全庫存時會出現在這裡</SheetDescription></div></SheetHeader><div className="inventory-list">{lowItems.length?lowItems.map(i=><button className="notice-row" key={i.id} onClick={()=>{setAlertsOpen(false);openZone(i.zone)}}><span className="notice-icon"><AlertTriangle size={18}/></span><span><strong>{i.name}</strong><small>{zones.find(z=>z.id===locationOf(i.zone))?.name} · 剩 {i.quantity} 件</small></span><ChevronRight size={18}/></button>):<div className="empty-alert">目前沒有低庫存提醒。</div>}</div></SheetContent></Sheet><ConflictDialog conflict={conflict} onClose={()=>setConflict(null)} onResave={async(base,ch)=>{setConflict(null);return update(base,ch)}}/></main>}
