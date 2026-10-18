"use client";
import {useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";

const MAP_WIDTH=608, MAP_HEIGHT=1004/1567*MAP_WIDTH;
const imageScale=MAP_WIDTH/1567;
export const locations = [
 {id:"01",note:"左上長櫃",x:68,y:138,w:634,h:127},
 {id:"02",note:"上方中央",x:710,y:90,w:244,h:106},
 {id:"03",note:"右上區",x:996,y:4,w:290,h:191},
 {id:"04",note:"中央島櫃",x:409,y:403,w:349,h:181},
 {id:"05",note:"右側中段",x:1109,y:452,w:142,h:111},
 {id:"06",note:"左下區",x:132,y:620,w:334,h:232},
 {id:"07",note:"下方中央",x:654,y:826,w:276,h:144},
 {id:"08",note:"右下區",x:1012,y:615,w:276,h:293},
 {id:"09",note:"最右側小區",x:1380,y:494,w:125,h:118}
].map(z=>({...z,x:z.x*imageScale,y:z.y*imageScale,w:z.w*imageScale,h:z.h*imageScale,name:`儲位 ${z.id}`}));
type Stock={zone:string;tracked:boolean;quantity:number;minimum:number};
type View={x:number;y:number;k:number};
export default function StorageMap({items,onOpen}:{items:Stock[];onOpen:(id:string)=>void}){
 const svg=useRef<SVGSVGElement>(null),view=useRef<View>({x:0,y:0,k:1});
 const [v,setV]=useState(view.current);
 const points=useRef(new Map<number,{x:number;y:number}>()),moved=useRef(false),travel=useRef(0);
 function apply(n:View){const k=Math.max(1,Math.min(4,n.k));const next={k,x:Math.max(MAP_WIDTH-MAP_WIDTH*k,Math.min(0,n.x)),y:Math.max(MAP_HEIGHT-MAP_HEIGHT*k,Math.min(0,n.y))};view.current=next;setV(next)}
 function local(x:number,y:number){const p=svg.current!.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(svg.current!.getScreenCTM()!.inverse())}
 function zoom(f:number,p={x:MAP_WIDTH/2,y:MAP_HEIGHT/2}){const old=view.current,k=Math.max(1,Math.min(4,old.k*f)),ratio=k/old.k;apply({k,x:p.x-(p.x-old.x)*ratio,y:p.y-(p.y-old.y)*ratio})}
 useEffect(()=>{const el=svg.current!;const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.002),local(e.clientX,e.clientY))};el.addEventListener("wheel",wheel,{passive:false});return()=>el.removeEventListener("wheel",wheel)},[]);
 function down(e:ReactPointerEvent<SVGSVGElement>){if(e.pointerType==="mouse"&&e.button!==0)return;if(!points.current.size){moved.current=false;travel.current=0}points.current.set(e.pointerId,local(e.clientX,e.clientY));if(points.current.size>1)moved.current=true;e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e:ReactPointerEvent<SVGSVGElement>){if(!points.current.has(e.pointerId))return;const before=Array.from(points.current.values());const prior=points.current.get(e.pointerId)!;const p=local(e.clientX,e.clientY);points.current.set(e.pointerId,p);travel.current+=Math.hypot(p.x-prior.x,p.y-prior.y);if(travel.current>4)moved.current=true;const after=Array.from(points.current.values());const old=view.current;if(after.length>=2){const a={x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2},b={x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2};const d=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),nd=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y),k=Math.max(1,Math.min(4,old.k*nd/Math.max(d,1)));apply({k,x:b.x-(a.x-old.x)*k/old.k,y:b.y-(a.y-old.y)*k/old.k})}else apply({...old,x:old.x+p.x-prior.x,y:old.y+p.y-prior.y})}
 function end(e:ReactPointerEvent<SVGSVGElement>){if(!points.current.has(e.pointerId))return;const tap=!moved.current&&points.current.size===1&&e.type==="pointerup";const p=local(e.clientX,e.clientY);points.current.delete(e.pointerId);if(tap){const q={x:(p.x-view.current.x)/view.current.k,y:(p.y-view.current.y)/view.current.k};const hit=locations.find(z=>q.x>=z.x&&q.x<=z.x+z.w&&q.y>=z.y&&q.y<=z.y+z.h);if(hit)onOpen(hit.id)}}
 return <div className="map-widget">
 <div className="map-tools" aria-label="地圖縮放"><span>拖曳移動 · 滾輪／雙指縮放</span><button disabled={v.k<=1} onClick={()=>zoom(1/1.25)} aria-label="縮小地圖">−</button><output>{Math.round(v.k*100)}%</output><button disabled={v.k>=4} onClick={()=>zoom(1.25)} aria-label="放大地圖">＋</button><button onClick={()=>apply({x:0,y:0,k:1})}>重設視角</button></div>
 <svg ref={svg} className="interactive-map" style={{aspectRatio:"1567 / 1004"}} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-label="九個儲位的互動平面圖" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={e=>points.current.delete(e.pointerId)}>
 <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
 <image href="/seafood-stock-map/store-floorplan.webp" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="xMidYMid meet"/>
 {locations.map(z=>{const stock=items.filter(i=>i.zone===z.id),low=stock.filter(i=>i.tracked&&i.minimum>0&&i.quantity<=i.minimum).length,pending=stock.some(i=>!i.tracked),state=low?"low":stock.length&&!pending?"ready":"pending";return <g key={z.id} role="button" tabIndex={0} aria-label={`${z.name}，${z.note}，${stock.length} 個品項${low?`，${low} 項不足`:""}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onOpen(z.id)}}} className={`map-region ${state}`}>
 <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="3"/>
 <rect className="region-label" x={z.x+3} y={z.y+3} width="36" height="25" rx="5"/><text x={z.x+21} y={z.y+20} textAnchor="middle">{z.id}</text>
 {low>0&&<><circle cx={z.x+z.w-11} cy={z.y+12} r="12" fill="#d53d28"/><text x={z.x+z.w-11} y={z.y+17} textAnchor="middle">{low}</text></>}
 </g>})}
 </g></svg>
 <div className="storage-shortcuts">{locations.map(z=><button key={z.id} onClick={()=>onOpen(z.id)}><b>{z.id}</b> {z.note}</button>)}</div>
 <p className="map-caption">原始平面圖 · {locations.length} 個儲位；灰框待分配／待盤點、綠框已盤點、紅框需補貨。</p>
 </div>
}
