
import {inventoryFetch} from "@/lib/pages-api";
import {useEffect,useMemo,useRef,useState} from "react";
import {AlertTriangle,Bell,Box,ChevronRight,Fish,Minus,PackageCheck,Plus,Snowflake,Warehouse} from "lucide-react";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from "@/components/ui/sheet";

import StorageMap,{locations} from "@/components/storage-map";
import PhotoOrganizer from "@/components/photo-organizer";
import type {Item} from "@/lib/storage-photos";
const zones=[...locations.map(z=>({...z,temp:"",note:z.note})),{id:"unassigned",name:"待分配商品",note:"保留原商品與盤點資料，請指定實際儲位",temp:""}];
const locationOf=(id:string)=>locations.some(z=>z.id===id)?id:"unassigned";
const rows:{zone:string;category:string;data:string[][]}[]=[
 {zone:"A",category:"肉類",data:[
  ["美國安格斯帶骨牛小排","300g","269"],["美國安格斯無骨牛小排","200g","319"],["美國安格斯霜降比臉大牛排","350g","269"],["西班牙伊比利松阪豬","200g","188"],["美國牛肋條","400g","280"],["台灣豬梅花捲片","1000g","355"],["牛五花捲片(大包)","1000g","399"],["牛五花捲片(小包)","500g","220"],["豬五花捲片(大包)","1000g","350"],["豬五花捲片(小包)","500g","190"],["牛板腱捲片","500g","280"],["小羔羊捲片","500g","299"],["美國安格斯骰子牛","200g","169"],["爆汁雞腿捲","350g","109"],["大成雞腿排","150g","59"],["桂花豬肋排","1000g","339"],["美國安格斯CH無骨牛小排肉片","100g","169"],["西班牙伊比利豬梅花肉片","100g","99"],["紐西蘭老饕牛舌切片","100g","129"],["日本佐賀A5和牛霜降切片","100g","179"],["豬梅花燒烤片","500g","200"],["牛五花燒烤片","500g","220"],["豬五花燒烤片","500g","200"]]},
 {zone:"B",category:"軟體類",data:[["一排小捲","300g","150"],["4A菲律賓大軟絲","300g","180"],["菲律賓大透抽","200g","165"]]},
 {zone:"B",category:"蝦類",data:[["國王大白蝦 21/25","500g","299"],["生食級赤蝦","120g","199"],["生食級甜蝦","115g","299"],["紅太陽白蝦50/60","850g","250"],["馬來西亞活凍4P大草蝦","500g","250"],["馬來西亞活凍8P大草蝦","500g","165"],["馬來西亞5P大草蝦","500g","250"],["紅太陽白蝦30/40","850g","250"],["泰蝦仁","600g","299"]]},
 {zone:"B",category:"帶殼類",data:[["櫛孔帆立貝","包冰1000g 淨重500g","280"],["北海道生食級6S干貝","500g","799"],["組合貝柱","包冰1000g 淨重500g","299"],["半殼扇貝","包冰550g 淨重300g","169"],["日本宮崎生食級生蠔(M)","80-100g","39"],["日本宮崎生食級生蠔(L)","100-150g","49"],["鮮凍大鳳螺","600g","150"],["鮮凍沙蟹腳","300g","150"],["石狩活凍大鮑魚","1000g","429"],["鮮凍小干貝","330g","159"],["沙蟹身","500g","120"],["北海道生食級4S-6S混和干貝小包裝","200g","360"]]},
 {zone:"C",category:"魚類",data:[["母蛋蛋香魚","150-200g","149"],["虱目魚里肌肉","300g","89"],["頂級挪威鮭魚菲力","貼標","貼標"],["紅釉魚片","200g","99"],["鮭魚切片","400g±5%","140"],["挪威鯖魚","含紙板170-190g","89"],["虱目魚肚","180g","125"],["鱸魚清肉片","150g","85"],["台灣五片鯛魚","450±3%","199"],["巴沙魚排","700g","120"],["白帶魚捲花","500g","139"],["三去龍虎斑","650g","299"],["扁鱈切片","250-300g","149"],["三去午仔魚","300-400g","159"],["喜知次一夜干","300g","139"],["鮭魚菲力","150g±10%","120"],["金鯧魚","600g","239"],["6兩烏魚子","225g","900"],["鳳勾翅","600g","150"],["鮭魚腹鰭","300g","95"],["鱘龍魚菲力","200g","220"],["大黑公","500-600g","99"],["山泉鱸魚蝴蝶切","300-400g","109"],["煙燻鮭魚","100g","159"],["紅條燕尾石斑","350g","299"]]},
 {zone:"E",category:"調理食品",data:[["巨無霸蟹味棒","600g","299"],["御炸蝦球","500g","270"],["尼信生魚片","170g","145"],["蝦仁漿","100g","55"],["蒜香小龍蝦","500g","299"],["麻辣小龍蝦","500g","299"],["特級花枝丸","600g","139"],["蟹味棒","270g","90"],["讚岐烏龍麵","1250g","139"],["福氣魚蛋","150g","139"],["鮮肉湯包","1.5kg","199"],["雞腿肉香腸","1000g","199"],["生食級花枝片","160g","229"],["紅龍牛肉湯","450g","79"],["蟹管肉","90g","69"],["脆皮肥腸","240g","199"],["紅龍雞塊","1kg","199"],["金園厚切排骨","200g","130"],["禾家香翡翠蔥抓餅","1.4kg(10片)","109"],["宏裕行花枝蝦餅","1片200g","139"]]},
 {zone:"D",category:"乾貨區",data:[["阿順師胡椒粉","40g","25"],["岩燒海苔 原味&梅子","27g","59"],["爭鮮玉米罐頭3罐","單罐340g","90"],["可爾必思","250ml","20"],["原翠綠茶","580ml","25"],["可樂","330ml","20"],["葵瓜子(原味)/(焦糖)","400g","130"],["泰式魚露","200ml","49"],["芒果乾","200g","90"],["茶葉禮盒","60g(10包)","159"],["杏仁牛軋糖(草莓)/(芒果)","100g","79"],["越南三合一咖啡","850g(1包50g)","180"],["咖啡糖","100g","69"]]}
];
const catalog:Item[]=rows.flatMap((g)=>g.data.map((r,index)=>({id:`${g.zone}-${g.category}-${index+1}`,zone:g.zone,category:g.category,name:r[0],spec:r[1],price:r[2],quantity:0,unit:"件",minimum:0,batch:"",tracked:false})));

export default function Home(){
 const[items,setItems]=useState<Item[]>(catalog),[selectedZone,setSelectedZone]=useState<string|null>(null),[alertsOpen,setAlertsOpen]=useState(false),[syncing,setSyncing]=useState(false),[activeCategory,setActiveCategory]=useState("全部");
 useEffect(()=>{inventoryFetch("/api/inventory").then(r=>{if(!r.ok)throw new Error();return r.json() as Promise<{items:Item[];unavailable?:boolean}>}).then(d=>{if(d?.unavailable)throw new Error();setLoaded(true);if(d?.items?.length){const saved=new Map<string,Item>(d.items.map((i:Item)=>[i.id,i]));setItems(catalog.map(i=>saved.has(i.id)?{...i,...saved.get(i.id)}:i))}}).catch(()=>setError("無法讀取已儲存資料，請重新整理後再操作。"))},[]);
 const lowItems=useMemo(()=>items.filter(i=>i.tracked&&i.minimum>0&&i.quantity<=i.minimum),[items]);
 const zoneAll=selectedZone?items.filter(i=>locationOf(i.zone)===selectedZone):[];
 const categories=["全部",...Array.from(new Set(zoneAll.map(i=>i.category)))];
 const zoneItems=activeCategory==="全部"?zoneAll:zoneAll.filter(i=>i.category===activeCategory);
 const selected=zones.find(z=>z.id===selectedZone),trackedCount=items.filter(i=>i.tracked).length;
 const [error,setError]=useState(""),[loaded,setLoaded]=useState(false);
 const saving=useRef(false);
 async function update(item:Item,changes:Partial<Item>){
  if(saving.current)return false;
  const next={...item,...changes,tracked:changes.quantity!==undefined?true:item.tracked};
  saving.current=true;setSyncing(true);setError("");
  try{const res=await inventoryFetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...next,expectedQuantity:item.quantity})});if(res.status===409){setError("庫存已被其他裝置或訂單更動，請重新整理後再調整。");return false}if(!res.ok)throw new Error();setItems(c=>c.map(r=>r.id===item.id?next:r));return true}
  catch{setError("儲存失敗，資料尚未更動，請再試一次。");return false}
  finally{saving.current=false;setSyncing(false)}
 }

 function openZone(id:string){setSelectedZone(locationOf(id));setActiveCategory("全部")}
 useEffect(()=>{const mc=(document as Document&{modelContext?:{registerTool?:(tool:unknown,options?:unknown)=>void}}).modelContext;if(!mc?.registerTool)return;const lifecycle=new AbortController();mc.registerTool({name:"list_low_stock",title:"查看低庫存",description:"列出已盤點且低於安全庫存量的商品",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({items:lowItems.map(({name,quantity,unit,minimum,zone,price})=>({name,quantity,unit,minimum,zone,price}))})},{signal:lifecycle.signal});return()=>lifecycle.abort()},[lowItems]);
 return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><Fish size={24}/></span><div><strong>鮮庫</strong><span>安星水產庫存地圖</span></div></div><div className="top-actions"><span className="sync-state"><i className={syncing?"pulse":"dot"}/>{syncing?"儲存中":error?"請檢查資料":loaded?"資料已載入":"讀取中"}</span><button className="alert-button" onClick={()=>setAlertsOpen(true)} aria-label={`低庫存通知，共 ${lowItems.length} 筆`}><Bell size={20}/><b>{lowItems.length}</b></button><div className="avatar">安</div></div></header>
 {error&&<p className="save-error" role="alert">{error}</p>}<section className="workspace"><div className="map-column"><div className="section-heading"><div><p>安星水產店內現貨區</p><h1>點選儲位，查看庫存</h1></div><div className="legend"><span><i className="safe"/>已盤點</span><span><i className="warning"/>需要補貨</span></div></div><StorageMap items={items} onOpen={openZone}/><button className="unassigned-button" onClick={()=>openZone("unassigned")}>待分配商品 · {items.filter(i=>locationOf(i.zone)==="unassigned").length} 項　→</button><p className="map-caption">原 A～E 分類不代表實際櫃位；商品數量保留，儲位請自行確認分配。</p></div>
 <aside className="side-panel"><div className="side-title"><div><p>補貨提醒</p><h2>{lowItems.length} 項需要處理</h2></div><button onClick={()=>setAlertsOpen(true)}>查看全部</button></div>{lowItems.length?<div className="alert-list">{lowItems.slice(0,4).map(i=><button key={i.id} className="alert-card" onClick={()=>openZone(i.zone)}><span className="mini-zone">{i.zone}</span><span><strong>{i.name}</strong><small>剩 {i.quantity} 件 · 安全量 {i.minimum}</small></span><ChevronRight size={18}/></button>)}</div>:<div className="empty-alert">完成盤點並設定安全量後，低庫存商品會顯示在這裡。</div>}<div className="summary-card"><span><Box size={22}/></span><div><small>現貨品項</small><strong>{items.length}</strong></div><div><small>已盤點</small><strong>{trackedCount}</strong></div></div><p className="updated">商品資料參考：安星水產店內現貨區</p></aside></section>
 <Sheet open={!!selectedZone} onOpenChange={o=>!o&&setSelectedZone(null)}><SheetContent className="inventory-sheet photo-sheet"><SheetHeader className="sheet-head"><div className="sheet-badge">{selectedZone}</div><div><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>照片分類與庫存整理 · {selected?.note}</SheetDescription></div></SheetHeader>{selectedZone&&<PhotoOrganizer key={selectedZone} zone={selectedZone} items={items} disabled={syncing||!loaded} error={error} update={update}/>}</SheetContent></Sheet>
 <Sheet open={alertsOpen} onOpenChange={setAlertsOpen}><SheetContent className="inventory-sheet sm:max-w-[480px]"><SheetHeader className="sheet-head"><div className="sheet-badge alert"><Bell size={20}/></div><div><SheetTitle>低庫存通知</SheetTitle><SheetDescription>已盤點商品低於安全庫存時會出現在這裡</SheetDescription></div></SheetHeader><div className="inventory-list">{lowItems.length?lowItems.map(i=><button className="notice-row" key={i.id} onClick={()=>{setAlertsOpen(false);openZone(i.zone)}}><span className="notice-icon"><AlertTriangle size={18}/></span><span><strong>{i.name}</strong><small>{zones.find(z=>z.id===locationOf(i.zone))?.name} · 剩 {i.quantity} 件</small></span><ChevronRight size={18}/></button>):<div className="empty-alert">目前沒有低庫存提醒。</div>}</div></SheetContent></Sheet></main>}
