// 漫畫店面圖上的點選熱區（座標沿用交接示範 comic.js，圖片 1536×1024 座標系，等比縮放）
export const LIVE=["t1","t4","t7"];
export const HOTSPOTS:[string,string,string][]=[
 // 商品櫃與魚缸僅作場景展示；購物入口統一回到下單頁。
 ["order","返回下單頁（逛進冰箱／挑選活鮮）","29,178 199,178 199,281 29,281"],
 ["game","釣蝦挑戰","29,282 199,282 199,322 29,322"],
 ["game","樂甜釣蝦場","1077,196 1478,275 1530,423 1377,545 1024,359"],
 ["order","返回下單頁（櫃台）","1260,588 1536,662 1536,848 1194,848 1177,705"],
 ["order","返回下單頁（購物籃）","1280,12 1525,12 1525,80 1280,80"],
 // 圖片下方的選單列（店面／活鮮／釣蝦／結帳）
 ["order","返回下單頁（逛店）","390,852 590,852 590,970 390,970"],
 ["order","返回下單頁（活鮮）","591,852 801,852 801,970 591,970"],
 ["game","釣蝦","803,852 987,852 987,970 803,970"],
 ["order","返回下單頁（結帳）","989,852 1149,852 1149,970 989,970"],
];
import {useEffect,useRef} from "react";
type Props={onOrder:()=>void;onGame:()=>void;subtitle:string};
export default function ShopMap({onOrder,onGame,subtitle}:Props){
 const run=(id:string)=>id==="game"?onGame():onOrder();
 const sc=useRef<HTMLDivElement>(null);
 // 手機直式：圖片撐滿螢幕高度，左右滑動；一開始置中
 const center=()=>{const e=sc.current;if(e)e.scrollLeft=(e.scrollWidth-e.clientWidth)/2};
 useEffect(()=>{center();const ro=new ResizeObserver(center);if(sc.current)ro.observe(sc.current);return()=>ro.disconnect()},[]);
 const pan=(d:number)=>sc.current?.scrollBy({left:d*sc.current.clientWidth*.6,behavior:"smooth"});
 return <section className="fullmap">
  <div className="fullmap-scroll" ref={sc}>
   <header className="comic-hero shop-map">
    <img src={import.meta.env.BASE_URL+"comic/comic-market-cats-clean.webp?v=1"} alt="安星水產店面，米色藍眼與黑色黃綠眼的兩位貓咪女店員為您服務" width={1536} height={1024} decoding="async" fetchPriority="high"/>
    <svg viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-label="玩釣蝦遊戲或返回下單頁" role="group">
     {HOTSPOTS.map(([id,name,pts],k)=>{
      return <g key={k} className={"hot hot-"+id} role="button" tabIndex={0} aria-label={name}
       onClick={()=>run(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run(id)}}}><title>{name}</title><polygon points={pts}/></g>})}
    </svg>
   </header>
  </div>
  <div className="fullmap-title"><h1>安星水產</h1><p>{subtitle}</p></div>
  <span className="map-pin" aria-hidden>🦐 點釣蝦池玩遊戲</span>
  <button className="pan pan-l" aria-label="往左看" onClick={()=>pan(-1)}>‹</button><button className="pan pan-r" aria-label="往右看" onClick={()=>pan(1)}>›</button>
  <button className="fullmap-down" onClick={onOrder}>返回下單頁</button>
 </section>;
}
