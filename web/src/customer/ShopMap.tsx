// 漫畫店面圖上的點選熱區（座標沿用交接示範 comic.js，圖片 1536×1024 座標系，等比縮放）
export const LIVE=["t1","t4","t7"];
export const HOTSPOTS:[string,string,string][]=[
 ["game","樂甜釣蝦場","1077,196 1478,275 1530,423 1377,545 1024,359"],
];
import {useEffect,useRef} from "react";
import {Store,Shrimp} from "lucide-react";
type Props={onOrder:()=>void;onGame:()=>void;subtitle:string};
export default function ShopMap({onOrder,onGame,subtitle}:Props){
 const sc=useRef<HTMLDivElement>(null);
 // 手機直式：圖片撐滿螢幕高度，左右滑動；一開始置中
 const center=()=>{const e=sc.current;if(e)e.scrollLeft=(e.scrollWidth-e.clientWidth)/2};
 useEffect(()=>{center();const ro=new ResizeObserver(center);if(sc.current)ro.observe(sc.current);return()=>ro.disconnect()},[]);
 const pan=(d:number)=>sc.current?.scrollBy({left:d*sc.current.clientWidth*.6,behavior:"smooth"});
 return <section className="fullmap">
  <div className="fullmap-scroll" ref={sc}>
   <header className="comic-hero shop-map">
    <img src={import.meta.env.BASE_URL+"comic/comic-market-games.webp?v=1"} alt="安星水產店面，米色藍眼與黑色黃綠眼的兩位貓咪女店員為您服務" width={1536} height={1024} decoding="async" fetchPriority="high"/>
    <svg viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-label="點釣蝦池玩遊戲" role="group">
     {HOTSPOTS.map(([id,name,pts],k)=>{
      return <g key={k} className={"hot hot-"+id} role="button" tabIndex={0} aria-label={name}
       onClick={onGame} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onGame()}}}><title>{name}</title><polygon points={pts}/></g>})}
    </svg>
   </header>
  </div>
  <div className="fullmap-title"><h1>安星水產</h1><p>{subtitle}</p></div>
  <span className="map-pin" aria-hidden>🦐 點釣蝦池玩遊戲</span>
  <button className="pan pan-l" aria-label="往左看" onClick={()=>pan(-1)}>‹</button><button className="pan pan-r" aria-label="往右看" onClick={()=>pan(1)}>›</button>
  <nav className="map-actions" aria-label="遊戲頁選單">
   <button type="button" onClick={onOrder}><Store aria-hidden/><span>回去逛店</span></button>
   <button type="button" onClick={onGame}><Shrimp aria-hidden/><span>樂甜釣蝦</span></button>
  </nav>
 </section>;
}
