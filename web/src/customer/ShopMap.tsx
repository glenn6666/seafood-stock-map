// 漫畫店面圖上的點選熱區（座標沿用交接示範 comic.js，圖片 1536×1024 座標系，等比縮放）
export const LIVE=["t1","t4","t7"];
export const HOTSPOTS:[string,string,string][]=[
 ["f1","冷藏冰箱 1","437,145 624,144 629,330 442,372"],
 ["f2","冷藏冰箱 2","631,137 779,117 795,309 636,330"],
 ["f3","冷藏冰箱 3","788,105 916,88 936,289 802,313"],
 ["c1","中央冰櫃 1","577,340 751,360 678,550 523,509"],
 ["c2","中央冰櫃 2","772,377 944,412 895,618 694,571"],
 ["c3","中央冰櫃 3","981,414 1163,471 1082,709 889,636"],
 ["t1","低溫缸","223,214 351,252 365,366 15,428 0,342 222,323"],
 ["t4","泰國蝦缸","22,429 365,370 400,524 28,650 0,596"],
 ["t7","常溫缸","18,650 401,536 513,735 111,853 0,771"],
 ["s7","乾貨區","627,611 963,725 1070,849 557,849 531,742"],
 ["game","樂湉釣蝦場","1077,196 1478,275 1530,423 1377,545 1024,359"],
 ["counter","櫃台結帳","1260,588 1536,662 1536,848 1194,848 1177,705"],
 // 圖片下方的選單列（店面／活鮮／釣蝦／結帳）
 ["all","店面（全部商品）","390,852 590,852 590,970 390,970"],
 ["live","活鮮（三個魚缸）","591,852 801,852 801,970 591,970"],
 ["game","釣蝦","803,852 987,852 987,970 803,970"],
 ["counter","結帳","989,852 1149,852 1149,970 989,970"],
];
type Props={names:Record<string,string>;counts:Record<string,number>;active:string|null;onZone:(id:string)=>void;onGame:()=>void;onCounter:()=>void;subtitle:string};
export default function ShopMap({names,counts,active,onZone,onGame,onCounter,subtitle}:Props){
 const run=(id:string)=>id==="game"?onGame():id==="counter"?onCounter():onZone(id);
 return <header className="comic-hero shop-map">
  <img src={import.meta.env.BASE_URL+"comic/comic-market.webp"} alt="安星水產店面" width={1080} height={720} decoding="async"/>
  <svg viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-label="點店面圖選分類或玩釣蝦" role="group">
   {HOTSPOTS.map(([id,fallback,pts],k)=>{const name=k>=12||id==="game"||id==="counter"?fallback:(names[id]??fallback);const n=counts[id];
    return <g key={k} className={(k>=12?"hot-menu ":"")+"hot hot-"+id+((active===id||(active==="live"&&LIVE.includes(id)))&&k<12?" on":"")+(n===0?" empty":"")} role="button" tabIndex={0} aria-label={name+(n!=null?`（${n} 項）`:"")} aria-pressed={active===id}
     onClick={()=>run(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run(id)}}}><title>{name}</title><polygon points={pts}/></g>})}
  </svg>
  <span className="map-pin" aria-hidden>🦐 點右上釣蝦池玩遊戲</span>
  <div><h1>安星水產</h1><p>{subtitle}</p></div>
 </header>;
}
